import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { proctorHub, ProctorEventPayload } from "@/lib/anti-cheat/proctor-hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: examinationId } = await params;

  // Verify examination exists
  const examination = await prisma.examination.findUnique({
    where: { id: examinationId },
    include: {
      policySettings: true,
      subject: true,
      participants: {
        include: {
          student: {
            select: {
              id: true,
              displayName: true,
              username: true,
              nis: true,
            },
          },
          classGroup: {
            select: {
              name: true,
            },
          },
        },
      },
      attempts: {
        include: {
          answers: {
            select: {
              id: true,
              isDoubtful: true,
            },
          },
        },
        orderBy: { attemptNumber: "desc" },
      },
    },
  });

  if (!examination) {
    return new Response("Examination not found", { status: 404 });
  }

  // Fetch recent events for initial state
  const attemptIds = examination.attempts.map((a) => a.id);
  const recentEvents = await prisma.examinationEvent.findMany({
    where: {
      attemptId: { in: attemptIds },
    },
    include: {
      attempt: {
        select: {
          student: {
            select: {
              id: true,
              displayName: true,
              nis: true,
            },
          },
        },
      },
      actor: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: { serverTimestamp: "desc" },
    take: 50,
  });

  // Prepare roster data
  const participantsMap = new Map<string, any>();
  for (const part of examination.participants) {
    const studentAttempt = examination.attempts.find((a) => a.studentId === part.studentId);
    participantsMap.set(part.studentId, {
      studentId: part.studentId,
      studentName: part.student.displayName,
      username: part.student.username,
      nis: part.student.nis,
      className: part.classGroup?.name || "-",
      attemptId: studentAttempt?.id || null,
      status: studentAttempt?.status || "not_started",
      connectionStatus: studentAttempt?.connectionStatus || "unknown",
      incidentCount: studentAttempt?.incidentCount || 0,
      startedAt: studentAttempt?.startedAt || null,
      deadlineAt: studentAttempt?.deadlineAt || null,
      submittedAt: studentAttempt?.submittedAt || null,
      answeredCount: studentAttempt?.answers.length || 0,
      doubtfulCount: studentAttempt?.answers.filter((ans) => ans.isDoubtful).length || 0,
      lastHeartbeat: studentAttempt?.lastHeartbeat || null,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial state event immediately
      const initialPayload = {
        type: "initial_state",
        examinationId,
        timestamp: new Date().toISOString(),
        data: {
          examination: {
            id: examination.id,
            title: examination.title,
            subject: examination.subject?.name || "-",
            durationMinutes: examination.durationMinutes,
            status: examination.status,
            policy: examination.policySettings,
          },
          roster: Array.from(participantsMap.values()),
          recentEvents: recentEvents.map((evt) => ({
            id: evt.id,
            attemptId: evt.attemptId,
            studentName: evt.attempt.student.displayName,
            studentNis: evt.attempt.student.nis,
            eventType: evt.eventType,
            actorName: evt.actor?.displayName || null,
            interventionNote: evt.interventionNote,
            metadata: evt.metadata,
            timestamp: evt.serverTimestamp,
          })),
        },
      };

      controller.enqueue(
        encoder.encode(`event: message\ndata: ${JSON.stringify(initialPayload)}\n\n`)
      );

      // 2. Subscribe to proctor hub
      const unsubscribe = proctorHub.subscribe(
        examinationId,
        (event: ProctorEventPayload) => {
          try {
            controller.enqueue(
              encoder.encode(`event: message\ndata: ${JSON.stringify(event)}\n\n`)
            );
          } catch {
            // Controller might be closed
          }
        }
      );

      // 3. Keep-alive ping interval
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // 4. Handle client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx direct streaming bypass
    },
  });
}
