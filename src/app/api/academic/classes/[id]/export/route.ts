import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApi("academic:read");
  if (auth instanceof NextResponse) return auth;

  const { id: classGroupId } = await params;

  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    include: {
      academicYear: true,
      major: true,
      studentEnrollments: {
        where: { status: "active" },
        include: {
          student: {
            select: {
              id: true,
              displayName: true,
              username: true,
              rawPassword: true,
              nis: true,
              nisn: true,
              gender: true,
              isActive: true,
            },
          },
        },
        orderBy: {
          student: { displayName: "asc" },
        },
      },
    },
  });

  if (!classGroup) {
    return NextResponse.json({ success: false, error: "Kelas tidak ditemukan" }, { status: 404 });
  }

  const escapeCsv = (val: string | null | undefined) => {
    if (!val) return '""';
    const clean = String(val).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const header = [
    "No",
    "NIS",
    "NISN",
    "Nama Lengkap",
    "Jenis Kelamin",
    "Kelas",
    "Username",
    "Password",
    "Status",
  ].join(",");

  const rows = classGroup.studentEnrollments.map((e, index) => {
    const s = e.student;
    const genderLabel = s.gender === "L" || s.gender === "Laki-laki" ? "Laki-laki" : s.gender === "P" || s.gender === "Perempuan" ? "Perempuan" : "";
    return [
      index + 1,
      escapeCsv(s.nis),
      escapeCsv(s.nisn),
      escapeCsv(s.displayName),
      escapeCsv(genderLabel),
      escapeCsv(classGroup.name),
      escapeCsv(s.username),
      escapeCsv(s.rawPassword || "(Belum diset/Terenkripsi)"),
      escapeCsv(s.isActive ? "Aktif" : "Nonaktif"),
    ].join(",");
  });

  // UTF-8 BOM for Microsoft Excel compatibility
  const csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
  const sanitizedClassName = classGroup.name.replace(/[^a-zA-Z0-9_-]/g, "_");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kredensial_siswa_${sanitizedClassName}.csv"`,
    },
  });
}
