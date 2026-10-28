import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { classGroupSchema } from "@/lib/validation/academic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const academicYearId = searchParams.get("academicYearId");

  const whereClause: any = {};
  if (academicYearId) {
    whereClause.academicYearId = academicYearId;
  }

  try {
    const classes = await prisma.classGroup.findMany({
      where: whereClause,
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      include: {
        major: true,
        homeroomTeacher: {
          select: {
            id: true,
            displayName: true,
            username: true,
            nip: true,
            email: true,
          },
        },
        academicYear: {
          select: { id: true, name: true, status: true },
        },
        _count: {
          select: {
            studentEnrollments: true,
            subjectOfferings: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: classes });
  } catch (error: any) {
    console.error("GET /api/academic/classes error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch classes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("academic:create");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parse = classGroupSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, gradeLevel, majorId, academicYearId, homeroomTeacherId, isActive } = parse.data;

    // Check unique constraint [name, academicYearId]
    const existing = await prisma.classGroup.findUnique({
      where: {
        name_academicYearId: {
          name,
          academicYearId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Rombel '${name}' sudah ada pada tahun ajaran ini.` },
        { status: 409 }
      );
    }

    const classGroup = await prisma.classGroup.create({
      data: {
        name,
        gradeLevel,
        majorId: majorId || null,
        academicYearId,
        homeroomTeacherId: homeroomTeacherId || null,
        isActive,
      },
      include: {
        major: true,
        homeroomTeacher: true,
        academicYear: true,
      },
    });

    // Synchronize teacher position to 'Wali Kelas' if assigned
    if (homeroomTeacherId) {
      await prisma.user.update({
        where: { id: homeroomTeacherId },
        data: { position: "Wali Kelas" },
      });
    }

    await logAudit({
      actorId: auth.user.id,
      action: "class_group:create",
      entityType: "class_groups",
      entityId: classGroup.id,
      afterValue: { name, gradeLevel, academicYearId, homeroomTeacherId },
    });

    return NextResponse.json({ success: true, data: classGroup }, { status: 201 });
  } catch (error) {
    console.error("Create class group error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membuat kelas baru." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateApi("academic:update");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { id, homeroomTeacherId, majorId, name } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Parameter 'id' kelas wajib diisi." }, { status: 400 });
    }

    const oldClass = await prisma.classGroup.findUnique({ where: { id } });
    if (!oldClass) {
      return NextResponse.json({ success: false, error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (homeroomTeacherId !== undefined) dataToUpdate.homeroomTeacherId = homeroomTeacherId || null;
    if (majorId !== undefined) dataToUpdate.majorId = majorId || null;
    if (name) dataToUpdate.name = name;

    const updated = await prisma.classGroup.update({
      where: { id },
      data: dataToUpdate,
      include: {
        major: true,
        homeroomTeacher: true,
        academicYear: true,
      },
    });

    // If homeroom teacher changed or removed
    if (homeroomTeacherId !== undefined && oldClass.homeroomTeacherId && oldClass.homeroomTeacherId !== homeroomTeacherId) {
      const remainingHomerooms = await prisma.classGroup.count({
        where: {
          homeroomTeacherId: oldClass.homeroomTeacherId,
          id: { not: id },
          isActive: true,
        },
      });
      if (remainingHomerooms === 0) {
        await prisma.user.updateMany({
          where: { id: oldClass.homeroomTeacherId, position: "Wali Kelas" },
          data: { position: "Guru" },
        });
      }
    }

    // Set new homeroom teacher position to 'Wali Kelas'
    if (homeroomTeacherId) {
      await prisma.user.update({
        where: { id: homeroomTeacherId },
        data: { position: "Wali Kelas" },
      });
    }

    await logAudit({
      actorId: auth.user.id,
      action: "class_group:update",
      entityType: "class_groups",
      entityId: id,
      afterValue: dataToUpdate,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update class error:", error);
    return NextResponse.json({ success: false, error: "Gagal memperbarui kelas." }, { status: 500 });
  }
}
