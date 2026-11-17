import prisma from "@/lib/prisma";

/**
 * Synchronizes the `position` of teachers when homeroom assignments change.
 * 1. If a teacher is assigned as homeroom teacher, update position to 'Wali Kelas'.
 * 2. If an old homeroom teacher is replaced or unassigned, check if they still have
 *    any active homeroom classes. If not, revert position to 'Guru'.
 */
export async function syncHomeroomTeacherPositions(
  oldTeacherId?: string | null,
  newTeacherId?: string | null,
  excludedClassId?: string
) {
  // 1. If old teacher exists and changed/removed
  if (oldTeacherId && oldTeacherId !== newTeacherId) {
    const remainingCount = await prisma.classGroup.count({
      where: {
        homeroomTeacherId: oldTeacherId,
        isActive: true,
        ...(excludedClassId ? { id: { not: excludedClassId } } : {}),
      },
    });

    if (remainingCount === 0) {
      await prisma.user.updateMany({
        where: { id: oldTeacherId, position: "Wali Kelas" },
        data: { position: "Guru" },
      });
    }
  }

  // 2. If new teacher is assigned as homeroom teacher
  if (newTeacherId) {
    await prisma.user.update({
      where: { id: newTeacherId },
      data: { position: "Wali Kelas" },
    });
  }
}

/**
 * One-time migration/sync query to fix all existing mismatched positions in the database.
 * - Any teacher who is currently assigned as homeroom teacher for at least one active class -> 'Wali Kelas'
 * - Any teacher whose position is currently 'Wali Kelas' but has NO active homeroom classes -> 'Guru'
 */
export async function syncAllHomeroomTeacherPositions() {
  // 1. Find all active homeroom teacher IDs from active class groups
  const activeHomeroomClasses = await prisma.classGroup.findMany({
    where: {
      isActive: true,
      homeroomTeacherId: { not: null },
    },
    select: { homeroomTeacherId: true },
  });

  const activeTeacherIds = Array.from(
    new Set(activeHomeroomClasses.map((c) => c.homeroomTeacherId).filter(Boolean) as string[])
  );

  let updatedToWaliKelasCount = 0;
  let revertedToGuruCount = 0;

  // 2. Update any active homeroom teacher whose position is NOT 'Wali Kelas'
  if (activeTeacherIds.length > 0) {
    const resWali = await prisma.user.updateMany({
      where: {
        id: { in: activeTeacherIds },
        position: { not: "Wali Kelas" },
      },
      data: { position: "Wali Kelas" },
    });
    updatedToWaliKelasCount = resWali.count;
  }

  // 3. Revert any user who has position 'Wali Kelas' but is NOT in activeTeacherIds to 'Guru'
  const resGuru = await prisma.user.updateMany({
    where: {
      position: "Wali Kelas",
      ...(activeTeacherIds.length > 0 ? { id: { notIn: activeTeacherIds } } : {}),
    },
    data: { position: "Guru" },
  });
  revertedToGuruCount = resGuru.count;

  return {
    updatedToWaliKelasCount,
    revertedToGuruCount,
    activeHomeroomTeacherCount: activeTeacherIds.length,
  };
}
