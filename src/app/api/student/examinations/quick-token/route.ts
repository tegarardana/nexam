import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { getEligibleExamsForStudent } from "@/lib/examination-participants";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  try {
    const body = await request.json();
    const rawToken = body?.token;

    if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
      return NextResponse.json(
        { success: false, error: "Token ujian wajib diisi." },
        { status: 400 }
      );
    }

    const searchToken = rawToken.trim().toUpperCase();

    // 1. Dapatkan seluruh ujian yang diikuti/eligible bagi siswa
    const eligibleExams = await getEligibleExamsForStudent(studentId);
    const examIds = eligibleExams.map((e) => e.id);

    // 2. Cek token individual peserta (jika ada)
    const participants = await prisma.examinationParticipant.findMany({
      where: {
        studentId,
        examinationId: { in: examIds },
      },
      select: {
        examinationId: true,
        token: true,
      },
    });

    const individualTokenMap = new Map<string, string | null>();
    for (const p of participants) {
      if (p.token) {
        individualTokenMap.set(p.examinationId, p.token.trim().toUpperCase());
      }
    }

    const now = new Date();

    // 3. Cocokkan token dengan ujian aktif/terjadwal
    const matchedExam = eligibleExams.find((exam) => {
      // Abaikan ujian draft atau closed
      if (exam.status === "draft" || exam.status === "archived") return false;

      // Cek apakah jadwal sudah kadaluarsa
      if (exam.scheduledEnd && now > new Date(exam.scheduledEnd)) return false;

      const policyToken = exam.policySettings?.globalToken?.trim().toUpperCase();
      const indivToken = individualTokenMap.get(exam.id);

      // Cocokkan token
      const matchesGlobal = Boolean(policyToken && policyToken === searchToken);
      const matchesIndiv = Boolean(indivToken && indivToken === searchToken);

      return matchesGlobal || matchesIndiv;
    });

    if (!matchedExam) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Token ujian tidak ditemukan atau jadwal ujian belum dibuka. Pastikan Anda mengetikkan kode token dengan benar sesuai arahan pengawas ruang.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      examination: {
        id: matchedExam.id,
        title: matchedExam.title,
        subjectName: matchedExam.subject?.name || "Mata Pelajaran",
        subjectCode: matchedExam.subject?.code || "-",
        durationMinutes: matchedExam.durationMinutes,
        status: matchedExam.status,
        scheduledStart: matchedExam.scheduledStart?.toISOString(),
        scheduledEnd: matchedExam.scheduledEnd?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("POST /api/student/examinations/quick-token error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memverifikasi token ujian." },
      { status: 500 }
    );
  }
}

