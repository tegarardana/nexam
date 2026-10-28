import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";

interface GradeItem {
  examinationQuestionId: string;
  rawScore: number;
  teacherFeedback?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
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

  const { id: examinationId, attemptId } = await params;

  try {
    const body = await request.json();
    const { grades } = body as { grades: GradeItem[] };

    if (!Array.isArray(grades) || grades.length === 0) {
      return NextResponse.json(
        { success: false, error: "Data penilaian tidak boleh kosong." },
        { status: 400 }
      );
    }

    const attempt = await prisma.examinationAttempt.findUnique({
      where: { id: attemptId },
      include: {
        examination: true,
        gradingRecords: true,
      },
    });

    if (!attempt || attempt.examinationId !== examinationId) {
      return NextResponse.json(
        { success: false, error: "Sesi ujian siswa tidak ditemukan." },
        { status: 404 }
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Process each grade update
      for (const item of grades) {
        const existingRecord = attempt.gradingRecords.find(
          (gr) => gr.examinationQuestionId === item.examinationQuestionId
        );

        const maxScore = existingRecord ? Number(existingRecord.maxScore) : 10.0;
        let score = Number(item.rawScore);
        if (isNaN(score) || score < 0) score = 0;
        if (score > maxScore) score = maxScore;

        if (existingRecord) {
          await tx.gradingRecord.update({
            where: { id: existingRecord.id },
            data: {
              rawScore: score,
              teacherFeedback: item.teacherFeedback !== undefined ? item.teacherFeedback : existingRecord.teacherFeedback,
              gradingStatus: "finalized",
              gradingMethod: "manual",
              gradedById: session.user.id,
              gradedAt: now,
            },
          });
        } else {
          // If record did not exist yet, find question type
          const eq = await tx.examinationQuestion.findUnique({
            where: { id: item.examinationQuestionId },
            include: { question: true },
          });

          await tx.gradingRecord.create({
            data: {
              attemptId: attempt.id,
              examinationQuestionId: item.examinationQuestionId,
              questionType: eq?.question?.type || "essay",
              rawScore: score,
              maxScore: eq ? Number(eq.points) : 10.0,
              gradingStatus: "finalized",
              gradingMethod: "manual",
              gradedById: session.user.id,
              gradedAt: now,
              teacherFeedback: item.teacherFeedback || null,
            },
          });
        }
      }

      // 2. Fetch updated grading records
      const allGradingRecords = await tx.gradingRecord.findMany({
        where: { attemptId: attempt.id },
      });

      let objectiveScore = 0;
      let essayScore = 0;
      let totalRawScore = 0;
      let totalMaxScore = 0;
      let hasPending = false;

      for (const rec of allGradingRecords) {
        const raw = Number(rec.rawScore) || 0;
        const max = Number(rec.maxScore) || 0;

        totalMaxScore += max;
        totalRawScore += raw;

        if (rec.questionType === "essay") {
          essayScore += raw;
        } else {
          objectiveScore += raw;
        }

        if (rec.gradingStatus === "pending") {
          hasPending = true;
        }
      }

      const percentage = totalMaxScore > 0 ? (totalRawScore / totalMaxScore) * 100 : 0;
      const roundedPercentage = Math.round(percentage * 100) / 100;

      // 3. Update attempt status
      if (!hasPending && attempt.status === "grading_pending") {
        await tx.examinationAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "completed",
          },
        });
      }

      // 4. Update examination result
      const examResult = await tx.examinationResult.upsert({
        where: { attemptId: attempt.id },
        update: {
          totalScore: totalRawScore,
          maxScore: totalMaxScore,
          percentage: roundedPercentage,
          objectiveScore,
          essayScore,
          isProvisional: hasPending,
          finalizedAt: hasPending ? null : now,
          finalizedById: hasPending ? null : session.user.id,
        },
        create: {
          attemptId: attempt.id,
          studentId: attempt.studentId,
          examinationId,
          totalScore: totalRawScore,
          maxScore: totalMaxScore,
          percentage: roundedPercentage,
          objectiveScore,
          essayScore,
          isProvisional: hasPending,
          finalizedAt: hasPending ? null : now,
          finalizedById: hasPending ? null : session.user.id,
        },
      });

      return {
        totalScore: totalRawScore,
        maxScore: totalMaxScore,
        percentage: roundedPercentage,
        objectiveScore,
        essayScore,
        isCompleted: !hasPending,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Penilaian esai berhasil disimpan.",
      data: result,
    });
  } catch (error: any) {
    console.error("POST /api/examinations/[id]/attempts/[attemptId]/grade-essay error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan penilaian esai." },
      { status: 500 }
    );
  }
}
