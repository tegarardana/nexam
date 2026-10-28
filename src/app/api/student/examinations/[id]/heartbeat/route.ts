import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { proctorHub } from "@/lib/anti-cheat/proctor-hub";
import { getTimerStatus } from "@/lib/exam-engine/timer";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: examinationId } = await params;

  try {
    const attempt = await prisma.examinationAttempt.findFirst({
      where: {
        examinationId,
        studentId: session.user.id,
      },
      include: {
        student: {
          select: { displayName: true, nis: true },
        },
        examination: {
          select: { durationMinutes: true, scheduledEnd: true, status: true },
        },
      },
      orderBy: { attemptNumber: "desc" },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Sesi ujian tidak ditemukan." },
        { status: 404 }
      );
    }

    const now = new Date();

    // Check if scheduledEnd has passed or exam is closed
    const examScheduledEnd = attempt.examination.scheduledEnd;
    const isExamExpired = (examScheduledEnd && now > examScheduledEnd) || attempt.examination.status === "closed";

    if (isExamExpired && ["in_progress", "warning", "blocked"].includes(attempt.status)) {
      const { submitAttempt } = await import("@/lib/exam-engine/attempt-manager");
      const submitted = await submitAttempt(session.user.id, examinationId);
      return NextResponse.json({
        success: true,
        data: {
          status: submitted.status,
          serverTime: now.toISOString(),
          isExpired: true,
          remainingSeconds: 0,
        },
      });
    }

    if (["submitted", "grading_pending", "completed", "expired"].includes(attempt.status)) {
      return NextResponse.json({
        success: true,
        data: {
          status: attempt.status,
          serverTime: now.toISOString(),
        },
      });
    }

    const previousConnection = attempt.connectionStatus;

    await prisma.examinationAttempt.update({
      where: { id: attempt.id },
      data: {
        lastHeartbeat: now,
        connectionStatus: "connected",
      },
    });

    if (previousConnection !== "connected") {
      proctorHub.broadcast(examinationId, "connection_status_change", {
        attemptId: attempt.id,
        studentId: session.user.id,
        studentName: attempt.student.displayName,
        studentNis: attempt.student.nis,
        connectionStatus: "connected",
        timestamp: now.toISOString(),
      });
    }

    const timer = getTimerStatus(
      attempt.startedAt || now,
      attempt.examination.durationMinutes,
      now,
      0,
      attempt.deadlineAt
    );

    return NextResponse.json({
      success: true,
      data: {
        status: attempt.status,
        incidentCount: attempt.incidentCount,
        serverTime: now.toISOString(),
        deadlineAt: attempt.deadlineAt ? attempt.deadlineAt.toISOString() : null,
        remainingSeconds: timer.remainingSeconds,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mencatat heartbeat." },
      { status: 400 }
    );
  }
}
