import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { ExaminationSessionSchema } from "@/lib/validation/examination";
import { logAudit } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const { id } = await context.params;
    const body = await request.json();
    const parse = ExaminationSessionSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.examinationSession.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Sesi ujian tidak ditemukan" },
        { status: 404 }
      );
    }

    const { name, code, startTime, endTime, description } = parse.data;
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    // Check code conflict if changed
    if (cleanCode !== existing.code) {
      const codeConflict = await prisma.examinationSession.findUnique({
        where: { code: cleanCode },
      });
      if (codeConflict) {
        return NextResponse.json(
          { success: false, error: `Kode sesi '${cleanCode}' sudah digunakan.` },
          { status: 409 }
        );
      }
    }

    // Check name conflict if changed
    if (cleanName !== existing.name) {
      const nameConflict = await prisma.examinationSession.findUnique({
        where: { name: cleanName },
      });
      if (nameConflict) {
        return NextResponse.json(
          { success: false, error: `Sesi dengan nama '${cleanName}' sudah terdaftar.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.examinationSession.update({
      where: { id },
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
      action: "examination_session:update",
      entityType: "examination_sessions",
      entityId: id,
      beforeValue: { name: existing.name, code: existing.code },
      afterValue: { name: cleanName, code: cleanCode },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT /api/examinations/sessions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui sesi ujian" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const { id } = await context.params;

    const existing = await prisma.examinationSession.findUnique({
      where: { id },
      include: {
        _count: {
          select: { participants: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Sesi ujian tidak ditemukan" },
        { status: 404 }
      );
    }

    if (existing._count.participants > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Sesi ujian tidak dapat dihapus karena masih digunakan oleh ${existing._count.participants} peserta ujian.`,
        },
        { status: 400 }
      );
    }

    await prisma.examinationSession.delete({
      where: { id },
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination_session:delete",
      entityType: "examination_sessions",
      entityId: id,
      beforeValue: { name: existing.name, code: existing.code },
    });

    return NextResponse.json({ success: true, message: "Sesi ujian berhasil dihapus" });
  } catch (error: any) {
    console.error("DELETE /api/examinations/sessions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus sesi ujian" },
      { status: 500 }
    );
  }
}

