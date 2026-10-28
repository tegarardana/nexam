import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateAntiCheatEvent,
  DEFAULT_COUNTED_EVENTS,
  EvaluateEventParams,
} from "../src/lib/anti-cheat/policy-evaluator";
import { proctorHub } from "../src/lib/anti-cheat/proctor-hub";

// Mock prisma and proctorHub broadcast
vi.mock("../src/lib/prisma", () => {
  const mockAttempts: Record<string, any> = {};
  const mockEvents: Record<string, any> = {};

  return {
    prisma: {
      examinationEvent: {
        findUnique: vi.fn(async ({ where }: any) => {
          const key = `${where.attemptId_clientEventId.attemptId}_${where.attemptId_clientEventId.clientEventId}`;
          return mockEvents[key] || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const id = `evt-${Date.now()}-${Math.random()}`;
          const record = { id, ...data, serverTimestamp: new Date() };
          if (data.clientEventId) {
            mockEvents[`${data.attemptId}_${data.clientEventId}`] = record;
          }
          return record;
        }),
      },
      examinationAttempt: {
        findUnique: vi.fn(async ({ where }: any) => {
          return mockAttempts[where.id] || null;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          if (mockAttempts[where.id]) {
            Object.assign(mockAttempts[where.id], data);
            return mockAttempts[where.id];
          }
          return null;
        }),
      },
      $transaction: vi.fn(async (cb: any) => {
        return cb({
          examinationEvent: {
            create: vi.fn(async ({ data }: any) => {
              const id = `evt-${Date.now()}-${Math.random()}`;
              const record = { id, ...data, serverTimestamp: new Date() };
              if (data.clientEventId) {
                mockEvents[`${data.attemptId}_${data.clientEventId}`] = record;
              }
              return record;
            }),
          },
          examinationAttempt: {
            update: vi.fn(async ({ where, data }: any) => {
              if (mockAttempts[where.id]) {
                Object.assign(mockAttempts[where.id], data);
                return mockAttempts[where.id];
              }
              return null;
            }),
          },
        });
      }),
      __mockAttempts: mockAttempts,
      __mockEvents: mockEvents,
    },
  };
});

