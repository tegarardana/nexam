import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

interface ImportOptionPayload {
  label?: string;
  text: string;
  imageUrl?: string;
  isCorrect: boolean;
  sortOrder?: number;
}

interface ImportQuestionPayload {
  type: string;
  difficulty?: string;
  points?: number;
  text: string;
  imageUrl?: string;
  instructions?: string;
  rubric?: string;
  options?: ImportOptionPayload[];
  answerKey?: string;
  explanation?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json(
      { success: false, error: "Hanya guru atau admin yang dapat mengimpor butir soal" },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const questions: ImportQuestionPayload[] = body.questions;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Daftar butir soal yang diimpor tidak boleh kosong" },
        { status: 400 }
      );
    }

    const questionBank = await prisma.questionBank.findUnique({
      where: { id },
      include: { subject: true },
    });

    if (!questionBank) {
      return NextResponse.json(
        { success: false, error: "Bank Soal tidak ditemukan" },
        { status: 404 }
      );
    }

    // Teacher authorization check
    if (
      !session.user.roles.includes("administrator") &&
      questionBank.teacherId &&
      questionBank.teacherId !== session.user.id
    ) {
      return NextResponse.json(
        { success: false, error: "Anda tidak memiliki wewenang untuk mengimpor ke bank soal ini" },
        { status: 403 }
      );
    }

    // Process and insert questions in a transaction
    const createdQuestions = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of questions) {
        if (!item.text || !item.text.trim()) continue;

        // Normalize Question Type (supports numeric codes 1-5 and textual)
        let rawType = String(item.type || "1").toLowerCase().trim();
        let normalizedType = "single_choice";
        if (
          rawType === "1" ||
          rawType === "single_choice" ||
          rawType === "pilihan_ganda" ||
          rawType === "pg"
        ) {
          normalizedType = "single_choice";
        } else if (
          rawType === "2" ||
          rawType === "multi_select" ||
          rawType === "complex_multiple_choice" ||
          rawType === "pg_kompleks" ||
          rawType === "pilihan_ganda_kompleks"
        ) {
          normalizedType = "multi_select";
        } else if (
          rawType === "3" ||
          rawType === "true_false" ||
          rawType === "benar_salah" ||
          rawType === "bs"
        ) {
          normalizedType = "true_false";
        } else if (
          rawType === "4" ||
          rawType === "short_answer" ||
          rawType === "isian_singkat" ||
          rawType === "isian"
        ) {
          normalizedType = "short_answer";
        } else if (
          rawType === "5" ||
          rawType === "essay" ||
          rawType === "esai" ||
          rawType === "uraian"
        ) {
          normalizedType = "essay";
        }

        // Normalize Difficulty (supports numeric 1-3 or text)
        let rawDiff = String(item.difficulty || "2").toLowerCase().trim();
        let difficulty = "medium";
        if (rawDiff === "1" || rawDiff === "easy" || rawDiff === "mudah") difficulty = "easy";
        if (rawDiff === "3" || rawDiff === "hard" || rawDiff === "sulit" || rawDiff === "sukar") difficulty = "hard";

        // Points
        const points = Number(item.points) > 0 ? Number(item.points) : 1;

        // Options resolution
        let finalOptions: ImportOptionPayload[] = [];
        let gradingConfig: any = { points };

        if (normalizedType === "single_choice" || normalizedType === "multi_select") {
          if (item.options && item.options.length > 0) {
            finalOptions = item.options.map((opt, idx) => ({
              label: opt.label || String.fromCharCode(65 + idx),
              text: opt.text || "",
              imageUrl: opt.imageUrl,
              isCorrect: !!opt.isCorrect,
              sortOrder: opt.sortOrder ?? idx,
            }));
          }
        } else if (normalizedType === "true_false") {
          const isBenar =
            item.answerKey?.toLowerCase() === "benar" ||
            item.answerKey?.toLowerCase() === "true" ||
            item.answerKey?.toLowerCase() === "b";
          finalOptions = [
            { label: "Benar", text: "Benar", isCorrect: isBenar, sortOrder: 0 },
            { label: "Salah", text: "Salah", isCorrect: !isBenar, sortOrder: 1 },
          ];
        } else if (normalizedType === "short_answer") {
          gradingConfig.answerKey = item.answerKey?.trim() || "";
        } else if (normalizedType === "essay") {
          gradingConfig.rubric = item.rubric || item.answerKey || "";
        }

        // 1. Create Question
        const q = await tx.question.create({
          data: {
            subjectId: questionBank.subjectId,
            questionBankId: questionBank.id,
            type: normalizedType,
            difficulty,
            status: "published",
            createdById: session.user.id,
          },
        });

        // 2. Create Question Version
        const v = await tx.questionVersion.create({
          data: {
            questionId: q.id,
            versionNumber: 1,
            content: {
              text: item.text.trim(),
              instructions: item.instructions || undefined,
              rubric: item.rubric || undefined,
              imageUrl: item.imageUrl || undefined,
            } as any,
            gradingConfig,
            explanation: item.explanation || null,
            isCurrent: true,
            createdById: session.user.id,
          },
        });

        // 3. Create Options if available
        if (finalOptions.length > 0) {
          await tx.questionOption.createMany({
            data: finalOptions.map((opt, idx) => ({
              versionId: v.id,
              label: opt.label || String.fromCharCode(65 + idx),
              content: { text: opt.text, imageUrl: opt.imageUrl } as any,
              isCorrect: opt.isCorrect,
              sortOrder: opt.sortOrder ?? idx,
            })),
          });
        }

        results.push(q);
      }

      return results;
    });

    await logAudit({
      actorId: session.user.id,
      action: "question_bank:import_questions",
      entityType: "question_banks",
      entityId: questionBank.id,
      afterValue: {
        questionBankCode: questionBank.code,
        importedCount: createdQuestions.length,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      count: createdQuestions.length,
      message: `Berhasil mengimpor ${createdQuestions.length} butir soal ke bank soal ${questionBank.code}!`,
    });
  } catch (error: any) {
    console.error("POST /api/question-banks/[id]/import-questions error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengimpor butir soal", details: error.message },
      { status: 500 }
    );
  }
}
