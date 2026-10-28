import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { submitAttempt } from "@/lib/exam-engine/attempt-manager";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { proctorHub } from "@/lib/anti-cheat/proctor-hub";

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
    let reason = "manual_submit";
    try {
      const body = await request.json();
      if (body?.reason) reason = body.reason;
    } catch {
      // Empty body is fine
    }

    const result = await submitAttempt(session.user.id, examinationId, reason);

    // 1. Record exam_submitted event for live proctoring feed
    await prisma.examinationEvent.create({
      data: {
        attemptId: result.attemptId,
        eventType: "exam_submitted",
        serverTimestamp: new Date(),
        metadata: {
          reason,
          status: result.status,
          percentage: result.percentage,
        },
      },
    });

    // 2. Broadcast real-time SSE event to live proctors
    proctorHub.broadcast(examinationId, "exam_submitted", {
      attemptId: result.attemptId,
      studentId: session.user.id,
      studentName: session.user.displayName,
      status: result.status,
      timestamp: new Date().toISOString(),
    });

    await logAudit({
      actorId: session.user.id,
      action: "EXAM_SUBMIT",
      entityType: "examination_attempts",
      entityId: result.attemptId,
      afterValue: {
        examinationId,
        status: result.status,
        totalScore: result.totalScore,
        maxScore: result.maxScore,
        percentage: result.percentage,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("POST /api/student/examinations/[id]/submit error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengumpulkan lembar ujian." },
      { status: 400 }
    );
  }
}
