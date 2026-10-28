import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { proctorHub } from "@/lib/anti-cheat/proctor-hub";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { attemptId, reason } = await request.json();

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "attemptId wajib diisi." },
        { status: 400 }
      );
    }

    const attempt = await prisma.examinationAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { displayName: true } },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Sesi ujian tidak ditemukan." },
        { status: 404 }
      );
    }

    const updated = await prisma.examinationAttempt.update({
      where: { id: attemptId },
      data: {
        status: "blocked",
      },
    });

    // Record event
    await prisma.examinationEvent.create({
      data: {
        attemptId,
        eventType: "manual_disqualify",
        actorId: session.user.id,
        interventionNote: reason || "Siswa didiskualifikasi oleh pengawas karena pelanggaran berat.",
      },
    });

    // Also update participant status to disqualified
    await prisma.examinationParticipant.updateMany({
      where: {
        examinationId: attempt.examinationId,
        studentId: attempt.studentId,
      },
      data: {
        status: "disqualified",
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "proctor.student_disqualified",
        entityType: "examination_attempt",
        entityId: attemptId,
        afterValue: { reason },
      },
    });

    // Broadcast SSE
    proctorHub.broadcast(attempt.examinationId, "attempt_status_change", {
      attemptId,
      studentId: attempt.studentId,
      studentName: attempt.student.displayName,
      previousStatus: attempt.status,
      newStatus: "blocked",
      isDisqualified: true,
      reason,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        attemptId,
        status: updated.status,
        disqualified: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mendiskualifikasi siswa." },
      { status: 400 }
    );
  }
}
