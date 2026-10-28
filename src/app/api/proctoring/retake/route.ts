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
    const { attemptId, mode = "reset_answers", durationMinutes, reason } = await request.json();

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "attemptId wajib diisi." },
        { status: 400 }
      );
    }

    const attempt = await prisma.examinationAttempt.findUnique({
      where: { id: attemptId },
      include: {
        examination: {
          include: { policySettings: true },
        },
        student: {
          select: {
            id: true,
            displayName: true,
            username: true,
            nis: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Sesi ujian siswa tidak ditemukan." },
        { status: 404 }
      );
    }

    const now = new Date();
    const duration =
      durationMinutes && Number(durationMinutes) > 0
        ? Number(durationMinutes)
        : attempt.examination.durationMinutes;

    const deadlineAt = new Date(now.getTime() + duration * 60 * 1000);

    // If the examination itself was closed or scheduledEnd is earlier than new deadline, extend it
    if (
      attempt.examination.status === "closed" ||
      (attempt.examination.scheduledEnd && deadlineAt > new Date(attempt.examination.scheduledEnd))
    ) {
      await prisma.examination.update({
        where: { id: attempt.examinationId },
        data: {
          status: "in_progress",
          scheduledEnd: deadlineAt,
        },
      });
    }

    // Process retake inside database transaction
    const updatedAttempt = await prisma.$transaction(async (tx) => {
      if (mode === "reset_answers") {
        // Clear all previous answers, grading records, and final results
        await tx.examinationAnswer.deleteMany({
          where: { attemptId },
        });
        await tx.gradingRecord.deleteMany({
          where: { attemptId },
        });
        await tx.examinationResult.deleteMany({
          where: { attemptId },
        });
      } else {
        // Keep existing answers, but remove finalized results so grading re-evaluates upon resubmission
        await tx.examinationResult.deleteMany({
          where: { attemptId },
        });
      }

      // Reset attempt back to active in_progress
      const updated = await tx.examinationAttempt.update({
        where: { id: attemptId },
        data: {
          status: "in_progress",
          startedAt: now,
          deadlineAt,
          submittedAt: null,
          incidentCount: 0,
          incidentCountResetAt: now,
          connectionStatus: "unknown",
          lastHeartbeat: now,
        },
      });

      // Log anti-cheat / proctoring event
      await tx.examinationEvent.create({
        data: {
          attemptId,
          eventType: "retake_granted",
          actorId: session.user.id,
          interventionNote:
            reason ||
            (mode === "reset_answers"
              ? "Pengawas mengizinkan pengerjaan ulang (lembar jawaban dikosongkan)."
              : "Pengawas mengizinkan pengerjaan ulang (lembar jawaban sebelumnya dipertahankan)."),
          metadata: {
            mode,
            durationMinutes: duration,
            previousStatus: attempt.status,
          },
        },
      });

      // Log system audit
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "proctor.retake_granted",
          entityType: "examination_attempt",
          entityId: attemptId,
          afterValue: {
            studentId: attempt.studentId,
            studentName: attempt.student.displayName,
            mode,
            durationMinutes: duration,
            reason: reason || null,
          },
        },
      });

      return updated;
    });

    // Broadcast SSE to live proctor dashboard
    proctorHub.broadcast(attempt.examinationId, "attempt_status_change", {
      attemptId,
      studentId: attempt.studentId,
      studentName: attempt.student.displayName,
      previousStatus: attempt.status,
      newStatus: "in_progress",
      isRetake: true,
      mode,
      durationMinutes: duration,
      timestamp: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        attemptId: updatedAttempt.id,
        status: updatedAttempt.status,
        deadlineAt: updatedAttempt.deadlineAt,
        mode,
        durationMinutes: duration,
      },
    });
  } catch (error: any) {
    console.error("POST /api/proctoring/retake error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengizinkan pengerjaan ulang." },
      { status: 400 }
    );
  }
}
