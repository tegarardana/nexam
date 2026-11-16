import prisma from "@/lib/prisma";
import { ExaminationStatus } from "@/lib/validation/examination";

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

export const VALID_EXAM_TRANSITIONS: Record<ExaminationStatus, ExaminationStatus[]> = {
  draft: ["ready", "archived"],
  ready: ["draft", "scheduled", "in_progress", "archived"],
  scheduled: ["draft", "in_progress", "closed", "archived"],
  in_progress: ["closed"],
  closed: ["grading", "finalized", "archived", "scheduled", "ready", "in_progress"],
  grading: ["finalized", "closed", "archived"],
  finalized: ["archived", "scheduled"],
  archived: ["scheduled", "ready", "draft"],
};

export async function validateExaminationTransition(
  examinationId: string,
  targetStatus: ExaminationStatus,
  overrides?: { scheduledStart?: Date; scheduledEnd?: Date }
): Promise<TransitionResult> {
  const exam = await prisma.examination.findUnique({
    where: { id: examinationId },
    include: {
      questions: {
        include: {
          question: true,
        },
      },
      policySettings: true,
    },
  });

  if (!exam) {
    return { allowed: false, reason: "Ujian tidak ditemukan" };
  }

  const currentStatus = exam.status as ExaminationStatus;

  // Check valid transition path
  const allowedNext = VALID_EXAM_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Transisi status tidak valid dari '${currentStatus}' ke '${targetStatus}'`,
    };
  }

  // Preconditions for transitioning from 'draft' or 'archived' -> 'ready' or 'scheduled'
  if (targetStatus === "ready" || targetStatus === "scheduled") {
    if (exam.questions.length === 0) {
      return {
        allowed: false,
        reason: "Ujian tidak dapat dipublikasikan tanpa butir soal. Tambahkan minimal 1 butir soal.",
      };
    }

    if (!exam.policySettings) {
      return {
        allowed: false,
        reason: "Pengaturan kebijakan anti-cheat ujian belum dikonfigurasi.",
      };
    }

    const start = overrides?.scheduledStart || exam.scheduledStart;
    const end = overrides?.scheduledEnd || exam.scheduledEnd;

    if (end <= start) {
      return {
        allowed: false,
        reason: "Jadwal selesai ujian harus lebih lambat dari jadwal mulai.",
      };
    }
  }

  return { allowed: true };
}

/**
 * Automatically starts scheduled examinations whose scheduled start time has arrived,
 * updating status from 'scheduled' to 'in_progress' and auto-enrolling eligible students.
 */
export async function autoStartScheduledExaminations(): Promise<number> {
  const now = new Date();

  // Find all examinations currently in 'scheduled' status where scheduledStart has arrived and window hasn't ended
  const dueExams = await prisma.examination.findMany({
    where: {
      status: "scheduled",
      scheduledStart: { lte: now },
      scheduledEnd: { gte: now },
    },
    select: {
      id: true,
      title: true,
      _count: { select: { participants: true } },
    },
  });

  if (dueExams.length === 0) return 0;

  for (const exam of dueExams) {
    await prisma.examination.update({
      where: { id: exam.id },
      data: {
        status: "in_progress",
        publishedAt: now,
      },
    });

    if (exam._count.participants === 0) {
      const { autoEnrollEligibleStudents } = await import("@/lib/examination-participants");
      await autoEnrollEligibleStudents(exam.id);
    }
  }

  return dueExams.length;
}

/**
 * Automatically closes examinations whose scheduled end time has passed.
 * Also auto-submits any active student attempts for these exams.
 */
export async function autoCloseExpiredExaminations(): Promise<number> {
  const now = new Date();

  // Find examinations in 'scheduled' or 'in_progress' where scheduledEnd < now
  const expiredExams = await prisma.examination.findMany({
    where: {
      status: { in: ["scheduled", "in_progress"] },
      scheduledEnd: { lt: now },
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (expiredExams.length === 0) return 0;

  for (const exam of expiredExams) {
    // 1. Transition exam status to 'closed'
    await prisma.examination.update({
      where: { id: exam.id },
      data: {
        status: "closed",
      },
    });

    // 2. Find any open attempts and auto-submit them
    const openAttempts = await prisma.examinationAttempt.findMany({
      where: {
        examinationId: exam.id,
        status: { in: ["in_progress", "warning", "blocked"] },
      },
      select: {
        id: true,
        studentId: true,
      },
    });

    if (openAttempts.length > 0) {
      const { submitAttempt } = await import("@/lib/exam-engine/attempt-manager");
      for (const att of openAttempts) {
        try {
          await submitAttempt(att.studentId, exam.id, "time_expired");
        } catch (err) {
          console.error(`Auto-closing attempt ${att.id} failed:`, err);
        }
      }
    }
  }

  return expiredExams.length;
}

/**
 * Automatically archives all examinations of a semester when it is deactivated/archived.
 * Any open attempts are auto-submitted, and non-finalized examinations are transitioned to 'archived'.
 */
export async function autoArchiveSemesterExaminations(
  semesterId: string
): Promise<{ archivedExams: number; submittedAttempts: number }> {
  // 1. Find all active/pending/in-progress examinations belonging to this semester
  const examinations = await prisma.examination.findMany({
    where: {
      semesterId,
      status: { in: ["draft", "ready", "scheduled", "in_progress", "closed", "grading"] },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (examinations.length === 0) {
    return { archivedExams: 0, submittedAttempts: 0 };
  }

  const examIds = examinations.map((e) => e.id);

  // 2. Find and submit any open attempts
  const openAttempts = await prisma.examinationAttempt.findMany({
    where: {
      examinationId: { in: examIds },
      status: { in: ["in_progress", "warning", "blocked"] },
    },
    select: {
      id: true,
      studentId: true,
      examinationId: true,
    },
  });

  let submittedAttempts = 0;
  if (openAttempts.length > 0) {
    const { submitAttempt } = await import("@/lib/exam-engine/attempt-manager");
    for (const att of openAttempts) {
      try {
        await submitAttempt(att.studentId, att.examinationId, "semester_transition_archive");
        submittedAttempts++;
      } catch (err) {
        console.error(`Auto-archiving attempt ${att.id} error:`, err);
        await prisma.examinationAttempt.update({
          where: { id: att.id },
          data: { status: "completed", submittedAt: new Date() },
        });
      }
    }
  }

  // 3. Mark examinations as archived
  const result = await prisma.examination.updateMany({
    where: {
      id: { in: examIds },
    },
    data: {
      status: "archived",
    },
  });

  return { archivedExams: result.count, submittedAttempts };
}

/**
 * Automatically archives all examinations of an academic year when it is archived.
 */
export async function autoArchiveAcademicYearExaminations(
  academicYearId: string
): Promise<{ archivedExams: number; submittedAttempts: number }> {
  const examinations = await prisma.examination.findMany({
    where: {
      academicYearId,
      status: { in: ["draft", "ready", "scheduled", "in_progress", "closed", "grading"] },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (examinations.length === 0) {
    return { archivedExams: 0, submittedAttempts: 0 };
  }

  const examIds = examinations.map((e) => e.id);

  const openAttempts = await prisma.examinationAttempt.findMany({
    where: {
      examinationId: { in: examIds },
      status: { in: ["in_progress", "warning", "blocked"] },
    },
    select: {
      id: true,
      studentId: true,
      examinationId: true,
    },
  });

  let submittedAttempts = 0;
  if (openAttempts.length > 0) {
    const { submitAttempt } = await import("@/lib/exam-engine/attempt-manager");
    for (const att of openAttempts) {
      try {
        await submitAttempt(att.studentId, att.examinationId, "academic_year_archive");
        submittedAttempts++;
      } catch (err) {
        console.error(`Auto-archiving attempt ${att.id} error:`, err);
        await prisma.examinationAttempt.update({
          where: { id: att.id },
          data: { status: "completed", submittedAt: new Date() },
        });
      }
    }
  }

  const result = await prisma.examination.updateMany({
    where: {
      id: { in: examIds },
    },
    data: {
      status: "archived",
    },
  });

  return { archivedExams: result.count, submittedAttempts };
}

/**
 * Syncs examination states: starts exams whose start window arrived,
 * and closes exams whose scheduled end time passed.
 */
export async function syncExaminationStates(): Promise<{ autoStarted: number; autoClosed: number }> {
  const autoStarted = await autoStartScheduledExaminations();
  const autoClosed = await autoCloseExpiredExaminations();
  return { autoStarted, autoClosed };
}

