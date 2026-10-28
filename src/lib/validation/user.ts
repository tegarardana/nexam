import { z } from "zod";

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, atau strip")
    .trim(),
  displayName: z
    .string()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter")
    .trim(),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  role: z.enum(["student", "teacher", "administrator"]),
  isActive: z.boolean().default(true),

  // Identity variables
  gender: z.enum(["L", "P", "Laki-laki", "Perempuan"]).optional().nullable().or(z.literal("")),
  nis: z.string().trim().optional().nullable().or(z.literal("")),
  nisn: z.string().trim().optional().nullable().or(z.literal("")),
  nip: z.string().trim().optional().nullable().or(z.literal("")),
  nuptk: z.string().trim().optional().nullable().or(z.literal("")),
  title: z.string().trim().optional().nullable().or(z.literal("")),
  position: z.string().optional().default("Guru"),

  // Teacher specific homeroom
  homeroomClassId: z.string().uuid("ID kelas tidak valid").optional().nullable().or(z.literal("")),
  assignedSubjectIds: z.array(z.string().uuid()).optional(),

  // Optional placement if creating a student
  classGroupId: z.string().uuid("ID rombel tidak valid").optional().nullable().or(z.literal("")),
  academicYearId: z.string().uuid("ID tahun ajaran tidak valid").optional().nullable().or(z.literal("")),
});

// Update Student Schema
export const updateStudentSchema = z.object({
  displayName: z
    .string()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter")
    .trim(),
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, atau strip")
    .trim(),
  gender: z.enum(["L", "P", "Laki-laki", "Perempuan"]).optional().nullable().or(z.literal("")),
  nis: z.string().trim().optional().nullable().or(z.literal("")),
  nisn: z.string().trim().optional().nullable().or(z.literal("")),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
  isActive: z.boolean().default(true),
  password: z.string().min(6, "Password minimal 6 karakter").optional().or(z.literal("")),
});

// Update Teacher Profile Schema
export const updateTeacherProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter")
    .trim(),
  title: z.string().trim().optional().nullable().or(z.literal("")),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
  nip: z.string().trim().optional().nullable().or(z.literal("")),
  nuptk: z.string().trim().optional().nullable().or(z.literal("")),
  gender: z.enum(["L", "P", "Laki-laki", "Perempuan"]).optional().nullable().or(z.literal("")),
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, atau strip")
    .trim(),
  isActive: z.boolean().default(true),
  password: z.string().min(6, "Password minimal 6 karakter").optional().or(z.literal("")),
});

// Update Teacher Duty Schema (Position, Homeroom & Teaching Assignment per Subject and Classes)
export const updateTeacherDutySchema = z.object({
  position: z.enum([
    "Guru",
    "Kepala Sekolah",
    "Wakil Kepala Sekolah",
    "Bimbingan Konseling",
    "Wali Kelas",
  ]),
  homeroomClassId: z.string().uuid("ID kelas tidak valid").optional().nullable().or(z.literal("")),
  teachingAssignments: z
    .array(
      z.object({
        subjectId: z.string().uuid(),
        classGroupIds: z.array(z.string().uuid()),
      })
    )
    .optional()
    .default([]),
});

// Bulk User Action Schema
export const bulkUserActionSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "Pilih minimal 1 pengguna"),
  action: z.enum(["activate", "deactivate", "delete"]),
});

export const updateUserSchema = z.object({
  displayName: z
    .string()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter")
    .trim()
    .optional(),
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, atau strip")
    .trim()
    .optional(),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
  password: z.string().min(6, "Password minimal 6 karakter").optional().or(z.literal("")),
  role: z.enum(["student", "teacher", "administrator"]).optional(),
  isActive: z.boolean().optional(),
  gender: z.enum(["L", "P", "Laki-laki", "Perempuan"]).optional().nullable().or(z.literal("")),
  title: z.string().trim().optional().nullable().or(z.literal("")),
  position: z.string().optional(),
  nis: z.string().trim().optional().nullable().or(z.literal("")),
  nisn: z.string().trim().optional().nullable().or(z.literal("")),
  nip: z.string().trim().optional().nullable().or(z.literal("")),
  nuptk: z.string().trim().optional().nullable().or(z.literal("")),
  homeroomClassId: z.string().uuid().optional().nullable().or(z.literal("")),
});

// Bulk template for students: nis, nisn, username, displayName, password, email
export const bulkStudentRowSchema = z.object({
  nis: z.string().min(1, "NIS wajib diisi").trim(),
  nisn: z.string().optional().nullable().or(z.literal("")),
  username: z.string().min(3, "Username minimal 3 karakter").trim(),
  displayName: z.string().min(2, "Nama lengkap minimal 2 karakter").trim(),
  password: z.string().min(6, "Password minimal 6 karakter"),
  email: z.string().email().optional().nullable().or(z.literal("")),
});

// Bulk template for teachers: nip, username, displayName, email, password
export const bulkTeacherRowSchema = z.object({
  nip: z.string().min(1, "NIP wajib diisi").trim(),
  username: z.string().min(3, "Username minimal 3 karakter").trim(),
  displayName: z.string().min(2, "Nama lengkap minimal 2 karakter").trim(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type UpdateTeacherProfileInput = z.infer<typeof updateTeacherProfileSchema>;
export type UpdateTeacherDutyInput = z.infer<typeof updateTeacherDutySchema>;
export type BulkUserActionInput = z.infer<typeof bulkUserActionSchema>;
export type BulkStudentRow = z.infer<typeof bulkStudentRowSchema>;
export type BulkTeacherRow = z.infer<typeof bulkTeacherRowSchema>;
