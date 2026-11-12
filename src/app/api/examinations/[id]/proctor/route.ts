import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatNameWithTitle } from "@/lib/format-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveStudentClass(
  academicYearId: string,
  directClassGroup?: { id: string; name: string } | null,
  enrollments?: Array<{
    academicYearId: string;
    classGroup: { id: string; name: string } | null;
  }>
) {
  if (directClassGroup?.name) {
    return { classGroupId: directClassGroup.id, className: directClassGroup.name };
  }
  const matched =
    enrollments?.find((e) => e.academicYearId === academicYearId && e.classGroup?.name) ??
    enrollments?.find((e) => e.classGroup?.name);
  return {
    classGroupId: matched?.classGroup?.id ?? null,
    className: matched?.classGroup?.name ?? "-",
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: examinationId } = await params;

  try {
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
                studentEnrollments: {
                  where: { status: "active" },
                  select: {
                    academicYearId: true,
                    classGroup: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                  orderBy: { enrolledAt: "desc" },
                },
              },
            },
            classGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attempts: {
          include: {
            student: {
              select: {
                id: true,
                displayName: true,
                username: true,
                nis: true,
                studentEnrollments: {
                  where: { status: "active" },
                  select: {
                    academicYearId: true,
                    classGroup: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                  orderBy: { enrolledAt: "desc" },
                },
              },
            },
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
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan." }, { status: 404 });
    }

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
            title: true,
          },
        },
      },
      orderBy: { serverTimestamp: "desc" },
      take: 50,
    });

    const participantsMap = new Map<string, any>();
    for (const part of examination.participants) {
      const studentAttempt = examination.attempts.find((a) => a.studentId === part.studentId);
      const { classGroupId, className } = resolveStudentClass(
        examination.academicYearId,
        part.classGroup,
        part.student.studentEnrollments
      );
      participantsMap.set(part.studentId, {
        studentId: part.studentId,
        studentName: part.student.displayName,
        username: part.student.username,
        nis: part.student.nis,
        classGroupId,
        className,
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

    // Also ensure any student who has an attempt is included in the roster
    for (const att of examination.attempts) {
      if (!participantsMap.has(att.studentId)) {
        const { classGroupId, className } = resolveStudentClass(
          examination.academicYearId,
          null,
          att.student?.studentEnrollments
        );
        participantsMap.set(att.studentId, {
          studentId: att.studentId,
          studentName: att.student?.displayName || "Siswa",
          username: att.student?.username || "-",
          nis: att.student?.nis || null,
          classGroupId,
          className,
          attemptId: att.id,
          status: att.status || "not_started",
          connectionStatus: att.connectionStatus || "unknown",
          incidentCount: att.incidentCount || 0,
          startedAt: att.startedAt || null,
          deadlineAt: att.deadlineAt || null,
          submittedAt: att.submittedAt || null,
          answeredCount: att.answers.length || 0,
          doubtfulCount: att.answers.filter((ans) => ans.isDoubtful).length || 0,
          lastHeartbeat: att.lastHeartbeat || null,
        });
      }
    }

    return NextResponse.json({
      success: true,
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
          studentId: evt.attempt.student.id,
          studentName: evt.attempt.student.displayName,
          studentNis: evt.attempt.student.nis,
          eventType: evt.eventType,
          actorName: evt.actor ? formatNameWithTitle(evt.actor.displayName, evt.actor.title) : null,
          interventionNote: evt.interventionNote,
          metadata: evt.metadata,
          timestamp: evt.serverTimestamp,
        })),
      },
    });
  } catch (err: any) {
    console.error("GET /api/examinations/[id]/proctor error:", err);
    return NextResponse.json({ success: false, error: err.message || "Gagal memuat status pengawasan." }, { status: 500 });
  }
}
