import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { subjectCategorySchema } from "@/lib/validation/academic";

export async function GET() {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  try {
    const categories = await prisma.subjectCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { subjects: true } },
      },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    console.error("GET /api/academic/subject-categories error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("academic:create");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parse = subjectCategorySchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, code, description } = parse.data;

    const existing = await prisma.subjectCategory.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Kategori '${name}' sudah terdaftar.` },
        { status: 409 }
      );
    }

    const category = await prisma.subjectCategory.create({
      data: { name, code: code || null, description: description || null },
    });

    await logAudit({
      actorId: auth.user.id,
      action: "subject_category:create",
      entityType: "subject_categories",
      entityId: category.id,
      afterValue: { name, code },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membuat kategori mata pelajaran." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateApi("academic:create");
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Parameter 'id' wajib diisi." }, { status: 400 });
    }

    const linkedSubjects = await prisma.subject.count({ where: { categoryId: id } });
    if (linkedSubjects > 0) {
      return NextResponse.json(
        { success: false, error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${linkedSubjects} mata pelajaran.` },
        { status: 400 }
      );
    }

    await prisma.subjectCategory.delete({ where: { id } });

    await logAudit({
      actorId: auth.user.id,
      action: "subject_category:delete",
      entityType: "subject_categories",
      entityId: id,
    });

    return NextResponse.json({ success: true, message: "Kategori berhasil dihapus." });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus kategori." },
      { status: 500 }
    );
  }
}
