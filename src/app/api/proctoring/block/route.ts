import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/rbac";
import { evaluateAntiCheatEvent } from "@/lib/anti-cheat/policy-evaluator";
import { prisma } from "@/lib/prisma";
import { verifyProctorCanAccessAttempt } from "@/lib/proctor-scope-server";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { attemptId, note } = await request.json();

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "attemptId wajib diisi." },
        { status: 400 }
      );
    }

    const authCheck = await verifyProctorCanAccessAttempt(attemptId, session.user);
    if (!authCheck.allowed) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: 403 });
    }

    const result = await evaluateAntiCheatEvent({
      attemptId,
      eventType: "manual_block",
      actorId: session.user.id,
      interventionNote: note || "Sesi ujian ditangguhkan secara manual oleh pengawas.",
    });

    // Record in audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "proctor.session_blocked",
        entityType: "examination_attempt",
        entityId: attemptId,
        afterValue: { note: note || "Manual block" },
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengunci sesi ujian." },
      { status: 400 }
    );
  }
}
