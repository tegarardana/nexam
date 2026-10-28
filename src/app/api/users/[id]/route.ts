import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/audit";
import {
  updateStudentSchema,
  updateTeacherProfileSchema,
  updateTeacherDutySchema,
} from "@/lib/validation/user";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApi("user:read");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          select: { role: { select: { id: true, name: true } } },
        },
        homeroomClasses: {
          select: { id: true, name: true, academicYearId: true },
        },
        teacherAssignments: {
          include: {
            subjectOffering: {
              include: {
                subject: { select: { id: true, name: true, code: true } },
                classGroup: { select: { id: true, name: true } },
              },
            },
          },
        },
        studentEnrollments: {
          where: { status: "active" },
          include: {
            classGroup: true,
            academicYear: true,
          },
          take: 1,
        },
      },
    });

    if (!user || user.archivedAt) {
      return NextResponse.json({ success: false, error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat detail pengguna" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApi("user:update");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const existing = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!existing || existing.archivedAt) {
      return NextResponse.json({ success: false, error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const updateType = body.updateType; // 'student' | 'teacher_profile' | 'teacher_duty' | 'generic'

    let updateData: any = {};

    // 1. Student Update
    if (updateType === "student") {
      const parsed = updateStudentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validasi gagal", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      // Check unique username if changed
      if (parsed.data.username !== existing.username) {
        const u = await prisma.user.findUnique({ where: { username: parsed.data.username } });
        if (u && u.id !== id) {
          return NextResponse.json(
            { success: false, error: `Username '${parsed.data.username}' sudah digunakan.` },
            { status: 409 }
          );
        }
      }

      // Check unique NIS if changed
      if (parsed.data.nis && parsed.data.nis !== existing.nis) {
        const u = await prisma.user.findUnique({ where: { nis: parsed.data.nis } });
        if (u && u.id !== id) {
          return NextResponse.json(
            { success: false, error: `NIS '${parsed.data.nis}' sudah terdaftar untuk siswa lain.` },
            { status: 409 }
          );
        }
      }

      // Check unique NISN if changed
      if (parsed.data.nisn && parsed.data.nisn !== existing.nisn) {
        const u = await prisma.user.findUnique({ where: { nisn: parsed.data.nisn } });
        if (u && u.id !== id) {
          return NextResponse.json(
            { success: false, error: `NISN '${parsed.data.nisn}' sudah terdaftar untuk siswa lain.` },
            { status: 409 }
          );
        }
      }

      updateData = {
        displayName: parsed.data.displayName,
        username: parsed.data.username,
        gender: parsed.data.gender || null,
        nis: parsed.data.nis || null,
        nisn: parsed.data.nisn || null,
        email: parsed.data.email || null,
        isActive: parsed.data.isActive,
      };

      if (parsed.data.password && parsed.data.password.trim() !== "") {
        updateData.passwordHash = await hashPassword(parsed.data.password);
        updateData.rawPassword = parsed.data.password;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      await logAudit({
        actorId: auth.user.id,
        action: "user:update_student",
        entityType: "users",
        entityId: id,
        beforeValue: existing,
        afterValue: updated,
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // 2. Teacher Profile Update
    if (updateType === "teacher_profile") {
      const parsed = updateTeacherProfileSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validasi gagal", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      // Check unique username if changed
      if (parsed.data.username !== existing.username) {
        const u = await prisma.user.findUnique({ where: { username: parsed.data.username } });
        if (u && u.id !== id) {
          return NextResponse.json(
            { success: false, error: `Username '${parsed.data.username}' sudah digunakan.` },
            { status: 409 }
          );
        }
      }

      // Check unique NIP if changed
      if (parsed.data.nip && parsed.data.nip !== existing.nip) {
        const u = await prisma.user.findUnique({ where: { nip: parsed.data.nip } });
        if (u && u.id !== id) {
          return NextResponse.json(
            { success: false, error: `NIP '${parsed.data.nip}' sudah terdaftar untuk guru lain.` },
            { status: 409 }
          );
        }
      }

      updateData = {
        displayName: parsed.data.displayName,
        title: parsed.data.title || null,
        username: parsed.data.username,
        email: parsed.data.email || null,
        nip: parsed.data.nip || null,
        nuptk: parsed.data.nuptk || null,
        gender: parsed.data.gender || null,
        isActive: parsed.data.isActive,
      };

      if (parsed.data.password && parsed.data.password.trim() !== "") {
        updateData.passwordHash = await hashPassword(parsed.data.password);
        updateData.rawPassword = parsed.data.password;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      await logAudit({
        actorId: auth.user.id,
        action: "user:update_teacher_profile",
        entityType: "users",
        entityId: id,
        beforeValue: existing,
        afterValue: updated,
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // 3. Teacher Duty & Teaching Assignments Update
    if (updateType === "teacher_duty") {
      const parsed = updateTeacherDutySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validasi gagal", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { position, homeroomClassId, teachingAssignments } = parsed.data;

      // Active academic context
      const activeYear = await prisma.academicYear.findFirst({
        where: { status: "active" },
        include: { semesters: { where: { status: "active" } } },
      });

      if (!activeYear || activeYear.semesters.length === 0) {
        return NextResponse.json(
          { success: false, error: "Tidak ada tahun ajaran atau semester aktif untuk mengaitkan penugasan mengajar." },
          { status: 400 }
        );
      }

      const activeSemester = activeYear.semesters[0];

      await prisma.$transaction(async (tx) => {
        // 1. Update teacher position
        await tx.user.update({
          where: { id },
          data: { position },
        });

        // 2. Update homeroom assignment
        // Clear previous homeroom assignment for this teacher
        await tx.classGroup.updateMany({
          where: { homeroomTeacherId: id },
          data: { homeroomTeacherId: null },
        });

        // Assign new homeroom if position is Wali Kelas or homeroomClassId provided
        if (homeroomClassId) {
          await tx.classGroup.update({
            where: { id: homeroomClassId },
            data: { homeroomTeacherId: id },
          });
        }

        // 3. Update teaching assignments per subject & classes
        // Remove existing teacher assignments
        await tx.teacherAssignment.deleteMany({
          where: { teacherId: id },
        });

        // Loop over each subject and its assigned classes
        for (const item of teachingAssignments) {
          for (const classGroupId of item.classGroupIds) {
            // Find or create subject offering
            const offering = await tx.subjectOffering.upsert({
              where: {
                subjectId_classGroupId_semesterId: {
                  subjectId: item.subjectId,
                  classGroupId,
                  semesterId: activeSemester.id,
                },
              },
              update: {},
              create: {
                subjectId: item.subjectId,
                classGroupId,
                semesterId: activeSemester.id,
                academicYearId: activeYear.id,
              },
            });

            // Assign teacher to this offering
            await tx.teacherAssignment.upsert({
              where: {
                teacherId_subjectOfferingId: {
                  teacherId: id,
                  subjectOfferingId: offering.id,
                },
              },
              update: {},
              create: {
                teacherId: id,
                subjectOfferingId: offering.id,
                assignedById: auth.user.id,
              },
            });
          }
        }
      });

      await logAudit({
        actorId: auth.user.id,
        action: "user:update_teacher_duty",
        entityType: "users",
        entityId: id,
        afterValue: { position, homeroomClassId, assignmentCount: teachingAssignments.length },
      });

      return NextResponse.json({
        success: true,
        message: "Jabatan dan penugasan mengajar guru berhasil diperbarui!",
      });
    }

    // 4. Admin / Generic User Update
    if (updateType === "admin" || updateType === "generic") {
      const { displayName, username, email, isActive, password } = body;

      const updateData: any = {};
      if (displayName) updateData.displayName = displayName.trim();
      if (typeof isActive === "boolean") updateData.isActive = isActive;
      if (email !== undefined) updateData.email = email ? email.trim() : null;

      if (username && username !== existing.username) {
        const u = await prisma.user.findUnique({ where: { username: username.trim() } });
        if (u && u.id !== id) {
          return NextResponse.json(
            { success: false, error: `Username '${username}' sudah digunakan.` },
            { status: 409 }
          );
        }
        updateData.username = username.trim();
      }

      if (password && password.trim() !== "") {
        updateData.passwordHash = await hashPassword(password);
        updateData.rawPassword = password;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      await logAudit({
        actorId: auth.user.id,
        action: "user:update_admin",
        entityType: "users",
        entityId: id,
        beforeValue: existing,
        afterValue: updated,
      });

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: "Tipe pembaruan tidak valid" }, { status: 400 });
  } catch (error: any) {
    console.error("PUT /api/users/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message || "Gagal memperbarui pengguna" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApi("user:delete");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        isActive: false,
      },
    });

    await logAudit({
      actorId: auth.user.id,
      action: "user:delete",
      entityType: "users",
      entityId: id,
      afterValue: { status: "archived" },
    });

    return NextResponse.json({ success: true, message: "Pengguna berhasil dihapus / diarsipkan" });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus pengguna" }, { status: 500 });
  }
}
