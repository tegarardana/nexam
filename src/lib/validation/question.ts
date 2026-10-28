import { z } from "zod";

export const QuestionTypeEnum = z.enum([
  "single_choice",
  "multi_select",
  "true_false",
  "short_answer",
  "essay",
  "image_based",
]);
export type QuestionType = z.infer<typeof QuestionTypeEnum>;

export const QuestionDifficultyEnum = z.enum(["easy", "medium", "hard"]);
export type QuestionDifficulty = z.infer<typeof QuestionDifficultyEnum>;

export const QuestionStatusEnum = z.enum(["draft", "published", "archived"]);
export type QuestionStatus = z.infer<typeof QuestionStatusEnum>;

export const QuestionOptionSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, "Label pilihan tidak boleh kosong"),
  text: z.string().min(1, "Teks opsi tidak boleh kosong"),
  imageUrl: z.string().optional(),
  isCorrect: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const CreateQuestionCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter"),
  parentId: z.string().uuid().optional().nullable(),
  subjectId: z.string().uuid().optional().nullable(),
});

export const CreateQuestionSchema = z
  .object({
    subjectId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    questionBankId: z.string().uuid().optional().nullable(),
    type: QuestionTypeEnum,
    difficulty: QuestionDifficultyEnum.default("medium"),
    status: QuestionStatusEnum.default("draft"),
    points: z.number().positive("Poin harus lebih dari 0").default(1),
    content: z.object({
      text: z.string().min(3, "Isi pertanyaan minimal 3 karakter"),
      instructions: z.string().optional(),
      rubric: z.string().optional(),
      imageUrl: z.string().optional(),
    }),
    options: z.array(QuestionOptionSchema).optional().default([]),
    gradingConfig: z
      .object({
        answerKey: z.any().optional(), // string for short_answer, array for multi_select, etc.
        caseSensitive: z.boolean().default(false),
        acceptableAnswers: z.array(z.string()).optional(),
        gradingMethod: z.string().default("exact_match"),
      })
      .optional(),
    explanation: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Single Choice validation
    if (data.type === "single_choice") {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Soal pilihan ganda harus memiliki minimal 2 opsi",
          path: ["options"],
        });
      } else {
        const correctCount = data.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Soal pilihan ganda tunggal harus memiliki tepat 1 kunci jawaban benar",
            path: ["options"],
          });
        }
      }
    }

    // 2. Multi Select validation
    if (data.type === "multi_select") {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Soal pilihan ganda kompleks harus memiliki minimal 2 opsi",
          path: ["options"],
        });
      } else {
        const correctCount = data.options.filter((o) => o.isCorrect).length;
        if (correctCount < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Soal pilihan ganda kompleks harus memiliki minimal 1 jawaban benar",
            path: ["options"],
          });
        }
      }
    }

    // 3. True / False validation
    if (data.type === "true_false") {
      if (!data.options || data.options.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Soal Benar/Salah harus memiliki tepat 2 opsi (Benar dan Salah)",
          path: ["options"],
        });
      } else {
        const correctCount = data.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Pilih salah satu sebagai jawaban benar (Benar atau Salah)",
            path: ["options"],
          });
        }
      }
    }

    // 4. Short Answer validation
    if (data.type === "short_answer") {
      const key = data.gradingConfig?.answerKey;
      const acceptable = data.gradingConfig?.acceptableAnswers;
      if (!key && (!acceptable || acceptable.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Kunci jawaban isian singkat wajib diisi",
          path: ["gradingConfig", "answerKey"],
        });
      }
    }

    // 5. Image based validation
    if (data.type === "image_based") {
      if (!data.content.imageUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Soal berbasis gambar wajib menyertakan URL atau file gambar",
          path: ["content", "imageUrl"],
        });
      }
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Soal berbasis gambar harus memiliki opsi jawaban",
          path: ["options"],
        });
      }
    }
  });

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
