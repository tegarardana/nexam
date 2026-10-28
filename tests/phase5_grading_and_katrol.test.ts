import { describe, it, expect } from "vitest";

describe("Phase 5 - Essay Grading & Katrol Nilai (Score Adjustment)", () => {
  describe("Katrol Nilai Algorithms", () => {
    const rawScores = [50, 60, 70, 80, 90];
    const passingScore = 75;

    it("should calculate Flat Katrol (+X points capped at 100)", () => {
      const flatPoints = 15;
      const adjusted = rawScores.map((s) => Math.min(100, Math.max(0, s + flatPoints)));

      expect(adjusted).toEqual([65, 75, 85, 95, 100]);
    });

    it("should calculate Linear Min-Max Katrol interpolation", () => {
      const targetMin = 75; // KKM
      const targetMax = 100;
      const minOrig = Math.min(...rawScores);
      const maxOrig = Math.max(...rawScores);

      const adjusted = rawScores.map((s) => {
        const val = targetMin + ((s - minOrig) / (maxOrig - minOrig)) * (targetMax - targetMin);
        return Math.round(val * 10) / 10;
      });

      expect(adjusted[0]).toBe(75); // Lowest score becomes targetMin
      expect(adjusted[adjusted.length - 1]).toBe(100); // Highest score becomes targetMax
      expect(adjusted[2]).toBe(87.5); // Mid score scales proportionally
    });

    it("should calculate Multiplier Katrol factor", () => {
      const multiplier = 1.15; // +15%
      const adjusted = rawScores.map((s) => {
        const val = Math.min(100, s * multiplier);
        return Math.round(val * 10) / 10;
      });

      expect(adjusted[0]).toBe(57.5);
      expect(adjusted[1]).toBe(69);
      expect(adjusted[4]).toBe(100); // 90 * 1.15 = 103.5 -> capped at 100
    });

    it("should calculate KKM Floor Katrol (raise remedial students to KKM)", () => {
      const adjusted = rawScores.map((s) => (s < passingScore ? passingScore : s));

      expect(adjusted).toEqual([75, 75, 75, 80, 90]);
      expect(adjusted.every((s) => s >= passingScore)).toBe(true);
    });
  });

  describe("Essay Grading & Result Consolidation", () => {
    it("should accurately recalculate total percentage after essay grading", () => {
      const objectiveScore = 60; // out of 70 max objective points
      const maxObjectiveScore = 70;

      const essayScores = [
        { raw: 8.5, max: 15 },
        { raw: 12.0, max: 15 },
      ];

      const essayScore = essayScores.reduce((acc, curr) => acc + curr.raw, 0); // 20.5
      const maxEssayScore = essayScores.reduce((acc, curr) => acc + curr.max, 0); // 30

      const totalRawScore = objectiveScore + essayScore; // 80.5
      const totalMaxScore = maxObjectiveScore + maxEssayScore; // 100

      const percentage = (totalRawScore / totalMaxScore) * 100;
      const rounded = Math.round(percentage * 100) / 100;

      expect(essayScore).toBe(20.5);
      expect(totalRawScore).toBe(80.5);
      expect(rounded).toBe(80.5);
      expect(rounded >= 75).toBe(true); // Passed
    });
  });

  describe("Automatic Examination Closing on Schedule Expiry", () => {
    it("should correctly identify expired examinations when scheduledEnd has passed", () => {
      const now = new Date("2026-10-28T12:00:00Z");

      const exams = [
        { id: "1", status: "in_progress", scheduledEnd: new Date("2026-10-28T11:00:00Z") }, // expired
        { id: "2", status: "scheduled", scheduledEnd: new Date("2026-10-28T10:00:00Z") },   // expired
        { id: "3", status: "in_progress", scheduledEnd: new Date("2026-10-28T13:00:00Z") }, // still open
        { id: "4", status: "closed", scheduledEnd: new Date("2026-10-28T09:00:00Z") },      // already closed
      ];

      const expiredExams = exams.filter(
        (e) => ["scheduled", "in_progress"].includes(e.status) && e.scheduledEnd < now
      );

      expect(expiredExams.length).toBe(2);
      expect(expiredExams.map((e) => e.id)).toEqual(["1", "2"]);

      // Simulate transition to closed
      const updatedExams = exams.map((e) => {
        if (["scheduled", "in_progress"].includes(e.status) && e.scheduledEnd < now) {
          return { ...e, status: "closed" };
        }
        return e;
      });

      expect(updatedExams.find((e) => e.id === "1")?.status).toBe("closed");
      expect(updatedExams.find((e) => e.id === "2")?.status).toBe("closed");
      expect(updatedExams.find((e) => e.id === "3")?.status).toBe("in_progress");
    });
  });

  describe("Proctor Live Retake Exam (Kerjakan Ulang)", () => {
    it("should correctly reset attempt state in reset_answers mode", () => {
      const originalAttempt = {
        id: "att-1",
        status: "submitted",
        startedAt: new Date("2026-10-28T10:00:00Z"),
        submittedAt: new Date("2026-10-28T11:00:00Z"),
        incidentCount: 2,
        answers: [{ qId: "q1", val: "A" }, { qId: "q2", val: "B" }],
      };

      const now = new Date("2026-10-28T11:05:00Z");
      const durationMinutes = 90;
      const mode = "reset_answers";

      // Simulate retake logic
      const answers = mode === "reset_answers" ? [] : originalAttempt.answers;
      const updatedAttempt = {
        ...originalAttempt,
        status: "in_progress",
        startedAt: now,
        deadlineAt: new Date(now.getTime() + durationMinutes * 60 * 1000),
        submittedAt: null,
        incidentCount: 0,
        answers,
      };

      expect(updatedAttempt.status).toBe("in_progress");
      expect(updatedAttempt.submittedAt).toBeNull();
      expect(updatedAttempt.answers.length).toBe(0);
      expect(updatedAttempt.incidentCount).toBe(0);
      expect(updatedAttempt.deadlineAt.getTime() - now.getTime()).toBe(90 * 60 * 1000);
    });

    it("should preserve existing answers in keep_answers mode", () => {
      const originalAttempt = {
        id: "att-2",
        status: "grading_pending",
        startedAt: new Date("2026-10-28T10:00:00Z"),
        submittedAt: new Date("2026-10-28T10:45:00Z"),
        incidentCount: 1,
        answers: [{ qId: "q1", val: "A" }, { qId: "q2", val: "B" }, { qId: "q3", val: "Essay answer" }],
      };

      const now = new Date("2026-10-28T10:50:00Z");
      const durationMinutes = 30; // additional 30 minutes
      const mode = "keep_answers";

      // Simulate retake logic
      const answers = (mode as string) === "reset_answers" ? [] : originalAttempt.answers;
      const updatedAttempt = {
        ...originalAttempt,
        status: "in_progress",
        startedAt: now,
        deadlineAt: new Date(now.getTime() + durationMinutes * 60 * 1000),
        submittedAt: null,
        incidentCount: 0,
        answers,
      };

      expect(updatedAttempt.status).toBe("in_progress");
      expect(updatedAttempt.submittedAt).toBeNull();
      expect(updatedAttempt.answers.length).toBe(3); // answers preserved
      expect(updatedAttempt.deadlineAt.getTime() - now.getTime()).toBe(30 * 60 * 1000);
    });
  });
});

