"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  PieChart,
  BarChart3,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Filter,
  Check,
  Calendar,
  Clock,
  Printer,
  Sparkles,
  Users,
  Award,
  RefreshCw,
  BookOpen,
  Layers,
  ChevronDown,
  Info,
} from "lucide-react";

export default function ExaminationAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchAnalysis = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/examinations/${examId}/analysis`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat data analisis soal ujian.");
      }
      setData(json.data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Terjadi kesalahan saat memuat analisis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examId) {
      fetchAnalysis();
    }
  }, [examId]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!data?.itemAnalysis) return [];
    return data.itemAnalysis.filter((item: any) => {
      // Text or question number search
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.text.toLowerCase().includes(q) ||
        String(item.sequenceOrder) === q ||
        `soal ${item.sequenceOrder}`.includes(q);

      // Difficulty filter
      const matchesDifficulty =
        difficultyFilter === "all" || item.stats.difficultyCategory === difficultyFilter;

      // Type filter
      const matchesType = typeFilter === "all" || item.questionType === typeFilter;

      return matchesSearch && matchesDifficulty && matchesType;
    });
  }, [data?.itemAnalysis, searchQuery, difficultyFilter, typeFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0D274C]/20 border-t-[#0D274C] rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Mengkalkulasi Analisis Butir Soal...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-rose-200 p-6 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Gagal Memuat Analisis</h3>
          <p className="text-xs text-slate-600">{errorMsg || "Data analisis ujian tidak ditemukan."}</p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={fetchAnalysis}
              className="px-4 py-2 bg-[#0D274C] hover:bg-[#163866] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { examination, summary } = data;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-4">
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
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Analisis Butir Soal: {examination.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalysis}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Segarkan Data Analisis"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <Link
              href={`/teacher/examinations/${examId}/results`}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Award className="w-4 h-4 text-purple-600" />
              <span>Rekap Nilai Siswa</span>
            </Link>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-[#0D274C] hover:bg-[#163866] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Analisis</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Printable Official Header */}
        <div className="hidden print:block text-center border-b pb-4 mb-6">
          <h2 className="text-xl font-bold uppercase text-slate-900">
            Laporan Analisis Kualitas Butir Soal Ujian
          </h2>
          <p className="text-sm text-slate-700">
            {examination.title} • {examination.subjectName} ({examination.subjectCode})
          </p>
          <p className="text-xs text-slate-500">
            Tahun Ajaran: {examination.academicYear} | Total Peserta: {summary.totalParticipantsTaking} Siswa
          </p>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#0D274C]/10 text-[#0D274C] flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Total Butir Soal</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{summary.totalQuestions}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{examination.totalPoints} Total Poin</div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Peserta Mengerjakan</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {summary.totalParticipantsTaking}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                {summary.totalParticipantsTaking > 0 ? "Data Tervalidasi" : "Belum Ada Peserta"}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Rerata Kesukaran (P)</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{summary.avgDifficulty}</div>
              <div className="text-[11px] font-semibold text-indigo-600 mt-0.5">
                {summary.avgDifficulty > 0.7
                  ? "Cenderung Mudah"
                  : summary.avgDifficulty < 0.3
                  ? "Cenderung Sukar"
                  : "Proporsional (Sedang)"}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-medium text-slate-500 mb-1.5">Sebaran Tingkat Kesukaran</div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-bold block">Mudah</span>
                <span className="text-xs font-extrabold text-emerald-700">{summary.easyCount}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200">
                <span className="text-[10px] text-blue-800 font-bold block">Sedang</span>
                <span className="text-xs font-extrabold text-blue-700">{summary.mediumCount}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200">
                <span className="text-[10px] text-rose-800 font-bold block">Sukar</span>
                <span className="text-xs font-extrabold text-rose-700">{summary.hardCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* GUIDELINE INFO BANNER */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-3 print:hidden">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Pedoman Interpretasi Indeks Kesukaran Soal (P-Value):</div>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              <strong>Mudah (P &gt; 0.70):</strong> Soal dijawab benar oleh lebih dari 70% siswa. •{" "}
              <strong>Sedang (0.30 ≤ P ≤ 0.70):</strong> Derajat kesukaran ideal yang baik untuk mengukur kompetensi. •{" "}
              <strong>Sukar (P &lt; 0.30):</strong> Soal hanya dijawab benar oleh kurang dari 30% siswa (perlu ditinjau materi atau distraktor).
            </p>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari teks soal atau nomor butir (contoh: 1, 5)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#65C443]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Kesukaran */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setDifficultyFilter("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  difficultyFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua ({summary.totalQuestions})
              </button>
              <button
                type="button"
                onClick={() => setDifficultyFilter("easy")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  difficultyFilter === "easy"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                Mudah ({summary.easyCount})
              </button>
              <button
                type="button"
                onClick={() => setDifficultyFilter("medium")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  difficultyFilter === "medium"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-blue-700 hover:bg-blue-50"
                }`}
              >
                Sedang ({summary.mediumCount})
              </button>
              <button
                type="button"
                onClick={() => setDifficultyFilter("hard")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  difficultyFilter === "hard"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-rose-700 hover:bg-rose-50"
                }`}
              >
                Sukar ({summary.hardCount})
              </button>
            </div>

            {/* Filter Tipe Soal */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:border-[#65C443] cursor-pointer"
            >
              <option value="all">Semua Tipe Soal</option>
              <option value="single_choice">Pilihan Ganda (Single Choice)</option>
              <option value="multi_select">Pilihan Jamak (Multi Select)</option>
              <option value="true_false">Benar / Salah</option>
              <option value="short_answer">Isian Singkat</option>
              <option value="essay">Uraian / Esai</option>
            </select>
          </div>
        </div>

        {/* QUESTION ANALYSIS CARDS LIST */}
        {filteredItems.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 space-y-2">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-300" />
            <div className="font-bold text-slate-800 text-sm">Tidak Ada Butir Soal yang Cocok</div>
            <p className="text-xs text-slate-400">
              Silakan sesuaikan kriteria pencarian atau filter tingkat kesukaran Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item: any) => {
              const diffBadgeClass =
                item.stats.difficultyCategory === "easy"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : item.stats.difficultyCategory === "hard"
                  ? "bg-rose-50 text-rose-800 border-rose-200"
                  : "bg-blue-50 text-blue-800 border-blue-200";

              const diffTextLabel =
                item.stats.difficultyCategory === "easy"
                  ? "Mudah"
                  : item.stats.difficultyCategory === "hard"
                  ? "Sukar"
                  : "Sedang";

              return (
                <div
                  key={item.examinationQuestionId}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition space-y-4"
                >
                  {/* Top Bar: Question Number, Type, Difficulty Badge */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-[#0D274C] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        #{item.sequenceOrder}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 uppercase">
                            {item.questionType.replace("_", " ")}
                          </span>
                          {item.categoryName && (
                            <span className="text-[11px] text-slate-400">• {item.categoryName}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">Bobot: {item.points} Poin</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <span className="text-slate-500">Indeks (P):</span>
                        <strong className="text-slate-900 font-mono">{item.stats.difficultyIndex}</strong>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-bold border uppercase tracking-wider ${diffBadgeClass}`}
                      >
                        {diffTextLabel}
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="text-slate-800 text-xs leading-relaxed font-medium bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                    {item.text || "(Teks butir soal tidak tersedia)"}
                  </div>

                  {/* Statistics & Option Distribution Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
                    {/* Left: Overall Accuracy (Benar vs Salah vs Kosong) */}
                    <div className="lg:col-span-5 bg-slate-50/50 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-[#0D274C]" />
                          <span>Ketepatan Jawaban Siswa</span>
                        </h4>

                        {/* Visual Bar of Accuracy */}
                        <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex">
                          <div
                            style={{ width: `${item.stats.correctPercentage}%` }}
                            className="bg-[#65C443] transition-all duration-300"
                            title={`Benar: ${item.stats.correctCount} (${item.stats.correctPercentage}%)`}
                          />
                          <div
                            style={{ width: `${item.stats.incorrectPercentage}%` }}
                            className="bg-rose-500 transition-all duration-300"
                            title={`Salah: ${item.stats.incorrectCount} (${item.stats.incorrectPercentage}%)`}
                          />
                          <div
                            style={{ width: `${item.stats.unansweredPercentage}%` }}
                            className="bg-slate-400 transition-all duration-300"
                            title={`Kosong: ${item.stats.unansweredCount} (${item.stats.unansweredPercentage}%)`}
                          />
                        </div>
                      </div>

                      {/* Accuracy Numbers */}
                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/80">
                          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-800 mb-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#65C443]" />
                            <span>Benar</span>
                          </div>
                          <div className="text-sm font-black text-emerald-900">
                            {item.stats.correctCount}{" "}
                            <span className="text-[10px] font-medium text-emerald-700">
                              ({item.stats.correctPercentage}%)
                            </span>
                          </div>
                        </div>

                        <div className="p-2 rounded-xl bg-rose-50 border border-rose-200/80">
                          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-800 mb-0.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Salah</span>
                          </div>
                          <div className="text-sm font-black text-rose-900">
                            {item.stats.incorrectCount}{" "}
                            <span className="text-[10px] font-medium text-rose-700">
                              ({item.stats.incorrectPercentage}%)
                            </span>
                          </div>
                        </div>

                        <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-700 mb-0.5">
                            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                            <span>Kosong</span>
                          </div>
                          <div className="text-sm font-black text-slate-800">
                            {item.stats.unansweredCount}{" "}
                            <span className="text-[10px] font-medium text-slate-600">
                              ({item.stats.unansweredPercentage}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Distribution of Options (A, B, C, D, etc.) */}
                    <div className="lg:col-span-7 space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <PieChart className="w-4 h-4 text-[#0D274C]" />
                          <span>Distribusi Pilihan Jawaban (A / B / C / D)</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Kunci Jawaban ditandai centang hijau
                        </span>
                      </h4>

                      {item.optionDistribution && item.optionDistribution.length > 0 ? (
                        <div className="space-y-2">
                          {item.optionDistribution.map((opt: any) => {
                            const isKey = opt.isCorrect;
                            return (
                              <div
                                key={opt.id}
                                className={`p-2.5 rounded-xl border text-xs transition flex flex-col justify-between ${
                                  isKey
                                    ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300/40"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                        isKey
                                          ? "bg-[#65C443] text-white"
                                          : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      {opt.label}
                                    </span>
                                    <span className="text-xs text-slate-800 truncate font-medium">
                                      {opt.text || `Opsi ${opt.label}`}
                                    </span>
                                    {isKey && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                                        <Check className="w-3 h-3" />
                                        <span>Kunci Benar</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs font-bold text-slate-900 shrink-0">
                                    {opt.count} Siswa{" "}
                                    <span className="text-slate-500 font-normal">
                                      ({opt.percentage}%)
                                    </span>
                                  </div>
                                </div>

                                {/* Progress Bar of this option */}
                                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    style={{ width: `${opt.percentage}%` }}
                                    className={`h-full transition-all duration-300 ${
                                      isKey ? "bg-[#65C443]" : "bg-slate-400"
                                    }`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-400 text-xs">
                          {item.questionType === "essay"
                            ? "Soal bertipe Uraian / Esai (tidak memiliki pilihan ganda objektif A/B/C/D)."
                            : "Tidak ada opsi pilihan ganda terkonfigurasi pada butir soal ini."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

