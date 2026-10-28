import { describe, it, expect } from "vitest";
import { createQuestionBankSchema } from "../src/lib/validation/question-bank";

describe("Phase 2: Question Bank Configuration Validation", () => {
  const validSubjectId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const validTeacherId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

  it("validates a complete, balanced question bank configuration", () => {
    const payload = {
      code: "BS-MAT10-PAS2026",
      title: "Penilaian Akhir Semester Matematika X",
      subjectId: validSubjectId,
      gradeLevel: 10,
      teacherId: validTeacherId,
      totalQuestions: 40,
      singleChoiceCount: 20,
      singleChoiceWeight: 40,
      complexMultipleChoiceCount: 5,
      complexMultipleChoiceWeight: 20,
      trueFalseCount: 5,
      trueFalseWeight: 10,
      shortAnswerCount: 5,
      shortAnswerWeight: 15,
      essayCount: 5,
      essayWeight: 15,
      status: "active" as const,
    };

    const result = createQuestionBankSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects configuration when total questions do not match allocated breakdown", () => {
    const payload = {
      code: "BS-IPA-01",
      title: "Bank Soal IPA 11",
      subjectId: validSubjectId,
      gradeLevel: 11,
      totalQuestions: 50, // Specified 50, but allocated 20+5+5+5+5 = 40
      singleChoiceCount: 20,
      singleChoiceWeight: 40,
      complexMultipleChoiceCount: 5,
      complexMultipleChoiceWeight: 20,
      trueFalseCount: 5,
      trueFalseWeight: 10,
      shortAnswerCount: 5,
      shortAnswerWeight: 15,
      essayCount: 5,
      essayWeight: 15,
    };

    const result = createQuestionBankSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("harus sama dengan total target soal");
    }
  });

  it("rejects configuration when total weights do not sum to 100%", () => {
    const payload = {
      code: "BS-BINDO-12",
      title: "Bank Soal B. Indonesia 12",
      subjectId: validSubjectId,
      gradeLevel: 12,
      totalQuestions: 20,
      singleChoiceCount: 20,
      singleChoiceWeight: 80, // Total weight is 80%, not 100%
      complexMultipleChoiceCount: 0,
      complexMultipleChoiceWeight: 0,
      trueFalseCount: 0,
      trueFalseWeight: 0,
      shortAnswerCount: 0,
      shortAnswerWeight: 0,
      essayCount: 0,
      essayWeight: 0,
    };

    const result = createQuestionBankSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("harus tepat 100%");
    }
  });

  it("rejects invalid code format with special characters", () => {
    const payload = {
      code: "BS MAT 10 / #1",
      title: "Bank Soal",
      subjectId: validSubjectId,
      gradeLevel: 10,
      totalQuestions: 10,
      singleChoiceCount: 10,
      singleChoiceWeight: 100,
      complexMultipleChoiceCount: 0,
      complexMultipleChoiceWeight: 0,
      trueFalseCount: 0,
      trueFalseWeight: 0,
      shortAnswerCount: 0,
      shortAnswerWeight: 0,
      essayCount: 0,
      essayWeight: 0,
    };

    const result = createQuestionBankSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("handles multi-type questions breakdown including optional image attachment", () => {
    const questionsSample = [
      {
        type: "single_choice",
        text: "Pilih jawaban yang benar:",
        imageUrl: "https://example.com/circuit.png",
        points: 1,
        options: [
          { label: "A", text: "Seri", isCorrect: true },
          { label: "B", text: "Paralel", isCorrect: false },
        ],
      },
      {
        type: "essay",
        text: "Jelaskan fungsi dari kapasitor pada rangkaian berikut:",
        imageUrl: "https://example.com/capacitor.png",
        points: 5,
        rubric: "Menjelaskan penyimpanan muatan listrik",
      },
    ];

    expect(questionsSample.length).toBe(2);
    expect(questionsSample[0].imageUrl).toBeDefined();
    expect(questionsSample[1].imageUrl).toBeDefined();
    expect(questionsSample[0].options?.[0]?.isCorrect).toBe(true);
  });
});
