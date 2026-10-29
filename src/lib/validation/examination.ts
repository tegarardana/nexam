import { z } from "zod";

export const ExaminationStatusEnum = z.enum([
  "draft",
  "ready",
  "scheduled",
  "in_progress",
  "closed",
  "grading",
  "finalized",
  "archived",
]);
export type ExaminationStatus = z.infer<typeof ExaminationStatusEnum>;

export const ExaminationPolicySettingSchema = z.object({
  randomizeQuestions: z.boolean().default(true),
  randomizeOptions: z.boolean().default(true),
  allowReview: z.boolean().default(true),
  maxTabSwitches: z.number().int().min(0).default(3),
  maxWindowBlurs: z.number().int().min(0).default(3),
  fullScreenRequired: z.boolean().default(true),
  blockOnViolation: z.boolean().default(true),
  autoSubmitOnTime: z.boolean().default(true),
  showInstantScore: z.boolean().default(false),
  tokenRequired: z.boolean().default(false),
  globalToken: z.string().optional().nullable(),
});

export const CreateExaminationSchema = z
  .object({
    title: z.string().min(3, "Judul ujian minimal 3 karakter"),
    description: z.string().optional().nullable(),
    subjectId: z.string().uuid("ID mata pelajaran tidak valid").optional().nullable(),
    academicYearId: z.string().uuid("ID tahun ajaran tidak valid"),
    semesterId: z.string().uuid("ID semester tidak valid"),
    durationMinutes: z.number().int().min(5, "Durasi ujian minimal 5 menit").max(480, "Durasi maksimal 8 jam"),
    scheduledStart: z.coerce.date(),
    scheduledEnd: z.coerce.date(),
    totalPoints: z.number().positive("Total poin harus lebih dari 0").default(100),
    passingScore: z.number().min(0).max(100).optional().nullable(),
    policySettings: ExaminationPolicySettingSchema.optional(),
    teacherId: z.string().uuid("ID guru pengampu tidak valid").optional().nullable(),
    examinationTypeId: z.string().uuid("ID tipe ujian tidak valid").optional().nullable(),
    questionBankId: z.string().uuid("ID bank soal tidak valid").optional().nullable(),
    classGroupIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.scheduledEnd > data.scheduledStart, {
    message: "Waktu selesai ujian harus setelah waktu mulai ujian",
    path: ["scheduledEnd"],
  });

export type CreateExaminationInput = z.infer<typeof CreateExaminationSchema>;

export const ExaminationTypeSchema = z.object({
  name: z.string().min(2, "Nama tipe ujian minimal 2 karakter").max(100),
  code: z.string().min(1, "Kode jenis ujian minimal 1 karakter").max(20),
  description: z.string().optional().nullable(),
});

export type ExaminationTypeInput = z.infer<typeof ExaminationTypeSchema>;

export const ExaminationSessionSchema = z.object({
  name: z.string().min(2, "Nama sesi minimal 2 karakter").max(100),
  code: z.string().min(1, "Kode sesi minimal 1 karakter").max(20),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export type ExaminationSessionInput = z.infer<typeof ExaminationSessionSchema>;

export const AssignQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        points: z.number().positive("Poin harus lebih dari 0").default(1),
        sequenceOrder: z.number().int().min(1),
        isOptional: z.boolean().default(false),
      })
    )
    .min(1, "Minimal harus ada 1 butir soal untuk ujian"),
});

export const AssignParticipantsSchema = z.object({
  classGroupIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
});
