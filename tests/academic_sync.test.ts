import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  syncHomeroomTeacherPositions,
  syncAllHomeroomTeacherPositions,
} from "../src/lib/academic-sync";
import prisma from "../src/lib/prisma";

vi.mock("../src/lib/prisma", () => {
  return {
    default: {
      classGroup: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      user: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  };
});

describe("Homeroom Teacher Position Synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncHomeroomTeacherPositions", () => {
    it("updates new teacher position to 'Wali Kelas' when assigned", async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({ id: "teacher-1", position: "Wali Kelas" } as any);

      await syncHomeroomTeacherPositions(null, "teacher-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "teacher-1" },
        data: { position: "Wali Kelas" },
      });
    });

    it("reverts old teacher position to 'Guru' if they have 0 remaining homeroom classes", async () => {
      vi.mocked(prisma.classGroup.count).mockResolvedValue(0);
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.user.update).mockResolvedValue({ id: "teacher-2", position: "Wali Kelas" } as any);

      await syncHomeroomTeacherPositions("teacher-1", "teacher-2", "class-abc");

      // Verify count check excludes the current class if provided
      expect(prisma.classGroup.count).toHaveBeenCalledWith({
        where: {
          homeroomTeacherId: "teacher-1",
          isActive: true,
          id: { not: "class-abc" },
        },
      });

      // Old teacher reverted
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "teacher-1", position: "Wali Kelas" },
        data: { position: "Guru" },
      });

      // New teacher assigned
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "teacher-2" },
        data: { position: "Wali Kelas" },
      });
    });

    it("does NOT revert old teacher position to 'Guru' if they still have other active homeroom classes", async () => {
      vi.mocked(prisma.classGroup.count).mockResolvedValue(1); // Still has 1 class!
      vi.mocked(prisma.user.update).mockResolvedValue({ id: "teacher-2", position: "Wali Kelas" } as any);

      await syncHomeroomTeacherPositions("teacher-1", "teacher-2", "class-abc");

      expect(prisma.classGroup.count).toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "teacher-2" },
        data: { position: "Wali Kelas" },
      });
    });

    it("reverts old teacher when homeroom is unassigned (newTeacherId is null) and has no other classes", async () => {
      vi.mocked(prisma.classGroup.count).mockResolvedValue(0);
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 });

      await syncHomeroomTeacherPositions("teacher-1", null, "class-abc");

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "teacher-1", position: "Wali Kelas" },
        data: { position: "Guru" },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("syncAllHomeroomTeacherPositions", () => {
    it("updates all active homeroom teachers to 'Wali Kelas' and reverts orphan 'Wali Kelas' to 'Guru'", async () => {
      vi.mocked(prisma.classGroup.findMany).mockResolvedValue([
        { homeroomTeacherId: "teacher-1" },
        { homeroomTeacherId: "teacher-2" },
      ] as any);

      vi.mocked(prisma.user.updateMany)
        .mockResolvedValueOnce({ count: 2 }) // updatedToWaliKelas
        .mockResolvedValueOnce({ count: 1 }); // revertedToGuru

      const result = await syncAllHomeroomTeacherPositions();

      expect(result).toEqual({
        updatedToWaliKelasCount: 2,
        revertedToGuruCount: 1,
        activeHomeroomTeacherCount: 2,
      });

      expect(prisma.user.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: { in: ["teacher-1", "teacher-2"] },
          position: { not: "Wali Kelas" },
        },
        data: { position: "Wali Kelas" },
      });

      expect(prisma.user.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          position: "Wali Kelas",
          id: { notIn: ["teacher-1", "teacher-2"] },
        },
        data: { position: "Guru" },
      });
    });
  });
});
