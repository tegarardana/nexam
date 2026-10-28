import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { subjectSchema } from "@/lib/validation/academic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const majorId = searchParams.get("majorId");

  const whereClause: any = { archivedAt: null };
  if (majorId) {
    whereClause.OR = [{ majorId }, { majorId: null }];
  }

  try {
    const subjects = await prisma.subject.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      include: {
        subjectCategory: true,
        major: { select: { id: true, name: true, code: true } },
        _count: {
          select: { subjectOfferings: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: subjects });
  } catch (error: any) {
    console.error("GET /api/academic/subjects error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("academic:create");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parse = subjectSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, code, category, categoryId, majorId, description, isActive } = parse.data;

    const existing = await prisma.subject.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Kode mata pelajaran '${code}' sudah terdaftar.` },
        { status: 409 }
      );
    }

    const subject = await prisma.subject.create({
      data: {
        name,
        code,
        category: category || null,
        categoryId: categoryId || null,
        majorId: majorId || null,
        description: description || null,
        isActive,
      },
      include: {
        subjectCategory: true,
        major: true,
      },
    });

    await logAudit({
      actorId: auth.user.id,
      action: "subject:create",
      entityType: "subjects",
      entityId: subject.id,
      afterValue: { name, code, categoryId, majorId },
    });

    return NextResponse.json({ success: true, data: subject }, { status: 201 });
  } catch (error) {
    console.error("Create subject error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membuat mata pelajaran" },
      { status: 500 }
    );
  }
}
