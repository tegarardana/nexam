import { z } from "zod";

export const academicYearSchema = z
  .object({
    name: z.string().min(4, "Name must be at least 4 characters").max(20).trim(),
    startDate: z.string().or(z.date()),
    endDate: z.string().or(z.date()),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end > start;
    },
    {
      message: "End date must be strictly after start date",
      path: ["endDate"],
    }
  );

export const semesterSchema = z
  .object({
    academicYearId: z.string().uuid("Invalid academic year ID"),
    name: z.enum(["Ganjil", "Genap"]),
    startDate: z.string().or(z.date()),
    endDate: z.string().or(z.date()),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end > start;
    },
    {
      message: "End date must be strictly after start date",
      path: ["endDate"],
    }
  );

export const majorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  code: z.string().min(2, "Code must be at least 2 characters").max(20).trim().toUpperCase(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const classGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50).trim(),
  gradeLevel: z.number().int().min(10).max(13),
  majorId: z.string().uuid("Invalid major ID").optional().nullable(),
  academicYearId: z.string().uuid("Invalid academic year ID"),
  homeroomTeacherId: z.string().uuid("Invalid teacher ID").optional().nullable(),
  isActive: z.boolean().default(true),
});

export const subjectCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter").max(100).trim(),
  code: z.string().max(20).optional().nullable(),
  description: z.string().optional().nullable(),
});

export const subjectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  code: z.string().min(2, "Code must be at least 2 characters").max(30).trim().toUpperCase(),
  category: z.string().optional().nullable(),
  categoryId: z.string().uuid("Invalid category ID").optional().nullable(),
  majorId: z.string().uuid("Invalid major ID").optional().nullable(), // Null means Umum (all majors)
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const studentEnrollmentSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  classGroupId: z.string().uuid("Invalid class group ID"),
  academicYearId: z.string().uuid("Invalid academic year ID"),
  status: z.enum(["active", "transferred", "graduated", "withdrawn"]).default("active"),
  notes: z.string().optional().nullable(),
});

export const subjectOfferingSchema = z.object({
  subjectId: z.string().uuid("Invalid subject ID"),
  classGroupId: z.string().uuid("Invalid class group ID"),
  semesterId: z.string().uuid("Invalid semester ID"),
  academicYearId: z.string().uuid("Invalid academic year ID"),
});

export const teacherAssignmentSchema = z.object({
  teacherId: z.string().uuid("Invalid teacher ID"),
  subjectOfferingId: z.string().uuid("Invalid subject offering ID"),
});

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type SemesterInput = z.infer<typeof semesterSchema>;
export type MajorInput = z.infer<typeof majorSchema>;
export type ClassGroupInput = z.infer<typeof classGroupSchema>;
export type SubjectCategoryInput = z.infer<typeof subjectCategorySchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type StudentEnrollmentInput = z.infer<typeof studentEnrollmentSchema>;
export type SubjectOfferingInput = z.infer<typeof subjectOfferingSchema>;
export type TeacherAssignmentInput = z.infer<typeof teacherAssignmentSchema>;
