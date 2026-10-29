import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { createQuestionBankSchema } from "@/lib/validation/question-bank";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get("subjectId");
    const gradeLevel = searchParams.get("gradeLevel");
    const teacherId = searchParams.get("teacherId");
    const search = searchParams.get("search");

    const isTeacher = session.user.roles.includes("teacher") && !session.user.roles.includes("administrator");

    const where: any = {};

    if (subjectId) {
      where.subjectId = subjectId;
    }
    if (gradeLevel) {
      where.gradeLevel = parseInt(gradeLevel, 10);
    }
    if (teacherId) {
      where.teacherId = teacherId;
    } else if (isTeacher && !subjectId) {
      // If teacher is logged in without specific query, show banks they teach or created, or open to their subjects
      where.OR = [
        { teacherId: session.user.id },
        { createdById: session.user.id },
      ];
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ];
    }

    const questionBanks = await prisma.questionBank.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            major: { select: { id: true, code: true, name: true } },
          },
        },
        teacher: {
          select: {
            id: true,
            username: true,
            displayName: true,
            nip: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
        questions: {
          where: {
            archivedAt: null,
          },
          select: {
            id: true,
            type: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    // Augment with real-time created questions count by type
    const result = questionBanks.map((qb) => {
      const typeCounts: Record<string, number> = {
        single_choice: 0,
        multi_select: 0,
        true_false: 0,
        short_answer: 0,
        essay: 0,
      };

      qb.questions.forEach((q) => {
        if (typeCounts[q.type] !== undefined) {
          typeCounts[q.type]++;
        }
      });

      return {
        ...qb,
        actualQuestionsCount: qb.questions.length,
        actualTypeCounts: typeCounts,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/question-banks error:", error);
    return NextResponse.json(
      { error: "Gagal memuat daftar bank soal", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPermission =
      session.user.roles.includes("administrator") || session.user.roles.includes("teacher");

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden: Akses ditolak" }, { status: 403 });
    }

    const body = await req.json();

    // If teacher creates it and no teacherId provided, assign self
    if (session.user.roles.includes("teacher") && !body.teacherId) {
      body.teacherId = session.user.id;
    }

    const parseResult = createQuestionBankSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validasi gagal",
          details: parseResult.error.flatten().fieldErrors,
          message: parseResult.error.issues[0]?.message || "Data input tidak valid",
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Check code uniqueness
    const existing = await prisma.questionBank.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Kode Bank Soal '${data.code}' sudah digunakan. Silakan gunakan kode lain.` },
        { status: 409 }
      );
    }

    const questionBank = await prisma.questionBank.create({
      data: {
        code: data.code.toUpperCase().trim(),
        title: data.title.trim(),
        subjectId: data.subjectId,
        gradeLevel: data.gradeLevel,
        teacherId: data.teacherId || null,
        totalQuestions: data.totalQuestions,
        singleChoiceCount: data.singleChoiceCount,
        singleChoiceWeight: data.singleChoiceWeight,
        complexMultipleChoiceCount: data.complexMultipleChoiceCount,
        complexMultipleChoiceWeight: data.complexMultipleChoiceWeight,
        trueFalseCount: data.trueFalseCount,
        trueFalseWeight: data.trueFalseWeight,
        shortAnswerCount: data.shortAnswerCount,
        shortAnswerWeight: data.shortAnswerWeight,
        essayCount: data.essayCount,
        essayWeight: data.essayWeight,
        status: data.status,
        createdById: session.user.id,
      },
      include: {
        subject: true,
        teacher: { select: { id: true, displayName: true, nip: true, username: true } },
      },
    });

    return NextResponse.json(questionBank, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/question-banks error:", error);
    return NextResponse.json(
      { error: "Gagal membuat bank soal", details: error.message },
      { status: 500 }
    );
  }
}
