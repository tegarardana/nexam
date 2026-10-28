import { prisma } from "@/lib/prisma";
import { calculateDeadline, isWriteAllowed, isSubmissionAllowed, getTimerStatus } from "./timer";
import { generateFrozenRandomization } from "./shuffler";
import { evaluateAnswer, QuestionVersionSnapshot } from "./grading";

export interface StartAttemptResult {
  attemptId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  deadlineAt: string;
  durationMinutes: number;
  remainingSeconds: number;
  isResumed: boolean;
  questionOrder: string[];
  examination: {
    id: string;
    title: string;
    subjectName: string;
    totalQuestions: number;
    allowReview: boolean;
  };
}

/**
 * Starts or resumes a student's examination attempt with strict server-side validation.
 */
export async function getOrStartAttempt(
  studentId: string,
  examinationId: string,
  providedToken?: string
): Promise<StartAttemptResult> {
  const now = new Date();

  // 1. Fetch examination with policy settings and questions
  const exam = await prisma.examination.findUnique({
    where: { id: examinationId },
    include: {
      subject: true,
      policySettings: true,
      questions: {
        include: {
          questionVersion: {
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
        orderBy: { sequenceOrder: "asc" },
      },
    },
  });

  if (!exam) {
    throw new Error("Ujian tidak ditemukan.");
  }

  // 2. Validate exam status & schedule window
  if (exam.status === "draft" || exam.status === "ready") {
    throw new Error("Ujian masih dalam tahap persetujuan dan belum dijadwalkan oleh Guru Pengampu.");
  }

  // Check if scheduled end has passed
  if (now > exam.scheduledEnd) {
    if (exam.status !== "closed") {
      await prisma.examination.update({
        where: { id: exam.id },
        data: { status: "closed" },
      });
    }

    // Auto-submit any open attempt for this student
    const openAttempt = await prisma.examinationAttempt.findFirst({
      where: {
        examinationId,
        studentId,
        status: { in: ["in_progress", "warning", "blocked"] },
      },
    });

    if (openAttempt) {
      await submitAttempt(openAttempt.id, studentId);
    }

    throw new Error("Jadwal pelaksanaan ujian ini telah berakhir dan sesi ujian telah ditutup.");
  }

  if (exam.status !== "scheduled" && exam.status !== "in_progress") {
    throw new Error(`Ujian ini tidak dapat dimulai (Status saat ini: ${exam.status}).`);
  }

  if (exam.status === "scheduled" && now < exam.scheduledStart) {
    const formattedStart = exam.scheduledStart.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short",
    });
    throw new Error(`Ujian belum dibuka. Sesuai jadwal, ujian baru dapat dimulai pada ${formattedStart} WIB.`);
  }

  // 3. Validate participant registration
  let participant = await prisma.examinationParticipant.findUnique({
    where: {
      examinationId_studentId: {
        examinationId,
        studentId,
      },
    },
  });

  if (!participant) {
    // Check if student is actively enrolled in a class offering this exam's subject in this academic year
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId,
        academicYearId: exam.academicYearId,
        status: "active",
      },
      include: {
        classGroup: {
          include: { subjectOfferings: true },
        },
      },
    });

    const isClassEligible =
      enrollment &&
      (!exam.subjectId ||
        enrollment.classGroup.subjectOfferings.some((so) => so.subjectId === exam.subjectId));

    if (isClassEligible) {
      participant = await prisma.examinationParticipant.upsert({
        where: {
          examinationId_studentId: {
            examinationId,
            studentId,
          },
        },
        update: {
          classGroupId: enrollment.classGroupId,
          status: "eligible",
        },
        create: {
          examinationId,
          studentId,
          classGroupId: enrollment.classGroupId,
          status: "eligible",
        },
      });
    }
  }

  if (!participant || participant.status !== "eligible") {
    throw new Error("Anda tidak terdaftar sebagai peserta ujian ini.");
  }

  // 4. Validate token if required
  const policy = exam.policySettings;
  if (policy?.tokenRequired) {
    const validToken = participant.token || policy.globalToken;
    if (validToken) {
      if (!providedToken || providedToken.trim().toUpperCase() !== validToken.trim().toUpperCase()) {
        throw new Error("Token ujian tidak valid. Silakan hubungi pengawas ujian.");
      }
    }
  }

  // 5. Check existing attempts
  const existingAttempts = await prisma.examinationAttempt.findMany({
    where: {
      examinationId,
      studentId,
    },
    orderBy: { attemptNumber: "desc" },
  });

  const latestAttempt = existingAttempts[0];

  // If latest attempt is active (in_progress or warning), resume it
  if (latestAttempt && (latestAttempt.status === "in_progress" || latestAttempt.status === "warning")) {
    const timer = getTimerStatus(
      latestAttempt.startedAt || now,
      exam.durationMinutes,
      now,
      0,
      latestAttempt.deadlineAt
    );

    // If time is expired while status was in_progress, auto-expire
    if (timer.isExpired && policy?.autoSubmitOnTime) {
      await submitAttempt(studentId, examinationId, "auto_time_expired");
      throw new Error("Waktu pengerjaan ujian Anda telah habis.");
    }

    const questionOrder = (latestAttempt.questionOrder as string[]) || exam.questions.map((q) => q.id);

    return {
      attemptId: latestAttempt.id,
      attemptNumber: latestAttempt.attemptNumber,
      status: latestAttempt.status,
      startedAt: (latestAttempt.startedAt || now).toISOString(),
      deadlineAt: (latestAttempt.deadlineAt || timer.deadlineAt).toISOString(),
      durationMinutes: exam.durationMinutes,
      remainingSeconds: timer.remainingSeconds,
      isResumed: true,
      questionOrder,
      examination: {
        id: exam.id,
        title: exam.title,
        subjectName: exam.subject?.name || "Mata Pelajaran",
        totalQuestions: exam.questions.length,
        allowReview: policy ? policy.allowReview : true,
      },
    };
  }

  // If latest attempt is submitted or completed, check max attempts (default 1)
  if (latestAttempt && ["submitted", "grading_pending", "completed", "expired"].includes(latestAttempt.status)) {
    throw new Error("Anda sudah menyelesaikan ujian ini dan tidak dapat mengerjakan kembali.");
  }

  if (latestAttempt && latestAttempt.status === "blocked") {
    throw new Error("Sesi ujian Anda diblokir oleh pengawas karena pelanggaran tata tertib.");
  }

  // 6. Create new attempt
  const startedAt = now;
  const deadlineAt = calculateDeadline(startedAt, exam.durationMinutes);
  const nextAttemptNumber = (latestAttempt?.attemptNumber || 0) + 1;

  // Generate deterministic randomized ordering
  const attemptSeed = `${studentId}_${examinationId}_${nextAttemptNumber}`;
  const { questionOrder, optionOrders } = generateFrozenRandomization(
    exam.questions,
    attemptSeed,
    policy?.randomizeQuestions ?? false,
    policy?.randomizeOptions ?? false
  );

  const newAttempt = await prisma.examinationAttempt.create({
    data: {
      examinationId,
      studentId,
      attemptNumber: nextAttemptNumber,
      status: "in_progress",
      startedAt,
      deadlineAt,
      questionOrder,
      optionOrders,
      connectionStatus: "connected",
      lastHeartbeat: now,
    },
  });

  return {
    attemptId: newAttempt.id,
    attemptNumber: newAttempt.attemptNumber,
    status: newAttempt.status,
    startedAt: startedAt.toISOString(),
    deadlineAt: deadlineAt.toISOString(),
    durationMinutes: exam.durationMinutes,
    remainingSeconds: exam.durationMinutes * 60,
    isResumed: false,
    questionOrder,
    examination: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subject?.name || "Mata Pelajaran",
      totalQuestions: exam.questions.length,
      allowReview: policy ? policy.allowReview : true,
    },
  };
}

