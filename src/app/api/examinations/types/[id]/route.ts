import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { ExaminationTypeSchema } from "@/lib/validation/examination";
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
      { success: false, error: "Hanya administrator yang dapat mengelola tipe ujian" },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parse = ExaminationTypeSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.examinationType.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Tipe ujian tidak ditemukan" },
        { status: 404 }
      );
    }

    const { name, code, description } = parse.data;
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    // Check code conflict if changed
    if (cleanCode !== existing.code) {
      const codeConflict = await prisma.examinationType.findUnique({
        where: { code: cleanCode },
      });
      if (codeConflict) {
        return NextResponse.json(
          { success: false, error: `Kode jenis ujian '${cleanCode}' sudah digunakan.` },
          { status: 409 }
        );
      }
    }

    // Check name conflict if changed
    if (cleanName !== existing.name) {
      const nameConflict = await prisma.examinationType.findUnique({
        where: { name: cleanName },
      });
      if (nameConflict) {
        return NextResponse.json(
          { success: false, error: `Tipe ujian dengan nama '${cleanName}' sudah terdaftar.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.examinationType.update({
      where: { id },
      data: {
        name: cleanName,
        code: cleanCode,
        description: description?.trim() || null,
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination_type:update",
      entityType: "examination_types",
      entityId: id,
      beforeValue: { name: existing.name, code: existing.code },
      afterValue: { name: cleanName, code: cleanCode },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT /api/examinations/types/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui tipe ujian" },
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
      { success: false, error: "Hanya administrator yang dapat mengelola tipe ujian" },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;

    const existing = await prisma.examinationType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { examinations: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Tipe ujian tidak ditemukan" },
        { status: 404 }
      );
    }

    if (existing._count.examinations > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Tipe ujian tidak dapat dihapus karena masih digunakan oleh ${existing._count.examinations} data ujian.`,
        },
        { status: 400 }
      );
    }

    await prisma.examinationType.delete({
      where: { id },
    });

    await logAudit({
      actorId: session.user.id,
      action: "examination_type:delete",
      entityType: "examination_types",
      entityId: id,
      beforeValue: { name: existing.name, code: existing.code },
    });

    return NextResponse.json({ success: true, message: "Tipe ujian berhasil dihapus" });
  } catch (error: any) {
    console.error("DELETE /api/examinations/types/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus tipe ujian" },
      { status: 500 }
    );
  }
}

