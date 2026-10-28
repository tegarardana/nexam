import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { AssignParticipantsSchema } from "@/lib/validation/examination";
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
    const exam = await prisma.examination.findUnique({ where: { id } });
    if (!exam) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = AssignParticipantsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { classGroupIds, studentIds } = parsed.data;

    const studentIdSet = new Set<string>(studentIds || []);
    const studentToClassMap = new Map<string, string>();

    // If classGroupIds provided, fetch all students currently enrolled in those classes
    if (classGroupIds && classGroupIds.length > 0) {
      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          classGroupId: { in: classGroupIds },
          academicYearId: exam.academicYearId,
          status: "active",
        },
      });

      enrollments.forEach((e) => {
        studentIdSet.add(e.studentId);
        studentToClassMap.set(e.studentId, e.classGroupId);
      });
    }

    const allStudentIds = Array.from(studentIdSet);

    if (allStudentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada siswa yang dipilih atau ditemukan di kelas terkait." },
        { status: 400 }
      );
    }

    // Insert participants, ignoring duplicates
    let addedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const studentId of allStudentIds) {
        const classGroupId = studentToClassMap.get(studentId) || null;
        await tx.examinationParticipant.upsert({
          where: {
            examinationId_studentId: {
              examinationId: id,
              studentId,
            },
          },
          update: {
            classGroupId,
            status: "eligible",
          },
          create: {
            examinationId: id,
            studentId,
            classGroupId,
            status: "eligible",
          },
        });
        addedCount++;
      }
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination:assign_participants",
      entityType: "examinations",
      entityId: id,
      afterValue: { participantCount: addedCount },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `${addedCount} peserta berhasil didaftarkan ke ujian`,
    });
  } catch (error) {
    console.error("POST /api/examinations/[id]/participants error:", error);
    return NextResponse.json({ success: false, error: "Gagal mendaftarkan peserta ke ujian" }, { status: 500 });
  }
}
