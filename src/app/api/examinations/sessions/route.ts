import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { ExaminationSessionSchema } from "@/lib/validation/examination";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessions = await prisma.examinationSession.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { participants: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error: any) {
    console.error("GET /api/examinations/sessions error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat data sesi ujian" },
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
      { success: false, error: "Hanya administrator yang dapat mengelola sesi ujian" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parse = ExaminationSessionSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, code, startTime, endTime, description } = parse.data;
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    // Check duplicate code
    const existingCode = await prisma.examinationSession.findUnique({
      where: { code: cleanCode },
    });
    if (existingCode) {
      return NextResponse.json(
        { success: false, error: `Kode sesi '${cleanCode}' sudah digunakan.` },
        { status: 409 }
      );
    }

    // Check duplicate name
    const existingName = await prisma.examinationSession.findUnique({
      where: { name: cleanName },
    });
    if (existingName) {
      return NextResponse.json(
        { success: false, error: `Sesi dengan nama '${cleanName}' sudah terdaftar.` },
        { status: 409 }
      );
    }

    const created = await prisma.examinationSession.create({
      data: {
        name: cleanName,
        code: cleanCode,
        startTime: startTime?.trim() || null,
        endTime: endTime?.trim() || null,
        description: description?.trim() || null,
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination_session:create",
      entityType: "examination_sessions",
      entityId: created.id,
      afterValue: { name: cleanName, code: cleanCode, startTime, endTime },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/examinations/sessions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuat sesi ujian baru" },
      { status: 500 }
    );
  }
}