/**
 * Saves a student's answer with optimistic concurrency sequence validation.
 */
export async function saveAnswer(
  studentId: string,
  examinationId: string,
  examinationQuestionId: string,
  answerValue: any,
  clientSequence: number = 0,
  isDoubtful: boolean = false
) {
  const now = new Date();

  // 1. Fetch active attempt
  const attempt = await prisma.examinationAttempt.findFirst({
    where: {
      examinationId,
      studentId,
      status: { in: ["in_progress", "warning"] },
    },
    include: {
      examination: { select: { scheduledEnd: true, status: true } },
    },
  });

  if (!attempt) {
    throw new Error("Sesi ujian tidak aktif atau telah selesai.");
  }

  // Check if scheduledEnd has passed or exam is closed
  const examEnd = attempt.examination.scheduledEnd;
  if ((examEnd && now > examEnd) || attempt.examination.status === "closed") {
    await submitAttempt(attempt.id, studentId);
    throw new Error("Jadwal pelaksanaan ujian telah berakhir dan ujian telah ditutup.");
  }

  if (attempt.status === "blocked") {
    throw new Error("Sesi ujian diblokir. Penyimpanan jawaban ditolak.");
  }

  // 2. Validate server deadline
  if (attempt.deadlineAt && !isWriteAllowed(attempt.deadlineAt, now)) {
    throw new Error("Batas waktu ujian telah habis. Jawaban baru tidak dapat disimpan.");
  }

  // 3. Optimistic Concurrency check
  const existingAnswer = await prisma.examinationAnswer.findUnique({
    where: {
      attemptId_examinationQuestionId: {
        attemptId: attempt.id,
        examinationQuestionId,
      },
    },
  });

  if (existingAnswer && existingAnswer.answerSequence > clientSequence) {
    const err = new Error("Konflik urutan penyimpanan (Stale Sequence). Silakan muat ulang state terbaru.");
    (err as any).statusCode = 409;
    throw err;
  }

  const nextSequence = (existingAnswer?.answerSequence || clientSequence) + 1;

  // 4. Upsert answer
  const saved = await prisma.examinationAnswer.upsert({
    where: {
      attemptId_examinationQuestionId: {
        attemptId: attempt.id,
        examinationQuestionId,
      },
    },
    update: {
      answerValue: answerValue ?? null,
      answerSequence: nextSequence,
      isDoubtful,
      savedAt: now,
    },
    create: {
      attemptId: attempt.id,
      examinationQuestionId,
      answerValue: answerValue ?? null,
      answerSequence: nextSequence,
      isDoubtful,
      savedAt: now,
    },
  });

  return {
    saved: true,
    examinationQuestionId,
    answerSequence: saved.answerSequence,
    savedAt: saved.savedAt.toISOString(),
    isDoubtful: saved.isDoubtful,
  };
}

