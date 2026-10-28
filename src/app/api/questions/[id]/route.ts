import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { CreateQuestionSchema } from "@/lib/validation/question";
import { logAudit } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        subject: true,
        category: true,
        createdBy: { select: { id: true, displayName: true, username: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
          },
        },
        media: true,
      },
    });

    if (!question || question.archivedAt) {
      return NextResponse.json({ success: false, error: "Soal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: question });
  } catch (error) {
    console.error("GET /api/questions/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat detail soal" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.question.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });

    if (!existing || existing.archivedAt) {
      return NextResponse.json({ success: false, error: "Soal tidak ditemukan" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = CreateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { subjectId, categoryId, type, difficulty, status, content, options, gradingConfig, explanation, points } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update question metadata
      const updatedQuestion = await tx.question.update({
        where: { id },
        data: {
          subjectId: subjectId || null,
          categoryId: categoryId || null,
          type,
          difficulty,
          status,
        },
      });

      // 2. Bump version number
      const latestVersionNumber = existing.versions[0]?.versionNumber || 1;
      const nextVersionNumber = latestVersionNumber + 1;

      // Set old versions isCurrent = false
      await tx.questionVersion.updateMany({
        where: { questionId: id },
        data: { isCurrent: false },
      });

      // Create new current version
      const newVersion = await tx.questionVersion.create({
        data: {
          questionId: id,
          versionNumber: nextVersionNumber,
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

      // Create options for new version
      if (options && options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((opt, idx) => ({
            versionId: newVersion.id,
            label: opt.label || String.fromCharCode(65 + idx),
            content: { text: opt.text, imageUrl: opt.imageUrl } as any,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder ?? idx,
          })),
        });
      }

      return { question: updatedQuestion, version: newVersion };
    });

    await logAudit({
      actorId: session.user.id,
      action: "question:update_version",
      entityType: "questions",
      entityId: id,
      beforeValue: existing,
      afterValue: result,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("PUT /api/questions/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal memperbarui soal" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const question = await prisma.question.findUnique({
      where: { id },
      include: { examinationQuestions: true },
    });

    if (!question) {
      return NextResponse.json({ success: false, error: "Soal tidak ditemukan" }, { status: 404 });
    }

    // Soft delete to preserve historical integrity
    await prisma.question.update({
      where: { id },
      data: {
        status: "archived",
        archivedAt: new Date(),
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "question:archive",
      entityType: "questions",
      entityId: id,
      afterValue: { status: "archived" },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, message: "Soal berhasil diarsipkan" });
  } catch (error) {
    console.error("DELETE /api/questions/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus soal" }, { status: 500 });
  }
}
