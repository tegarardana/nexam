import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/audit";
import { createUserSchema, updateUserSchema } from "@/lib/validation/user";

export async function GET(req: NextRequest) {
  const auth = await authenticateApi("user:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
  const skip = (page - 1) * limit;

  const whereClause: any = {
    archivedAt: null,
  };

  if (role) {
    whereClause.userRoles = {
      some: {
        role: { name: role },
      },
    };
  }

  if (search) {
    whereClause.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { nis: { contains: search, mode: "insensitive" } },
      { nisn: { contains: search, mode: "insensitive" } },
      { nip: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const [total, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          nis: true,
          nisn: true,
          nip: true,
          nuptk: true,
          gender: true,
          title: true,
          position: true,
          rawPassword: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: {
            select: {
              role: {
                select: { id: true, name: true },
              },
            },
          },
          homeroomClasses: {
            select: {
              id: true,
              name: true,
              academicYear: { select: { name: true } },
            },
          },
          teacherAssignments: {
            select: {
              id: true,
              subjectOffering: {
                select: {
                  id: true,
                  subject: { select: { id: true, name: true, code: true } },
                  classGroup: { select: { id: true, name: true } },
                },
              },
            },
          },
          studentEnrollments: {
            where: { status: "active" },
            take: 1,
            select: {
              classGroup: {
                select: {
                  id: true,
                  name: true,
                  major: { select: { name: true } },
                },
              },
              academicYear: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      nis: u.nis,
      nisn: u.nisn,
      nip: u.nip,
      nuptk: u.nuptk,
      gender: u.gender,
      title: u.title,
      position: u.position,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: u.userRoles.map((ur) => ur.role.name),
      currentClass: u.studentEnrollments[0]?.classGroup?.name || null,
      currentMajor: u.studentEnrollments[0]?.classGroup?.major?.name || null,
      currentAcademicYear: u.studentEnrollments[0]?.academicYear?.name || null,
      homeroomClasses: u.homeroomClasses.map((h) => h.name),
      homeroomClassId: u.homeroomClasses[0]?.id || null,
      taughtSubjects: Array.from(
        new Set(
          u.teacherAssignments.map((ta) => ta.subjectOffering.subject.name)
        )
      ),
      teachingAssignments: u.teacherAssignments.map((ta) => ({
        subjectId: ta.subjectOffering.subject.id,
        subjectName: ta.subjectOffering.subject.name,
        classGroupId: ta.subjectOffering.classGroup.id,
        classGroupName: ta.subjectOffering.classGroup.name,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: formattedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("user:create");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parse = createUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      username,
      displayName,
      email,
      password,
      role,
      isActive,
      nis,
      nisn,
      nip,
      nuptk,
      gender,
      title,
      position,
      homeroomClassId,
      classGroupId,
      academicYearId,
    } = parse.data;

    // Check unique username
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Username '${username}' sudah digunakan.` },
        { status: 409 }
      );
    }

    // Check unique NIS
    if (nis) {
      const existingNis = await prisma.user.findUnique({ where: { nis } });
      if (existingNis) {
        return NextResponse.json(
          { success: false, error: `NIS '${nis}' sudah terdaftar untuk siswa lain.` },
          { status: 409 }
        );
      }
    }

    // Check unique NISN
    if (nisn) {
      const existingNisn = await prisma.user.findUnique({ where: { nisn } });
      if (existingNisn) {
        return NextResponse.json(
          { success: false, error: `NISN '${nisn}' sudah terdaftar untuk siswa lain.` },
          { status: 409 }
        );
      }
    }

    // Check unique NIP
    if (nip) {
      const existingNip = await prisma.user.findUnique({ where: { nip } });
      if (existingNip) {
        return NextResponse.json(
          { success: false, error: `NIP '${nip}' sudah terdaftar untuk guru lain.` },
          { status: 409 }
        );
      }
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // Find role ID
    const roleRecord = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRecord) {
      return NextResponse.json(
        { success: false, error: `Peran '${role}' tidak ditemukan.` },
        { status: 400 }
      );
    }

    // Atomic creation
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          displayName,
          email: email || null,
          passwordHash,
          rawPassword: password,
          isActive,
          gender: gender || null,
          title: role === "teacher" ? title || null : null,
          position: role === "teacher" ? position || "Guru" : null,
          nuptk: role === "teacher" ? nuptk || null : null,
          nis: role === "student" ? nis || null : null,
          nisn: role === "student" ? nisn || null : null,
          nip: role === "teacher" ? nip || null : null,
          createdById: auth.user.id,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: roleRecord.id,
          grantedById: auth.user.id,
        },
      });

      // If student and placement provided, enroll student (optional)
      if (role === "student" && classGroupId && academicYearId) {
        await tx.studentEnrollment.create({
          data: {
            studentId: user.id,
            classGroupId,
            academicYearId,
            status: "active",
          },
        });
      }

      // If teacher and homeroom class provided, assign as homeroom teacher
      if (role === "teacher" && homeroomClassId) {
        await tx.classGroup.update({
          where: { id: homeroomClassId },
          data: { homeroomTeacherId: user.id },
        });
      }

      return user;
    });

    await logAudit({
      actorId: auth.user.id,
      action: "user:create",
      entityType: "users",
      entityId: createdUser.id,
      afterValue: { username, displayName, role, email, nis, nip },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: createdUser.id,
          username: createdUser.username,
          displayName: createdUser.displayName,
          email: createdUser.email,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membuat akun pengguna" },
      { status: 500 }
    );
  }
}
