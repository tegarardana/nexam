import { describe, it, expect } from "vitest";
import {
  isStudentInAssignedRoom,
  normalizeRoomOrClass,
  getProctorScope,
} from "../src/lib/proctor-scope";

describe("Proctor Room & Class Scoping Logic", () => {
  describe("normalizeRoomOrClass", () => {
    it("strips common room and class prefixes correctly", () => {
      expect(normalizeRoomOrClass("Kelas X-TKJ-1")).toBe("x tkj 1");
      expect(normalizeRoomOrClass("Ruang 01")).toBe("01");
      expect(normalizeRoomOrClass("Ruangan Lab CBT")).toBe("lab cbt");
      expect(normalizeRoomOrClass("Rombel XII-RPL-2")).toBe("xii rpl 2");
      expect(normalizeRoomOrClass("Lab Komputer 1")).toBe("komputer 1");
    });

    it("returns empty string on null or undefined or whitespace", () => {
      expect(normalizeRoomOrClass(null)).toBe("");
      expect(normalizeRoomOrClass(undefined)).toBe("");
      expect(normalizeRoomOrClass("   ")).toBe("");
    });
  });

  describe("isStudentInAssignedRoom", () => {
    it("returns true when proctor has no room assignment (unrestricted)", () => {
      expect(isStudentInAssignedRoom({ className: "X-TKJ-1" }, null)).toBe(true);
      expect(isStudentInAssignedRoom({ className: "X-TKJ-1" }, undefined)).toBe(true);
      expect(isStudentInAssignedRoom({ className: "X-TKJ-1" }, "")).toBe(true);
      expect(isStudentInAssignedRoom({ className: "X-TKJ-1" }, "   ")).toBe(true);
    });

    it("matches exact class name case-insensitively", () => {
      expect(
        isStudentInAssignedRoom(
          { className: "X-TKJ-1" },
          "X-TKJ-1"
        )
      ).toBe(true);

      expect(
        isStudentInAssignedRoom(
          { className: "x-tkj-1" },
          "X-TKJ-1"
        )
      ).toBe(true);
    });

    it("matches when one has prefix 'Kelas' or 'Ruang'", () => {
      expect(
        isStudentInAssignedRoom(
          { className: "X-TKJ-1" },
          "Kelas X-TKJ-1"
        )
      ).toBe(true);

      expect(
        isStudentInAssignedRoom(
          { className: "Kelas X-TKJ-1" },
          "X-TKJ-1"
        )
      ).toBe(true);

      expect(
        isStudentInAssignedRoom(
          { className: "X-TKJ-1" },
          "Ruang X-TKJ-1"
        )
      ).toBe(true);
    });

    it("matches when dash and spaces differ (compact normalization)", () => {
      expect(
        isStudentInAssignedRoom(
          { className: "X RPL 1" },
          "X-RPL-1"
        )
      ).toBe(true);

      expect(
        isStudentInAssignedRoom(
          { className: "X-RPL-1" },
          "Ruang X RPL 1"
        )
      ).toBe(true);
    });

    it("matches direct classGroupId", () => {
      const groupId = "d7313835-1811-4fa3-80b7-c6b63ca00bb1";
      expect(
        isStudentInAssignedRoom(
          { classGroupId: groupId, className: "X-TKJ-1" },
          groupId
        )
      ).toBe(true);
    });

    it("rejects students from different classes", () => {
      expect(
        isStudentInAssignedRoom(
          { className: "X-TKJ-2" },
          "X-TKJ-1"
        )
      ).toBe(false);

      expect(
        isStudentInAssignedRoom(
          { className: "XI-TKJ-1" },
          "X-TKJ-1"
        )
      ).toBe(false);

      expect(
        isStudentInAssignedRoom(
          { className: "X-RPL-1" },
          "Kelas X-TKJ-1"
        )
      ).toBe(false);
    });
  });

  describe("getProctorScope", () => {
    const exam = {
      createdById: "creator-uuid-1",
      proctorAssignments: [
        { proctorId: "proctor-uuid-1", roomName: "X-TKJ-1" },
        { proctorId: "proctor-uuid-2", roomName: null },
      ],
    };

    it("grants full access to administrator regardless of assignment", () => {
      const scope = getProctorScope(exam, {
        id: "admin-uuid",
        roles: ["administrator"],
      });
      expect(scope.isScoped).toBe(false);
      expect(scope.canAccessAll).toBe(true);
      expect(scope.assignedRoom).toBeNull();
    });

    it("grants full access to exam creator regardless of assignment", () => {
      const scope = getProctorScope(exam, {
        id: "creator-uuid-1",
        roles: ["teacher"],
      });
      expect(scope.isScoped).toBe(false);
      expect(scope.canAccessAll).toBe(true);
      expect(scope.assignedRoom).toBeNull();
    });

    it("scopes assigned proctor with roomName to that specific room", () => {
      const scope = getProctorScope(exam, {
        id: "proctor-uuid-1",
        roles: ["teacher"],
      });
      expect(scope.isScoped).toBe(true);
      expect(scope.canAccessAll).toBe(false);
      expect(scope.assignedRoom).toBe("X-TKJ-1");
    });

    it("does not scope proctor when roomName is null (supervising all rooms)", () => {
      const scope = getProctorScope(exam, {
        id: "proctor-uuid-2",
        roles: ["teacher"],
      });
      expect(scope.isScoped).toBe(false);
      expect(scope.canAccessAll).toBe(true);
      expect(scope.assignedRoom).toBeNull();
    });

    it("preserves assignedRoom for creator or admin if assigned to a room, while keeping canAccessAll true", () => {
      const examWithCreatorAssigned = {
        createdById: "creator-uuid-1",
        proctorAssignments: [
          { proctorId: "creator-uuid-1", roomName: "Ruang Lab 1" },
          { proctorId: "admin-uuid", roomName: "Ruang 02" },
        ],
      };

      const creatorScope = getProctorScope(examWithCreatorAssigned, {
        id: "creator-uuid-1",
        roles: ["teacher"],
      });
      expect(creatorScope.isScoped).toBe(true);
      expect(creatorScope.assignedRoom).toBe("Ruang Lab 1");
      expect(creatorScope.canAccessAll).toBe(true);

      const adminScope = getProctorScope(examWithCreatorAssigned, {
        id: "admin-uuid",
        roles: ["administrator"],
      });
      expect(adminScope.isScoped).toBe(true);
      expect(adminScope.assignedRoom).toBe("Ruang 02");
      expect(adminScope.canAccessAll).toBe(true);
    });
  });
});