/**
 * Submits the examination attempt, runs auto-grading, and registers results.
 */
export async function submitAttempt(
  studentId: string,
  examinationId: string,
  reason: string = "manual_submit"
) {
  const now = new Date();

  // 1. Fetch attempt and questions with answers
  const attempt = await prisma.examinationAttempt.findFirst({
    where: {
      examinationId,
      studentId,
      status: { in: ["in_progress", "warning"] },
    },
    include: {
      examination: {
        include: {
          questions: {
            include: {
              question: true,
              questionVersion: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt) {
    throw new Error("Tidak ada sesi ujian aktif yang dapat diselesaikan.");
  }

  // 2. Validate submission deadline (grace period: 30s)
  if (attempt.deadlineAt && !isSubmissionAllowed(attempt.deadlineAt, now, 30)) {
    // If passed grace period, still accept submission but mark as auto_time_expired
    reason = "grace_period_expired";
  }

  const exam = attempt.examination;
  const answersMap = new Map(attempt.answers.map((a) => [a.examinationQuestionId, a.answerValue]));

  let totalRawScore = 0;
  let totalMaxScore = 0;
  let objectiveScore = 0;
  let essayScore = 0;
  let hasPendingEssay = false;

  const gradingRecordData: any[] = [];

  // 3. Grade each examination question
  for (const eq of exam.questions) {
    const qVersion = eq.questionVersion;
    const qType = eq.question.type;
    const maxScore = Number(eq.points) || 1.0;
    const studentAnswerValue = answersMap.get(eq.id);

    const snapshot: QuestionVersionSnapshot = {
      id: qVersion.id,
      questionId: eq.questionId,
      content: qVersion.content,
      gradingConfig: qVersion.gradingConfig as any,
      options: qVersion.options.map((o) => ({
        id: o.id,
        label: o.label,
        content: o.content,
        isCorrect: o.isCorrect,
        sortOrder: o.sortOrder,
      })),
    };

    const gradeResult = evaluateAnswer(qType, studentAnswerValue, snapshot, maxScore);

    totalMaxScore += maxScore;

    if (gradeResult.gradingMethod === "manual" || gradeResult.gradingStatus === "pending") {
      hasPendingEssay = true;
    } else {
      totalRawScore += gradeResult.rawScore;
      if (qType === "essay") {
        essayScore += gradeResult.rawScore;
      } else {
        objectiveScore += gradeResult.rawScore;
      }
    }

    gradingRecordData.push({
      attemptId: attempt.id,
      examinationQuestionId: eq.id,
      questionType: qType,
      rawScore: gradeResult.rawScore,
      maxScore: gradeResult.maxScore,
      gradingMethod: gradeResult.gradingMethod,
      gradingStatus: gradeResult.gradingStatus,
      teacherFeedback: gradeResult.feedback || null,
      autoGradedAt: gradeResult.gradingMethod === "auto" ? now : null,
    });
  }

  // 4. Save grading records in transaction
  await prisma.$transaction(async (tx) => {
    // Delete existing records if any
    await tx.gradingRecord.deleteMany({
      where: { attemptId: attempt.id },
    });

    // Create all grading records
    await tx.gradingRecord.createMany({
      data: gradingRecordData,
    });

    const finalStatus = hasPendingEssay ? "grading_pending" : "completed";
    const percentage = totalMaxScore > 0 ? (totalRawScore / totalMaxScore) * 100 : 0;

    // Update attempt
    await tx.examinationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: finalStatus,
        submittedAt: now,
      },
    });

    // Upsert examination result
    await tx.examinationResult.upsert({
      where: { attemptId: attempt.id },
      update: {
        totalScore: totalRawScore,
        maxScore: totalMaxScore,
        percentage: Math.round(percentage * 100) / 100,
        objectiveScore,
        essayScore,
        isProvisional: hasPendingEssay,
        finalizedAt: hasPendingEssay ? null : now,
      },
      create: {
        attemptId: attempt.id,
        studentId,
        examinationId,
        totalScore: totalRawScore,
        maxScore: totalMaxScore,
        percentage: Math.round(percentage * 100) / 100,
        objectiveScore,
        essayScore,
        isProvisional: hasPendingEssay,
        finalizedAt: hasPendingEssay ? null : now,
      },
    });
  });

  return {
    success: true,
    attemptId: attempt.id,
    submittedAt: now.toISOString(),
    status: hasPendingEssay ? "grading_pending" : "completed",
    hasPendingEssay,
    totalScore: totalRawScore,
    maxScore: totalMaxScore,
    percentage: totalMaxScore > 0 ? Math.round(((totalRawScore / totalMaxScore) * 100) * 100) / 100 : 0,
    reason,
  };
}
