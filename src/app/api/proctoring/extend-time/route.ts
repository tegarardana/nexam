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
    const { attemptId, additionalMinutes, reason } = await request.json();

    const minutes = Number(additionalMinutes);
    if (!attemptId || !minutes || minutes <= 0) {
      return NextResponse.json(
        { success: false, error: "attemptId dan additionalMinutes (> 0) wajib diisi." },
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

    const baseDeadline = attempt.deadlineAt ? new Date(attempt.deadlineAt) : new Date();
    const newDeadline = new Date(baseDeadline.getTime() + minutes * 60 * 1000);

    const updated = await prisma.examinationAttempt.update({
      where: { id: attemptId },
      data: {
        deadlineAt: newDeadline,
      },
    });

    // Record event
    await prisma.examinationEvent.create({
      data: {
        attemptId,
        eventType: "time_extended",
        actorId: session.user.id,
        interventionNote: reason || `Perpanjangan waktu ${minutes} menit oleh pengawas.`,
        metadata: {
          additionalMinutes: minutes,
          previousDeadline: baseDeadline.toISOString(),
          newDeadline: newDeadline.toISOString(),
        },
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "proctor.time_extended",
        entityType: "examination_attempt",
        entityId: attemptId,
        afterValue: {
          additionalMinutes: minutes,
          reason,
          newDeadline: newDeadline.toISOString(),
        },
      },
    });

    // Broadcast SSE
    proctorHub.broadcast(attempt.examinationId, "time_extended", {
      attemptId,
      studentId: attempt.studentId,
      studentName: attempt.student.displayName,
      additionalMinutes: minutes,
      newDeadline: newDeadline.toISOString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        attemptId,
        deadlineAt: updated.deadlineAt,
        additionalMinutes: minutes,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menambah waktu ujian." },
      { status: 400 }
    );
  }
}
