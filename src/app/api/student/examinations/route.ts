import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  try {
    const { getEligibleExamsForStudent } = await import("@/lib/examination-participants");
    const eligibleExams = await getEligibleExamsForStudent(studentId);

    const examIds = eligibleExams.map((e) => e.id);

    // Fetch attempts separately for safety
    const attempts = (examIds.length > 0 && prisma.examinationAttempt)
      ? await prisma.examinationAttempt.findMany({
          where: {
            studentId,
            examinationId: { in: examIds },
          },
          orderBy: { attemptNumber: "desc" },
          include: {
            result: true,
          },
        })
      : [];

    const attemptsByExam = new Map<string, any>();
    for (const att of attempts) {
      if (!attemptsByExam.has(att.examinationId)) {
        attemptsByExam.set(att.examinationId, att);
      }
    }

    // Fetch individual participant tokens if any
    const participants = await prisma.examinationParticipant.findMany({
      where: {
        studentId,
        examinationId: { in: examIds },
      },
      select: {
        examinationId: true,
        token: true,
      },
    });
    const tokenByExam = new Map<string, string | null>();
    for (const p of participants) {
      tokenByExam.set(p.examinationId, p.token);
    }

    const exams = eligibleExams.map((exam) => {
      const latestAttempt = attemptsByExam.get(exam.id) || null;
      const individualToken = tokenByExam.get(exam.id) || null;

      return {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        subjectName: exam.subject?.name || "Mata Pelajaran",
        subjectCode: exam.subject?.code || "-",
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        scheduledStart: exam.scheduledStart.toISOString(),
        scheduledEnd: exam.scheduledEnd.toISOString(),
        totalQuestions: exam._count.questions,
        passingScore: Number(exam.passingScore) || 75,
        tokenRequired: Boolean(exam.policySettings?.tokenRequired),
        hasToken: Boolean(individualToken || exam.policySettings?.globalToken),
        myAttempt: latestAttempt
            ? {
                id: latestAttempt.id,
                status: latestAttempt.status,
                startedAt: latestAttempt.startedAt?.toISOString() || null,
                submittedAt: latestAttempt.submittedAt?.toISOString() || null,
                result: latestAttempt.result
                  ? {
                      totalScore: Number(latestAttempt.result.totalScore),
                      maxScore: Number(latestAttempt.result.maxScore),
                      percentage: Number(latestAttempt.result.percentage),
                      objectiveScore: latestAttempt.result.objectiveScore ? Number(latestAttempt.result.objectiveScore) : null,
                      essayScore: latestAttempt.result.essayScore ? Number(latestAttempt.result.essayScore) : null,
                      isProvisional: latestAttempt.result.isProvisional,
                      modificationReason: latestAttempt.result.modificationReason || null,
                    }
                  : null,
              }
            : null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data: exams,
    });
  } catch (error) {
    console.error("GET /api/student/examinations error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat jadwal ujian Anda." },
      { status: 500 }
    );
  }
}
