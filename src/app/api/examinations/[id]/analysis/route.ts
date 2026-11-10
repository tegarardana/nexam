import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
      return NextResponse.json(
        { success: false, error: "Akses tidak diizinkan." },
        { status: 401 }
      );
    }

    const { id: examinationId } = await params;

    // 1. Fetch examination info
    const exam = await prisma.examination.findUnique({
      where: { id: examinationId },
      include: {
        subject: {
          select: { id: true, name: true, code: true },
        },
        academicYear: {
          select: { id: true, name: true },
        },
        semester: {
          select: { id: true, name: true },
        },
        session: {
          select: { id: true, name: true, startTime: true, endTime: true },
        },
        examinationType: {
          select: { id: true, name: true, code: true },
        },
        questions: {
          orderBy: { sequenceOrder: "asc" },
          include: {
            question: {
              select: {
                id: true,
                type: true,
                difficulty: true,
                category: {
                  select: { id: true, name: true },
                },
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
        },
      },
    });

    if (!exam) {
      return NextResponse.json(
        { success: false, error: "Jadwal ujian tidak ditemukan." },
        { status: 404 }
      );
    }

    // 2. Fetch attempts for this exam (focus on attempts that have started or completed)
    const attempts = await prisma.examinationAttempt.findMany({
      where: {
        examinationId,
        status: {
          in: ["in_progress", "warning", "blocked", "submitted", "completed", "grading_pending"],
        },
      },
      include: {
        answers: true,
        gradingRecords: true,
      },
    });

    const totalParticipantsTaking = attempts.length;

    // 3. Aggregate item analysis for each examination question
    const itemAnalysis = (exam.questions || []).map((eq, index) => {
      const q = eq.question;
      const version = eq.questionVersion;
      const options = version.options || [];
      const questionType = q.type;
      const maxPoints = Number(eq.points) || 1;

      // Collect all answers for this specific question
      const answersForQuestion = attempts.map((att) => {
        const ans = att.answers.find((a) => a.examinationQuestionId === eq.id);
        const grading = att.gradingRecords.find((g) => g.examinationQuestionId === eq.id);
        return {
          attemptId: att.id,
          answerValue: ans?.answerValue ?? null,
          rawScore: grading?.rawScore !== undefined && grading?.rawScore !== null ? Number(grading.rawScore) : null,
          maxScore: grading?.maxScore !== undefined && grading?.maxScore !== null ? Number(grading.maxScore) : maxPoints,
        };
      });

      // Frequency of options (A, B, C, D, E, etc.)
      const optionMap: Record<string, { count: number; option: typeof options[0] }> = {};
      options.forEach((opt) => {
        optionMap[opt.id] = { count: 0, option: opt };
      });

      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;

      answersForQuestion.forEach((a) => {
        const val = a.answerValue;

        // Check unanswered
        if (val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
          unansweredCount += 1;
          return;
        }

        // Tally option distribution
        if (questionType === "single_choice" || questionType === "true_false") {
          const strVal = String(val).trim();
          // match by option id or label
          const matchedOpt = options.find(
            (o) => o.id === strVal || o.label.toLowerCase() === strVal.toLowerCase()
          );
          if (matchedOpt && optionMap[matchedOpt.id]) {
            optionMap[matchedOpt.id].count += 1;
          }
        } else if (questionType === "multi_select") {
          const selectedArr = Array.isArray(val) ? val.map((v) => String(v).trim()) : [String(val).trim()];
          selectedArr.forEach((s) => {
            const matchedOpt = options.find(
              (o) => o.id === s || o.label.toLowerCase() === s.toLowerCase()
            );
            if (matchedOpt && optionMap[matchedOpt.id]) {
              optionMap[matchedOpt.id].count += 1;
            }
          });
        }

        // Determine if answer is correct or incorrect
        if (a.rawScore !== null) {
          // If graded
          if (a.rawScore >= a.maxScore && a.maxScore > 0) {
            correctCount += 1;
          } else if (a.rawScore > 0 && a.rawScore < a.maxScore) {
            // Partial correct -> count as partially correct / incorrect
            incorrectCount += 1;
          } else {
            incorrectCount += 1;
          }
        } else {
          // Evaluate dynamically for objective types
          if (questionType === "single_choice" || questionType === "true_false") {
            const correctOpt = options.find((o) => o.isCorrect);
            if (correctOpt) {
              const isMatch =
                String(val).trim() === correctOpt.id ||
                String(val).trim().toUpperCase() === correctOpt.label.toUpperCase();
              if (isMatch) correctCount += 1;
              else incorrectCount += 1;
            } else {
              incorrectCount += 1;
            }
          } else {
            // default fallback for un-graded essay / other
            incorrectCount += 1;
          }
        }
      });

      const answeredCount = correctCount + incorrectCount;

      // Item Difficulty Index (P): P = Total Correct / Total Participants
      // When participants = 0, default to 0
      const difficultyIndex =
        totalParticipantsTaking > 0
          ? Number((correctCount / totalParticipantsTaking).toFixed(2))
          : 0;

      // Category based on classical test theory:
      // P > 0.70 => Mudah
      // 0.30 <= P <= 0.70 => Sedang
      // P < 0.30 => Sukar
      let difficultyCategory: "easy" | "medium" | "hard" = "medium";
      if (difficultyIndex > 0.7) {
        difficultyCategory = "easy";
      } else if (difficultyIndex < 0.3) {
        difficultyCategory = "hard";
      }

      // Format options distribution
      const optionDistribution = options.map((opt) => {
        const count = optionMap[opt.id]?.count || 0;
        const percentage =
          totalParticipantsTaking > 0
            ? Number(((count / totalParticipantsTaking) * 100).toFixed(1))
            : 0;

        let optContentText = "";
        if (opt.content && typeof opt.content === "object") {
          optContentText = (opt.content as any).text || "";
        } else if (typeof opt.content === "string") {
          optContentText = opt.content;
        }

        return {
          id: opt.id,
          label: opt.label,
          text: optContentText,
          isCorrect: opt.isCorrect,
          count,
          percentage,
        };
      });

      // Extract question version content
      let contentText = "";
      if (version.content && typeof version.content === "object") {
        contentText = (version.content as any).text || "";
      } else if (typeof version.content === "string") {
        contentText = version.content;
      }

      return {
        sequenceOrder: eq.sequenceOrder || index + 1,
        examinationQuestionId: eq.id,
        questionId: q.id,
        questionType,
        points: maxPoints,
        text: contentText,
        difficultyLabel: q.difficulty || "medium",
        categoryName: q.category?.name || null,
        stats: {
          totalParticipants: totalParticipantsTaking,
          answeredCount,
          correctCount,
          incorrectCount,
          unansweredCount,
          correctPercentage:
            totalParticipantsTaking > 0
              ? Number(((correctCount / totalParticipantsTaking) * 100).toFixed(1))
              : 0,
          incorrectPercentage:
            totalParticipantsTaking > 0
              ? Number(((incorrectCount / totalParticipantsTaking) * 100).toFixed(1))
              : 0,
          unansweredPercentage:
            totalParticipantsTaking > 0
              ? Number(((unansweredCount / totalParticipantsTaking) * 100).toFixed(1))
              : 0,
          difficultyIndex,
          difficultyCategory,
        },
        optionDistribution,
      };
    });

    // Summary statistics of the exam
    const easyCount = itemAnalysis.filter((item) => item.stats.difficultyCategory === "easy").length;
    const mediumCount = itemAnalysis.filter((item) => item.stats.difficultyCategory === "medium").length;
    const hardCount = itemAnalysis.filter((item) => item.stats.difficultyCategory === "hard").length;
    const avgDifficulty =
      itemAnalysis.length > 0
        ? Number(
            (
              itemAnalysis.reduce((acc, curr) => acc + curr.stats.difficultyIndex, 0) /
              itemAnalysis.length
            ).toFixed(2)
          )
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        examination: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          status: exam.status,
          durationMinutes: exam.durationMinutes,
          scheduledStart: exam.scheduledStart,
          scheduledEnd: exam.scheduledEnd,
          totalPoints: Number(exam.totalPoints),
          passingScore: exam.passingScore,
          subjectName: exam.subject?.name || "-",
          subjectCode: exam.subject?.code || "-",
          academicYear: exam.academicYear?.name || "-",
          semester: exam.semester?.name || "-",
          sessionName: exam.session?.name || null,
          typeName: exam.examinationType?.name || null,
          typeCode: exam.examinationType?.code || null,
        },
        summary: {
          totalQuestions: exam.questions?.length || 0,
          totalParticipantsTaking,
          avgDifficulty,
          easyCount,
          mediumCount,
          hardCount,
        },
        itemAnalysis,
      },
    });
  } catch (error) {
    console.error("GET /api/examinations/[id]/analysis error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat memproses data analisis soal." },
      { status: 500 }
    );
  }
}
