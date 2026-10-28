import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { ExaminationStatus, ExaminationStatusEnum } from "@/lib/validation/examination";
import { validateExaminationTransition } from "@/lib/examination-state";
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
    const body = await request.json();
    const targetStatus = body.status as ExaminationStatus;

    if (!targetStatus || !ExaminationStatusEnum.options.includes(targetStatus)) {
      return NextResponse.json(
        { success: false, error: "Target status ujian tidak valid" },
        { status: 400 }
      );
    }

    const exam = await prisma.examination.findUnique({ where: { id } });
    if (!exam) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    const validation = await validateExaminationTransition(id, targetStatus);
    if (!validation.allowed) {
      return NextResponse.json(
        { success: false, error: validation.reason || "Transisi status ujian tidak diizinkan" },
        { status: 400 }
      );
    }

    const updated = await prisma.examination.update({
      where: { id },
      data: {
        status: targetStatus,
        publishedAt: targetStatus === "scheduled" || targetStatus === "ready" ? new Date() : exam.publishedAt,
      },
    });

    // Auto-enroll eligible students from classes offering the subject if no participants yet
    if (["ready", "scheduled", "in_progress"].includes(targetStatus)) {
      const participantCount = await prisma.examinationParticipant.count({
        where: { examinationId: id },
      });
      if (participantCount === 0) {
        const { autoEnrollEligibleStudents } = await import("@/lib/examination-participants");
        await autoEnrollEligibleStudents(id);
      }
    }

    await logAudit({
      actorId: session.user.id,
      action: `examination:transition:${targetStatus}`,
      entityType: "examinations",
      entityId: id,
      beforeValue: { status: exam.status },
      afterValue: { status: updated.status },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("POST /api/examinations/[id]/transition error:", error);
    return NextResponse.json({ success: false, error: "Gagal memproses transisi status ujian" }, { status: 500 });
  }
}
