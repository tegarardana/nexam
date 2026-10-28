import { describe, it, expect } from "vitest";
import { CreateExaminationSchema } from "../src/lib/validation/examination";
import { VALID_EXAM_TRANSITIONS } from "../src/lib/examination-state";

describe("Phase 2: Examination Lifecycle & Validation", () => {
  it("validates a correctly configured examination", () => {
    const validExam = {
      title: "Penilaian Akhir Semester - Matematika X",
      description: "Ujian akhir semester ganjil",
      academicYearId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      semesterId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      durationMinutes: 90,
      scheduledStart: new Date("2026-11-01T08:00:00Z"),
      scheduledEnd: new Date("2026-11-01T10:00:00Z"),
      totalPoints: 100,
      passingScore: 75,
      policySettings: {
        randomizeQuestions: true,
        maxTabSwitches: 3,
        fullScreenRequired: true,
      },
    };
    const res = CreateExaminationSchema.safeParse(validExam);
    expect(res.success).toBe(true);
  });

  it("rejects an examination where scheduledEnd is before or equal to scheduledStart", () => {
    const invalidDates = {
      title: "Ujian Jadwal Terbalik",
      academicYearId: "11111111-1111-1111-1111-111111111111",
      semesterId: "22222222-2222-2222-2222-222222222222",
      durationMinutes: 60,
      scheduledStart: new Date("2026-11-01T10:00:00Z"),
      scheduledEnd: new Date("2026-11-01T08:00:00Z"), // Earlier than start!
    };
    const res = CreateExaminationSchema.safeParse(invalidDates);
    expect(res.success).toBe(false);
  });

  it("enforces valid state transition paths according to lifecycle design", () => {
    // Draft can transition to ready
    expect(VALID_EXAM_TRANSITIONS.draft).toContain("ready");

    // Ready can transition to scheduled
    expect(VALID_EXAM_TRANSITIONS.ready).toContain("scheduled");

    // Scheduled can transition to in_progress
    expect(VALID_EXAM_TRANSITIONS.scheduled).toContain("in_progress");

    // In Progress can only transition to closed
    expect(VALID_EXAM_TRANSITIONS.in_progress).toEqual(["closed"]);

    // Closed can transition to grading or finalized
    expect(VALID_EXAM_TRANSITIONS.closed).toContain("grading");
    expect(VALID_EXAM_TRANSITIONS.closed).toContain("finalized");

    // Finalized cannot transition to active states
    expect(VALID_EXAM_TRANSITIONS.finalized).not.toContain("draft");
    expect(VALID_EXAM_TRANSITIONS.finalized).not.toContain("in_progress");
  });
});
