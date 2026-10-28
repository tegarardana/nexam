import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { studentEnrollmentSchema } from "@/lib/validation/academic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const classGroupId = searchParams.get("classGroupId");
  const academicYearId = searchParams.get("academicYearId");
  const unassigned = searchParams.get("unassigned") === "true";

  // If unassigned requested, return students without active enrollment in this academic year
  if (unassigned && academicYearId) {
    const unassignedStudents = await prisma.user.findMany({
      where: {
        archivedAt: null,
        isActive: true,
        userRoles: {
          some: { role: { name: "student" } },
        },
        studentEnrollments: {
          none: {
            academicYearId,
            status: "active",
          },
        },
      },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        nis: true,
        nisn: true,
        email: true,
      },
    });

    return NextResponse.json({ success: true, data: unassignedStudents });
  }

  const whereClause: any = {};
  if (classGroupId) whereClause.classGroupId = classGroupId;
  if (academicYearId) whereClause.academicYearId = academicYearId;

  const enrollments = await prisma.studentEnrollment.findMany({
    where: whereClause,
    orderBy: { student: { displayName: "asc" } },
    include: {
      student: {
        select: {
          id: true,
          username: true,
          displayName: true,
          nis: true,
          nisn: true,
          email: true,
          rawPassword: true,
          isActive: true,
        },
      },
      classGroup: {
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          major: { select: { id: true, name: true, code: true } },
        },
      },
      academicYear: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  return NextResponse.json({ success: true, data: enrollments });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("academic:enroll");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parse = studentEnrollmentSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { studentId, classGroupId, academicYearId, status, notes } = parse.data;

    // Check unique placement for student in this academic year
    const existing = await prisma.studentEnrollment.findUnique({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
    });

    if (existing) {
      // Update placement
      const updated = await prisma.studentEnrollment.update({
        where: { id: existing.id },
        data: { classGroupId, status, notes },
        include: { student: true, classGroup: true },
      });

      await logAudit({
        actorId: auth.user.id,
        action: "student_enrollment:update",
        entityType: "student_enrollments",
        entityId: updated.id,
        beforeValue: { classGroupId: existing.classGroupId, status: existing.status },
        afterValue: { classGroupId, status },
      });

      return NextResponse.json({ success: true, data: updated });
    }

    const created = await prisma.studentEnrollment.create({
      data: {
        studentId,
        classGroupId,
        academicYearId,
        status,
        notes,
      },
      include: {
        student: true,
        classGroup: true,
      },
    });

    await logAudit({
      actorId: auth.user.id,
      action: "student_enrollment:create",
      entityType: "student_enrollments",
      entityId: created.id,
      afterValue: { studentId, classGroupId, academicYearId },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Enrollment error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan penempatan siswa" },
      { status: 500 }
    );
  }
}

/**
 * Bulk Student Assignment / Promotion Endpoint (PUT)
 * Promotes or places multiple students to a target class group in a target academic year.
 */
export async function PUT(req: NextRequest) {
  const auth = await authenticateApi("academic:enroll");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { studentIds, targetClassGroupId, targetAcademicYearId, status = "active" } = body;

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !targetClassGroupId || !targetAcademicYearId) {
      return NextResponse.json(
        { success: false, error: "studentIds array, targetClassGroupId, dan targetAcademicYearId wajib diisi." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const studentId of studentIds) {
        const enrollment = await tx.studentEnrollment.upsert({
          where: {
            studentId_academicYearId: {
              studentId,
              academicYearId: targetAcademicYearId,
            },
          },
          update: {
            classGroupId: targetClassGroupId,
            status,
          },
          create: {
            studentId,
            classGroupId: targetClassGroupId,
            academicYearId: targetAcademicYearId,
            status,
          },
        });
        records.push(enrollment);
      }
      return records;
    });

    await logAudit({
      actorId: auth.user.id,
      action: "academic:assign_students_to_class",
      entityType: "student_enrollments",
      afterValue: {
        placedCount: result.length,
        targetClassGroupId,
        targetAcademicYearId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menempatkan ${result.length} siswa ke dalam kelas.`,
      count: result.length,
    });
  } catch (error) {
    console.error("Bulk placement error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menempatkan siswa ke dalam kelas." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateApi("academic:enroll");
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get("id");
    const idsParam = searchParams.get("ids");
    let ids: string[] = [];

    if (singleId) {
      ids = [singleId];
    } else if (idsParam) {
      ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      try {
        const body = await req.json();
        if (Array.isArray(body?.ids)) ids = body.ids;
      } catch {
        // empty body ok
      }
    }

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "Parameter 'id' atau 'ids' penempatan wajib diisi." }, { status: 400 });
    }

    const deleteResult = await prisma.studentEnrollment.deleteMany({
      where: { id: { in: ids } },
    });

    await logAudit({
      actorId: auth.user.id,
      action: "student_enrollment:batch_delete",
      entityType: "student_enrollments",
      afterValue: { deletedCount: deleteResult.count, ids },
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil mengeluarkan ${deleteResult.count} siswa dari rombel.`,
      count: deleteResult.count,
    });
  } catch (error) {
    console.error("Delete enrollment error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengeluarkan siswa dari rombel." },
      { status: 500 }
    );
  }
}
