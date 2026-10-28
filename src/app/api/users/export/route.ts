import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  const auth = await authenticateApi("user:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") || "teacher";

  if (role === "teacher") {
    const teachers = await prisma.user.findMany({
      where: {
        archivedAt: null,
        userRoles: {
          some: { role: { name: "teacher" } },
        },
      },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        title: true,
        nip: true,
        nuptk: true,
        gender: true,
        position: true,
        username: true,
        rawPassword: true,
        isActive: true,
        homeroomClasses: {
          select: { name: true },
        },
      },
    });

    const escapeCsv = (val: string | null | undefined) => {
      if (!val) return '""';
      const clean = String(val).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const header = [
      "No",
      "Nama Lengkap",
      "Gelar",
      "NIP",
      "NUPTK",
      "Jenis Kelamin",
      "Jabatan",
      "Wali Kelas",
      "Username",
      "Password",
      "Status",
    ].join(",");

    const rows = teachers.map((t, index) => {
      const homeroom = t.homeroomClasses.map((c) => c.name).join("; ");
      const genderLabel = t.gender === "L" || t.gender === "Laki-laki" ? "Laki-laki" : t.gender === "P" || t.gender === "Perempuan" ? "Perempuan" : "";
      return [
        index + 1,
        escapeCsv(t.displayName),
        escapeCsv(t.title),
        escapeCsv(t.nip),
        escapeCsv(t.nuptk),
        escapeCsv(genderLabel),
        escapeCsv(t.position || "Guru"),
        escapeCsv(homeroom),
        escapeCsv(t.username),
        escapeCsv(t.rawPassword || "(Belum diset/Terenkripsi)"),
        escapeCsv(t.isActive ? "Aktif" : "Nonaktif"),
      ].join(",");
    });

    // UTF-8 BOM for Microsoft Excel compatibility
    const csvContent = "\uFEFF" + [header, ...rows].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="kredensial_guru_nexam.csv"',
      },
    });
  }

  return NextResponse.json({ success: false, error: "Role tidak didukung untuk ekspor umum." }, { status: 400 });
}
