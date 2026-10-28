import { prisma } from "../prisma";
import { proctorHub } from "./proctor-hub";

export type AntiCheatEventType =
  | "focus_loss"
  | "visibility_change"
  | "fullscreen_exit"
  | "fullscreen_attempt"
  | "screenshot_attempt"
  | "clipboard_copy"
  | "page_unload"
  | "network_disconnect"
  | "heartbeat_missed"
  | "session_conflict"
  | "manual_warning"
  | "manual_block"
  | "manual_unlock"
  | "manual_disqualify"
  | "time_extended";

export interface EvaluateEventParams {
  attemptId: string;
  eventType: AntiCheatEventType;
  clientEventId?: string;
  clientTimestamp?: string | Date;
  metadata?: Record<string, any>;
  actorId?: string; // Set when proctor or teacher initiates an action
  interventionNote?: string;
}

export interface PolicyEvaluationResult {
  action: "recorded" | "warning" | "blocked" | "unlocked" | "ignored";
  status: string;
  incidentCount: number;
  eventId?: string;
  message?: string;
}

/**
 * Standard default list of events that count as policy violations.
 * Network disconnections and heartbeat misses are connection quality metrics,
 * not policy violations.
 */
export const DEFAULT_COUNTED_EVENTS: AntiCheatEventType[] = [
  "focus_loss",
  "visibility_change",
  "fullscreen_exit",
  "page_unload",
  "screenshot_attempt",
  "clipboard_copy",
];

export async function evaluateAntiCheatEvent(
  params: EvaluateEventParams
): Promise<PolicyEvaluationResult> {
  const {
    attemptId,
    eventType,
    clientEventId,
    clientTimestamp,
    metadata,
    actorId,
    interventionNote,
  } = params;

  // 1. Check for duplicate event (idempotency by clientEventId)
  if (clientEventId) {
    const existingEvent = await prisma.examinationEvent.findUnique({
      where: {
        attemptId_clientEventId: {
          attemptId,
          clientEventId,
        },
      },
    });

    if (existingEvent) {
      const currentAttempt = await prisma.examinationAttempt.findUnique({
        where: { id: attemptId },
      });
      return {
        action: "recorded",
        status: currentAttempt?.status || "in_progress",
        incidentCount: currentAttempt?.incidentCount || 0,
        eventId: existingEvent.id,
        message: "Duplicate event acknowledged (idempotent)",
      };
    }
  }

  // 2. Fetch attempt with examination policy settings
  const attempt = await prisma.examinationAttempt.findUnique({
    where: { id: attemptId },
    include: {
      examination: {
        include: {
          policySettings: true,
        },
      },
      student: {
        select: {
          id: true,
          displayName: true,
          username: true,
          nis: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new Error("Sesi ujian (attempt) tidak ditemukan.");
  }

  // 3. Status checks: terminal attempts cannot process browser events
  if (["submitted", "completed", "expired"].includes(attempt.status)) {
    return {
      action: "ignored",
      status: attempt.status,
      incidentCount: attempt.incidentCount,
      message: "Ujian telah selesai atau kedaluwarsa.",
    };
  }

  // If already blocked, do not allow further browser incidents to re-trigger
  if (attempt.status === "blocked" && !eventType.startsWith("manual_")) {
    return {
      action: "blocked",
      status: "blocked",
      incidentCount: attempt.incidentCount,
      message: "Sesi ujian sedang ditangguhkan (blocked).",
    };
  }

  const policy = attempt.examination.policySettings;
  const mode = policy?.mode || "standard";

  // Determine counted events and thresholds based on policy mode
  let countedEvents = DEFAULT_COUNTED_EVENTS;
  let warnThreshold = policy?.warnThreshold ?? 1;
  let blockThreshold = policy?.blockThreshold ?? 3;

  if (mode === "strict") {
    warnThreshold = 1;
    blockThreshold = 2;
  } else if (mode === "practice") {
    // In practice mode, thresholds are practically infinite; events are recorded only
    warnThreshold = 9999;
    blockThreshold = 9999;
  } else if (mode === "custom" && policy?.customRules) {
    const rules = policy.customRules as any;
    if (Array.isArray(rules.counted_events)) {
      countedEvents = rules.counted_events;
    }
    if (typeof rules.warn_threshold === "number") {
      warnThreshold = rules.warn_threshold;
    }
    if (typeof rules.block_threshold === "number") {
      blockThreshold = rules.block_threshold;
    }
  }

  const isCounted = countedEvents.includes(eventType);

  // 4. Save event in transaction
  return await prisma.$transaction(async (tx) => {
    const createdEvent = await tx.examinationEvent.create({
      data: {
        attemptId,
        clientEventId: clientEventId || undefined,
        eventType,
        actorId: actorId || undefined,
        clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : undefined,
        metadata: metadata || undefined,
        interventionNote: interventionNote || undefined,
      },
    });

    let newIncidentCount = attempt.incidentCount;
    let nextStatus = attempt.status;
    let actionResult: PolicyEvaluationResult["action"] = "recorded";

    // Handle manual proctor actions
    if (eventType === "manual_warning") {
      nextStatus = "warning";
      actionResult = "warning";
    } else if (eventType === "manual_block") {
      nextStatus = "blocked";
      actionResult = "blocked";
    } else if (eventType === "manual_unlock") {
      nextStatus = "in_progress";
      actionResult = "unlocked";
      if (metadata?.resetIncidentCount) {
        newIncidentCount = 0;
      }
    } else if (isCounted && mode !== "practice") {
      // Automatic browser event evaluation
      newIncidentCount += 1;

      if (newIncidentCount >= blockThreshold) {
        nextStatus = "blocked";
        actionResult = "blocked";
      } else if (newIncidentCount >= warnThreshold && nextStatus === "in_progress") {
        nextStatus = "warning";
        actionResult = "warning";
      }
    }

    // Update attempt if count or status changed
    const updateData: any = {};
    if (newIncidentCount !== attempt.incidentCount) {
      updateData.incidentCount = newIncidentCount;
    }
    if (nextStatus !== attempt.status) {
      updateData.status = nextStatus;
    }
    if (eventType === "manual_unlock" && metadata?.resetIncidentCount) {
      updateData.incidentCountResetAt = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      await tx.examinationAttempt.update({
        where: { id: attemptId },
        data: updateData,
      });
    }

    // Broadcast live event to all connected proctors
    proctorHub.broadcast(attempt.examinationId, "incident_recorded", {
      attemptId,
      studentId: attempt.studentId,
      studentName: attempt.student.displayName,
      studentNis: attempt.student.nis,
      eventType,
      action: actionResult,
      status: nextStatus,
      incidentCount: newIncidentCount,
      timestamp: createdEvent.serverTimestamp,
      metadata,
      interventionNote,
    });

    if (nextStatus !== attempt.status) {
      proctorHub.broadcast(attempt.examinationId, "attempt_status_change", {
        attemptId,
        studentId: attempt.studentId,
        studentName: attempt.student.displayName,
        previousStatus: attempt.status,
        newStatus: nextStatus,
        incidentCount: newIncidentCount,
        timestamp: createdEvent.serverTimestamp,
      });
    }

    return {
      action: actionResult,
      status: nextStatus,
      incidentCount: newIncidentCount,
      eventId: createdEvent.id,
    };
  });
}
