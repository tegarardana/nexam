import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("academic:promote");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { sourceAcademicYearId, targetAcademicYearId } = body;

    if (!sourceAcademicYearId || !targetAcademicYearId) {
      return NextResponse.json(
        { success: false, error: "Tahun ajaran asal dan tahun ajaran tujuan wajib diisi." },
        { status: 400 }
      );
    }

    if (sourceAcademicYearId === targetAcademicYearId) {
      return NextResponse.json(
        { success: false, error: "Tahun ajaran asal dan tujuan tidak boleh sama." },
        { status: 400 }
      );
    }

    // Verify target academic year and active semester
    const targetYear = await prisma.academicYear.findUnique({
      where: { id: targetAcademicYearId },
      include: {
        semesters: { where: { status: "active" } },
      },
    });

    if (!targetYear) {
      return NextResponse.json(
        { success: false, error: "Tahun ajaran tujuan tidak ditemukan." },
        { status: 404 }
      );
    }

    const activeSemester = targetYear.semesters[0];
    if (!activeSemester || !activeSemester.name.toLowerCase().includes("ganjil")) {
      return NextResponse.json(
        {
          success: false,
          error: "Opsi kenaikan kelas hanya dapat dijalankan pada Semester Ganjil yang sedang aktif.",
        },
        { status: 400 }
      );
    }

    // Fetch classes and students from source academic year
    const sourceClasses = await prisma.classGroup.findMany({
      where: { academicYearId: sourceAcademicYearId, isActive: true },
      include: {
        studentEnrollments: {
          where: { status: "active" },
          select: { studentId: true },
        },
      },
    });

    if (sourceClasses.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada data rombel aktif pada tahun ajaran asal." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let createdClassesCount = 0;
      let promotedStudentsCount = 0;

      for (const cls of sourceClasses) {
        const studentIds = cls.studentEnrollments.map((e) => e.studentId);
        if (cls.gradeLevel < 12) {
          const nextGradeLevel = cls.gradeLevel + 1;
          // Generate next class name (e.g., replace 'X ' with 'XI ', or 'XI ' with 'XII ')
          let nextClassName = cls.name;
          if (cls.gradeLevel === 10) {
            nextClassName = cls.name.replace(/^X\b/, "XI").replace(/^10\b/, "11");
          } else if (cls.gradeLevel === 11) {
            nextClassName = cls.name.replace(/^XI\b/, "XII").replace(/^11\b/, "12");
          }

          // Check if class already exists in target academic year
          let targetClass = await tx.classGroup.findFirst({
            where: {
              academicYearId: targetAcademicYearId,
              name: nextClassName,
            },
          });

          if (!targetClass) {
            targetClass = await tx.classGroup.create({
              data: {
                name: nextClassName,
                gradeLevel: nextGradeLevel,
                majorId: cls.majorId,
                academicYearId: targetAcademicYearId,
                isActive: true,
              },
            });
            createdClassesCount++;
          }

          // Enroll students into target class
          for (const studentId of studentIds) {
            await tx.studentEnrollment.upsert({
              where: {
                studentId_academicYearId: {
                  studentId,
                  academicYearId: targetAcademicYearId,
                },
              },
              update: {
                classGroupId: targetClass.id,
                status: "active",
                notes: `Promoted from ${cls.name}`,
              },
              create: {
                studentId,
                classGroupId: targetClass.id,
                academicYearId: targetAcademicYearId,
                status: "active",
                notes: `Promoted from ${cls.name}`,
              },
            });
            promotedStudentsCount++;
          }
        }
      }

      return { createdClassesCount, promotedStudentsCount };
    });

    await logAudit({
      actorId: auth.user.id,
      action: "academic:promote_classes",
      entityType: "academic_years",
      entityId: targetAcademicYearId,
      afterValue: {
        sourceAcademicYearId,
        targetAcademicYearId,
        promotedStudentsCount: result.promotedStudentsCount,
        createdClassesCount: result.createdClassesCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Proses kenaikan kelas berhasil! ${result.promotedStudentsCount} siswa telah dipromosikan ke ${result.createdClassesCount} rombel baru.`,
      data: result,
    });
  } catch (error: any) {
    console.error("Promote classes error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses kenaikan kelas." },
      { status: 500 }
    );
  }
}
