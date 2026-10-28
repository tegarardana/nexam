import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { CreateQuestionCategorySchema } from "@/lib/validation/question";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");

  try {
    const categories = await prisma.questionCategory.findMany({
      where: subjectId ? { subjectId } : undefined,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error("GET /api/questions/categories error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat kategori soal" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden: Hanya guru/admin yang dapat menambah kategori soal" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = CreateQuestionCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const category = await prisma.questionCategory.create({
      data: {
        name: parsed.data.name,
        subjectId: parsed.data.subjectId || null,
        parentId: parsed.data.parentId || null,
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "question_category:create",
      entityType: "question_categories",
      entityId: category.id,
      afterValue: category,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    console.error("POST /api/questions/categories error:", error);
    return NextResponse.json({ success: false, error: "Gagal membuat kategori soal" }, { status: 500 });
  }
}
