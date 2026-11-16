import { prisma } from "./prisma";

/**
 * Normalizes strings by removing common prefixes ("kelas", "ruang", "ruangan", "rombel", "lab"),
 * punctuation, and excessive spaces for smart matching between proctor room assignment and student class.
 */
export function normalizeRoomOrClass(value?: string | null): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^(kelas|ruang|ruangan|rombel|lab)\s+/i, "")
    .replace(/[-_\s]+/g, " ")
    .trim();
}

/**
 * Checks if a student belongs to the assigned room or class group.
 * Supports:
 * - Direct UUID matching (if roomName is classGroupId)
 * - Exact class name matching (case-insensitive)
 * - Normalized matching (e.g. "Ruang X-TKJ-1" matches "X-TKJ-1")
 * - Substring matching for descriptive room names (e.g. "Lab 1 (X-TKJ-1)" matches "X-TKJ-1")
 */
export function isStudentInAssignedRoom(
  student: { classGroupId?: string | null; className?: string | null },
  assignedRoomOrClass?: string | null
): boolean {
  if (!assignedRoomOrClass || !assignedRoomOrClass.trim()) {
    // Not scoped: proctor has full access across all rooms/classes
    return true;
  }

  const rawAssigned = assignedRoomOrClass.trim();
  const rawClassName = (student.className || "").trim();
  const rawGroupId = (student.classGroupId || "").trim();

  // 1. Direct match with classGroupId
  if (rawGroupId && rawGroupId.toLowerCase() === rawAssigned.toLowerCase()) {
    return true;
  }

  // 2. Direct exact match with className (case-insensitive)
  if (rawClassName && rawClassName.toLowerCase() === rawAssigned.toLowerCase()) {
    return true;
  }

  // 3. Normalized string match
  const normAssigned = normalizeRoomOrClass(rawAssigned);
  const normClass = normalizeRoomOrClass(rawClassName);

  if (normAssigned && normClass) {
    if (normAssigned === normClass) {
      return true;
    }

    // Substring match if length is at least 3 chars to prevent accidental matches
    if (normAssigned.length >= 3 && normClass.length >= 3) {
      if (normClass.includes(normAssigned) || normAssigned.includes(normClass)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines whether a user is scoped to a specific room or class for a given examination.
 */
export function getProctorScope(
  examination: {
    createdById: string;
    proctorAssignments?: Array<{ proctorId: string; roomName?: string | null }>;
  },
  user: { id: string; roles: string[] }
): {
  isScoped: boolean;
  assignedRoom: string | null;
  canAccessAll: boolean;
} {
  const isAdmin = user.roles.includes("administrator");
  const isCreator = examination.createdById === user.id;

  if (isAdmin || isCreator) {
    return {
      isScoped: false,
      assignedRoom: null,
      canAccessAll: true,
    };
  }

  const assignment = examination.proctorAssignments?.find(
    (pa) => pa.proctorId === user.id
  );

  const assignedRoom = assignment?.roomName?.trim() || null;
  const isScoped = Boolean(assignedRoom);

  return {
    isScoped,
    assignedRoom,
    canAccessAll: !isScoped,
  };
}

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
