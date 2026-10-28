import { describe, it, expect } from "vitest";
import { hasRole, hasAnyRole, hasPermission } from "../src/lib/auth/rbac";
import { SessionUser } from "../src/lib/auth/session";

describe("RBAC Permissions Engine", () => {
  const adminUser: SessionUser = {
    id: "admin-uuid",
    username: "admin",
    displayName: "Administrator",
    email: "admin@sekolah.sch.id",
    isActive: true,
    roles: ["administrator"],
    permissions: [], // Admin has implicit bypass
  };

  const teacherUser: SessionUser = {
    id: "teacher-uuid",
    username: "guru.budi",
    displayName: "Budi Prasetyo",
    email: "budi@sekolah.sch.id",
    isActive: true,
    roles: ["teacher"],
    permissions: [
      "academic:read",
      "question:create",
      "examination:create",
      "examination:publish",
      "grading:finalize",
    ],
  };

  const studentUser: SessionUser = {
    id: "student-uuid",
    username: "siswa.andi",
    displayName: "Andi Pratama",
    email: "andi@siswa.sekolah.sch.id",
    isActive: true,
    roles: ["student"],
    permissions: ["examination:start", "examination:save_answer", "examination:submit"],
  };

  it("should verify user roles accurately", () => {
    expect(hasRole(adminUser, "administrator")).toBe(true);
    expect(hasRole(adminUser, "teacher")).toBe(false);

    expect(hasRole(teacherUser, "teacher")).toBe(true);
    expect(hasRole(teacherUser, "student")).toBe(false);

    expect(hasAnyRole(teacherUser, ["student", "teacher"])).toBe(true);
    expect(hasAnyRole(studentUser, ["administrator", "teacher"])).toBe(false);
  });

  it("should grant administrator implicit bypass for all permissions", () => {
    expect(hasPermission(adminUser, "academic:create")).toBe(true);
    expect(hasPermission(adminUser, "user:delete")).toBe(true);
    expect(hasPermission(adminUser, "system:settings_edit")).toBe(true);
    expect(hasPermission(adminUser, "any_arbitrary_permission")).toBe(true);
  });

  it("should restrict teacher to explicit teacher permissions", () => {
    expect(hasPermission(teacherUser, "examination:create")).toBe(true);
    expect(hasPermission(teacherUser, "grading:finalize")).toBe(true);
    expect(hasPermission(teacherUser, "academic:read")).toBe(true);

    // Teacher cannot manage system settings or users
    expect(hasPermission(teacherUser, "system:settings_edit")).toBe(false);
    expect(hasPermission(teacherUser, "user:delete")).toBe(false);
  });

  it("should restrict student from teacher or administrative actions", () => {
    expect(hasPermission(studentUser, "examination:start")).toBe(true);
    expect(hasPermission(studentUser, "examination:submit")).toBe(true);

    // Student must never have examination creation or grading permissions
    expect(hasPermission(studentUser, "examination:create")).toBe(false);
    expect(hasPermission(studentUser, "grading:finalize")).toBe(false);
    expect(hasPermission(studentUser, "proctor:block")).toBe(false);
  });
});
