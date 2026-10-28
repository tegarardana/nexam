import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrStartAttempt } from "@/lib/exam-engine/attempt-manager";
import { logAudit } from "@/lib/audit";

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
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty if no token provided
    }

    const { token } = body;
    const result = await getOrStartAttempt(session.user.id, examinationId, token);

    await logAudit({
      actorId: session.user.id,
      action: result.isResumed ? "EXAM_RESUME" : "EXAM_START",
      entityType: "examination_attempts",
      entityId: result.attemptId,
      afterValue: {
        examinationId,
        attemptNumber: result.attemptNumber,
        isResumed: result.isResumed,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("POST /api/student/examinations/[id]/start error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memulai sesi ujian." },
      { status: 400 }
    );
  }
}
