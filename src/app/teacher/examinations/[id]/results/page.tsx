"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Printer,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Users,
  Award,
  TrendingUp,
  BarChart3,
  FileSpreadsheet,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  PenTool,
  FileText,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import StudentReviewModal from "./review-modal";
import KatrolModal from "./katrol-modal";

export default function ExaminationResultsPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [showKatrolModal, setShowKatrolModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedStudentForReview, setSelectedStudentForReview] = useState<any | null>(null);
  const [reviewInitialFilter, setReviewInitialFilter] = useState<"all" | "essay">("all");

  const fetchResults = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/examinations/${examId}/results`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat data hasil ujian");
      }
      setData(json.data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Terjadi kesalahan saat memuat hasil ujian.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examId) {
      fetchResults();
    }
  }, [examId]);

  // Unique class groups from students list
  const availableClasses = useMemo(() => {
    if (!data?.students) return [];
    const classSet = new Set<string>();
    data.students.forEach((s: any) => {
      if (s.className) classSet.add(s.className);
    });
    return Array.from(classSet);
  }, [data?.students]);

  // Check if any active score adjustment exists
  const activeAdjustment = useMemo(() => {
    if (!data?.students) return null;
    const adjustedStudent = data.students.find((s: any) => s.isAdjusted);
    return adjustedStudent?.modificationReason || null;
  }, [data?.students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    return data.students.filter((student: any) => {
      const matchesSearch =
        searchQuery === "" ||
        student.nis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesClass = classFilter === "all" || student.className === classFilter;

      let matchesStatus = true;
      if (statusFilter === "passed") matchesStatus = student.passStatus === "passed";
      if (statusFilter === "failed") matchesStatus = student.passStatus === "failed";
      if (statusFilter === "pending")
        matchesStatus = student.passStatus === "pending" || student.passStatus === "not_started";
      if (statusFilter === "essay_pending") matchesStatus = Boolean(student.hasPendingEssay);

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [data?.students, searchQuery, classFilter, statusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0D274C]/20 border-t-[#0D274C] rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Memuat Rekapitulasi Hasil Ujian...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-rose-200 p-6 text-center shadow-lg space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">Gagal Memuat Hasil</h3>
          <p className="text-xs text-slate-600">{errorMsg || "Ujian tidak ditemukan."}</p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Kembali
            </button>
            <button
              onClick={fetchResults}
              className="px-4 py-2 bg-[#0D274C] hover:bg-[#163866] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { examination, statistics } = data;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#0D274C]/10 text-[#0D274C] border border-[#0D274C]/20 text-[11px] font-mono font-bold">
                  {examination.subjectCode}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {examination.academicYear} • {examination.semester}
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">{examination.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchResults}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Katrol Nilai Button */}
            <button
              onClick={() => setShowKatrolModal(true)}
              className="px-3.5 py-2 rounded-xl border border-[#0D274C] bg-[#0D274C] hover:bg-[#163866] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Katrol / Sesuaikan Nilai Siswa"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#65C443]" />
              <span>Katrol Nilai</span>
            </button>

            <Link
              href={`/teacher/examinations/${examId}/proctor`}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Eye className="w-4 h-4 text-[#65C443]" />
              <span className="hidden sm:inline">Dasbor Proctoring</span>
            </Link>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Cetak Rapor</span>
            </button>

            <a
              href={`/api/examinations/${examId}/export`}
              download
              className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Printable Official Header */}
        <div className="hidden print:block text-center border-b pb-4 mb-6">
          <h2 className="text-xl font-bold uppercase text-slate-900">Rekapitulasi Hasil Asesmen Siswa</h2>
          <p className="text-sm text-slate-700">
            {examination.title} • {examination.subjectName}
          </p>
          <p className="text-xs text-slate-500">
            Tahun Ajaran: {examination.academicYear} | Standar Kelulusan (KKM): {examination.passingScore}%
          </p>
        </div>

        {/* Active Katrol Banner */}
        {activeAdjustment && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Penyesuaian Nilai Aktif (Katrol Nilai)</div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Alasan: <strong>{activeAdjustment}</strong>. Nilai akhir pada daftar di bawah telah diperbarui secara proporsional.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowKatrolModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-200/80 hover:bg-amber-200 text-amber-950 font-bold transition cursor-pointer"
              >
                Kelola Katrol
              </button>
            </div>
          </div>
        )}

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Peserta */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-1">Total Peserta</div>
              <div className="text-2xl font-extrabold text-[#0D274C]">{statistics.totalParticipants}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                <strong className="text-emerald-600">{statistics.completedCount} Selesai</strong> • {statistics.inProgressCount} Aktif
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Rata-Rata */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-1">Rata-Rata Nilai</div>
              <div className="text-2xl font-extrabold text-slate-900">{statistics.averagePercentage}%</div>
              <div className="text-[11px] text-slate-500 mt-1">
                KKM: <strong className="text-slate-800">{examination.passingScore}%</strong>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Tertinggi & Terendah */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-1">Rentang Nilai</div>
              <div className="text-2xl font-extrabold text-emerald-700">{statistics.highestPercentage}%</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Terendah: <strong className="text-rose-600">{statistics.lowestPercentage}%</strong>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#65C443]">
              <Award className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Tingkat Kelulusan */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-1">Tingkat Kelulusan</div>
              <div className="text-2xl font-extrabold text-[#0D274C]">{statistics.passRate}%</div>
              <div className="text-[11px] text-slate-500 mt-1">
                <strong className="text-emerald-600">{statistics.passedCount} Lulus</strong> •{" "}
                <strong className="text-rose-600">{statistics.failedCount} Remedial</strong>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter Controls (Hidden when printing) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari siswa berdasarkan Nama atau NIS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#65C443] transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {/* Filter Rombel */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-[#65C443] cursor-pointer"
            >
              <option value="all">Semua Rombel/Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas: {cls}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-[#65C443] cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="passed">Lulus (≥ KKM)</option>
              <option value="failed">Remedial (&lt; KKM)</option>
              <option value="pending">Belum Selesai</option>
              <option value="essay_pending">Perlu Koreksi Esai</option>
            </select>
          </div>
        </div>

        {/* Student Gradebook Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#0D274C]" />
              <h2 className="text-sm font-bold text-slate-900">Daftar Nilai Siswa</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Menampilkan <strong>{filteredStudents.length}</strong> dari {data.students.length} Siswa
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">NIS</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Rombel / Kelas</th>
                  <th className="py-3 px-4 text-center">Waktu Pengerjaan</th>
                  <th className="py-3 px-4 text-center">Integritas (Pelanggaran)</th>
                  <th className="py-3 px-4 text-right">Nilai Akhir (%)</th>
                  <th className="py-3 px-4 text-center">Status Kelulusan</th>
                  <th className="py-3 px-4 text-center print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Tidak ada data siswa yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student: any, idx: number) => {
                    const isPassed = student.passStatus === "passed";
                    const isFailed = student.passStatus === "failed";
                    const hasViolation = student.incidentCount > 0;
                    const hasPendingEssay = Boolean(student.hasPendingEssay);

                    return (
                      <tr key={student.studentId} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#0D274C]">{student.nis}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{student.studentName}</div>
                          {student.isAdjusted && (
                            <div className="text-[10px] text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Nilai dikatrol</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{student.className}</td>
                        <td className="py-3 px-4 text-center text-slate-500">
                          {student.durationMinutes !== null ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{student.durationMinutes} Menit</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Belum Selesai</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasViolation ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <ShieldAlert className="w-3 h-3 text-amber-600" />
                              <span>{student.incidentCount}x Terdeteksi</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Tertib</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {student.percentage !== null ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-sm font-extrabold font-mono text-slate-900">
                                {student.percentage}%
                              </span>
                              {hasPendingEssay && (
                                <span className="text-[10px] text-amber-600 font-semibold">
                                  (Esai Belum Lengkap)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasPendingEssay ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <PenTool className="w-3 h-3 text-amber-600" />
                              <span>KOREKSI ESAI</span>
                            </span>
                          ) : isPassed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>LULUS</span>
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>REMEDIAL</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                              <span>PENDING</span>
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="py-3 px-4 text-center print:hidden">
                          {student.attemptId ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentForReview(student);
                                  setReviewInitialFilter("all");
                                  setShowReviewModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#0D274C] text-slate-700 hover:text-white border border-slate-200 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                title="Review lembar jawaban lengkap siswa"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Review</span>
                              </button>

                              {hasPendingEssay && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentForReview(student);
                                    setReviewInitialFilter("essay");
                                    setShowReviewModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                  title="Beri nilai soal esai siswa ini"
                                >
                                  <PenTool className="w-3.5 h-3.5" />
                                  <span>Nilai Esai</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Belum Ada Sesi</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Review & Grading Modal */}
      <StudentReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        examinationId={examId}
        attemptId={selectedStudentForReview?.attemptId || null}
        studentName={selectedStudentForReview?.studentName}
        initialFilter={reviewInitialFilter}
        onGradeSaved={fetchResults}
      />

      {/* Katrol Modal */}
      <KatrolModal
        isOpen={showKatrolModal}
        onClose={() => setShowKatrolModal(false)}
        examinationId={examId}
        passingScore={Number(examination.passingScore) || 75}
        students={data.students || []}
        hasActiveAdjustment={Boolean(activeAdjustment)}
        currentAdjustmentReason={activeAdjustment}
        onAdjustSuccess={fetchResults}
      />
    </div>
  );
}
