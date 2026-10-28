import { z } from "zod";

export const QuestionBankStatusEnum = z.enum(["draft", "active", "archived"]);
export type QuestionBankStatus = z.infer<typeof QuestionBankStatusEnum>;

export const baseQuestionBankSchema = z.object({
  code: z
    .string()
    .min(3, "Kode bank soal minimal 3 karakter")
    .max(50, "Kode bank soal maksimal 50 karakter")
    .regex(/^[A-Za-z0-9_-]+$/, "Kode bank soal hanya boleh alfanumerik, tanda hubung (-), dan garis bawah (_)"),
  title: z.string().min(3, "Judul bank soal minimal 3 karakter").max(150, "Judul maksimal 150 karakter"),
  subjectId: z.string().uuid("ID mata pelajaran tidak valid"),
  gradeLevel: z.coerce.number().int().min(10).max(13, "Tingkat kelas harus antara 10 sampai 13"),
  teacherId: z.string().uuid("ID guru tidak valid").optional().nullable(),
  totalQuestions: z.coerce.number().int().min(1, "Total soal minimal 1"),

  // Kuota Tipe Soal
  singleChoiceCount: z.coerce.number().int().min(0).default(0),
  singleChoiceWeight: z.coerce.number().min(0).max(100).default(0),

  complexMultipleChoiceCount: z.coerce.number().int().min(0).default(0),
  complexMultipleChoiceWeight: z.coerce.number().min(0).max(100).default(0),

  trueFalseCount: z.coerce.number().int().min(0).default(0),
  trueFalseWeight: z.coerce.number().min(0).max(100).default(0),

  shortAnswerCount: z.coerce.number().int().min(0).default(0),
  shortAnswerWeight: z.coerce.number().min(0).max(100).default(0),

  essayCount: z.coerce.number().int().min(0).default(0),
  essayWeight: z.coerce.number().min(0).max(100).default(0),

  status: QuestionBankStatusEnum.default("draft"),
});

export const createQuestionBankSchema = baseQuestionBankSchema.superRefine((data, ctx) => {
  const totalAllocated =
    data.singleChoiceCount +
    data.complexMultipleChoiceCount +
    data.trueFalseCount +
    data.shortAnswerCount +
    data.essayCount;

  if (totalAllocated !== data.totalQuestions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["totalQuestions"],
      message: `Total alokasi tipe soal (${totalAllocated}) harus sama dengan total target soal (${data.totalQuestions})`,
    });
  }

  const totalWeight =
    data.singleChoiceWeight +
    data.complexMultipleChoiceWeight +
    data.trueFalseWeight +
    data.shortAnswerWeight +
    data.essayWeight;

  // Tolerance of 0.05 for floating calculations
  if (Math.abs(totalWeight - 100) > 0.05 && totalWeight > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["singleChoiceWeight"],
      message: `Total persentase bobot soal harus tepat 100% (saat ini ${totalWeight}%)`,
    });
  }
});

export type CreateQuestionBankInput = z.infer<typeof createQuestionBankSchema>;

export const updateQuestionBankSchema = baseQuestionBankSchema.partial();
export type UpdateQuestionBankInput = z.infer<typeof updateQuestionBankSchema>;
