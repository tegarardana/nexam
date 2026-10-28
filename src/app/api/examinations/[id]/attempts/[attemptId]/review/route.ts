import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(
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
    const attempt = await prisma.examinationAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: {
            id: true,
            displayName: true,
            username: true,
            nis: true,
          },
        },
        examination: {
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            passingScore: true,
            subject: { select: { name: true, code: true } },
          },
        },
        result: true,
        answers: true,
        gradingRecords: true,
      },
    });

    if (!attempt || attempt.examinationId !== examinationId) {
      return NextResponse.json(
        { success: false, error: "Sesi ujian siswa tidak ditemukan." },
        { status: 404 }
      );
    }

    // Get student's class group from ExaminationParticipant
    const participant = await prisma.examinationParticipant.findUnique({
      where: {
        examinationId_studentId: {
          examinationId,
          studentId: attempt.studentId,
        },
      },
      include: {
        classGroup: { select: { id: true, name: true } },
      },
    });

    // Fetch all examination questions with version & options
    const examQuestions = await prisma.examinationQuestion.findMany({
      where: { examinationId },
      orderBy: { sequenceOrder: "asc" },
      include: {
        question: {
          select: {
            id: true,
            type: true,
          },
        },
        questionVersion: {
          include: {
            options: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    const answersMap = new Map(attempt.answers.map((a) => [a.examinationQuestionId, a]));
    const gradingMap = new Map(attempt.gradingRecords.map((g) => [g.examinationQuestionId, g]));

    const questionsReview = examQuestions.map((eq, index) => {
      const qv = eq.questionVersion;
      const answer = answersMap.get(eq.id);
      const grading = gradingMap.get(eq.id);
      const points = Number(eq.points) || 1.0;

      // Extract answer key
      let answerKey: any = null;
      if (eq.question.type === "single_choice") {
        const correctOpt = qv.options.find((o) => o.isCorrect);
        answerKey = correctOpt ? { id: correctOpt.id, label: correctOpt.label } : null;
      } else if (eq.question.type === "multi_select") {
        const correctOpts = qv.options.filter((o) => o.isCorrect);
        answerKey = correctOpts.map((o) => ({ id: o.id, label: o.label }));
      } else if (eq.question.type === "true_false") {
        const correctOpt = qv.options.find((o) => o.isCorrect);
        answerKey = correctOpt ? correctOpt.label : null;
      } else if (eq.question.type === "short_answer") {
        answerKey = (qv.gradingConfig as any)?.answerKey || null;
      } else if (eq.question.type === "essay") {
        answerKey = (qv.content as any)?.rubric || (qv.gradingConfig as any)?.rubric || null;
      }

      return {
        sequenceNumber: index + 1,
        examinationQuestionId: eq.id,
        questionId: eq.questionId,
        questionType: eq.question.type,
        maxScore: points,
        content: qv.content,
        explanation: qv.explanation || null,
        options: qv.options.map((opt) => ({
          id: opt.id,
          label: opt.label,
          content: opt.content,
          isCorrect: opt.isCorrect,
          sortOrder: opt.sortOrder,
        })),
        studentAnswer: answer ? answer.answerValue : null,
        isDoubtful: answer ? answer.isDoubtful : false,
        gradingRecord: grading
          ? {
              id: grading.id,
              rawScore: grading.rawScore !== null ? Number(grading.rawScore) : null,
              maxScore: Number(grading.maxScore),
              gradingMethod: grading.gradingMethod,
              gradingStatus: grading.gradingStatus,
              teacherFeedback: grading.teacherFeedback,
              gradedAt: grading.gradedAt ? grading.gradedAt.toISOString() : null,
            }
          : null,
        answerKey,
      };
    });

    let durationMinutes = null;
    if (attempt.startedAt && attempt.submittedAt) {
      durationMinutes = Math.round(
        (new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: attempt.student.id,
          displayName: attempt.student.displayName,
          username: attempt.student.username,
          nis: attempt.student.nis,
          className: participant?.classGroup?.name || "-",
        },
        attempt: {
          id: attempt.id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          startedAt: attempt.startedAt ? attempt.startedAt.toISOString() : null,
          submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
          durationMinutes,
          incidentCount: attempt.incidentCount,
        },
        result: attempt.result
          ? {
              totalScore: Number(attempt.result.totalScore),
              maxScore: Number(attempt.result.maxScore),
              percentage: Number(attempt.result.percentage),
              objectiveScore: attempt.result.objectiveScore ? Number(attempt.result.objectiveScore) : null,
              essayScore: attempt.result.essayScore ? Number(attempt.result.essayScore) : null,
              isProvisional: attempt.result.isProvisional,
              modificationReason: attempt.result.modificationReason,
              finalizedAt: attempt.result.finalizedAt ? attempt.result.finalizedAt.toISOString() : null,
            }
          : null,
        questions: questionsReview,
      },
    });
  } catch (error: any) {
    console.error("GET /api/examinations/[id]/attempts/[attemptId]/review error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat tinjauan jawaban siswa." },
      { status: 500 }
    );
  }
}
