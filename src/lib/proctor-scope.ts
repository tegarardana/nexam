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
  if (!assignedRoomOrClass || !assignedRoomOrClass.trim() || assignedRoomOrClass.trim().toLowerCase() === "all") {
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

    // Strip spaces & hyphens for comparing e.g. "x rpl 1" vs "x-rpl-1" or "xrpl1"
    const compactAssigned = normAssigned.replace(/[\s-_]+/g, "");
    const compactClass = normClass.replace(/[\s-_]+/g, "");
    if (compactAssigned && compactClass && compactAssigned === compactClass) {
      return true;
    }

    // Substring match if length is at least 3 chars to prevent accidental matches
    if (compactAssigned.length >= 3 && compactClass.length >= 3) {
      if (compactClass.includes(compactAssigned) || compactAssigned.includes(compactClass)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines whether a user is scoped to a specific room or class for a given examination.
 * A user has an assigned room if they have a proctor assignment with a non-empty roomName.
 * Administrators and exam creators have canAccessAll = true, allowing them to switch views,
 * but their assignedRoom is still preserved so default views focus on their assigned room.
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

  const assignment = examination.proctorAssignments?.find(
    (pa) => pa.proctorId === user.id
  );

  const assignedRoom = assignment?.roomName?.trim() || null;
  const isScoped = Boolean(assignedRoom);

  return {
    isScoped,
    assignedRoom,
    canAccessAll: isAdmin || isCreator || !assignedRoom,
  };
}
