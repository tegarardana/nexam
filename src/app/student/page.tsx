import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import Header from "@/components/layout/Header";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  ShieldAlert,
  ArrowRight,
  BookOpen,
  Calendar,
  PenTool,
  Sparkles,
  Award,
  KeyRound,
} from "lucide-react";
import StudentTokenQuickLauncher from "@/components/student/StudentTokenQuickLauncher";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  // Active academic year & semester
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "active" },
    include: { semesters: { where: { status: "active" } } },
  });

  // Current student enrollment
  const enrollment = activeYear
    ? await prisma.studentEnrollment.findFirst({
        where: {
          studentId: session.user.id,
          academicYearId: activeYear.id,
        },
        include: {
          classGroup: {
            include: { major: true },
          },
        },
      })
    : null;

  // Real scheduled & active examinations assigned to this student (via direct participation, class group, or subject enrollment)
  const { getEligibleExamsForStudent } = await import("@/lib/examination-participants");
  const validExams = await getEligibleExamsForStudent(session.user.id);

  const examIds = validExams.map((e) => e.id);

  // Fetch attempts separately for safety
  const attempts = (examIds.length > 0 && prisma.examinationAttempt)
    ? await prisma.examinationAttempt.findMany({
        where: {
          studentId: session.user.id,
          examinationId: { in: examIds },
        },
        orderBy: { attemptNumber: "desc" },
        include: { result: true },
      })
    : [];

  const attemptsByExam = new Map<string, any>();
  for (const att of attempts) {
    if (!attemptsByExam.has(att.examinationId)) {
      attemptsByExam.set(att.examinationId, att);
    }
  }

  const now = new Date();

  const assignedExams = validExams.map((exam) => ({
    ...exam,
    latestAttempt: attemptsByExam.get(exam.id) || null,
  }));

  // 1. Completed exams (sudah selesai dikerjakan)
  const completedExams = assignedExams.filter((exam) => {
    const att = exam.latestAttempt;
    return att && ["submitted", "grading_pending", "completed"].includes(att.status);
  });

  // Categorize completed exams into under grading vs graded
  const underGradingExams = completedExams.filter((exam) => {
    const att = exam.latestAttempt;
    return att && (att.status === "grading_pending" || Boolean(att.result?.isProvisional));
  });

  const gradedExams = completedExams.filter((exam) => {
    const att = exam.latestAttempt;
    return att && att.status === "completed" && !att.result?.isProvisional;
  });

  // 2. Active / Ready exams (guru telah memulai sesi / in_progress, atau attempt sedang berjalan, atau jadwal sedang terbuka)
  const activeExams = assignedExams.filter((exam) => {
    const att = exam.latestAttempt;
    const isCompleted = att && ["submitted", "grading_pending", "completed"].includes(att.status);
    if (isCompleted) return false;

    // If exam is closed or scheduledEnd has passed, it is closed and cannot be taken
    const isPastScheduledEnd = exam.scheduledEnd && now > new Date(exam.scheduledEnd);
    if (exam.status === "closed" || isPastScheduledEnd) return false;

    const isStarted = att && (att.status === "in_progress" || att.status === "warning" || att.status === "blocked");
    const isInProgress = exam.status === "in_progress";
    const isScheduledOpen =
      exam.status === "scheduled" && now >= new Date(exam.scheduledStart) && now <= new Date(exam.scheduledEnd);

    return isStarted || isInProgress || isScheduledOpen;
  });

  // 3. Upcoming exams (ujian yang sudah dijadwalkan oleh guru tapi belum dimulai / belum selesai dikerjakan)
  const upcomingExams = assignedExams.filter((exam) => {
    const att = exam.latestAttempt;
    const isCompleted = att && ["submitted", "grading_pending", "completed"].includes(att.status);
    if (isCompleted) return false;

    // If exam is closed or scheduledEnd has passed, it is closed
    const isPastScheduledEnd = exam.scheduledEnd && now > new Date(exam.scheduledEnd);
    if (exam.status === "closed" || isPastScheduledEnd) return false;

    const isStarted = att && (att.status === "in_progress" || att.status === "warning" || att.status === "blocked");
    if (isStarted) return false;

    // Show in upcoming only if start time has not arrived yet; once start time arrives, it automatically starts and moves to activeExams
    return exam.status === "scheduled" && now < new Date(exam.scheduledStart);
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Header
        user={session.user}
        activeYear={activeYear?.name}
        activeSemester={activeYear?.semesters[0]?.name}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[#0D274C] text-xs font-semibold mb-3">
                <GraduationCap className="w-3.5 h-3.5 text-[#65C443]" />
                <span>Portal Peserta Ujian CBT</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Selamat Datang, {session.user.displayName}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                NIS: <span className="text-[#0D274C] font-mono font-semibold">{session.user.username}</span> • Kelas:{" "}
                <span className="text-slate-800 font-semibold">
                  {enrollment?.classGroup.name || "Belum Terdaftar"}
                </span>{" "}
                {enrollment?.classGroup.major && `(${enrollment.classGroup.major.name})`}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-green-50 border border-green-200 p-3.5 rounded-xl shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-white border border-green-200 flex items-center justify-center text-green-600 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-[#65C443]" />
              </div>
              <div>
                <div className="text-xs text-green-800/80 font-medium">Status Akun</div>
                <div className="text-sm font-bold text-green-700">Aktif & Terverifikasi</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Token Access Launcher */}
        <StudentTokenQuickLauncher />

        {/* Anti-cheat Policy Notice Box */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3.5 text-sm shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-amber-900">Pemberitahuan Protokol Anti-Cheat Server-Enforced:</span>
            <p className="text-xs text-amber-800 leading-relaxed font-normal">
              Selama ujian berlangsung, sistem mencatat aktivitas peramban (perpindahan tab, jendela kehilangan fokus,
              koneksi terputus). Pelanggaran yang melebihi batas kebijakan ujian akan memblokir pengerjaan ujian secara
              otomatis hingga diverifikasi dan dibuka kembali oleh Pengawas.
            </p>
          </div>
        </div>

        {/* 1. UJIAN AKTIF / BERLANGSUNG */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0D274C]" />
              <span>Ujian Aktif & Siap Dikerjakan</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">Tahun Ajaran {activeYear?.name || "Aktif"}</span>
          </div>

          {activeExams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeExams.map((exam) => {
                const latestAttempt = exam.latestAttempt;
                const isStarted = latestAttempt && (latestAttempt.status === "in_progress" || latestAttempt.status === "warning");

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-[#0D274C]/10 text-[#0D274C] border border-[#0D274C]/20 font-semibold font-mono text-[11px]">
                            {exam.subject?.code || "MAPEL"}
                          </span>
                          {exam.policySettings?.tokenRequired && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                              <KeyRound className="w-3 h-3 text-emerald-600" />
                              <span>Wajib Token</span>
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {exam.durationMinutes} Menit
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">{exam.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {exam.description || `Mata Pelajaran: ${exam.subject?.name || "Umum"} (${exam._count.questions} Butir Soal)`}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[11px] text-slate-500">
                        {isStarted ? (
                          <span className="text-amber-700 font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-pulse" /> Sedang Berjalan
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Buka Sekarang
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/student/exam/${exam.id}`}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                          isStarted
                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                            : "bg-[#65C443] hover:bg-[#57b237] text-white"
                        }`}
                      >
                        <span>{isStarted ? "Lanjutkan Ujian" : "Mulai Ujian"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-500 text-xs">
              Tidak ada sesi ujian yang sedang berlangsung saat ini.
            </div>
          )}
        </div>

        {/* 2. UJIAN AKAN DATANG (TERJADWAL OLEH GURU) */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span>Jadwal Ujian Akan Datang</span>
            </h2>
            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-semibold">
              {upcomingExams.length} Ujian Terjadwal
            </span>
          </div>

          {upcomingExams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingExams.map((exam) => {
                const formattedStart = new Date(exam.scheduledStart).toLocaleString("id-ID", {
                  dateStyle: "full",
                  timeStyle: "short",
                });

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm hover:border-blue-300 transition flex flex-col justify-between space-y-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-0 pointer-events-none" />

                    <div className="relative z-10">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold font-mono text-[11px]">
                            {exam.subject?.code || "MAPEL"}
                          </span>
                          {exam.policySettings?.tokenRequired && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              <span>Wajib Token</span>
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {exam.durationMinutes} Menit
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base">{exam.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {exam.description || `Mata Pelajaran: ${exam.subject?.name || "Umum"} (${exam._count.questions} Butir Soal)`}
                      </p>

                      <div className="mt-3 p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-blue-900 space-y-1">
                        <div className="text-[11px] text-blue-600 font-medium">Jadwal Pelaksanaan:</div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>{formattedStart} WIB</span>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const isBeforeStart = now < new Date(exam.scheduledStart);
                      const isWindowOpen = now >= new Date(exam.scheduledStart) && now <= new Date(exam.scheduledEnd);

                      return (
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between relative z-10">
                          <span className="text-[11px] font-medium flex items-center gap-1.5">
                            {isBeforeStart ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-slate-500">Menunggu Waktu Mulai</span>
                              </>
                            ) : isWindowOpen ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-emerald-700 font-semibold">Waktu Ujian Tiba</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-amber-700 font-semibold">Jadwal Terlewat</span>
                              </>
                            )}
                          </span>

                          <Link
                            href={`/student/exam/${exam.id}`}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                              isWindowOpen
                                ? "bg-[#65C443] hover:bg-[#52a835] text-white shadow-xs"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            <span>{isWindowOpen ? "Buka Lembar Ujian" : "Lihat Tata Tertib"}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-500 text-xs">
              Belum ada jadwal ujian masa depan yang terdaftar untuk kelas Anda.
            </div>
          )}
        </div>

        {/* 3. RIWAYAT UJIAN & STATUS PENILAIAN */}
        {completedExams.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0D274C]" />
                  <span>Riwayat Ujian & Hasil Penilaian</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daftar ujian yang telah Anda selesaikan beserta status penilaian terkini.
                </p>
              </div>

              {/* Status Counters */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{gradedExams.length} Sudah Dinilai</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{underGradingExams.length} Dalam Penilaian</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedExams.map((exam) => {
                const att = exam.latestAttempt;
                const isUnderGrading = att && (att.status === "grading_pending" || Boolean(att.result?.isProvisional));
                const res = att?.result;
                const passingScore = Number(exam.passingScore) || 75;
                const percentage = res?.percentage !== undefined && res?.percentage !== null ? Number(res.percentage) : null;
                const isPassed = percentage !== null && percentage >= passingScore;

                return (
                  <div
                    key={exam.id}
                    className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between space-y-4 transition ${
                      isUnderGrading
                        ? "border-amber-200/90 hover:border-amber-300 ring-1 ring-amber-100"
                        : "border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    <div>
                      {/* Top Bar: Subject code & Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-bold border border-slate-200">
                          {exam.subject?.code || "MAPEL"}
                        </span>

                        {isUnderGrading ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Dalam Penilaian</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Sudah Dinilai</span>
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 text-base">{exam.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {exam.subject?.name} • {exam._count.questions} Butir Soal
                      </p>

                      {/* Content Box: Under Grading vs Graded */}
                      <div className="mt-3.5">
                        {isUnderGrading ? (
                          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-1">
                            <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                              <PenTool className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Menunggu Pemeriksaan Esai</span>
                            </div>
                            <p className="text-[11px] text-amber-800/80 leading-relaxed">
                              Jawaban soal esai/uraian Anda sedang diperiksa oleh guru pengampu. Nilai akhir akan ditampilkan setelah selesai dikoreksi.
                            </p>
                            {res?.objectiveScore !== null && res?.objectiveScore !== undefined && (
                              <div className="pt-1 text-[11px] text-slate-600 font-medium">
                                Skor Sementara: <strong className="text-slate-800">{Number(res.objectiveScore)}</strong> Poin
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Nilai Akhir</div>
                              <div className="text-xl font-extrabold font-mono text-slate-900">
                                {percentage !== null ? `${percentage}%` : "-"}
                              </div>
                              {res?.modificationReason && (
                                <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Disesuaikan</span>
                                </div>
                              )}
                            </div>

                            <div className="text-right">
                              {percentage !== null ? (
                                isPassed ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>LULUS</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>REMEDIAL</span>
                                  </span>
                                )
                              ) : null}
                              <div className="text-[10px] text-slate-400 mt-1 font-medium">
                                KKM: {passingScore}%
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        {isUnderGrading ? "Koreksi sedang berlangsung" : "Nilai telah diterbitkan"}
                      </span>
                      <Link
                        href={`/student/exam/${exam.id}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                          isUnderGrading
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "bg-[#0D274C] hover:bg-[#163866] text-white"
                        }`}
                      >
                        <span>{isUnderGrading ? "Lihat Status" : "Rincian Nilai"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
