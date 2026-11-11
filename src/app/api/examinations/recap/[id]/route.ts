import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const recap = await prisma.examGradeRecap.findUnique({
      where: { id },
    });

    if (!recap) {
      return NextResponse.json({ success: false, error: "Rekap nilai tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: recap,
    });
  } catch (error) {
    console.error("GET /api/examinations/recap/[id] error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat detail rekap nilai" }, { status: 500 });
  }
}

