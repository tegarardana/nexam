import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { majorSchema } from "@/lib/validation/academic";

export async function GET() {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  const majors = await prisma.major.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { classGroups: true },
      },
    },
  });

  return NextResponse.json({ success: true, data: majors });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("academic:create");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parse = majorSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, code, description, isActive } = parse.data;

    const existing = await prisma.major.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Major code '${code}' is already registered.` },
        { status: 409 }
      );
    }

    const major = await prisma.major.create({
      data: { name, code, description, isActive },
    });

    await logAudit({
      actorId: auth.user.id,
      action: "major:create",
      entityType: "majors",
      entityId: major.id,
      afterValue: { name, code },
    });

    return NextResponse.json({ success: true, data: major }, { status: 201 });
  } catch (error) {
    console.error("Create major error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create major" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateApi("academic:update");
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Parameter 'id' jurusan wajib diisi." }, { status: 400 });
    }

    // Check if major has classes or subjects
    const [classCount, subjectCount] = await Promise.all([
      prisma.classGroup.count({ where: { majorId: id, isActive: true } }),
      prisma.subject.count({ where: { majorId: id, archivedAt: null } }),
    ]);

    if (classCount > 0 || subjectCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Jurusan tidak dapat dihapus karena masih digunakan oleh ${classCount} rombel dan ${subjectCount} mata pelajaran.`,
        },
        { status: 409 }
      );
    }

    // Soft delete / archive major
    const deleted = await prisma.major.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false },
    });

    await logAudit({
      actorId: auth.user.id,
      action: "major:delete",
      entityType: "majors",
      entityId: id,
      beforeValue: { name: deleted.name, code: deleted.code },
    });

    return NextResponse.json({ success: true, message: `Jurusan '${deleted.name}' berhasil dihapus.` });
  } catch (error) {
    console.error("Delete major error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus jurusan." },
      { status: 500 }
    );
  }
}

