import { describe, it, expect } from "vitest";
import {
  calculateDeadline,
  getTimerStatus,
  isWriteAllowed,
  isSubmissionAllowed,
} from "../src/lib/exam-engine/timer";
import {
  shuffleWithSeed,
  generateFrozenRandomization,
} from "../src/lib/exam-engine/shuffler";
import {
  evaluateAnswer,
  normalizeShortAnswer,
  QuestionVersionSnapshot,
} from "../src/lib/exam-engine/grading";

describe("Phase 3: Examination Engine - Timer & Deadlines", () => {
  it("should calculate exact deadline based on duration in minutes", () => {
    const start = new Date("2026-10-24T10:00:00.000Z");
    const deadline = calculateDeadline(start, 90);
    expect(deadline.toISOString()).toBe("2026-10-24T11:30:00.000Z");
  });

  it("should report active timer status when now is before deadline", () => {
    const start = new Date("2026-10-24T10:00:00.000Z");
    const now = new Date("2026-10-24T10:30:00.000Z");
    const status = getTimerStatus(start, 60, now, 0);

    expect(status.isExpired).toBe(false);
    expect(status.remainingSeconds).toBe(1800); // 30 minutes left
    expect(status.isInGracePeriod).toBe(false);
  });

  it("should honor extended explicit deadline from proctor time compensation", () => {
    const start = new Date("2026-10-24T10:00:00.000Z");
    const now = new Date("2026-10-24T10:50:00.000Z");
    const extendedDeadline = new Date("2026-10-24T11:15:00.000Z"); // +15 mins extended deadline
    const status = getTimerStatus(start, 60, now, 0, extendedDeadline);

    expect(status.isExpired).toBe(false);
    expect(status.remainingSeconds).toBe(1500); // 25 mins = 1500s
    expect(status.deadlineAt.toISOString()).toBe("2026-10-24T11:15:00.000Z");
  });

  it("should report expired status when now passes deadline", () => {
    const start = new Date("2026-10-24T10:00:00.000Z");
    const now = new Date("2026-10-24T11:01:00.000Z");
    const status = getTimerStatus(start, 60, now, 120);

    expect(status.isExpired).toBe(true);
    expect(status.remainingSeconds).toBe(0);
    expect(status.isInGracePeriod).toBe(true); // Within 120s grace period
  });

  it("should reject answer writes past deadline even during grace period", () => {
    const deadline = new Date("2026-10-24T11:00:00.000Z");
    const nowInGrace = new Date("2026-10-24T11:00:30.000Z");

    expect(isWriteAllowed(deadline, nowInGrace)).toBe(false);
    expect(isSubmissionAllowed(deadline, nowInGrace, 60)).toBe(true);
  });

  it("should reject submission once grace period has elapsed", () => {
    const deadline = new Date("2026-10-24T11:00:00.000Z");
    const nowAfterGrace = new Date("2026-10-24T11:02:00.000Z");

    expect(isSubmissionAllowed(deadline, nowAfterGrace, 60)).toBe(false);
  });
});

describe("Phase 3: Examination Engine - Deterministic Shuffler", () => {
  it("should produce reproducible shuffle order with the same seed", () => {
    const items = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"];
    const seed = "student_andi_exam_1";

    const shuffle1 = shuffleWithSeed(items, seed);
    const shuffle2 = shuffleWithSeed(items, seed);

    expect(shuffle1).toEqual(shuffle2);
    expect(shuffle1).toHaveLength(items.length);
    expect(new Set(shuffle1).size).toBe(items.length);
  });

  it("should produce different orders for different seeds", () => {
    const items = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10"];
    const shuffleA = shuffleWithSeed(items, "seed_student_1");
    const shuffleB = shuffleWithSeed(items, "seed_student_2");

    expect(shuffleA).not.toEqual(shuffleB);
  });

  it("should correctly generate frozen question and option randomizations", () => {
    const examQuestions = [
      {
        id: "eq-1",
        questionVersion: {
          id: "qv-1",
          options: [{ id: "opt-1" }, { id: "opt-2" }, { id: "opt-3" }, { id: "opt-4" }],
        },
      },
      {
        id: "eq-2",
        questionVersion: {
          id: "qv-2",
          options: [{ id: "opt-5" }, { id: "opt-6" }],
        },
      },
    ];

    const { questionOrder, optionOrders } = generateFrozenRandomization(
      examQuestions,
      "test_attempt_seed",
      true,
      true
    );

    expect(questionOrder).toHaveLength(2);
    expect(questionOrder).toContain("eq-1");
    expect(questionOrder).toContain("eq-2");
    expect(optionOrders["eq-1"]).toHaveLength(4);
    expect(optionOrders["eq-2"]).toHaveLength(2);
  });
});

