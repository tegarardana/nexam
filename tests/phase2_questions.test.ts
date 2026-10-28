import { describe, it, expect } from "vitest";
import { CreateQuestionSchema } from "../src/lib/validation/question";

describe("Phase 2: Question Bank Validation (All 6 Types)", () => {
  it("validates a correct single_choice question", () => {
    const validSingle = {
      type: "single_choice",
      difficulty: "medium",
      content: { text: "Ibukota Indonesia saat ini adalah?" },
      points: 2,
      options: [
        { label: "A", text: "Jakarta", isCorrect: true },
        { label: "B", text: "Surabaya", isCorrect: false },
        { label: "C", text: "Bandung", isCorrect: false },
      ],
    };
    const res = CreateQuestionSchema.safeParse(validSingle);
    expect(res.success).toBe(true);
  });

  it("rejects single_choice with more than 1 correct option", () => {
    const invalidSingle = {
      type: "single_choice",
      difficulty: "easy",
      content: { text: "Soal pilihan ganda tunggal salah konfigurasi" },
      options: [
        { label: "A", text: "Opsi 1", isCorrect: true },
        { label: "B", text: "Opsi 2", isCorrect: true },
      ],
    };
    const res = CreateQuestionSchema.safeParse(invalidSingle);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain("tepat 1 kunci jawaban benar");
    }
  });

  it("validates a correct multi_select question", () => {
    const validMulti = {
      type: "multi_select",
      difficulty: "hard",
      content: { text: "Pilihlah bilangan prima di bawah ini!" },
      points: 3,
      options: [
        { label: "A", text: "2", isCorrect: true },
        { label: "B", text: "3", isCorrect: true },
        { label: "C", text: "4", isCorrect: false },
        { label: "D", text: "5", isCorrect: true },
      ],
    };
    const res = CreateQuestionSchema.safeParse(validMulti);
    expect(res.success).toBe(true);
  });

  it("validates true_false with exactly 2 options and 1 correct answer", () => {
    const validTF = {
      type: "true_false",
      content: { text: "Matahari terbit dari arah barat." },
      options: [
        { label: "Benar", text: "Benar", isCorrect: false },
        { label: "Salah", text: "Salah", isCorrect: true },
      ],
    };
    const res = CreateQuestionSchema.safeParse(validTF);
    expect(res.success).toBe(true);
  });

  it("rejects true_false with incorrect option count or multiple correct answers", () => {
    const invalidTF = {
      type: "true_false",
      content: { text: "Bumi itu bulat." },
      options: [
        { label: "Benar", text: "Benar", isCorrect: true },
        { label: "Salah", text: "Salah", isCorrect: true },
      ],
    };
    const res = CreateQuestionSchema.safeParse(invalidTF);
    expect(res.success).toBe(false);
  });

  it("validates short_answer with answer key", () => {
    const validShort = {
      type: "short_answer",
      content: { text: "Siapakah presiden pertama Republik Indonesia?" },
      gradingConfig: {
        answerKey: "Ir. Soekarno",
        acceptableAnswers: ["Soekarno", "Bung Karno"],
        caseSensitive: false,
      },
    };
    const res = CreateQuestionSchema.safeParse(validShort);
    expect(res.success).toBe(true);
  });

  it("rejects short_answer without answer key", () => {
    const invalidShort = {
      type: "short_answer",
      content: { text: "Berapakah 2 + 2?" },
      gradingConfig: {},
    };
    const res = CreateQuestionSchema.safeParse(invalidShort);
    expect(res.success).toBe(false);
  });

  it("validates essay with rubric instructions", () => {
    const validEssay = {
      type: "essay",
      content: {
        text: "Jelaskan proses terjadinya fotosintesis pada tumbuhan hijau!",
        instructions: "Tuliskan minimal 3 paragraf mencakup reaksi terang dan gelap.",
        rubric: "Reaksi terang (40 poin), Reaksi gelap (40 poin), Tata bahasa (20 poin)",
      },
      points: 100,
    };
    const res = CreateQuestionSchema.safeParse(validEssay);
    expect(res.success).toBe(true);
  });

  it("validates image_based with imageUrl and options", () => {
    const validImage = {
      type: "image_based",
      content: {
        text: "Perhatikan diagram rangkaian listrik berikut. Komponen X adalah...",
        imageUrl: "/uploads/questions/diagram-listrik.png",
      },
      options: [
        { label: "A", text: "Resistor", isCorrect: true },
        { label: "B", text: "Kapasitor", isCorrect: false },
      ],
    };
    const res = CreateQuestionSchema.safeParse(validImage);
    expect(res.success).toBe(true);
  });

  it("rejects image_based without imageUrl", () => {
    const invalidImage = {
      type: "image_based",
      content: {
        text: "Perhatikan gambar berikut",
      },
      options: [
        { label: "A", text: "Pilihan A", isCorrect: true },
        { label: "B", text: "Pilihan B", isCorrect: false },
      ],
    };
    const res = CreateQuestionSchema.safeParse(invalidImage);
    expect(res.success).toBe(false);
  });
});
