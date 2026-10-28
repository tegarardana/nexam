"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  ShieldAlert,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Eye,
  Radio,
  Wifi,
  WifiOff,
  UserCheck,
  Send,
  Plus,
  HelpCircle,
  FileText,
  AlertCircle,
  Check,
  XCircle,
  Award,
  RotateCcw,
  KeyRound,
  Copy,
  Sparkles,
} from "lucide-react";

interface StudentRosterItem {
  studentId: string;
  studentName: string;
  username: string;
  nis: string | null;
  className: string;
  attemptId: string | null;
  status: "not_started" | "in_progress" | "warning" | "blocked" | "submitted" | "completed" | "grading_pending" | "expired";
  connectionStatus: "connected" | "disconnected" | "unknown";
  incidentCount: number;
  startedAt: string | null;
  deadlineAt: string | null;
  submittedAt: string | null;
  answeredCount: number;
  doubtfulCount: number;
  lastHeartbeat: string | null;
}

interface EventLogItem {
  id: string;
  attemptId: string;
  studentName: string;
  studentNis: string | null;
  eventType: string;
  actorName: string | null;
  interventionNote: string | null;
  metadata?: any;
  timestamp: string;
}

export default function ProctorDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examInfo, setExamInfo] = useState<any>(null);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLogItem[]>([]);
  const [sseConnected, setSseConnected] = useState(false);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "attention" | "in_progress" | "submitted" | "disconnected">("all");

  // Intervention Modals State
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterItem | null>(null);
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [warnNote, setWarnNote] = useState("");
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockNote, setUnlockNote] = useState("");
  const [resetIncidentCount, setResetIncidentCount] = useState(true);
  const [showExtendTimeModal, setShowExtendTimeModal] = useState(false);
  const [additionalMinutes, setAdditionalMinutes] = useState(10);
  const [extendReason, setExtendReason] = useState("");
  const [showRetakeModal, setShowRetakeModal] = useState(false);
  const [retakeMode, setRetakeMode] = useState<"reset_answers" | "keep_answers">("reset_answers");
  const [retakeMinutes, setRetakeMinutes] = useState<number>(90);
  const [retakeReason, setRetakeReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Token Management State
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenRequiredInput, setTokenRequiredInput] = useState(true);
  const [tokenSubmitting, setTokenSubmitting] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const handleCopyToken = () => {
    if (examInfo?.policy?.globalToken) {
      navigator.clipboard.writeText(examInfo.policy.globalToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const openTokenModal = () => {
    setTokenRequiredInput(Boolean(examInfo?.policy?.tokenRequired));
    setTokenInput(examInfo?.policy?.globalToken || "");
    setShowTokenModal(true);
  };

  const handleUpdateToken = async (autoGenerate = false) => {
    setTokenSubmitting(true);
    try {
      const res = await fetch(`/api/examinations/${examId}/token`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenRequired: tokenRequiredInput,
          globalToken: autoGenerate ? undefined : tokenInput,
          autoGenerate,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setExamInfo((prev: any) => ({
          ...prev,
          policy: {
            ...prev?.policy,
            tokenRequired: json.data.tokenRequired,
            globalToken: json.data.globalToken,
          },
        }));
        setShowTokenModal(false);
      } else {
        alert(json.error || "Gagal memperbarui token ujian.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setTokenSubmitting(false);
    }
  };

  // Resilient Real-Time Polling for Proctor Dashboard
  const fetchProctorData = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch(`/api/examinations/${examId}/proctor`);
      if (res.status === 401) {
        setError("unauthorized");
        if (isInitial) setLoading(false);
        setSseConnected(false);
        return;
      }

      const json = await res.json();
      if (res.ok && json.success) {
        setExamInfo(json.data.examination);
        setRoster(json.data.roster);
        setEventLogs(json.data.recentEvents);
        setSseConnected(true);
        setError(null);
      } else {
        if (isInitial) {
          setError(json.error || "Gagal memuat sesi pengawasan.");
        }
      }
    } catch (err: any) {
      if (isInitial) {
        console.error("Proctor fetch error:", err);
        setError("Gagal menghubungi server untuk memuat sesi pengawasan.");
      }
      setSseConnected(false);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [examId]);

  useEffect(() => {
    if (!examId) return;

    let isCancelled = false;

    // 1. Initial hydration
    fetchProctorData(true);

    // 2. Poll every 2500ms for fresh live state without holding hanging sockets
    const interval = setInterval(() => {
      if (!isCancelled && document.visibilityState !== "hidden") {
        fetchProctorData(false);
      }
    }, 2500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [examId, fetchProctorData]);

  // Statistics
  const stats = useMemo(() => {
    const total = roster.length;
    const inProgress = roster.filter((r) => r.status === "in_progress").length;
    const warning = roster.filter((r) => r.status === "warning").length;
    const blocked = roster.filter((r) => r.status === "blocked").length;
    const submitted = roster.filter((r) => ["submitted", "completed", "grading_pending"].includes(r.status)).length;
    const disconnected = roster.filter((r) => r.connectionStatus === "disconnected").length;

    return { total, inProgress, warning, blocked, submitted, disconnected };
  }, [roster]);

  // Filtered roster
  const filteredRoster = useMemo(() => {
    return roster.filter((student) => {
      const matchesSearch =
        !searchQuery ||
        student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.nis && student.nis.includes(searchQuery)) ||
        student.className.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "attention") {
        return student.status === "warning" || student.status === "blocked";
      }
      if (statusFilter === "in_progress") {
        return student.status === "in_progress";
      }
      if (statusFilter === "submitted") {
        return ["submitted", "completed", "grading_pending"].includes(student.status);
      }
      if (statusFilter === "disconnected") {
        return student.connectionStatus === "disconnected";
      }

      return true;
    });
  }, [roster, searchQuery, statusFilter]);

  // Handle Manual Warning
  const handleSendWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent?.attemptId) return;

    setSubmittingAction(true);
    try {
      const res = await fetch("/api/proctoring/warn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: selectedStudent.attemptId,
          note: warnNote || "Peringatan pengawas ruang ujian.",
        }),
      });

      if (res.ok) {
        setShowWarnModal(false);
        setWarnNote("");
        fetchProctorData(false);
      } else {
        const json = await res.json();
        alert(json.error || "Gagal mengirimkan peringatan.");
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Manual Block
  const handleBlockStudent = async (student: StudentRosterItem) => {
    if (!student.attemptId) return;
    const conf = window.confirm(`Apakah Anda yakin ingin mengunci lembar ujian ${student.studentName}?`);
    if (!conf) return;

    try {
      const res = await fetch("/api/proctoring/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: student.attemptId,
          note: "Sesi ujian ditangguhkan secara manual oleh pengawas ruang.",
        }),
      });

      if (res.ok) {
        fetchProctorData(false);
      } else {
        const json = await res.json();
        alert(json.error || "Gagal mengunci sesi ujian.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    }
  };

  // Handle Manual Unlock
  const handleSaveUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent?.attemptId) return;

    if (!unlockNote.trim()) {
      alert("Alasan pembukaan kunci wajib diisi.");
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await fetch("/api/proctoring/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: selectedStudent.attemptId,
          note: unlockNote.trim(),
          resetIncidentCount,
        }),
      });

      if (res.ok) {
        setShowUnlockModal(false);
        setUnlockNote("");
        fetchProctorData(false);
      } else {
        const json = await res.json();
        alert(json.error || "Gagal membuka kunci ujian.");
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Extend Time
  const handleSaveExtendTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent?.attemptId) return;

    setSubmittingAction(true);
    try {
      const res = await fetch("/api/proctoring/extend-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: selectedStudent.attemptId,
          additionalMinutes: Number(additionalMinutes),
          reason: extendReason || "Kompensasi waktu teknis.",
        }),
      });

      if (res.ok) {
        setShowExtendTimeModal(false);
        setExtendReason("");
        fetchProctorData(false);
      } else {
        const json = await res.json();
        alert(json.error || "Gagal menambahkan waktu.");
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Retake Exam (Kerjakan Ulang)
  const handleSaveRetake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent?.attemptId) return;

    setSubmittingAction(true);
    try {
      const res = await fetch("/api/proctoring/retake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: selectedStudent.attemptId,
          mode: retakeMode,
          durationMinutes: Number(retakeMinutes),
          reason: retakeReason.trim() || undefined,
        }),
      });

      if (res.ok) {
        setShowRetakeModal(false);
        setRetakeReason("");
        fetchProctorData(false);
      } else {
        const json = await res.json();
        alert(json.error || "Gagal mengizinkan pengerjaan ulang.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Format event label
  const formatEventLabel = (type: string) => {
    switch (type) {
      case "focus_loss":
        return { label: "Fokus Jendela Hilang", color: "text-amber-800 bg-amber-50 border-amber-200" };
      case "visibility_change":
        return { label: "Pindah Tab / Minimize", color: "text-rose-800 bg-rose-50 border-rose-200" };
      case "fullscreen_exit":
        return { label: "Keluar Layar Penuh", color: "text-orange-800 bg-orange-50 border-orange-200" };
      case "screenshot_attempt":
        return { label: "Percobaan Screenshot", color: "text-purple-800 bg-purple-50 border-purple-200" };
      case "clipboard_copy":
        return { label: "Percobaan Salin Teks", color: "text-red-800 bg-red-50 border-red-200" };
      case "network_disconnect":
        return { label: "Koneksi Terputus", color: "text-slate-700 bg-slate-100 border-slate-200" };
      case "manual_warning":
        return { label: "Peringatan Pengawas", color: "text-amber-900 bg-amber-100 border-amber-300" };
      case "manual_block":
        return { label: "Kunci Sesi Pengawas", color: "text-rose-900 bg-rose-100 border-rose-300" };
      case "manual_unlock":
        return { label: "Buka Kunci Pengawas", color: "text-emerald-800 bg-emerald-50 border-emerald-200" };
      case "time_extended":
        return { label: "Perpanjangan Waktu", color: "text-blue-800 bg-blue-50 border-blue-200" };
      case "retake_granted":
        return { label: "Izin Kerjakan Ulang", color: "text-indigo-800 bg-indigo-50 border-indigo-200" };
      case "exam_submitted":
        return { label: "Ujian Selesai Dikumpulkan", color: "text-emerald-800 bg-emerald-50 border-emerald-200" };
      default:
        return { label: type, color: "text-slate-700 bg-slate-100 border-slate-200" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-600">
        <div className="w-10 h-10 border-3 border-[#65C443] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Menghubungkan ke Saluran Pengawasan Live...</p>
      </div>
    );
  }

  if (error === "unauthorized") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Akses Pengawas Diperlukan</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Sesi Anda saat ini tidak memiliki hak akses sebagai Guru atau Administrator pengawas. Pastikan Anda masuk dengan akun pengajar.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition cursor-pointer"
          >
            Kembali
          </button>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-[#0D274C] hover:bg-[#153a6f] text-white text-sm font-semibold transition cursor-pointer"
          >
            Masuk Akun Pengajar
          </Link>
        </div>
      </div>
    );
  }

  if (error && !examInfo) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Gagal Memuat Pengawasan Ujian</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition cursor-pointer"
          >
            Kembali
          </button>
          <button
            onClick={() => fetchProctorData(true)}
            className="px-4 py-2 rounded-xl bg-[#0D274C] hover:bg-[#153a6f] text-white text-sm font-semibold transition cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 truncate">
                  {examInfo?.title || "Live Pengawasan Ujian"}
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[#0D274C]/10 text-[#0D274C] border border-[#0D274C]/20">
                  {examInfo?.subject}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Durasi: {examInfo?.durationMinutes} Menit • Mode Integritas:{" "}
                <strong className="uppercase font-semibold">{examInfo?.policy?.mode || "Standard"}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Link
              href={`/teacher/examinations/${examId}/results`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition"
            >
              <Award className="w-3.5 h-3.5 text-purple-600" />
              <span>Rekap Nilai</span>
            </Link>

            {/* Live SSE indicator */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                sseConnected
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? "bg-[#65C443] animate-pulse" : "bg-rose-500"
                }`}
              />
              <span>{sseConnected ? "Live Terhubung (SSE)" : "Koneksi Terputus"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Exam Token Banner / Proctor Board */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0D274C] to-[#153a6f] text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <KeyRound className="w-6 h-6 text-[#65C443]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                  Token Ujian Pengawas Ruang (CBT)
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    examInfo?.policy?.tokenRequired
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                      : "bg-white/10 text-slate-300"
                  }`}
                >
                  {examInfo?.policy?.tokenRequired ? "Wajib Digunakan" : "Opsional / Nonaktif"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {examInfo?.policy?.tokenRequired
                  ? "Umumkan kode token di bawah kepada peserta ujian agar dapat membuka lembar soal."
                  : "Ujian ini saat ini tidak mewajibkan token. Anda dapat mengaktifkannya jika diperlukan."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
            {examInfo?.policy?.tokenRequired && examInfo?.policy?.globalToken ? (
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                <span className="font-mono text-2xl font-black tracking-widest text-[#65C443] select-all">
                  {examInfo.policy.globalToken}
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Salin Token"
                >
                  {tokenCopied ? (
                    <Check className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={openTokenModal}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#65C443]" />
              <span>{examInfo?.policy?.tokenRequired ? "Rilis Ulang / Ubah Token" : "Aktifkan Token Ujian"}</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium">Total Peserta</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium">Sedang Ujian</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.inProgress}</div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium">Peringatan</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.warning}</div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium">Terkunci (Hold)</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">{stats.blocked}</div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium">Terkumpul</div>
            <div className="text-2xl font-bold text-slate-700 mt-1">{stats.submitted}</div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium">Terputus / Idle</div>
            <div className="text-2xl font-bold text-slate-500 mt-1">{stats.disconnected}</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-xs text-xs">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === "all" ? "bg-[#0D274C] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter("attention")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === "attention"
                  ? "bg-amber-600 text-white"
                  : "text-amber-800 bg-amber-50 hover:bg-amber-100"
              }`}
            >
              Perlu Perhatian ({stats.warning + stats.blocked})
            </button>
            <button
              onClick={() => setStatusFilter("in_progress")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === "in_progress"
                  ? "bg-[#65C443] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Sedang Ujian ({stats.inProgress})
            </button>
            <button
              onClick={() => setStatusFilter("submitted")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === "submitted"
                  ? "bg-[#0D274C] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Selesai ({stats.submitted})
            </button>
            <button
              onClick={() => setStatusFilter("disconnected")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === "disconnected"
                  ? "bg-slate-700 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Terputus ({stats.disconnected})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari siswa, NIS, atau kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443]"
            />
          </div>
        </div>

        {/* 2-Column Layout: Grid of Students (Left) & Real-time Event Feed (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: Students Grid (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            {filteredRoster.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 shadow-xs">
                Tidak ada peserta yang cocok dengan kriteria filter saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredRoster.map((student) => {
                  const isBlocked = student.status === "blocked";
                  const isWarning = student.status === "warning";
                  const isDone = ["submitted", "completed", "grading_pending"].includes(student.status);

                  return (
                    <div
                      key={student.studentId}
                      className={`p-4 rounded-xl border bg-white shadow-xs transition-all flex flex-col justify-between space-y-3 ${
                        isBlocked
                          ? "border-rose-300 bg-rose-50/20 ring-1 ring-rose-200"
                          : isWarning
                          ? "border-amber-300 bg-amber-50/20 ring-1 ring-amber-200"
                          : isDone
                          ? "border-slate-200 opacity-80"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Student Card Top */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-xs truncate">
                              {student.studentName}
                            </h4>
                            <div className="text-[11px] text-slate-500 font-mono">
                              NIS: {student.nis || "-"} • {student.className}
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                student.connectionStatus === "connected"
                                  ? "bg-[#65C443]"
                                  : student.connectionStatus === "disconnected"
                                  ? "bg-slate-400"
                                  : "bg-slate-300"
                              }`}
                              title={`Koneksi: ${student.connectionStatus}`}
                            />
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                isBlocked
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : isWarning
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : isDone
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : student.status === "in_progress"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {isBlocked
                                ? "Terkunci"
                                : isWarning
                                ? "Peringatan"
                                : isDone
                                ? "Selesai"
                                : student.status === "in_progress"
                                ? "Sedang Ujian"
                                : "Belum Mulai"}
                            </span>
                          </div>
                        </div>

                        {/* Middle stats */}
                        <div className="mt-3 grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                          <div>
                            <div className="text-[10px] text-slate-400">Terjawab</div>
                            <div className="font-bold text-slate-800">{student.answeredCount} Soal</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Ragu-ragu</div>
                            <div className="font-bold text-orange-600">{student.doubtfulCount}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Insiden</div>
                            <div
                              className={`font-bold ${
                                student.incidentCount > 0 ? "text-rose-600" : "text-emerald-700"
                              }`}
                            >
                              {student.incidentCount}x
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                        {isBlocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(student);
                              setUnlockNote("");
                              setResetIncidentCount(true);
                              setShowUnlockModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Buka Kunci</span>
                          </button>
                        ) : isDone ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(student);
                              setRetakeMode("reset_answers");
                              setRetakeMinutes(examInfo?.durationMinutes || 90);
                              setRetakeReason("");
                              setShowRetakeModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                            title="Berikan izin bagi siswa ini untuk mengerjakan ulang ujian"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Kerjakan Ulang</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(student);
                                setWarnNote("");
                                setShowWarnModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 text-[11px] font-semibold transition cursor-pointer"
                              title="Kirim catatan peringatan manual"
                            >
                              Peringatkan
                            </button>

                            <button
                              type="button"
                              onClick={() => handleBlockStudent(student)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-900 border border-slate-200 text-[11px] font-semibold transition cursor-pointer"
                              title="Kunci sesi ujian siswa"
                            >
                              Kunci Sesi
                            </button>
                          </>
                        )}

                        {!isDone && !isBlocked && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(student);
                              setAdditionalMinutes(10);
                              setExtendReason("");
                              setShowExtendTimeModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 border border-slate-200 text-[11px] font-semibold transition cursor-pointer"
                            title="Tambahkan waktu pengerjaan"
                          >
                            + Waktu
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Live Event Feed (1 Col) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col space-y-3 h-[680px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#65C443] animate-pulse" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Log Integritas Real-Time
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {eventLogs.length} Aktivitas
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {eventLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs italic">
                  Belum ada aktivitas integritas atau insiden tercatat.
                </div>
              ) : (
                eventLogs.map((evt) => {
                  const badge = formatEventLabel(evt.eventType);
                  const timeStr = new Date(evt.timestamp).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <div
                      key={evt.id}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 space-y-1 text-xs transition-colors hover:bg-slate-100"
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-slate-900 truncate">
                          {evt.studentName}
                        </span>
                        <span className="text-slate-400 font-mono shrink-0">{timeStr}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        {evt.actorName && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Oleh: {evt.actorName}
                          </span>
                        )}
                      </div>

                      {evt.interventionNote && (
                        <p className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1">
                          "{evt.interventionNote}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL 1: PERINGATAN MANUAL */}
      {showWarnModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Beri Peringatan Manual</h3>
                <p className="text-xs text-slate-500">
                  Kirim peringatan langsung ke layar siswa <strong>{selectedStudent.studentName}</strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleSendWarning} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-medium">Catatan / Alasan Peringatan</label>
                <textarea
                  rows={3}
                  value={warnNote}
                  onChange={(e) => setWarnNote(e.target.value)}
                  placeholder="Contoh: Harap fokus menatap layar dan tidak menengok ke kanan/kiri."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWarnModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold shadow-sm transition cursor-pointer"
                >
                  {submittingAction ? "Mengirim..." : "Kirim Peringatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BUKA KUNCI SESI (UNLOCK) */}
      {showUnlockModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Unlock className="w-5 h-5 text-[#65C443]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Buka Kunci Sesi Ujian</h3>
                <p className="text-xs text-slate-500">
                  Buka penangguhan sesi siswa <strong>{selectedStudent.studentName}</strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveUnlock} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-medium">
                  Alasan Pembukaan Kunci (Wajib diisi) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={unlockNote}
                  onChange={(e) => setUnlockNote(e.target.value)}
                  placeholder="Contoh: Siswa telah diperiksa dan berjanji tidak mengulangi; kendala teknis pada browser."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={resetIncidentCount}
                    onChange={(e) => setResetIncidentCount(e.target.checked)}
                    className="rounded accent-[#65C443] cursor-pointer"
                  />
                  <span className="font-semibold text-slate-800">
                    Reset Jumlah Insiden ke 0
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1 pl-5">
                  Centang opsi ini jika pelanggaran sebelumnya dianggap selesai dan siswa diberi kesempatan penuh kembali.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-bold shadow-sm transition cursor-pointer"
                >
                  {submittingAction ? "Membuka..." : "Buka Kunci Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH WAKTU (EXTEND TIME) */}
      {showExtendTimeModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Perpanjang Waktu Ujian</h3>
                <p className="text-xs text-slate-500">
                  Tambahkan menit pengerjaan untuk <strong>{selectedStudent.studentName}</strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveExtendTime} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-medium">
                  Tambahan Waktu (Menit) *
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setAdditionalMinutes(mins)}
                      className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                        additionalMinutes === mins
                          ? "bg-[#0D274C] text-white border-[#0D274C]"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      }`}
                    >
                      +{mins} m
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={additionalMinutes}
                  onChange={(e) => setAdditionalMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full mt-2 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Alasan Penambahan Waktu</label>
                <input
                  type="text"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Contoh: Kendala perangkat sempat restart / gangguan jaringan."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExtendTimeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-bold shadow-sm transition cursor-pointer"
                >
                  {submittingAction ? "Menyimpan..." : "Simpan Tambahan Waktu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: IZINKAN KERJAKAN ULANG (RETAKE) */}
      {showRetakeModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Izinkan Kerjakan Ulang Ujian</h3>
                <p className="text-xs text-slate-500">
                  Peserta: <strong>{selectedStudent.studentName}</strong> (NIS: {selectedStudent.nis || "-"}) • {selectedStudent.className}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRetake} className="space-y-4 text-xs">
              {/* Pilihan Opsi Lembar Jawaban */}
              <div>
                <label className="block text-slate-700 mb-1.5 font-semibold">
                  Opsi Lembar Jawaban Siswa *
                </label>
                <div className="space-y-2">
                  <label
                    onClick={() => setRetakeMode("reset_answers")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      retakeMode === "reset_answers"
                        ? "bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-200"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="retake_mode"
                      checked={retakeMode === "reset_answers"}
                      onChange={() => setRetakeMode("reset_answers")}
                      className="mt-0.5 accent-indigo-600 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Mulai Baru (Kosongkan Jawaban)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Seluruh lembar jawaban dan nilai sebelumnya akan dihapus bersih. Siswa mengerjakan ulang dari awal.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setRetakeMode("keep_answers")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      retakeMode === "keep_answers"
                        ? "bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-200"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="retake_mode"
                      checked={retakeMode === "keep_answers"}
                      onChange={() => setRetakeMode("keep_answers")}
                      className="mt-0.5 accent-indigo-600 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Pertahankan Jawaban (Lanjutkan / Perbaiki)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Jawaban yang telah diisi sebelumnya tetap tersimpan ({selectedStudent.answeredCount} butir). Siswa dapat melanjutkan menjawab soal yang belum selesai.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Durasi Waktu */}
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Alokasi Waktu Pengerjaan Ulang (Menit) *
                </label>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {[15, 30, 45, 60, examInfo?.durationMinutes || 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setRetakeMinutes(mins)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                        retakeMinutes === mins
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      }`}
                    >
                      {mins === (examInfo?.durationMinutes || 90) ? `${mins} m (Penuh)` : `${mins} m`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={retakeMinutes}
                  onChange={(e) => setRetakeMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold"
                />
              </div>

              {/* Alasan / Catatan */}
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Catatan / Alasan Pengawas (Opsional)
                </label>
                <input
                  type="text"
                  value={retakeReason}
                  onChange={(e) => setRetakeReason(e.target.value)}
                  placeholder="Contoh: Siswa salah klik kumpul lebih awal / izin remedial."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRetakeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{submittingAction ? "Memproses..." : "Izinkan Kerjakan Ulang"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* MODAL: MANAJEMEN / RILIS TOKEN UJIAN                     */}
      {/* ========================================================= */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                <span>Pengaturan Token Ujian</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Token ini digunakan siswa untuk membuka atau memulai lembar ujian pada aplikasi peserta CBT.
            </p>

            <div className="space-y-4 pt-1">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tokenRequiredInput}
                  onChange={(e) => setTokenRequiredInput(e.target.checked)}
                  className="rounded accent-[#65C443] w-4 h-4 cursor-pointer"
                />
                <span>Wajibkan Siswa Memasukkan Token Ujian</span>
              </label>

              {tokenRequiredInput && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kode Token Ujian (Maks. 10 Karakter)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={(e) =>
                        setTokenInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                      }
                      placeholder="Contoh: NEX9KT"
                      maxLength={10}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono tracking-widest text-center text-base font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateToken(true)}
                      disabled={tokenSubmitting}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shrink-0 transition cursor-pointer shadow-xs flex items-center gap-1.5"
                      title="Generate dan Langsung Simpan Token Baru Acak"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Acak Baru</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    Klik <strong>Acak Baru</strong> untuk merilis token acak otomatis ke seluruh ruang ujian.
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateToken(false)}
                  disabled={tokenSubmitting || (tokenRequiredInput && !tokenInput.trim())}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{tokenSubmitting ? "Menyimpan..." : "Simpan Token"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
