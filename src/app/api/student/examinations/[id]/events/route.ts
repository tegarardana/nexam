import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { evaluateAntiCheatEvent, AntiCheatEventType } from "@/lib/anti-cheat/policy-evaluator";

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
    const body = await request.json();
    const { eventType, clientEventId, clientTimestamp, metadata } = body;

    if (!eventType) {
      return NextResponse.json(
        { success: false, error: "eventType wajib disertakan." },
        { status: 400 }
      );
    }

    // Find active student attempt
    const attempt = await prisma.examinationAttempt.findFirst({
      where: {
        examinationId,
        studentId: session.user.id,
      },
      orderBy: { attemptNumber: "desc" },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Sesi pengerjaan ujian tidak ditemukan." },
        { status: 404 }
      );
    }

    // Attempt blocked enforcement
    if (attempt.status === "blocked") {
      return NextResponse.json(
        {
          success: false,
          error: "Sesi ujian Anda sedang ditangguhkan oleh sistem atau pengawas.",
          status: "blocked",
        },
        { status: 403 }
      );
    }

    const evaluation = await evaluateAntiCheatEvent({
      attemptId: attempt.id,
      eventType: eventType as AntiCheatEventType,
      clientEventId,
      clientTimestamp,
      metadata,
    });

    return NextResponse.json({
      success: true,
      data: evaluation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses event integritas." },
      { status: 400 }
    );
  }
}
