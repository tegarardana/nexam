import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";

const bulkUpdateClassStudentsSchema = z.object({
  action: z.enum(["set_password", "set_status", "batch_update"]),
  // For 'set_password'
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  // For 'set_status'
  isActive: z.boolean().optional(),
  // For 'batch_update' (e.g. from edited list or CSV)
  students: z
    .array(
      z.object({
        id: z.string().uuid(),
        displayName: z.string().min(2).max(100).optional(),
        username: z.string().min(3).max(50).optional(),
        nis: z.string().max(30).optional().nullable(),
        nisn: z.string().max(30).optional().nullable(),
        gender: z.string().optional().nullable(),
        password: z.string().min(6).max(100).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApi("academic:update");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: classGroupId } = await params;
    const body = await req.json();

    const parse = bulkUpdateClassStudentsSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { action, password, isActive, students } = parse.data;

    // Verify class exists
    const classGroup = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      include: {
        studentEnrollments: {
          where: { status: "active" },
          select: { studentId: true },
        },
      },
    });

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Kelas tidak ditemukan." },
        { status: 404 }
      );
    }

    const enrolledStudentIds = classGroup.studentEnrollments.map((e) => e.studentId);
    if (enrolledStudentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada siswa aktif yang terdaftar di kelas ini." },
        { status: 400 }
      );
    }

    // 1. Set uniform password for entire class
    if (action === "set_password") {
      if (!password) {
        return NextResponse.json(
          { success: false, error: "Password baru wajib diisi." },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(password);
      await prisma.user.updateMany({
        where: { id: { in: enrolledStudentIds } },
        data: {
          passwordHash,
          rawPassword: password,
        },
      });

      await logAudit({
        actorId: auth.user.id,
        action: "user:class_bulk_password_reset",
        entityType: "class_groups",
        entityId: classGroupId,
        afterValue: { totalUpdated: enrolledStudentIds.length, className: classGroup.name },
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil mereset password untuk ${enrolledStudentIds.length} siswa di kelas ${classGroup.name}.`,
        totalUpdated: enrolledStudentIds.length,
      });
    }

    // 2. Set active status for entire class
    if (action === "set_status") {
      if (isActive === undefined) {
        return NextResponse.json(
          { success: false, error: "Status aktif (isActive) wajib ditentukan." },
          { status: 400 }
        );
      }

      await prisma.user.updateMany({
        where: { id: { in: enrolledStudentIds } },
        data: { isActive },
      });

      await logAudit({
        actorId: auth.user.id,
        action: "user:class_bulk_status_update",
        entityType: "class_groups",
        entityId: classGroupId,
        afterValue: { isActive, totalUpdated: enrolledStudentIds.length, className: classGroup.name },
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil mengubah status ${enrolledStudentIds.length} siswa di kelas ${classGroup.name} menjadi ${
          isActive ? "Aktif" : "Nonaktif"
        }.`,
        totalUpdated: enrolledStudentIds.length,
      });
    }

    // 3. Batch update student details (e.g. from inline edit table or uploaded CSV)
    if (action === "batch_update") {
      if (!students || students.length === 0) {
        return NextResponse.json(
          { success: false, error: "Daftar data siswa wajib diisi." },
          { status: 400 }
        );
      }

      let updatedCount = 0;
      await prisma.$transaction(async (tx) => {
        for (const s of students) {
          // Ensure student is actually in this class
          if (!enrolledStudentIds.includes(s.id)) continue;

          const dataToUpdate: any = {};
          if (s.displayName) dataToUpdate.displayName = s.displayName;
          if (s.username) dataToUpdate.username = s.username;
          if (s.nis !== undefined) dataToUpdate.nis = s.nis || null;
          if (s.nisn !== undefined) dataToUpdate.nisn = s.nisn || null;
          if (s.gender !== undefined) dataToUpdate.gender = s.gender || null;
          if (s.isActive !== undefined) dataToUpdate.isActive = s.isActive;
          if (s.password && s.password.trim() !== "") {
            dataToUpdate.passwordHash = await hashPassword(s.password);
            dataToUpdate.rawPassword = s.password;
          }

          if (Object.keys(dataToUpdate).length > 0) {
            await tx.user.update({
              where: { id: s.id },
              data: dataToUpdate,
            });
            updatedCount++;
          }
        }
      });

      await logAudit({
        actorId: auth.user.id,
        action: "user:class_batch_update",
        entityType: "class_groups",
        entityId: classGroupId,
        afterValue: { updatedCount, className: classGroup.name },
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil memperbarui data ${updatedCount} siswa di kelas ${classGroup.name}.`,
        totalUpdated: updatedCount,
      });
    }

    return NextResponse.json({ success: false, error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: any) {
    console.error("Bulk update class students error:", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: "Terdapat duplikasi data (Username, NIS, atau NISN sudah digunakan oleh pengguna lain).",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui data siswa sekelas." },
      { status: 500 }
    );
  }
}
