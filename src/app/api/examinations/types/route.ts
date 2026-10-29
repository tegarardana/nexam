import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { ExaminationTypeSchema } from "@/lib/validation/examination";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const types = await prisma.examinationType.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { examinations: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: types });
  } catch (error: any) {
    console.error("GET /api/examinations/types error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat data tipe ujian" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.roles.includes("administrator");
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "Hanya administrator yang dapat mengelola tipe ujian" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parse = ExaminationTypeSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, code, description } = parse.data;
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    // Check duplicate code
    const existingCode = await prisma.examinationType.findUnique({
      where: { code: cleanCode },
    });
    if (existingCode) {
      return NextResponse.json(
        { success: false, error: `Kode jenis ujian '${cleanCode}' sudah digunakan.` },
        { status: 409 }
      );
    }

    // Check duplicate name
    const existingName = await prisma.examinationType.findUnique({
      where: { name: cleanName },
    });
    if (existingName) {
      return NextResponse.json(
        { success: false, error: `Tipe ujian dengan nama '${cleanName}' sudah terdaftar.` },
        { status: 409 }
      );
    }

    const created = await prisma.examinationType.create({
      data: {
        name: cleanName,
        code: cleanCode,
        description: description?.trim() || null,
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination_type:create",
      entityType: "examination_types",
      entityId: created.id,
      afterValue: { name: cleanName, code: cleanCode },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/examinations/types error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuat tipe ujian" },
      { status: 500 }
    );
  }
}

