import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { updateQuestionBankSchema } from "@/lib/validation/question-bank";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const questionBank = await prisma.questionBank.findUnique({
      where: { id },
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            major: true,
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
          include: {
            versions: {
              where: { isCurrent: true },
              include: { options: { orderBy: { sortOrder: "asc" } } },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!questionBank) {
      return NextResponse.json({ error: "Bank Soal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(questionBank);
  } catch (error: any) {
    console.error("GET /api/question-banks/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal memuat detail bank soal", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await req.json();

    const parseResult = updateQuestionBankSchema.safeParse(body);
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

    if (data.code) {
      const existing = await prisma.questionBank.findFirst({
        where: {
          code: data.code.toUpperCase().trim(),
          NOT: { id },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Kode Bank Soal '${data.code}' sudah digunakan pada bank soal lain.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.questionBank.update({
      where: { id },
      data: {
        ...(data.code ? { code: data.code.toUpperCase().trim() } : {}),
        ...(data.title ? { title: data.title.trim() } : {}),
        ...(data.subjectId ? { subjectId: data.subjectId } : {}),
        ...(data.gradeLevel !== undefined ? { gradeLevel: data.gradeLevel } : {}),
        ...(data.teacherId !== undefined ? { teacherId: data.teacherId || null } : {}),
        ...(data.totalQuestions !== undefined ? { totalQuestions: data.totalQuestions } : {}),
        ...(data.singleChoiceCount !== undefined ? { singleChoiceCount: data.singleChoiceCount } : {}),
        ...(data.singleChoiceWeight !== undefined ? { singleChoiceWeight: data.singleChoiceWeight } : {}),
        ...(data.complexMultipleChoiceCount !== undefined ? { complexMultipleChoiceCount: data.complexMultipleChoiceCount } : {}),
        ...(data.complexMultipleChoiceWeight !== undefined ? { complexMultipleChoiceWeight: data.complexMultipleChoiceWeight } : {}),
        ...(data.trueFalseCount !== undefined ? { trueFalseCount: data.trueFalseCount } : {}),
        ...(data.trueFalseWeight !== undefined ? { trueFalseWeight: data.trueFalseWeight } : {}),
        ...(data.shortAnswerCount !== undefined ? { shortAnswerCount: data.shortAnswerCount } : {}),
        ...(data.shortAnswerWeight !== undefined ? { shortAnswerWeight: data.shortAnswerWeight } : {}),
        ...(data.essayCount !== undefined ? { essayCount: data.essayCount } : {}),
        ...(data.essayWeight !== undefined ? { essayWeight: data.essayWeight } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
      include: {
        subject: true,
        teacher: { select: { id: true, displayName: true, nip: true, username: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT /api/question-banks/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui bank soal", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    await prisma.questionBank.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Bank soal berhasil dihapus" });
  } catch (error: any) {
    console.error("DELETE /api/question-banks/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus bank soal", details: error.message },
      { status: 500 }
    );
  }
}
