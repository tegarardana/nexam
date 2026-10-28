import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { getTimerStatus } from "@/lib/exam-engine/timer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: examinationId } = await params;
  const now = new Date();

  try {
    const attempt = await prisma.examinationAttempt.findFirst({
      where: {
        examinationId,
        studentId: session.user.id,
      },
      orderBy: { attemptNumber: "desc" },
      include: {
        student: {
          select: {
            username: true,
            displayName: true,
            nis: true,
          },
        },
        examination: {
          include: {
            subject: true,
            policySettings: true,
            questions: {
              include: {
                question: true,
                questionVersion: {
                  include: {
                    options: {
                      orderBy: { sortOrder: "asc" },
                    },
                  },
                },
              },
            },
          },
        },
        answers: true,
        result: true,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Belum ada sesi ujian yang dimulai." },
        { status: 404 }
      );
    }

    const exam = attempt.examination;
    const policy = exam.policySettings;

    // Calculate timer (using attempt.deadlineAt if available to honor time extensions)
    const timer = getTimerStatus(
      attempt.startedAt || now,
      exam.durationMinutes,
      now,
      0,
      attempt.deadlineAt
    );

    // Build question list according to attempt.questionOrder
    const questionOrder = (attempt.questionOrder as string[]) || exam.questions.map((q) => q.id);
    const optionOrders = (attempt.optionOrders as Record<string, string[]>) || {};

    const questionsMap = new Map(exam.questions.map((q) => [q.id, q]));

    const sanitizedQuestions = questionOrder
      .map((qId, idx) => {
        const eq = questionsMap.get(qId);
        if (!eq) return null;

        const qVersion = eq.questionVersion;
        const optionsList = qVersion.options || [];

        // Apply frozen option orders if available
        let orderedOptions = [...optionsList];
        if (optionOrders[eq.id] && Array.isArray(optionOrders[eq.id])) {
          const optMap = new Map(optionsList.map((o) => [o.id, o]));
          orderedOptions = optionOrders[eq.id]
            .map((optId) => optMap.get(optId))
            .filter(Boolean) as typeof optionsList;
        }

        // Sanitize options (strip isCorrect for student client, preserve sequential A, B, C, D labels)
        const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
        const sanitizedOptions = orderedOptions.map((opt, optIdx) => ({
          id: opt.id,
          label: OPTION_LETTERS[optIdx] || opt.label,
          content: opt.content,
        }));

        // Content sanitize (strip answerKey)
        const rawContent = (qVersion.content as any) || {};

        return {
          examinationQuestionId: eq.id,
          sequenceNumber: idx + 1,
          type: eq.question.type,
          difficulty: eq.question.difficulty,
          points: Number(eq.points),
          isOptional: eq.isOptional,
          content: {
            text: rawContent.text || "",
            instructions: rawContent.instructions || "",
            imageUrl: rawContent.imageUrl || null,
          },
          options: sanitizedOptions,
        };
      })
      .filter(Boolean);

    // Answers map
    const studentAnswers = attempt.answers.map((a) => ({
      examinationQuestionId: a.examinationQuestionId,
      answerValue: a.answerValue,
      answerSequence: a.answerSequence,
      isDoubtful: a.isDoubtful,
      savedAt: a.savedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        student: {
          username: attempt.student?.username || session.user.username,
          displayName: attempt.student?.displayName || session.user.displayName,
          nis: attempt.student?.nis || null,
        },
        attempt: {
          id: attempt.id,
          status: attempt.status,
          incidentCount: attempt.incidentCount,
          startedAt: attempt.startedAt ? attempt.startedAt.toISOString() : null,
          deadlineAt: attempt.deadlineAt ? attempt.deadlineAt.toISOString() : null,
          submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
          remainingSeconds: timer.remainingSeconds,
          isExpired: timer.isExpired,
        },
        examination: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          subjectName: exam.subject?.name || "Mata Pelajaran",
          durationMinutes: exam.durationMinutes,
          passingScore: Number(exam.passingScore) || 75,
          allowReview: policy ? policy.allowReview : true,
          totalQuestions: sanitizedQuestions.length,
          policySettings: policy,
        },
        questions: sanitizedQuestions,
        answers: studentAnswers,
        result: attempt.result
          ? {
              totalScore: Number(attempt.result.totalScore),
              maxScore: Number(attempt.result.maxScore),
              percentage: Number(attempt.result.percentage),
              objectiveScore: attempt.result.objectiveScore ? Number(attempt.result.objectiveScore) : null,
              essayScore: attempt.result.essayScore ? Number(attempt.result.essayScore) : null,
              isProvisional: attempt.result.isProvisional,
              modificationReason: attempt.result.modificationReason || null,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("GET /api/student/examinations/[id]/attempt error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat status ujian." },
      { status: 500 }
    );
  }
}