describe("Phase 4 – Anti-Cheat Policy Evaluator Engine", () => {
  let mockAttempts: Record<string, any>;
  let mockEvents: Record<string, any>;

  beforeEach(async () => {
    const { prisma } = await import("../src/lib/prisma");
    mockAttempts = (prisma as any).__mockAttempts;
    mockEvents = (prisma as any).__mockEvents;
    for (const k in mockAttempts) delete mockAttempts[k];
    for (const k in mockEvents) delete mockEvents[k];
  });

  it("should define standard countable browser events", () => {
    expect(DEFAULT_COUNTED_EVENTS).toContain("focus_loss");
    expect(DEFAULT_COUNTED_EVENTS).toContain("visibility_change");
    expect(DEFAULT_COUNTED_EVENTS).toContain("fullscreen_exit");
    expect(DEFAULT_COUNTED_EVENTS).toContain("page_unload");
    expect(DEFAULT_COUNTED_EVENTS).toContain("screenshot_attempt");
    expect(DEFAULT_COUNTED_EVENTS).toContain("clipboard_copy");
    expect(DEFAULT_COUNTED_EVENTS).not.toContain("network_disconnect");
    expect(DEFAULT_COUNTED_EVENTS).not.toContain("heartbeat_missed");
  });

  it("should record screenshot attempt as countable policy violation", async () => {
    mockAttempts["attempt-ss"] = {
      id: "attempt-ss",
      examinationId: "exam-1",
      studentId: "student-1",
      status: "in_progress",
      incidentCount: 0,
      student: { displayName: "Andi", nis: "1001" },
      examination: {
        policySettings: {
          mode: "standard",
          warnThreshold: 1,
          blockThreshold: 3,
        },
      },
    };

    const res = await evaluateAntiCheatEvent({
      attemptId: "attempt-ss",
      eventType: "screenshot_attempt",
      clientEventId: "client-ss-1",
      metadata: { shortcut: "PrintScreen" },
    });

    expect(res.action).toBe("warning");
    expect(res.status).toBe("warning");
    expect(res.incidentCount).toBe(1);
    expect(mockAttempts["attempt-ss"].incidentCount).toBe(1);
  });

  it("should transition from in_progress to warning on first countable event in standard mode", async () => {
    mockAttempts["attempt-1"] = {
      id: "attempt-1",
      examinationId: "exam-1",
      studentId: "student-1",
      status: "in_progress",
      incidentCount: 0,
      student: { displayName: "Andi", nis: "1001" },
      examination: {
        policySettings: {
          mode: "standard",
          warnThreshold: 1,
          blockThreshold: 3,
        },
      },
    };

    const res = await evaluateAntiCheatEvent({
      attemptId: "attempt-1",
      eventType: "focus_loss",
      clientEventId: "client-evt-1",
    });

    expect(res.action).toBe("warning");
    expect(res.status).toBe("warning");
    expect(res.incidentCount).toBe(1);
    expect(mockAttempts["attempt-1"].status).toBe("warning");
  });

  it("should block attempt when blockThreshold is reached in standard mode", async () => {
    mockAttempts["attempt-2"] = {
      id: "attempt-2",
      examinationId: "exam-1",
      studentId: "student-2",
      status: "warning",
      incidentCount: 2,
      student: { displayName: "Budi", nis: "1002" },
      examination: {
        policySettings: {
          mode: "standard",
          warnThreshold: 1,
          blockThreshold: 3,
        },
      },
    };

    const res = await evaluateAntiCheatEvent({
      attemptId: "attempt-2",
      eventType: "visibility_change",
      clientEventId: "client-evt-2",
    });

    expect(res.action).toBe("blocked");
    expect(res.status).toBe("blocked");
    expect(res.incidentCount).toBe(3);
    expect(mockAttempts["attempt-2"].status).toBe("blocked");
  });

  it("should not increment incidentCount for network_disconnect or heartbeat_missed", async () => {
    mockAttempts["attempt-3"] = {
      id: "attempt-3",
      examinationId: "exam-1",
      studentId: "student-3",
      status: "in_progress",
      incidentCount: 0,
      student: { displayName: "Citra", nis: "1003" },
      examination: {
        policySettings: {
          mode: "standard",
          warnThreshold: 1,
          blockThreshold: 3,
        },
      },
    };

    const res = await evaluateAntiCheatEvent({
      attemptId: "attempt-3",
      eventType: "network_disconnect",
      clientEventId: "net-evt-1",
    });

    expect(res.action).toBe("recorded");
    expect(res.status).toBe("in_progress");
    expect(res.incidentCount).toBe(0);
    expect(mockAttempts["attempt-3"].status).toBe("in_progress");
  });

  it("should handle event deduplication idempotently via clientEventId", async () => {
    mockAttempts["attempt-4"] = {
      id: "attempt-4",
      examinationId: "exam-1",
      studentId: "student-4",
      status: "in_progress",
      incidentCount: 0,
      student: { displayName: "Dewi", nis: "1004" },
      examination: {
        policySettings: {
          mode: "standard",
          warnThreshold: 1,
          blockThreshold: 3,
        },
      },
    };

    // First delivery
    const res1 = await evaluateAntiCheatEvent({
      attemptId: "attempt-4",
      eventType: "fullscreen_exit",
      clientEventId: "dup-uuid-123",
    });

    expect(res1.action).toBe("warning");
    expect(res1.incidentCount).toBe(1);

    // Second delivery of identical clientEventId (retry scenario)
    const res2 = await evaluateAntiCheatEvent({
      attemptId: "attempt-4",
      eventType: "fullscreen_exit",
      clientEventId: "dup-uuid-123",
    });

    expect(res2.action).toBe("recorded");
    expect(res2.incidentCount).toBe(1); // Not incremented again!
  });

  it("should never block or warn in practice mode", async () => {
    mockAttempts["attempt-practice"] = {
      id: "attempt-practice",
      examinationId: "exam-2",
      studentId: "student-5",
      status: "in_progress",
      incidentCount: 0,
      student: { displayName: "Eko", nis: "1005" },
      examination: {
        policySettings: {
          mode: "practice",
          warnThreshold: 1,
          blockThreshold: 3,
        },
      },
    };

    for (let i = 0; i < 5; i++) {
      const res = await evaluateAntiCheatEvent({
        attemptId: "attempt-practice",
        eventType: "focus_loss",
        clientEventId: `practice-evt-${i}`,
      });
      expect(res.action).toBe("recorded");
      expect(res.status).toBe("in_progress");
    }

    expect(mockAttempts["attempt-practice"].status).toBe("in_progress");
  });

  it("should block on second event in strict mode", async () => {
    mockAttempts["attempt-strict"] = {
      id: "attempt-strict",
      examinationId: "exam-3",
      studentId: "student-6",
      status: "in_progress",
      incidentCount: 0,
      student: { displayName: "Fani", nis: "1006" },
      examination: {
        policySettings: {
          mode: "strict",
        },
      },
    };

    // Event 1 -> warning
    const ev1 = await evaluateAntiCheatEvent({
      attemptId: "attempt-strict",
      eventType: "focus_loss",
      clientEventId: "strict-1",
    });
    expect(ev1.action).toBe("warning");

    // Event 2 -> blocked
    const ev2 = await evaluateAntiCheatEvent({
      attemptId: "attempt-strict",
      eventType: "focus_loss",
      clientEventId: "strict-2",
    });
    expect(ev2.action).toBe("blocked");
    expect(ev2.status).toBe("blocked");
  });

  it("should support proctor manual interventions (warn, block, unlock)", async () => {
    mockAttempts["attempt-proctor"] = {
      id: "attempt-proctor",
      examinationId: "exam-1",
      studentId: "student-7",
      status: "in_progress",
      incidentCount: 1,
      student: { displayName: "Gita", nis: "1007" },
      examination: {
        policySettings: {
          mode: "standard",
        },
      },
    };

    // 1. Proctor manual warning
    const warnRes = await evaluateAntiCheatEvent({
      attemptId: "attempt-proctor",
      eventType: "manual_warning",
      actorId: "proctor-uuid",
      interventionNote: "Tolong fokus pada layar ujian",
    });
    expect(warnRes.action).toBe("warning");
    expect(warnRes.status).toBe("warning");

    // 2. Proctor manual block
    const blockRes = await evaluateAntiCheatEvent({
      attemptId: "attempt-proctor",
      eventType: "manual_block",
      actorId: "proctor-uuid",
      interventionNote: "Penggunaan gawai terdeteksi",
    });
    expect(blockRes.action).toBe("blocked");
    expect(blockRes.status).toBe("blocked");

    // 3. Proctor manual unlock with reset
    const unlockRes = await evaluateAntiCheatEvent({
      attemptId: "attempt-proctor",
      eventType: "manual_unlock",
      actorId: "proctor-uuid",
      interventionNote: "Siswa telah diverifikasi dan diberi kesempatan kedua",
      metadata: { resetIncidentCount: true },
    });
    expect(unlockRes.action).toBe("unlocked");
    expect(unlockRes.status).toBe("in_progress");
    expect(unlockRes.incidentCount).toBe(0);
  });
});
