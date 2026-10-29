import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { CreateExaminationSchema } from "@/lib/validation/examination";
import { logAudit } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { syncExaminationStates } = await import("@/lib/examination-state");
    await syncExaminationStates();

    const exam = await prisma.examination.findUnique({
      where: { id },
      include: {
        subject: true,
        examinationType: true,
        session: true,
        academicYear: true,
        semester: true,
        createdBy: { select: { id: true, displayName: true, username: true } },
        policySettings: true,
        questions: {
          orderBy: { sequenceOrder: "asc" },
          include: {
            question: {
              include: {
                category: true,
              },
            },
            questionVersion: {
              include: {
                options: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        participants: {
          include: {
            student: { select: { id: true, displayName: true, username: true, nis: true, nisn: true } },
            classGroup: { select: { id: true, name: true } },
          },
        },
        proctorAssignments: {
          include: {
            proctor: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: exam });
  } catch (error) {
    console.error("GET /api/examinations/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat detail ujian" }, { status: 500 });
  }
}

export async function PUT(
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
    const existing = await prisma.examination.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    // Material edits only permitted in draft or ready (per PRD)
    if (existing.status !== "draft" && existing.status !== "ready") {
      return NextResponse.json(
        {
          success: false,
          error: `Pengubahan konfigurasi ujian tidak diizinkan pada status '${existing.status}'. Kembalikan ke 'draft' terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = CreateExaminationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      subjectId,
      academicYearId,
      semesterId,
      durationMinutes,
      scheduledStart,
      scheduledEnd,
      totalPoints,
      passingScore,
      policySettings,
      examinationTypeId,
      sessionId,
    } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const exam = await tx.examination.update({
        where: { id },
        data: {
          title,
          description: description || null,
          subjectId: subjectId || null,
          academicYearId,
          semesterId,
          durationMinutes,
          scheduledStart,
          scheduledEnd,
          totalPoints,
          passingScore: passingScore || null,
          ...(examinationTypeId !== undefined ? { examinationTypeId: examinationTypeId || null } : {}),
          ...(sessionId !== undefined ? { sessionId: sessionId || null } : {}),
        },
      });

      if (policySettings) {
        await tx.examinationPolicySetting.upsert({
          where: { examinationId: id },
          update: policySettings,
          create: {
            examinationId: id,
            ...policySettings,
          },
        });
      }

      return exam;
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination:update",
      entityType: "examinations",
      entityId: id,
      beforeValue: existing,
      afterValue: updated,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/examinations/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal memperbarui ujian" }, { status: 500 });
  }
}

export async function DELETE(
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
    const existing = await prisma.examination.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    const isAdmin = session.user.roles.includes("administrator");

    // If the exam is closed, finalized, or archived: only Administrator can delete it
    if (["closed", "finalized", "archived"].includes(existing.status)) {
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: "Hanya Administrator yang memiliki wewenang untuk menghapus ujian yang telah ditutup.",
          },
          { status: 403 }
        );
      }
    }

    // Delete examination and its cascade relations
    await prisma.examination.delete({
      where: { id },
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination:delete",
      entityType: "examinations",
      entityId: id,
      beforeValue: existing,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, message: "Ujian berhasil dihapus." });
  } catch (error) {
    console.error("DELETE /api/examinations/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengarsipkan ujian" }, { status: 500 });
  }
}
