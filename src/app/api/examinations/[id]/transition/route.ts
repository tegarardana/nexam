import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { ExaminationStatus, ExaminationStatusEnum } from "@/lib/validation/examination";
import { validateExaminationTransition } from "@/lib/examination-state";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const targetStatus = body.status as ExaminationStatus;

    if (!targetStatus || !ExaminationStatusEnum.options.includes(targetStatus)) {
      return NextResponse.json(
        { success: false, error: "Target status ujian tidak valid" },
        { status: 400 }
      );
    }

    const exam = await prisma.examination.findUnique({
      where: { id },
      include: { semester: true, academicYear: true },
    });
    if (!exam) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    const now = new Date();
    const isReopening =
      (exam.status === "archived" || exam.status === "closed" || exam.status === "finalized") &&
      (targetStatus === "scheduled" || targetStatus === "ready");

    let newScheduledStart = exam.scheduledStart;
    let newScheduledEnd = exam.scheduledEnd;
    let newSemesterId = exam.semesterId;
    let newAcademicYearId = exam.academicYearId;

    if (body.scheduledStart) {
      newScheduledStart = new Date(body.scheduledStart);
    } else if (isReopening && exam.scheduledEnd < now) {
      newScheduledStart = now;
    }

    if (body.scheduledEnd) {
      newScheduledEnd = new Date(body.scheduledEnd);
    } else if (isReopening && exam.scheduledEnd < now) {
      const durationMs = (exam.durationMinutes || 90) * 60 * 1000;
      newScheduledEnd = new Date(newScheduledStart.getTime() + durationMs);
    }

    // Ensure newScheduledEnd is strictly greater than newScheduledStart
    if (newScheduledEnd <= newScheduledStart) {
      const durationMs = (exam.durationMinutes || 90) * 60 * 1000;
      newScheduledEnd = new Date(newScheduledStart.getTime() + durationMs);
    }

    // Reopen assignment to requested semester or active semester
    if (body.semesterId) {
      newSemesterId = body.semesterId;
      if (body.academicYearId) {
        newAcademicYearId = body.academicYearId;
      } else {
        const sem = await prisma.semester.findUnique({ where: { id: body.semesterId } });
        if (sem?.academicYearId) newAcademicYearId = sem.academicYearId;
      }
    } else if (isReopening && (exam.status === "archived" || exam.semester?.status !== "active")) {
      const activeSemester = await prisma.semester.findFirst({
        where: { status: "active" },
        include: { academicYear: true },
      });
      if (activeSemester) {
        newSemesterId = activeSemester.id;
        newAcademicYearId = activeSemester.academicYearId;
      }
    }

    const validation = await validateExaminationTransition(id, targetStatus, {
      scheduledStart: newScheduledStart,
      scheduledEnd: newScheduledEnd,
    });
    if (!validation.allowed) {
      return NextResponse.json(
        { success: false, error: validation.reason || "Transisi status ujian tidak diizinkan" },
        { status: 400 }
      );
    }

    const updated = await prisma.examination.update({
      where: { id },
      data: {
        status: targetStatus,
        publishedAt: targetStatus === "scheduled" || targetStatus === "ready" ? new Date() : exam.publishedAt,
        scheduledStart: newScheduledStart,
        scheduledEnd: newScheduledEnd,
        semesterId: newSemesterId,
        academicYearId: newAcademicYearId,
      },
      include: {
        semester: { select: { id: true, name: true, status: true } },
        academicYear: { select: { id: true, name: true, status: true } },
      },
    });

    // Auto-enroll eligible students from classes offering the subject if no participants yet or moved to new academic year
    if (["ready", "scheduled", "in_progress"].includes(targetStatus)) {
      const participantCount = await prisma.examinationParticipant.count({
        where: { examinationId: id },
      });
      if (participantCount === 0 || (isReopening && newAcademicYearId !== exam.academicYearId)) {
        const { autoEnrollEligibleStudents } = await import("@/lib/examination-participants");
        await autoEnrollEligibleStudents(id);
      }
    }

    await logAudit({
      actorId: session.user.id,
      action: `examination:transition:${targetStatus}`,
      entityType: "examinations",
      entityId: id,
      beforeValue: {
        status: exam.status,
        scheduledStart: exam.scheduledStart,
        scheduledEnd: exam.scheduledEnd,
        semesterId: exam.semesterId,
      },
      afterValue: {
        status: updated.status,
        scheduledStart: updated.scheduledStart,
        scheduledEnd: updated.scheduledEnd,
        semesterId: updated.semesterId,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("POST /api/examinations/[id]/transition error:", error);
    return NextResponse.json({ success: false, error: "Gagal memproses transisi status ujian" }, { status: 500 });
  }
}
