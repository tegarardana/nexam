import { prisma } from "./prisma";
import { isStudentInAssignedRoom } from "./proctor-scope";

export * from "./proctor-scope";

/**
 * Verifies if an actor (teacher/proctor) is authorized to intervene or inspect an attempt,
 * strictly verifying room/class bounds if the proctor has an assigned room.
 */
export async function verifyProctorCanAccessAttempt(
  attemptId: string,
  user: { id: string; roles: string[] }
): Promise<{ allowed: boolean; error?: string; attempt?: any }> {
  const isAdmin = user.roles.includes("administrator");
  if (isAdmin) {
    return { allowed: true };
  }

  const attempt = await prisma.examinationAttempt.findUnique({
    where: { id: attemptId },
    include: {
      examination: {
        include: {
          proctorAssignments: true,
        },
      },
      student: {
        include: {
          studentEnrollments: {
            where: { status: "active" },
            include: { classGroup: true },
          },
        },
      },
    },
  });

  if (!attempt) {
    return { allowed: false, error: "Sesi ujian tidak ditemukan." };
  }

  const isCreator = attempt.examination.createdById === user.id;
  if (isCreator) {
    return { allowed: true, attempt };
  }

  const myAssignment = attempt.examination.proctorAssignments.find(
    (pa) => pa.proctorId === user.id
  );

  if (!myAssignment) {
    return {
      allowed: false,
      error: "Akses ditolak: Anda bukan pembuat ujian atau pengawas yang ditugaskan pada ujian ini.",
    };
  }

  const assignedRoom = myAssignment.roomName?.trim();
  if (!assignedRoom) {
    // Proctor has no room restriction
    return { allowed: true, attempt };
  }

  // Lookup participant data for class matching
  const participant = await prisma.examinationParticipant.findUnique({
    where: {
      examinationId_studentId: {
        examinationId: attempt.examinationId,
        studentId: attempt.studentId,
      },
    },
    include: { classGroup: true },
  });

  const studentClass =
    participant?.classGroup?.name ||
    attempt.student?.studentEnrollments?.[0]?.classGroup?.name ||
    null;
  const studentGroupId =
    participant?.classGroupId ||
    attempt.student?.studentEnrollments?.[0]?.classGroupId ||
    null;

  const inRoom = isStudentInAssignedRoom(
    { classGroupId: studentGroupId, className: studentClass },
    assignedRoom
  );

  if (!inRoom) {
    return {
      allowed: false,
      error: `Akses ditolak: Siswa ini berada di luar ruang/kelas tugas pengawasan Anda (${assignedRoom}).`,
    };
  }

  return { allowed: true, attempt };
}
