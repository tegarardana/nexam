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

  const { id: examinationId } = await params;

  try {
    const exam = await prisma.examination.findUnique({
      where: { id: examinationId },
      include: {
        subject: true,
        academicYear: true,
        semester: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    const participants = await prisma.examinationParticipant.findMany({
      where: { examinationId },
      include: {
        student: {
          select: {
            username: true,
            displayName: true,
            nis: true,
          },
        },
        classGroup: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { student: { username: "asc" } },
    });

    const attempts = await prisma.examinationAttempt.findMany({
      where: { examinationId },
      include: {
        result: true,
        events: {
          select: { id: true },
        },
      },
      orderBy: { attemptNumber: "desc" },
    });

    const latestAttemptByStudent = new Map<string, any>();
    for (const att of attempts) {
      if (!latestAttemptByStudent.has(att.studentId)) {
        latestAttemptByStudent.set(att.studentId, att);
      }
    }

    const passingScore = Number(exam.passingScore) || 75;

    // Build CSV Content with UTF-8 BOM for Excel compatibility
    const BOM = "\uFEFF";
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];
    lines.push(escapeCsv("REKAPITULASI HASIL ASESMEN / UJIAN"));
    lines.push(`${escapeCsv("Judul Ujian:")},${escapeCsv(exam.title)}`);
    lines.push(`${escapeCsv("Mata Pelajaran:")},${escapeCsv(exam.subject?.name || "-")}`);
    lines.push(`${escapeCsv("Tahun Ajaran:")},${escapeCsv(`${exam.academicYear.name} (${exam.semester.name})`)}`);
    lines.push(`${escapeCsv("Standar Kelulusan (KKM):")},${escapeCsv(`${passingScore}%`)}`);
    lines.push(`${escapeCsv("Tanggal Unduh:")},${escapeCsv(new Date().toLocaleString("id-ID"))}`);
    lines.push("");

    // Headers
    lines.push([
      escapeCsv("No"),
      escapeCsv("NIS"),
      escapeCsv("Nama Lengkap"),
      escapeCsv("Kelas / Rombel"),
      escapeCsv("Status Pengerjaan"),
      escapeCsv("Waktu Mulai"),
      escapeCsv("Waktu Selesai"),
      escapeCsv("Durasi (Menit)"),
      escapeCsv("Pelanggaran Anti-Cheat"),
      escapeCsv("Nilai Akhir (%)"),
      escapeCsv("Status Kelulusan"),
    ].join(","));

    participants.forEach((p, index) => {
      const att = latestAttemptByStudent.get(p.studentId);
      const res = att?.result;
      const percentage = res ? Number(res.percentage) : null;

      let passStatusText = "Belum Mengerjakan";
      if (att) {
        if (["submitted", "completed"].includes(att.status)) {
          passStatusText = percentage !== null && percentage >= passingScore ? "LULUS" : "REMEDIAL";
        } else if (att.status === "grading_pending") {
          passStatusText = "Koreksi Pending";
        } else {
          passStatusText = "Sedang Berlangsung";
        }
      }

      let durationMinutes = "-";
      if (att?.startedAt && att?.submittedAt) {
        durationMinutes = String(
          Math.round((new Date(att.submittedAt).getTime() - new Date(att.startedAt).getTime()) / 60000)
        );
      }

      const startedStr = att?.startedAt
        ? new Date(att.startedAt).toLocaleString("id-ID")
        : "-";
      const submittedStr = att?.submittedAt
        ? new Date(att.submittedAt).toLocaleString("id-ID")
        : "-";

      lines.push([
        escapeCsv(index + 1),
        escapeCsv(p.student.username),
        escapeCsv(p.student.displayName || p.student.username),
        escapeCsv(p.classGroup?.name || "Umum"),
        escapeCsv(att?.status || "not_started"),
        escapeCsv(startedStr),
        escapeCsv(submittedStr),
        escapeCsv(durationMinutes),
        escapeCsv(att?.events?.length || att?.incidentCount || 0),
        escapeCsv(percentage !== null ? `${percentage}` : "-"),
        escapeCsv(passStatusText),
      ].join(","));
    });

    const csvData = BOM + lines.join("\r\n");
    const sanitizedTitle = exam.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Rekap_Nilai_${sanitizedTitle}_${Date.now()}.csv`;

    return new NextResponse(csvData, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/examinations/[id]/export error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengekspor data nilai" }, { status: 500 });
  }
}
