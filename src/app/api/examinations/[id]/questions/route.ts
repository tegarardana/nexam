import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { AssignQuestionsSchema } from "@/lib/validation/examination";
import { logAudit } from "@/lib/audit";

export async function POST(
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
    const exam = await prisma.examination.findUnique({ where: { id } });
    if (!exam) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    if (exam.status !== "draft" && exam.status !== "ready") {
      return NextResponse.json(
        {
          success: false,
          error: `Penyusunan butir soal hanya dapat dilakukan saat ujian berstatus 'draft' atau 'ready'. Status saat ini: '${exam.status}'`,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = AssignQuestionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const questionIds = parsed.data.questions.map((q) => q.questionId);

    // Fetch the current version of each question
    const currentVersions = await prisma.questionVersion.findMany({
      where: {
        questionId: { in: questionIds },
        isCurrent: true,
      },
    });

    const versionMap = new Map<string, string>();
    currentVersions.forEach((v) => versionMap.set(v.questionId, v.id));

    // Verify all questions have an active version
    for (const q of parsed.data.questions) {
      if (!versionMap.has(q.questionId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Soal dengan ID ${q.questionId} tidak memiliki versi aktif yang valid.`,
          },
          { status: 400 }
        );
      }
    }

    // Replace questions atomically
    await prisma.$transaction(async (tx) => {
      await tx.examinationQuestion.deleteMany({
        where: { examinationId: id },
      });

      await tx.examinationQuestion.createMany({
        data: parsed.data.questions.map((q) => ({
          examinationId: id,
          questionId: q.questionId,
          questionVersionId: versionMap.get(q.questionId)!,
          sequenceOrder: q.sequenceOrder,
          points: q.points,
          isOptional: q.isOptional,
        })),
      });

      // Calculate total points
      const totalPoints = parsed.data.questions.reduce((sum, q) => sum + Number(q.points), 0);
      await tx.examination.update({
        where: { id },
        data: { totalPoints },
      });
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination:assign_questions",
      entityType: "examinations",
      entityId: id,
      afterValue: { questionCount: parsed.data.questions.length },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `${parsed.data.questions.length} butir soal berhasil dipasangkan ke ujian`,
    });
  } catch (error) {
    console.error("POST /api/examinations/[id]/questions error:", error);
    return NextResponse.json({ success: false, error: "Gagal menetapkan butir soal ke ujian" }, { status: 500 });
  }
}
