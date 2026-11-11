import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { recapIds, all } = body;

    let recaps: any[] = [];
    if (all || !recapIds || recapIds.length === 0) {
      recaps = await prisma.examGradeRecap.findMany({
        orderBy: { scheduledStart: "desc" },
      });
    } else {
      recaps = await prisma.examGradeRecap.findMany({
        where: { id: { in: recapIds } },
        orderBy: { scheduledStart: "desc" },
      });
    }

    if (recaps.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada data rekap nilai yang ditemukan untuk diekspor." },
        { status: 404 }
      );
    }

    const wb = XLSX.utils.book_new();

    // 1. Sheet Ringkasan Rekapitulasi
    const summaryData = [
      ["REKAPITULASI HASIL ASESMEN DAN UJIAN - NEXAM CBT"],
      [`Tanggal Ekspor: ${new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })} ${new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`],
      [`Diekspor oleh: ${session.user.displayName || session.user.username} (${session.user.roles.join(", ")})`],
      [],
      [
        "No",
        "Judul Ujian",
        "Tipe",
        "Mata Pelajaran",
        "Kelas Peserta",
        "Tahun Ajaran",
        "Semester",
        "Waktu Pelaksanaan",
        "KKM",
        "Total Peserta",
        "Mengerjakan",
        "Rata-rata",
        "Tertinggi",
        "Terendah",
        "Tuntas",
        "Belum Tuntas",
        "Waktu Kunci Rekap",
        "Perekap",
      ],
    ];

    recaps.forEach((r, idx) => {
      summaryData.push([
        idx + 1,
        r.examTitle,
        r.examTypeCode || "-",
        r.subjectName,
        r.targetClasses || "-",
        r.academicYearName,
        r.semesterName,
        `${new Date(r.scheduledStart).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })} ${new Date(r.scheduledStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`,
        Number(r.passingScore),
        r.totalParticipants,
        r.submittedCount,
        Number(r.averageScore),
        Number(r.highestScore),
        Number(r.lowestScore),
        r.passingCount,
        r.failingCount,
        new Date(r.lockedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
        r.lockedByName || "-",
      ]);
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan Ujian");

    // 2. Sheet Rincian Nilai Seluruh Siswa (Master Sheet)
    const masterDetailData = [
      [
        "No",
        "Judul Ujian",
        "Mata Pelajaran",
        "Kelas",
        "NIS / Username",
        "Nama Lengkap Siswa",
        "Nilai PG",
        "Nilai Esai",
        "Total Skor",
        "Nilai Akhir (%)",
        "KKM",
        "Status Kelulusan",
        "Status Ujian",
        "Waktu Selesai",
        "Insiden Pelanggaran",
      ],
    ];

    let rowNum = 1;
    for (const r of recaps) {
      const records = (r.studentRecords as any[]) || [];
      const passingScore = Number(r.passingScore);

      for (const s of records) {
        masterDetailData.push([
          rowNum++,
          r.examTitle,
          r.subjectName,
          s.className || "-",
          s.nis || s.username || "-",
          s.displayName || "-",
          s.objectiveScore ?? 0,
          s.essayScore ?? 0,
          s.totalScore ?? 0,
          s.percentage ?? 0,
          passingScore,
          s.isPassed ? "TUNTAS" : "BELUM TUNTAS",
          s.isSubmitted ? "Selesai" : "Belum Mengumpulkan",
          s.submittedAt
            ? new Date(s.submittedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
            : "-",
          s.incidentCount ?? 0,
        ]);
      }
    }

    const masterDetailWs = XLSX.utils.aoa_to_sheet(masterDetailData);
    XLSX.utils.book_append_sheet(wb, masterDetailWs, "Rincian Nilai Siswa");

    // 3. If single recap or a few recaps (<= 5), add individual sheets per exam
    if (recaps.length <= 5) {
      for (const r of recaps) {
        const records = (r.studentRecords as any[]) || [];
        const sheetName = (r.subjectCode || r.examTitle)
          .replace(/[\\/?*[\]]/g, "_")
          .substring(0, 28);

        const examSheetData = [
          [`HASIL ASESMEN: ${r.examTitle}`],
          [`Mata Pelajaran: ${r.subjectName} | Tipe: ${r.examTypeCode || "-"} | KKM: ${Number(r.passingScore)}`],
          [`Rombel / Kelas: ${r.targetClasses} | Periode: ${r.academicYearName} ${r.semesterName}`],
          [],
          [
            "No",
            "NIS / Username",
            "Nama Lengkap Siswa",
            "Kelas",
            "Nilai PG",
            "Nilai Esai",
            "Total Skor",
            "Nilai Akhir (%)",
            "KKM",
            "Keterangan",
            "Waktu Submit",
          ],
        ];

        records.forEach((s, idx) => {
          examSheetData.push([
            idx + 1,
            s.nis || s.username || "-",
            s.displayName || "-",
            s.className || "-",
            s.objectiveScore ?? 0,
            s.essayScore ?? 0,
            s.totalScore ?? 0,
            s.percentage ?? 0,
            Number(r.passingScore),
            s.isPassed ? "TUNTAS" : "BELUM TUNTAS",
            s.submittedAt
              ? new Date(s.submittedAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })
              : "-",
          ]);
        });

        const examWs = XLSX.utils.aoa_to_sheet(examSheetData);
        XLSX.utils.book_append_sheet(wb, examWs, sheetName);
      }
    }

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const filename = `Rekap_Nilai_Nexam_${Date.now()}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("POST /api/examinations/recap/export error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengekspor file Excel" }, { status: 500 });
  }
}

