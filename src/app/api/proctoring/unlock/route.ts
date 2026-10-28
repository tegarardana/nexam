import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/rbac";
import { evaluateAntiCheatEvent } from "@/lib/anti-cheat/policy-evaluator";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { attemptId, note, resetIncidentCount } = await request.json();

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "attemptId wajib diisi." },
        { status: 400 }
      );
    }

    if (!note || !note.trim()) {
      return NextResponse.json(
        { success: false, error: "Alasan pembukaan kunci (note) wajib diisi oleh pengawas." },
        { status: 400 }
      );
    }

    const result = await evaluateAntiCheatEvent({
      attemptId,
      eventType: "manual_unlock",
      actorId: session.user.id,
      interventionNote: note.trim(),
      metadata: {
        resetIncidentCount: Boolean(resetIncidentCount),
      },
    });

    const updatedAttempt = await prisma.examinationAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        deadlineAt: true,
        incidentCount: true,
      },
    });

    // Record in audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "proctor.session_unlocked",
        entityType: "examination_attempt",
        entityId: attemptId,
        afterValue: {
          note: note.trim(),
          resetIncidentCount: Boolean(resetIncidentCount),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        deadlineAt: updatedAttempt?.deadlineAt,
        serverNow: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuka kunci sesi ujian." },
      { status: 400 }
    );
  }
}
