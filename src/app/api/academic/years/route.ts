import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { academicYearSchema } from "@/lib/validation/academic";

export async function GET() {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  const years = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: {
      semesters: {
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          classGroups: true,
          studentEnrollments: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: years });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("academic:create");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parse = academicYearSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, startDate, endDate, status } = parse.data;

    // Check if name already exists
    const existing = await prisma.academicYear.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Academic year '${name}' already exists.` },
        { status: 409 }
      );
    }

    // Atomic transaction: if setting active, ensure no other year is active
    const createdYear = await prisma.$transaction(async (tx) => {
      if (status === "active") {
        await tx.academicYear.updateMany({
          where: { status: "active" },
          data: { status: "archived" },
        });
        // Deactivate all semesters of any archived years
        await tx.semester.updateMany({
          where: {
            academicYear: { status: "archived" },
            status: "active",
          },
          data: { status: "archived" },
        });
      }

      const year = await tx.academicYear.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status,
        },
      });

      // Automatically create Ganjil and Genap semesters in draft
      const midDate = new Date((new Date(startDate).getTime() + new Date(endDate).getTime()) / 2);
      await tx.semester.createMany({
        data: [
          {
            academicYearId: year.id,
            name: "Ganjil",
            startDate: new Date(startDate),
            endDate: midDate,
            status: status === "active" ? "active" : "draft",
          },
          {
            academicYearId: year.id,
            name: "Genap",
            startDate: new Date(midDate.getTime() + 24 * 60 * 60 * 1000),
            endDate: new Date(endDate),
            status: "draft",
          },
        ],
      });

      return year;
    });

    await logAudit({
      actorId: auth.user.id,
      action: "academic_year:create",
      entityType: "academic_years",
      entityId: createdYear.id,
      afterValue: { name, status },
    });

    return NextResponse.json({ success: true, data: createdYear }, { status: 201 });
  } catch (error) {
    console.error("Create academic year error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create academic year" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateApi("academic:update");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !["draft", "active", "archived"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Parameter 'id' dan 'status' ('draft' | 'active' | 'archived') wajib diisi." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (status === "active") {
        // Demote other active years to archived
        await tx.academicYear.updateMany({
          where: { status: "active", NOT: { id } },
          data: { status: "archived" },
        });

        // Deactivate semesters of other archived academic years
        await tx.semester.updateMany({
          where: {
            academicYearId: { not: id },
            status: "active",
          },
          data: { status: "archived" },
        });
      } else if (status === "archived") {
        // Deactivate all active semesters of this archived year
        await tx.semester.updateMany({
          where: {
            academicYearId: id,
            status: "active",
          },
          data: { status: "archived" },
        });
      }

      return tx.academicYear.update({
        where: { id },
        data: { status },
        include: { semesters: { orderBy: { startDate: "asc" } } },
      });
    });

    await logAudit({
      actorId: auth.user.id,
      action: "academic_year:status_change",
      entityType: "academic_years",
      entityId: id,
      afterValue: { status },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update academic year error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui status tahun ajaran" },
      { status: 500 }
    );
  }
}

