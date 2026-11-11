"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileSpreadsheet,
  Lock,
  Download,
  CheckSquare,
  Square,
  Search,
  Filter,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Users,
  ShieldCheck,
  TrendingUp,
  X,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Layers,
} from "lucide-react";

interface ExamGradeRecapPanelProps {
  subjects?: any[];
  academicYears?: any[];
  classes?: any[];
  activeYearId?: string | null;
  activeYearName?: string | null;
  userRoles?: string[];
}

export default function ExamGradeRecapPanel({
  subjects = [],
  academicYears = [],
  classes = [],
  activeYearId,
  activeYearName,
  userRoles = [],
}: ExamGradeRecapPanelProps) {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalExams: 0,
    totalRecapped: 0,
    totalPending: 0,
    totalInProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<"all" | "recapped" | "pending" | "in_progress">("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Checkbox selections for batch export
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal Detail State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecapDetail, setSelectedRecapDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailClassFilter, setDetailClassFilter] = useState("all");
  const [detailStatusFilter, setDetailStatusFilter] = useState<"all" | "passed" | "failed">("all");

  // Toast / Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Fetch Items
  const loadRecapData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (selectedSubject !== "all") params.append("subjectId", selectedSubject);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/examinations/recap?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        showToast(data.error || "Gagal memuat daftar rekap nilai", "error");
      }
    } catch (err) {
      console.error("loadRecapData error:", err);
      showToast("Terjadi kesalahan jaringan saat memuat rekap nilai", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedSubject, searchQuery]);

  useEffect(() => {
    loadRecapData();
  }, [loadRecapData]);

  // Handle Process & Lock Recap
  const handleProcessRecap = async (examinationId: string, examTitle: string, canRecap: boolean = true) => {
    if (!examinationId) return;
    if (!canRecap) {
      showToast(
        "Ujian masih berlangsung dan belum selesai. Rekap nilai hanya dapat dilakukan setelah ujian selesai atau ditutup.",
        "error"
      );
      return;
    }
    const confirmLock = confirm(
      `Apakah Anda yakin ingin memproses dan mengunci rekap nilai untuk:\n"${examTitle}"?\n\nNilai seluruh peserta akan dihitung dan di-backup secara permanen ke dalam sistem.`
    );
    if (!confirmLock) return;

    try {
      setRevisingId(examinationId);
      const res = await fetch(`/api/examinations/${examinationId}/recap`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Nilai ujian "${examTitle}" berhasil direkap dan dikunci secara permanen!`, "success");
        await loadRecapData();
      } else {
        showToast(data.error || "Gagal memproses rekap nilai", "error");
      }
    } catch (err) {
      console.error("handleProcessRecap error:", err);
      showToast("Terjadi kesalahan saat memproses rekap nilai", "error");
    } finally {
      setRevisingId(null);
    }
  };

  // Handle View Detail
  const handleViewDetail = async (recapId: string) => {
    try {
      setLoadingDetail(true);
      setDetailModalOpen(true);
      const res = await fetch(`/api/examinations/recap/${recapId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedRecapDetail(data.data);
      } else {
        showToast(data.error || "Gagal memuat detail nilai", "error");
        setDetailModalOpen(false);
      }
    } catch (err) {
      console.error("handleViewDetail error:", err);
      showToast("Terjadi kesalahan jaringan", "error");
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Selection Logic
  const recappedItems = useMemo(() => items.filter((i) => i.isRecapped), [items]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === recappedItems.length && recappedItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(recappedItems.map((i) => i.recapId));
    }
  };

  const handleToggleSelect = (recapId: string) => {
    if (selectedIds.includes(recapId)) {
      setSelectedIds(selectedIds.filter((id) => id !== recapId));
    } else {
      setSelectedIds([...selectedIds, recapId]);
    }
  };

  // Export to Excel
  const handleExportExcel = async (batchMode: "all" | "selected" | "single", singleId?: string) => {
    try {
      setExporting(true);
      const payload: any = {};
      if (batchMode === "all") {
        payload.all = true;
      } else if (batchMode === "selected") {
        if (selectedIds.length === 0) {
          showToast("Pilih minimal satu ujian untuk diekspor", "error");
          setExporting(false);
          return;
        }
        payload.recapIds = selectedIds;
      } else if (batchMode === "single" && singleId) {
        payload.recapIds = [singleId];
      }

      const res = await fetch("/api/examinations/recap/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || "Gagal mengunduh berkas Excel", "error");
        setExporting(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekap_Nilai_Nexam_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast("Berkas Excel rekap nilai berhasil diunduh!", "success");
    } catch (err) {
      console.error("handleExportExcel error:", err);
      showToast("Terjadi kesalahan saat mengunduh berkas Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  // Filtered Student Records inside Detail Modal
  const modalStudentRecords = useMemo(() => {
    if (!selectedRecapDetail?.studentRecords) return [];
    let list = selectedRecapDetail.studentRecords as any[];

    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.displayName?.toLowerCase().includes(q) ||
          s.username?.toLowerCase().includes(q) ||
          s.nis?.toLowerCase().includes(q) ||
          s.className?.toLowerCase().includes(q)
      );
    }

    if (detailClassFilter !== "all") {
      list = list.filter((s) => s.className === detailClassFilter);
    }

    if (detailStatusFilter === "passed") {
      list = list.filter((s) => s.isPassed);
    } else if (detailStatusFilter === "failed") {
      list = list.filter((s) => !s.isPassed);
    }

    return list;
  }, [selectedRecapDetail, detailSearch, detailClassFilter, detailStatusFilter]);

  const distinctDetailClasses = useMemo(() => {
    if (!selectedRecapDetail?.studentRecords) return [];
    const classesSet = new Set<string>();
    (selectedRecapDetail.studentRecords as any[]).forEach((s) => {
      if (s.className && s.className !== "-") classesSet.add(s.className);
    });
    return Array.from(classesSet).sort();
  }, [selectedRecapDetail]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-md transition-all ${
            toastMessage.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/20 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header & Actions Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Rekap Nilai & Pengarsipan Asesmen</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kunci nilai ujian siswa, amankan backup data asesmen permanen, pantau kelulusan, dan ekspor ke Excel.
              </p>
            </div>
          </div>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => handleExportExcel("selected")}
              disabled={exporting}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Ekspor Terpilih ({selectedIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleExportExcel("all")}
            disabled={exporting || summary.totalRecapped === 0}
            className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            title="Ekspor seluruh rekap nilai yang telah dikunci ke format berkas Excel (.xlsx)"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? "Memproses..." : "Ekspor Semua (.xlsx)"}</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Stat KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Asesmen Terdata</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{summary.totalExams}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-xs flex items-center gap-3.5 bg-gradient-to-br from-emerald-50/40 to-white">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
              <span>Nilai Terkunci & Aman</span>
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-200/70 text-emerald-900 text-[10px] font-bold">
                Permanen
              </span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{summary.totalRecapped} Ujian</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-amber-800 font-medium">Selesai (Siap Direkap)</div>
            <div className="text-xl font-extrabold text-amber-700 mt-0.5">{summary.totalPending} Ujian</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-blue-800 font-medium">Sedang Berjalan</div>
            <div className="text-xl font-extrabold text-blue-700 mt-0.5">{summary.totalInProgress || 0} Ujian</div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "all"
                ? "bg-[#0D274C] text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <span>Semua Asesmen</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              statusFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
            }`}>
              {summary.totalExams}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("recapped")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "recapped"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Terkunci & Aman</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              statusFilter === "recapped" ? "bg-white/25 text-white" : "bg-emerald-200 text-emerald-900"
            }`}>
              {summary.totalRecapped}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Siap Direkap</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              statusFilter === "pending" ? "bg-white/25 text-white" : "bg-amber-200 text-amber-900"
            }`}>
              {summary.totalPending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("in_progress")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "in_progress"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Sedang Berjalan</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              statusFilter === "in_progress" ? "bg-white/25 text-white" : "bg-blue-200 text-blue-900"
            }`}>
              {summary.totalInProgress || 0}
            </span>
          </button>
        </div>

        {/* Search & Subject Select */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari judul ujian, mata pelajaran, atau kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {subjects.length > 0 && (
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 max-w-[150px]"
            >
              <option value="all">Semua Mapel</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={loadRecapData}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* 4. Select All Checkbox Helper Bar */}
      {recappedItems.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedIds.length === recappedItems.length && recappedItems.length > 0}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <span className="font-semibold text-slate-700">
              Pilih Semua Ujian yang Sudah Direkap ({selectedIds.length} dari {recappedItems.length} terpilih)
            </span>
          </label>
        </div>
      )}

      {/* 5. Exam Cards List */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-purple-600" />
          <span>Memuat data rekap nilai ujian...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 space-y-3">
          <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300" />
          <div className="font-bold text-slate-800 text-sm">Tidak Ditemukan Jadwal Asesmen</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tidak ada jadwal ujian yang sesuai dengan filter pencarian Anda atau belum ada ujian yang selesai dilaksanakan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.recapId);
            const isProcessing = revisingId === item.examinationId;

            return (
              <div
                key={item.id}
                className={`bg-white p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md ${
                  item.isRecapped
                    ? isSelected
                      ? "border-purple-400 ring-2 ring-purple-500/20 bg-purple-50/20"
                      : "border-slate-200 hover:border-purple-200"
                    : "border-amber-200/90 bg-amber-50/15"
                }`}
              >
                {/* Header Information */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-start gap-3">
                    {/* Checkbox for recapped items */}
                    {item.isRecapped ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.recapId)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        title="Pilih untuk ekspor batch"
                      />
                    ) : (
                      <div className="w-4 h-4 mt-1" />
                    )}

                    <div>
                      {/* Badges: Type, Subject, and Status */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {item.examTypeCode && (
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[11px] tracking-wide">
                            {item.examTypeCode}
                          </span>
                        )}

                        <span className="text-xs font-bold text-[#0D274C]">
                          {item.subjectName} {item.subjectCode ? `(${item.subjectCode})` : ""}
                        </span>

                        {item.isRecapped ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Terkunci & Aman</span>
                          </span>
                        ) : item.canRecap ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Selesai (Siap Direkap)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                            <span>Sedang Berjalan (Belum Selesai)</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{item.examTitle}</h3>

                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-700">Kelas: {item.targetClasses || "Semua"}</span>
                        <span>•</span>
                        <span>Periode: {item.academicYearName} {item.semesterName}</span>
                        <span>•</span>
                        <span>KKM: <strong className="text-slate-800">{item.passingScore}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right Status Info */}
                  <div className="text-right flex flex-col items-end">
                    {item.isRecapped ? (
                      <div className="text-right">
                        <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 justify-end">
                          <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Permanen</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(item.lockedAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}{" "}
                          {new Date(item.lockedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB
                        </div>
                        {item.lockedByName && (
                          <div className="text-[10px] text-slate-500">Oleh: {item.lockedByName}</div>
                        )}
                      </div>
                    ) : item.canRecap ? (
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-amber-700">
                          {item.submittedCount} / {item.totalParticipants} Selesai
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Ujian selesai • Siap direkap
                        </div>
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-blue-700 flex items-center gap-1 justify-end">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                          <span>{item.submittedCount} / {item.totalParticipants} Mengerjakan</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Ujian sedang berlangsung
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Statistics Box */}
                {item.isRecapped ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Peserta Dinilai</div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">
                        {item.submittedCount} / {item.totalParticipants} Siswa
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Rata-rata Nilai</div>
                      <div className="text-xs font-bold text-purple-700 mt-0.5">
                        {item.averageScore}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Tertinggi / Terendah</div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">
                        <span className="text-emerald-600">{item.highestScore}</span> / <span className="text-rose-600">{item.lowestScore}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Kelulusan KKM</div>
                      <div className="text-xs font-bold mt-0.5 flex items-center gap-1.5">
                        <span className="text-emerald-700 font-extrabold">{item.passingCount} Tuntas</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-rose-600">{item.failingCount} Belum</span>
                      </div>
                    </div>
                  </div>
                ) : item.canRecap ? (
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Sesi ujian telah berakhir. Segera proses rekap nilai agar data nilai siswa terkunci dan terarsip aman.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Ujian sedang berlangsung. Rekapitulasi nilai baru dapat dilakukan setelah sesi ujian selesai atau ditutup.
                      </span>
                    </div>
                  </div>
                )}

                {/* Bottom Actions Bar */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.isRecapped ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleViewDetail(item.recapId)}
                          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          title="Lihat daftar nilai seluruh siswa pada ujian ini"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Lihat Detail Nilai</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportExcel("single", item.recapId)}
                          disabled={exporting}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          title="Unduh berkas Excel rekap nilai ujian ini"
                        >
                          <Download className="w-4 h-4 text-emerald-600" />
                          <span>Unduh Excel (.xlsx)</span>
                        </button>

                        {/* Optional refresh if exam still exists */}
                        {item.examinationId && (
                          <button
                            type="button"
                            onClick={() => handleProcessRecap(item.examinationId, item.examTitle, true)}
                            disabled={isProcessing}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Perbarui snapshot rekap nilai jika terdapat koreksi esai susulan"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin text-purple-600" : ""}`} />
                            <span className="hidden sm:inline">Perbarui Snapshot</span>
                          </button>
                        )}
                      </>
                    ) : item.canRecap ? (
                      <button
                        type="button"
                        onClick={() => handleProcessRecap(item.examinationId, item.examTitle, true)}
                        disabled={isProcessing}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Lock className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
                        <span>{isProcessing ? "Memproses Nilai..." : "Proses & Kunci Nilai Ujian"}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled
                          className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold flex items-center gap-2 cursor-not-allowed shadow-none"
                          title="Ujian masih berlangsung. Nilai baru dapat diproses dan direkap setelah sesi ujian berakhir atau ditutup."
                        >
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>Ujian Masih Berjalan (Belum Dapat Direkap)</span>
                        </button>
                        <span className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                          Menunggu ujian selesai
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Jadwal: {new Date(item.scheduledStart).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MODAL: LIHAT DETAIL NILAI SISWA (SNAPSHOT)            */}
      {/* ======================================================== */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {selectedRecapDetail?.examTypeCode && (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[11px]">
                      {selectedRecapDetail.examTypeCode}
                    </span>
                  )}
                  <span className="text-xs font-bold text-purple-800">
                    {selectedRecapDetail?.subjectName}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Tersimpan Aman di Arsip</span>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{selectedRecapDetail?.examTitle}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelas: <strong className="text-slate-700">{selectedRecapDetail?.targetClasses}</strong> • KKM:{" "}
                  <strong className="text-slate-700">{selectedRecapDetail?.passingScore}</strong> • Dikunci oleh:{" "}
                  <span className="text-purple-700 font-semibold">{selectedRecapDetail?.lockedByName || "-"}</span> (
                  {selectedRecapDetail?.lockedAt
                    ? new Date(selectedRecapDetail.lockedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
                    : "-"}
                  )
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportExcel("single", selectedRecapDetail?.id)}
                  disabled={exporting}
                  className="px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    setSelectedRecapDetail(null);
                  }}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingDetail ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-purple-600" />
                  <span>Memuat rincian nilai siswa...</span>
                </div>
              ) : (
                <>
                  {/* Summary Metric Cards inside Modal */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="text-[11px] text-slate-500">Total Peserta</div>
                      <div className="text-base font-bold text-slate-800 mt-0.5">
                        {selectedRecapDetail?.submittedCount} / {selectedRecapDetail?.totalParticipants}
                      </div>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                      <div className="text-[11px] text-purple-800 font-medium">Rata-rata</div>
                      <div className="text-base font-extrabold text-purple-700 mt-0.5">
                        {selectedRecapDetail?.averageScore}
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                      <div className="text-[11px] text-emerald-800 font-medium">Nilai Tertinggi</div>
                      <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                        {selectedRecapDetail?.highestScore}
                      </div>
                    </div>

                    <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                      <div className="text-[11px] text-rose-800 font-medium">Nilai Terendah</div>
                      <div className="text-base font-extrabold text-rose-700 mt-0.5">
                        {selectedRecapDetail?.lowestScore}
                      </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 col-span-2 sm:col-span-1">
                      <div className="text-[11px] text-blue-800 font-medium">Tuntas KKM</div>
                      <div className="text-base font-extrabold text-blue-700 mt-0.5">
                        {selectedRecapDetail?.passingCount} Siswa
                      </div>
                    </div>
                  </div>

                  {/* Filter & Search inside modal */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari nama siswa, NIS, atau kelas..."
                        value={detailSearch}
                        onChange={(e) => setDetailSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {distinctDetailClasses.length > 1 && (
                      <select
                        value={detailClassFilter}
                        onChange={(e) => setDetailClassFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500"
                      >
                        <option value="all">Semua Rombel</option>
                        {distinctDetailClasses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailStatusFilter("all")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          detailStatusFilter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Semua ({selectedRecapDetail?.studentRecords?.length || 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailStatusFilter("passed")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          detailStatusFilter === "passed"
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        Tuntas ({selectedRecapDetail?.passingCount || 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailStatusFilter("failed")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          detailStatusFilter === "failed"
                            ? "bg-rose-600 text-white"
                            : "bg-rose-50 text-rose-800"
                        }`}
                      >
                        Belum ({selectedRecapDetail?.failingCount || 0})
                      </button>
                    </div>
                  </div>

                  {/* Student Records Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">No</th>
                            <th className="py-2.5 px-3">NIS / No. Peserta</th>
                            <th className="py-2.5 px-3">Nama Lengkap</th>
                            <th className="py-2.5 px-3">Kelas</th>
                            <th className="py-2.5 px-3 text-right">Nilai PG</th>
                            <th className="py-2.5 px-3 text-right">Nilai Esai</th>
                            <th className="py-2.5 px-3 text-right">Nilai Akhir (%)</th>
                            <th className="py-2.5 px-3 text-center">Status Kelulusan</th>
                            <th className="py-2.5 px-3 text-right">Waktu Selesai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modalStudentRecords.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-slate-400">
                                Tidak ada data siswa yang cocok dengan filter pencarian.
                              </td>
                            </tr>
                          ) : (
                            modalStudentRecords.map((s, idx) => (
                              <tr key={s.studentId || idx} className="hover:bg-slate-50/80 transition">
                                <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3 font-mono font-medium text-slate-800 text-[11px]">
                                  {s.nis || s.username || "-"}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">
                                  {s.displayName || "-"}
                                </td>
                                <td className="py-2 px-3 text-slate-600">{s.className || "-"}</td>
                                <td className="py-2 px-3 text-right text-slate-700 font-mono">
                                  {s.objectiveScore ?? 0}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700 font-mono">
                                  {s.essayScore ?? 0}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-purple-700 font-mono text-sm">
                                  {s.percentage ?? 0}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {s.isPassed ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      TUNTAS
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      BELUM TUNTAS
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-400 text-[11px]">
                                  {s.submittedAt
                                    ? new Date(s.submittedAt).toLocaleTimeString("id-ID", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        timeZone: "Asia/Jakarta",
                                      }) + " WIB"
                                    : "-"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Menampilkan <strong>{modalStudentRecords.length}</strong> dari{" "}
                <strong>{selectedRecapDetail?.studentRecords?.length || 0}</strong> siswa terdaftar
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailModalOpen(false);
                  setSelectedRecapDetail(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