describe("Phase 3: Examination Engine - Auto-Grading Evaluator", () => {
  it("should grade single_choice accurately", () => {
    const snapshot: QuestionVersionSnapshot = {
      id: "qv-1",
      questionId: "q-1",
      content: { text: "Ibukota Indonesia?" },
      gradingConfig: { points: 2.0 },
      options: [
        { id: "opt-a", label: "A", content: { text: "Bandung" }, isCorrect: false, sortOrder: 0 },
        { id: "opt-b", label: "B", content: { text: "Jakarta" }, isCorrect: true, sortOrder: 1 },
        { id: "opt-c", label: "C", content: { text: "Surabaya" }, isCorrect: false, sortOrder: 2 },
      ],
    };

    // Correct by ID
    const resCorrect = evaluateAnswer("single_choice", "opt-b", snapshot, 2.0);
    expect(resCorrect.rawScore).toBe(2.0);
    expect(resCorrect.isCorrect).toBe(true);

    // Correct by Label
    const resCorrectLabel = evaluateAnswer("single_choice", "b", snapshot, 2.0);
    expect(resCorrectLabel.rawScore).toBe(2.0);
    expect(resCorrectLabel.isCorrect).toBe(true);

    // Incorrect
    const resWrong = evaluateAnswer("single_choice", "opt-a", snapshot, 2.0);
    expect(resWrong.rawScore).toBe(0);
    expect(resWrong.isCorrect).toBe(false);
  });

  it("should grade true_false accurately", () => {
    const snapshot: QuestionVersionSnapshot = {
      id: "qv-2",
      questionId: "q-2",
      content: { text: "Matahari terbit di sebelah timur." },
      gradingConfig: { points: 1.0 },
      options: [
        { id: "opt-t", label: "Benar", content: { text: "Benar" }, isCorrect: true, sortOrder: 0 },
        { id: "opt-f", label: "Salah", content: { text: "Salah" }, isCorrect: false, sortOrder: 1 },
      ],
    };

    const resTrue = evaluateAnswer("true_false", "Benar", snapshot, 1.0);
    expect(resTrue.rawScore).toBe(1.0);
    expect(resTrue.isCorrect).toBe(true);

    const resFalse = evaluateAnswer("true_false", "Salah", snapshot, 1.0);
    expect(resFalse.rawScore).toBe(0);
    expect(resFalse.isCorrect).toBe(false);
  });

  it("should grade multi_select accurately (exact match and partial)", () => {
    const snapshotExact: QuestionVersionSnapshot = {
      id: "qv-3",
      questionId: "q-3",
      content: { text: "Bilangan prima kurang dari 10" },
      gradingConfig: { points: 4.0, partialGrading: false },
      options: [
        { id: "opt-2", label: "A", content: { text: "2" }, isCorrect: true, sortOrder: 0 },
        { id: "opt-3", label: "B", content: { text: "3" }, isCorrect: true, sortOrder: 1 },
        { id: "opt-4", label: "C", content: { text: "4" }, isCorrect: false, sortOrder: 2 },
        { id: "opt-5", label: "D", content: { text: "5" }, isCorrect: true, sortOrder: 3 },
      ],
    };

    // Full match
    const resFull = evaluateAnswer("multi_select", ["opt-2", "opt-3", "opt-5"], snapshotExact, 4.0);
    expect(resFull.rawScore).toBe(4.0);
    expect(resFull.isCorrect).toBe(true);

    // Partial without partialGrading flag gives 0
    const resPartial = evaluateAnswer("multi_select", ["opt-2", "opt-3"], snapshotExact, 4.0);
    expect(resPartial.rawScore).toBe(0);
    expect(resPartial.isCorrect).toBe(false);

    // With partialGrading: true
    const snapshotPartial: QuestionVersionSnapshot = {
      ...snapshotExact,
      gradingConfig: { points: 3.0, partialGrading: true },
    };
    const resPartialAllowed = evaluateAnswer("multi_select", ["opt-2", "opt-3"], snapshotPartial, 3.0);
    expect(resPartialAllowed.rawScore).toBe(2.0); // 2 of 3 correct options
  });

  it("should grade short_answer with normalization & alternative answers", () => {
    const snapshot: QuestionVersionSnapshot = {
      id: "qv-4",
      questionId: "q-4",
      content: { text: "Singkatan dari Central Processing Unit" },
      gradingConfig: {
        points: 2.5,
        answerKey: "CPU, Processor, Prosesor",
        caseSensitive: false,
      },
    };

    expect(evaluateAnswer("short_answer", "cpu", snapshot, 2.5).rawScore).toBe(2.5);
    expect(evaluateAnswer("short_answer", "  CPU  ", snapshot, 2.5).rawScore).toBe(2.5);
    expect(evaluateAnswer("short_answer", "processor", snapshot, 2.5).rawScore).toBe(2.5);
    expect(evaluateAnswer("short_answer", "RAM", snapshot, 2.5).rawScore).toBe(0);
  });

  it("should mark essay as pending manual grading", () => {
    const snapshot: QuestionVersionSnapshot = {
      id: "qv-5",
      questionId: "q-5",
      content: { text: "Jelaskan konsep Polymorphism dalam OOP!" },
      gradingConfig: { points: 10.0 },
    };

    const resEssay = evaluateAnswer("essay", "Polymorphism adalah kemampuan...", snapshot, 10.0);
    expect(resEssay.rawScore).toBe(0);
    expect(resEssay.maxScore).toBe(10.0);
    expect(resEssay.gradingMethod).toBe("manual");
    expect(resEssay.gradingStatus).toBe("pending");
  });
});
