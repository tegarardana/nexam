import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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
      orderBy: { attemptNumber: "desc" },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Sesi ujian tidak ditemukan." },
        { status: 404 }
      );
    }

    if (attempt.status === "warning") {
      await prisma.examinationAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "in_progress",
        },
      });
    }

    await prisma.examinationEvent.create({
      data: {
        attemptId: attempt.id,
        eventType: "warning_acknowledged",
        serverTimestamp: new Date(),
        metadata: {
          acknowledgedByStudent: true,
          incidentCountAtAck: attempt.incidentCount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { acknowledged: true, status: "in_progress" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengonfirmasi peringatan." },
      { status: 400 }
    );
  }
}
