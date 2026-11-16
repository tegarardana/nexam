import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatNameWithTitle } from "@/lib/format-user";
import { logAudit } from "@/lib/audit";

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
        proctorAssignments: {
          include: {
            proctor: {
              select: {
                id: true,
                displayName: true,
                username: true,
                title: true,
                nip: true,
              },
            },
          },
          orderBy: { assignedAt: "asc" },
        },
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

    const isAdmin = session.user.roles.includes("administrator");
    const isCreator = examination.createdById === session.user.id;
    const isAssignedProctor = examination.proctorAssignments.some(
      (pa) => pa.proctorId === session.user.id
    );

    if (!isAdmin && !isCreator && !isAssignedProctor) {
      return NextResponse.json(
        {
          success: false,
          error: "Akses ditolak: Anda bukan pembuat ujian atau pengawas yang ditugaskan pada ujian ini.",
        },
        { status: 403 }
      );
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
          proctors: examination.proctorAssignments.map((pa) => ({
            id: pa.id,
            proctorId: pa.proctorId,
            displayName: pa.proctor.displayName,
            title: pa.proctor.title,
            formattedName: formatNameWithTitle(pa.proctor.displayName, pa.proctor.title),
            username: pa.proctor.username,
            nip: pa.proctor.nip,
            roomName: pa.roomName,
            assignedAt: pa.assignedAt,
          })),
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: examinationId } = await params;

  try {
    const body = await request.json();
    const { proctorId, roomName } = body;

    if (!proctorId) {
      return NextResponse.json(
        { success: false, error: "proctorId wajib diisi." },
        { status: 400 }
      );
    }

    const examination = await prisma.examination.findUnique({
      where: { id: examinationId },
    });
    if (!examination) {
      return NextResponse.json(
        { success: false, error: "Ujian tidak ditemukan." },
        { status: 404 }
      );
    }

    // Check target teacher exists
    const teacherUser = await prisma.user.findUnique({
      where: { id: proctorId },
      select: { id: true, displayName: true, title: true, username: true, nip: true },
    });
    if (!teacherUser) {
      return NextResponse.json(
        { success: false, error: "Pengguna guru tidak ditemukan." },
        { status: 404 }
      );
    }

    const assignment = await prisma.examinationProctorAssignment.upsert({
      where: {
        examinationId_proctorId: {
          examinationId,
          proctorId,
        },
      },
      update: {
        roomName: roomName ? String(roomName).trim() : null,
      },
      create: {
        examinationId,
        proctorId,
        roomName: roomName ? String(roomName).trim() : null,
      },
      include: {
        proctor: {
          select: {
            id: true,
            displayName: true,
            username: true,
            title: true,
            nip: true,
          },
        },
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination:assign_proctor",
      entityType: "examination_proctor_assignments",
      entityId: assignment.id,
      afterValue: assignment,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...assignment,
        formattedName: formatNameWithTitle(assignment.proctor.displayName, assignment.proctor.title),
      },
    });
  } catch (error: any) {
    console.error("POST /api/examinations/[id]/proctor error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menugaskan pengawas." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session || !hasAnyRole(session.user, ["administrator", "teacher"])) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: examinationId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    let proctorId = searchParams.get("proctorId");

    if (!proctorId) {
      try {
        const body = await request.json();
        proctorId = body.proctorId;
      } catch {
        // Body might be empty
      }
    }

    if (!proctorId) {
      return NextResponse.json(
        { success: false, error: "proctorId wajib diisi." },
        { status: 400 }
      );
    }

    const deleted = await prisma.examinationProctorAssignment.deleteMany({
      where: {
        examinationId,
        proctorId,
      },
    });

    if (deleted.count > 0) {
      await logAudit({
        actorId: session.user.id,
        action: "examination:unassign_proctor",
        entityType: "examination_proctor_assignments",
        entityId: `${examinationId}:${proctorId}`,
        afterValue: { examinationId, proctorId },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Pengawas berhasil dihapus dari ujian.",
    });
  } catch (error: any) {
    console.error("DELETE /api/examinations/[id]/proctor error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mencabut penugasan pengawas." },
      { status: 500 }
    );
  }
}
