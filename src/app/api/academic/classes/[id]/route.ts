import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const classGroup = await prisma.classGroup.findUnique({
      where: { id },
      include: {
        major: true,
        academicYear: true,
        homeroomTeacher: {
          select: {
            id: true,
            displayName: true,
            username: true,
            nip: true,
            nuptk: true,
            email: true,
            title: true,
            position: true,
            gender: true,
          },
        },
        studentEnrollments: {
          orderBy: [
            { student: { displayName: "asc" } },
          ],
          include: {
            student: {
              select: {
                id: true,
                username: true,
                displayName: true,
                nis: true,
                nisn: true,
                gender: true,
                email: true,
                rawPassword: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Rombongan belajar kelas tidak ditemukan." },
        { status: 404 }
      );
    }

    // Generate formatted class code
    const majorCode = classGroup.major?.code || "UMUM";
    const classCode = `CLS-${classGroup.gradeLevel}-${majorCode}-${classGroup.name.replace(/\s+/g, "").toUpperCase()}`;

    // Students breakdown
    const students = classGroup.studentEnrollments.map((en, index) => ({
      enrollmentId: en.id,
      studentId: en.student.id,
      number: index + 1,
      displayName: en.student.displayName,
      username: en.student.username,
      nis: en.student.nis || "-",
      nisn: en.student.nisn || "-",
      gender: en.student.gender === "L" ? "Laki-laki" : en.student.gender === "P" ? "Perempuan" : "-",
      genderCode: en.student.gender || "-",
      email: en.student.email || "-",
      rawPassword: en.student.rawPassword || "-",
      status: en.status || "active",
      roleInClass: en.notes || "Anggota Kelas",
      enrolledAt: en.enrolledAt,
    }));

    const totalStudents = students.length;
    const totalMale = students.filter((s) => s.genderCode === "L").length;
    const totalFemale = students.filter((s) => s.genderCode === "P").length;

    // Class Structure extraction from roles & homeroom
    const structure = {
      homeroomTeacher: classGroup.homeroomTeacher
        ? {
            id: classGroup.homeroomTeacher.id,
            name: classGroup.homeroomTeacher.displayName,
            nip: classGroup.homeroomTeacher.nip || classGroup.homeroomTeacher.nuptk || "-",
            title: classGroup.homeroomTeacher.title || "-",
            position: "Wali Kelas",
          }
        : null,
      leader: students.find((s) => s.roleInClass.toLowerCase().includes("ketua kelas") || s.roleInClass.toLowerCase() === "ketua") || null,
      viceLeader: students.find((s) => s.roleInClass.toLowerCase().includes("wakil ketua")) || null,
      secretary1: students.find((s) => s.roleInClass.toLowerCase() === "sekretaris 1" || s.roleInClass.toLowerCase() === "sekretaris") || null,
      secretary2: students.find((s) => s.roleInClass.toLowerCase() === "sekretaris 2") || null,
      treasurer1: students.find((s) => s.roleInClass.toLowerCase() === "bendahara 1" || s.roleInClass.toLowerCase() === "bendahara") || null,
      treasurer2: students.find((s) => s.roleInClass.toLowerCase() === "bendahara 2") || null,
      sections: students.filter((s) => s.roleInClass.toLowerCase().startsWith("seksi") || s.roleInClass.toLowerCase().startsWith("koordinator")),
      customRoles: students.filter(
        (s) =>
          s.roleInClass !== "Anggota Kelas" &&
          !s.roleInClass.toLowerCase().includes("ketua") &&
          !s.roleInClass.toLowerCase().includes("sekretaris") &&
          !s.roleInClass.toLowerCase().includes("bendahara") &&
          !s.roleInClass.toLowerCase().startsWith("seksi") &&
          !s.roleInClass.toLowerCase().startsWith("koordinator")
      ),
    };

    return NextResponse.json({
      success: true,
      data: {
        id: classGroup.id,
        name: classGroup.name,
        code: classCode,
        gradeLevel: classGroup.gradeLevel,
        isActive: classGroup.isActive,
        academicYear: classGroup.academicYear,
        major: classGroup.major
          ? {
              id: classGroup.major.id,
              name: classGroup.major.name,
              code: classGroup.major.code,
              description: classGroup.major.description,
            }
          : {
              id: null,
              name: "Umum (Tidak Ada Jurusan)",
              code: "UMUM",
              description: "Jenjang non-kejuruan / reguler",
            },
        homeroomTeacher: classGroup.homeroomTeacher,
        totalStudents,
        totalMale,
        totalFemale,
        students,
        structure,
      },
    });
  } catch (error: any) {
    console.error("GET /api/academic/classes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load class details" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApi("academic:update");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = await req.json();

    // Check action type: update role in class structure vs update class details
    if (body.action === "update_student_role") {
      const { enrollmentId, roleInClass } = body;
      if (!enrollmentId) {
        return NextResponse.json(
          { success: false, error: "Enrollment ID wajib disertakan." },
          { status: 400 }
        );
      }

      const updated = await prisma.studentEnrollment.update({
        where: { id: enrollmentId },
        data: {
          notes: roleInClass && roleInClass.trim() !== "" ? roleInClass.trim() : null,
        },
        include: {
          student: {
            select: { displayName: true },
          },
        },
      });

      await logAudit({
        actorId: auth.user.id,
        action: "update",
        entityType: "student_enrollments",
        entityId: enrollmentId,
        afterValue: {
          action: "update_student_role",
          student: updated.student.displayName,
          newRole: roleInClass,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Jabatan kelas berhasil diperbarui menjadi '${roleInClass || "Anggota Kelas"}'.`,
        data: updated,
      });
    }

    // Default: update class details (name, gradeLevel, majorId, homeroomTeacherId, isActive)
    const { name, gradeLevel, majorId, homeroomTeacherId, isActive } = body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (gradeLevel !== undefined) updateData.gradeLevel = Number(gradeLevel);
    if (majorId !== undefined) updateData.majorId = majorId || null;
    if (homeroomTeacherId !== undefined) updateData.homeroomTeacherId = homeroomTeacherId || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updatedClass = await prisma.classGroup.update({
      where: { id },
      data: updateData,
      include: {
        major: true,
        homeroomTeacher: true,
      },
    });

    await logAudit({
      actorId: auth.user.id,
      action: "update",
      entityType: "class_groups",
      entityId: id,
      afterValue: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Data kelas berhasil diperbarui.",
      data: updatedClass,
    });
  } catch (error: any) {
    console.error("PATCH /api/academic/classes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui data kelas" },
      { status: 500 }
    );
  }
}
