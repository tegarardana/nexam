import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";

interface AdjustmentPayload {
  method: "flat" | "linear" | "multiplier" | "kkm_floor" | "custom" | "reset";
  params?: {
    flatPoints?: number;
    targetMin?: number;
    targetMax?: number;
    multiplier?: number;
    targetKkm?: number;
  };
  customAdjustments?: Array<{
    studentId: string;
    newPercentage: number;
  }>;
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: examinationId } = await params;

  try {
    const body: AdjustmentPayload = await request.json();
    const { method, params: p = {}, customAdjustments, reason } = body;

    const exam = await prisma.examination.findUnique({
      where: { id: examinationId },
      include: {
        results: {
          include: {
            attempt: {
              include: {
                gradingRecords: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json(
        { success: false, error: "Ujian tidak ditemukan." },
        { status: 404 }
      );
    }

    if (exam.results.length === 0) {
      return NextResponse.json(
        { success: false, error: "Belum ada nilai siswa yang dapat dikatrol." },
        { status: 400 }
      );
    }

    const now = new Date();

    // Reset Katrol: Restore original score from gradingRecords or totalScore/maxScore
    if (method === "reset") {
      await prisma.$transaction(async (tx) => {
        for (const res of exam.results) {
          let originalPercentage = Number(res.percentage);
          // If grading records exist, compute exact raw sum
          if (res.attempt?.gradingRecords && res.attempt.gradingRecords.length > 0) {
            const rawSum = res.attempt.gradingRecords.reduce(
              (acc, gr) => acc + (Number(gr.rawScore) || 0),
              0
            );
            const maxSum = res.attempt.gradingRecords.reduce(
              (acc, gr) => acc + (Number(gr.maxScore) || 0),
              0
            );
            originalPercentage = maxSum > 0 ? (rawSum / maxSum) * 100 : 0;
          } else if (Number(res.maxScore) > 0) {
            originalPercentage = (Number(res.totalScore) / Number(res.maxScore)) * 100;
          }

          const rounded = Math.round(originalPercentage * 100) / 100;

          await tx.examinationResult.update({
            where: { id: res.id },
            data: {
              percentage: rounded,
              lastModifiedAt: now,
              lastModifiedById: session.user.id,
              modificationReason: null,
            },
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: "Nilai siswa berhasil dikembalikan ke nilai murni.",
      });
    }

    // Calculate original percentages
    const currentResults = exam.results.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      currentPercentage: Number(r.percentage),
      maxScore: Number(r.maxScore),
    }));

    const validPercentages = currentResults.map((r) => r.currentPercentage);
    const minOrig = Math.min(...validPercentages);
    const maxOrig = Math.max(...validPercentages);

    const updates: Array<{ id: string; studentId: string; newPercentage: number }> = [];

    if (method === "flat") {
      const flat = Number(p.flatPoints) || 0;
      for (const item of currentResults) {
        const adjusted = Math.min(100, Math.max(0, item.currentPercentage + flat));
        updates.push({ id: item.id, studentId: item.studentId, newPercentage: Math.round(adjusted * 100) / 100 });
      }
    } else if (method === "linear") {
      const targetMin = Number(p.targetMin) || Number(exam.passingScore) || 75;
      const targetMax = Number(p.targetMax) || 100;

      for (const item of currentResults) {
        let adjusted = item.currentPercentage;
        if (maxOrig === minOrig) {
          adjusted = targetMax;
        } else {
          // Standard linear min-max interpolation
          adjusted = targetMin + ((item.currentPercentage - minOrig) / (maxOrig - minOrig)) * (targetMax - targetMin);
        }
        adjusted = Math.min(100, Math.max(0, adjusted));
        updates.push({ id: item.id, studentId: item.studentId, newPercentage: Math.round(adjusted * 100) / 100 });
      }
    } else if (method === "multiplier") {
      const factor = Number(p.multiplier) || 1.1;
      for (const item of currentResults) {
        const adjusted = Math.min(100, Math.max(0, item.currentPercentage * factor));
        updates.push({ id: item.id, studentId: item.studentId, newPercentage: Math.round(adjusted * 100) / 100 });
      }
    } else if (method === "kkm_floor") {
      const kkm = Number(p.targetKkm) || Number(exam.passingScore) || 75;
      for (const item of currentResults) {
        const adjusted = item.currentPercentage < kkm ? kkm : item.currentPercentage;
        updates.push({ id: item.id, studentId: item.studentId, newPercentage: Math.round(adjusted * 100) / 100 });
      }
    } else if (method === "custom") {
      const customMap = new Map((customAdjustments || []).map((c) => [c.studentId, Number(c.newPercentage)]));
      for (const item of currentResults) {
        if (customMap.has(item.studentId)) {
          const val = Math.min(100, Math.max(0, customMap.get(item.studentId)!));
          updates.push({ id: item.id, studentId: item.studentId, newPercentage: Math.round(val * 100) / 100 });
        }
      }
    }

    const defaultReason =
      method === "flat"
        ? `Katrol Flat (+${p.flatPoints || 0} Poin)`
        : method === "linear"
        ? `Katrol Linier (${p.targetMin || 75} - ${p.targetMax || 100})`
        : method === "multiplier"
        ? `Katrol Faktor Multiplier (${p.multiplier || 1.1}x)`
        : method === "kkm_floor"
        ? `Katrol Batas KKM (${p.targetKkm || 75})`
        : "Penyesuaian Nilai Khusus";

    const finalReason = reason && reason.trim().length > 0 ? reason.trim() : defaultReason;

    // Apply updates in transaction
    await prisma.$transaction(async (tx) => {
      for (const up of updates) {
        await tx.examinationResult.update({
          where: { id: up.id },
          data: {
            percentage: up.newPercentage,
            lastModifiedAt: now,
            lastModifiedById: session.user.id,
            modificationReason: finalReason,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Nilai berhasil disesuaikan (${updates.length} siswa).`,
      data: {
        adjustedCount: updates.length,
        method,
        reason: finalReason,
      },
    });
  } catch (error: any) {
    console.error("POST /api/examinations/[id]/results/adjust error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menerapkan katrol nilai." },
      { status: 500 }
    );
  }
}
