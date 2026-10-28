import { describe, it, expect } from "vitest";
import {
  academicYearSchema,
  semesterSchema,
  classGroupSchema,
  majorSchema,
  subjectCategorySchema,
  subjectSchema,
} from "../src/lib/validation/academic";
import {
  createUserSchema,
  bulkStudentRowSchema,
  bulkTeacherRowSchema,
  updateStudentSchema,
  updateTeacherProfileSchema,
  updateTeacherDutySchema,
  bulkUserActionSchema,
} from "../src/lib/validation/user";

describe("Validation Schemas (Zod)", () => {
  it("should validate academic year date ranges (endDate > startDate)", () => {
    const valid = academicYearSchema.safeParse({
      name: "2026/2027",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      status: "active",
    });
    expect(valid.success).toBe(true);

    const invalidDates = academicYearSchema.safeParse({
      name: "2026/2027",
      startDate: "2026-07-01",
      endDate: "2026-05-01", // Before start date!
      status: "draft",
    });
    expect(invalidDates.success).toBe(false);
  });

  it("should validate semester names and dates", () => {
    const valid = semesterSchema.safeParse({
      academicYearId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Ganjil",
      startDate: "2026-07-01",
      endDate: "2026-12-31",
      status: "active",
    });
    expect(valid.success).toBe(true);

    const invalidName = semesterSchema.safeParse({
      academicYearId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Semester 3", // Must be Ganjil or Genap
      startDate: "2026-07-01",
      endDate: "2026-12-31",
    });
    expect(invalidName.success).toBe(false);
  });

  it("should validate class group grade levels between 10 and 13", () => {
    const valid = classGroupSchema.safeParse({
      name: "X RPL 1",
      gradeLevel: 10,
      academicYearId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(valid.success).toBe(true);

    const invalidGrade = classGroupSchema.safeParse({
      name: "IX RPL 1",
      gradeLevel: 9, // School is Senior High / SMK (10-13)
      academicYearId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(invalidGrade.success).toBe(false);
  });

  it("should enforce clean user creation requirements", () => {
    const valid = createUserSchema.safeParse({
      username: "guru.ani",
      displayName: "Ani Yudhoyono, M.Pd",
      email: "ani@sekolah.sch.id",
      password: "Password123!",
      role: "teacher",
    });
    expect(valid.success).toBe(true);

    const invalidUsername = createUserSchema.safeParse({
      username: "ani with spaces!",
      displayName: "Ani",
      password: "123", // Too short
      role: "invalid_role",
    });
    expect(invalidUsername.success).toBe(false);
  });

  it("should validate student bulk import rows (NIS/NISN optional, username/displayName/password mandatory)", () => {
    const valid = bulkStudentRowSchema.safeParse({
      nis: "202501005",
      nisn: "0089991234",
      username: "siswa.citra",
      displayName: "Citra Lestari",
      password: "Password123!",
      email: "citra@sekolah.sch.id",
    });
    expect(valid.success).toBe(true);

    // NIS is optional (not mandatory)
    const missingNis = bulkStudentRowSchema.safeParse({
      username: "siswa.tanpa.nis",
      displayName: "Tanpa NIS",
      password: "Password123!",
    });
    expect(missingNis.success).toBe(true);

    // Username / displayName / password are mandatory (*)
    const missingPassword = bulkStudentRowSchema.safeParse({
      username: "siswa.tanpa.pass",
      displayName: "Tanpa Password",
      password: "",
    });
    expect(missingPassword.success).toBe(false);
  });

  it("should validate teacher bulk import rows (NIP optional, username/displayName/password mandatory)", () => {
    const valid = bulkTeacherRowSchema.safeParse({
      nip: "198001012005011003",
      username: "guru.dewi",
      displayName: "Dewi Sartika, S.Pd",
      email: "dewi@sekolah.sch.id",
      password: "Password123!",
    });
    expect(valid.success).toBe(true);

    // NIP is optional (not mandatory)
    const missingNip = bulkTeacherRowSchema.safeParse({
      username: "guru.tanpa.nip",
      displayName: "Tanpa NIP",
      password: "Password123!",
    });
    expect(missingNip.success).toBe(true);

    // Mandatory field check
    const missingUsername = bulkTeacherRowSchema.safeParse({
      username: "",
      displayName: "Dewi Sartika",
      password: "Password123!",
    });
    expect(missingUsername.success).toBe(false);
  });

  it("should validate subject categories and subject linking", () => {
    const validCat = subjectCategorySchema.safeParse({
      code: "C3",
      name: "Kompetensi Keahlian",
    });
    expect(validCat.success).toBe(true);

    const validSubject = subjectSchema.safeParse({
      code: "RPL-PBO",
      name: "Pemrograman Berorientasi Objek",
      categoryId: "123e4567-e89b-12d3-a456-426614174000",
      majorId: "123e4567-e89b-12d3-a456-426614174001",
    });
    expect(validSubject.success).toBe(true);
  });

  it("should validate student detail update schema", () => {
    const valid = updateStudentSchema.safeParse({
      displayName: "Ahmad Rizky Pratama",
      username: "ahmad.rizky",
      gender: "L",
      nis: "202501001",
      nisn: "0081234567",
      isActive: true,
      password: "NewPassword123!",
    });
    expect(valid.success).toBe(true);

    const validNoPassword = updateStudentSchema.safeParse({
      displayName: "Ahmad Rizky Pratama",
      username: "ahmad.rizky",
      gender: "L",
      nis: "202501001",
      isActive: false,
    });
    expect(validNoPassword.success).toBe(true);

    const invalidGender = updateStudentSchema.safeParse({
      displayName: "Ahmad",
      username: "ahmad",
      gender: "X", // Must be L or P
    });
    expect(invalidGender.success).toBe(false);
  });

  it("should validate teacher profile update schema", () => {
    const valid = updateTeacherProfileSchema.safeParse({
      displayName: "Drs. Bambang Sudiro",
      title: "M.Kom",
      username: "bambang.kom",
      email: "bambang@sekolah.sch.id",
      nip: "197501012000031002",
      nuptk: "1234567890123456",
      gender: "L",
      isActive: true,
    });
    expect(valid.success).toBe(true);

    const invalidEmail = updateTeacherProfileSchema.safeParse({
      displayName: "Bambang",
      username: "bambang",
      email: "not-an-email",
    });
    expect(invalidEmail.success).toBe(false);
  });

  it("should validate teacher duty and teaching assignments schema", () => {
    const valid = updateTeacherDutySchema.safeParse({
      position: "Wali Kelas",
      homeroomClassId: "123e4567-e89b-12d3-a456-426614174000",
      teachingAssignments: [
        {
          subjectId: "123e4567-e89b-12d3-a456-426614174001",
          classGroupIds: [
            "123e4567-e89b-12d3-a456-426614174000",
            "123e4567-e89b-12d3-a456-426614174002",
          ],
        },
      ],
    });
    expect(valid.success).toBe(true);

    const invalidPosition = updateTeacherDutySchema.safeParse({
      position: "Satpam", // Not in allowed positions
    });
    expect(invalidPosition.success).toBe(false);
  });

  it("should validate bulk user action schema", () => {
    const valid = bulkUserActionSchema.safeParse({
      userIds: [
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
      ],
      action: "activate",
    });
    expect(valid.success).toBe(true);

    const emptyUsers = bulkUserActionSchema.safeParse({
      userIds: [],
      action: "deactivate",
    });
    expect(emptyUsers.success).toBe(false);

    const invalidAction = bulkUserActionSchema.safeParse({
      userIds: ["123e4567-e89b-12d3-a456-426614174000"],
      action: "suspend_forever",
    });
    expect(invalidAction.success).toBe(false);
  });
});

