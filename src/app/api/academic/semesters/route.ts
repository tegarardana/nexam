import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const academicYearId = searchParams.get("academicYearId");

  const semesters = await prisma.semester.findMany({
    where: academicYearId ? { academicYearId } : undefined,
    orderBy: { name: "asc" },
    include: {
      academicYear: { select: { id: true, name: true, status: true } },
    },
  });

  return NextResponse.json({ success: true, data: semesters });
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

    const targetSemester = await prisma.semester.findUnique({
      where: { id },
    });

    if (!targetSemester) {
      return NextResponse.json({ success: false, error: "Semester tidak ditemukan." }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (status === "active") {
        // Demote other semesters of the same academic year to draft
        await tx.semester.updateMany({
          where: {
            academicYearId: targetSemester.academicYearId,
            NOT: { id },
          },
          data: { status: "draft" },
        });
      }
      return tx.semester.update({
        where: { id },
        data: { status },
      });
    });

    await logAudit({
      actorId: auth.user.id,
      action: "semester:status_change",
      entityType: "semesters",
      entityId: id,
      afterValue: { status, academicYearId: targetSemester.academicYearId },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update semester error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui status semester." },
      { status: 500 }
    );
  }
}
