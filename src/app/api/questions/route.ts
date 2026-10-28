import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { CreateQuestionSchema } from "@/lib/validation/question";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");
  const categoryId = searchParams.get("categoryId");
  const questionBankId = searchParams.get("questionBankId");
  const type = searchParams.get("type");
  const difficulty = searchParams.get("difficulty");
  const search = searchParams.get("search");

  try {
    const questions = await prisma.question.findMany({
      where: {
        archivedAt: null,
        subjectId: subjectId || undefined,
        categoryId: categoryId || undefined,
        questionBankId: questionBankId || undefined,
        type: type || undefined,
        difficulty: difficulty || undefined,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, displayName: true, username: true } },
        versions: {
          where: { isCurrent: true },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Client-side text filter if search provided
    const filtered = search
      ? questions.filter((q) => {
          const version = q.versions[0];
          const text = (version?.content as any)?.text || "";
          return text.toLowerCase().includes(search.toLowerCase());
        })
      : questions;

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    console.error("GET /api/questions error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat bank soal" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden: Hanya guru/admin yang dapat menambah butir soal" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = CreateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { subjectId, categoryId, questionBankId, type, difficulty, status, content, options, gradingConfig, explanation, points } = parsed.data;

    let targetSubjectId = subjectId || null;
    if (!targetSubjectId && questionBankId) {
      const qb = await prisma.questionBank.findUnique({
        where: { id: questionBankId },
        select: { subjectId: true },
      });
      if (qb) targetSubjectId = qb.subjectId;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Question container
      const question = await tx.question.create({
        data: {
          subjectId: targetSubjectId,
          categoryId: categoryId || null,
          questionBankId: questionBankId || null,
          type,
          difficulty,
          status,
          createdById: session.user.id,
        },
      });

      // 2. Create Initial QuestionVersion (v1)
      const version = await tx.questionVersion.create({
        data: {
          questionId: question.id,
          versionNumber: 1,
          content: content as any,
          gradingConfig: {
            points,
            ...gradingConfig,
          } as any,
          explanation: explanation || null,
          isCurrent: true,
          createdById: session.user.id,
        },
      });

      // 3. Create options if provided (e.g. single_choice, multi_select, true_false, image_based)
      if (options && options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((opt, idx) => ({
            versionId: version.id,
            label: opt.label || String.fromCharCode(65 + idx),
            content: { text: opt.text, imageUrl: opt.imageUrl } as any,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder ?? idx,
          })),
        });
      }

      return { question, version };
    });

    await logAudit({
      actorId: session.user.id,
      action: "question:create",
      entityType: "questions",
      entityId: result.question.id,
      afterValue: { question: result.question, version: result.version },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/questions error:", error);
    return NextResponse.json({ success: false, error: "Gagal membuat butir soal" }, { status: 500 });
  }
}
