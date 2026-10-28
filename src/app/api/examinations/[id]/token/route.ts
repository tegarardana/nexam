import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";

function generateExamToken(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Hindari karakter membingungkan seperti 0/O, 1/I
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: examinationId } = await params;

  try {
    const exam = await prisma.examination.findUnique({
      where: { id: examinationId },
      include: { policySettings: true },
    });

    if (!exam) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    const body = await request.json();
    let { tokenRequired, globalToken, autoGenerate } = body;

    // Jika autoGenerate diminta atau token kosong saat diaktifkan
    if (autoGenerate || (tokenRequired && !globalToken)) {
      globalToken = generateExamToken();
    } else if (globalToken) {
      globalToken = globalToken.trim().toUpperCase();
    }

    const updatedPolicy = await prisma.examinationPolicySetting.upsert({
      where: { examinationId },
      update: {
        tokenRequired: tokenRequired !== undefined ? Boolean(tokenRequired) : exam.policySettings?.tokenRequired ?? false,
        globalToken: globalToken !== undefined ? (globalToken ? globalToken.trim().toUpperCase() : null) : exam.policySettings?.globalToken,
      },
      create: {
        examinationId,
        tokenRequired: tokenRequired !== undefined ? Boolean(tokenRequired) : true,
        globalToken: globalToken ? globalToken.trim().toUpperCase() : generateExamToken(),
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination:update_token",
      entityType: "examination_policy_settings",
      entityId: updatedPolicy.id,
      beforeValue: exam.policySettings,
      afterValue: updatedPolicy,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        tokenRequired: updatedPolicy.tokenRequired,
        globalToken: updatedPolicy.globalToken,
      },
    });
  } catch (error: any) {
    console.error("PATCH /api/examinations/[id]/token error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui token ujian." },
      { status: 500 }
    );
  }
}

