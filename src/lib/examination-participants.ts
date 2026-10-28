import prisma from "@/lib/prisma";

/**
 * Automatically enrolls active students in the target class groups or all classes
 * taking the examination's subject for that academic year into examination_participants.
 */
export async function autoEnrollEligibleStudents(examinationId: string): Promise<number> {
  const exam = await prisma.examination.findUnique({
    where: { id: examinationId },
    select: {
      id: true,
      subjectId: true,
      academicYearId: true,
      _count: { select: { participants: true } },
    },
  });

  if (!exam) return 0;

  // Find class groups taking this subject in this academic year
  let targetClassGroupIds: string[] = [];

  if (exam.subjectId) {
    const offerings = await prisma.subjectOffering.findMany({
      where: {
        subjectId: exam.subjectId,
        academicYearId: exam.academicYearId,
      },
      select: { classGroupId: true },
    });
    targetClassGroupIds = Array.from(new Set(offerings.map((o) => o.classGroupId)));
  }

  // Find all active enrollments in those classes (or in the academic year if no subject constraint)
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      academicYearId: exam.academicYearId,
      status: "active",
      ...(targetClassGroupIds.length > 0 ? { classGroupId: { in: targetClassGroupIds } } : {}),
    },
    select: {
      studentId: true,
      classGroupId: true,
    },
  });

  if (enrollments.length === 0) return 0;

  let enrolledCount = 0;
  for (const enr of enrollments) {
    await prisma.examinationParticipant.upsert({
      where: {
        examinationId_studentId: {
          examinationId: exam.id,
          studentId: enr.studentId,
        },
      },
      update: {
        classGroupId: enr.classGroupId,
        status: "eligible",
      },
      create: {
        examinationId: exam.id,
        studentId: enr.studentId,
        classGroupId: enr.classGroupId,
        status: "eligible",
      },
    });
    enrolledCount++;
  }

  return enrolledCount;
}

/**
 * Enrolls all active students from specific class groups into an examination.
 */
export async function enrollClassGroups(
  examinationId: string,
  classGroupIds: string[]
): Promise<number> {
  const exam = await prisma.examination.findUnique({
    where: { id: examinationId },
    select: { id: true, academicYearId: true },
  });

  if (!exam || classGroupIds.length === 0) return 0;

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      classGroupId: { in: classGroupIds },
      academicYearId: exam.academicYearId,
      status: "active",
    },
    select: {
      studentId: true,
      classGroupId: true,
    },
  });

  let enrolledCount = 0;
  for (const enr of enrollments) {
    await prisma.examinationParticipant.upsert({
      where: {
        examinationId_studentId: {
          examinationId: exam.id,
          studentId: enr.studentId,
        },
      },
      update: {
        classGroupId: enr.classGroupId,
        status: "eligible",
      },
      create: {
        examinationId: exam.id,
        studentId: enr.studentId,
        classGroupId: enr.classGroupId,
        status: "eligible",
      },
    });
    enrolledCount++;
  }

  return enrolledCount;
}

/**
 * Resolves all examinations assigned/eligible to a student, whether assigned directly,
 * assigned via class group, or scheduled for their class subject offerings.
 * Also ensures an examinationParticipant record exists for frictionless attempt creation.
 */
export async function getEligibleExamsForStudent(studentId: string) {
  const { syncExaminationStates } = await import("@/lib/examination-state");
  await syncExaminationStates();

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      studentId,
      status: "active",
    },
    include: {
      classGroup: {
        include: {
          subjectOfferings: true,
        },
      },
    },
  });

  const offeredSubjectIds = enrollment?.classGroup?.subjectOfferings.map((s) => s.subjectId) || [];
  const classGroupId = enrollment?.classGroupId || null;
  const academicYearId = enrollment?.academicYearId || null;

  // 1. Direct participant examinations
  const directParticipants = await prisma.examinationParticipant.findMany({
    where: {
      studentId,
      status: "eligible",
    },
    include: {
      examination: {
        include: {
          subject: true,
          academicYear: true,
          semester: true,
          policySettings: true,
          _count: { select: { questions: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  const knownExamIds = new Set<string>();
  const directExams: any[] = [];
  for (const dp of directParticipants) {
    if (dp.examination) {
      knownExamIds.add(dp.examination.id);
      directExams.push(dp.examination);
    }
  }

  // 2. Class-level examinations or exams matching student's subject offerings
  let additionalExams: any[] = [];
  if (classGroupId && academicYearId) {
    additionalExams = await prisma.examination.findMany({
      where: {
        id: { notIn: Array.from(knownExamIds) },
        academicYearId,
        status: { in: ["scheduled", "in_progress", "closed", "grading", "finalized"] },
        OR: [
          // Exam explicitly has participants from student's class
          {
            participants: {
              some: { classGroupId, status: "eligible" },
            },
          },
          // Or exam has NO participant records yet and matches class subject offering (or is general)
          {
            participants: { none: {} },
            ...(offeredSubjectIds.length > 0
              ? {
                  OR: [
                    { subjectId: { in: offeredSubjectIds } },
                    { subjectId: null },
                  ],
                }
              : {}),
          },
        ],
      },
      include: {
        subject: true,
        academicYear: true,
        semester: true,
        policySettings: true,
        _count: { select: { questions: true } },
      },
      orderBy: { scheduledStart: "desc" },
    });

    // Auto-upsert participant records for these eligible exams to ensure complete compatibility
    for (const exam of additionalExams) {
      await prisma.examinationParticipant.upsert({
        where: {
          examinationId_studentId: {
            examinationId: exam.id,
            studentId,
          },
        },
        update: {
          classGroupId,
          status: "eligible",
        },
        create: {
          examinationId: exam.id,
          studentId,
          classGroupId,
          status: "eligible",
        },
      });
    }
  }

  const allExams = [...directExams, ...additionalExams];

  // Filter for valid lifecycle statuses
  return allExams.filter(
    (e) => e && ["scheduled", "in_progress", "closed", "grading", "finalized"].includes(e.status)
  );
}
