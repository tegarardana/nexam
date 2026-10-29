"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Users,
  ShieldAlert,
  KeyRound,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Layers,
} from "lucide-react";

interface MajorItem {
  id: string;
  name: string;
  code: string;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  majorId?: string | null;
  major?: { id: string; name: string; code: string } | null;
}

interface AcademicYearItem {
  id: string;
  name: string;
  status?: string;
}

interface SemesterItem {
  id: string;
  name: string;
  status?: string;
  academicYearId?: string;
}

interface ClassItem {
  id: string;
  name: string;
  gradeLevel?: number;
  academicYearId?: string;
  majorId?: string | null;
  major?: { id: string; name: string; code: string } | null;
}

interface CreateExaminationFormProps {
  backUrl: string;
  userRole: "administrator" | "teacher";
  subjects: SubjectItem[];
  academicYears: AcademicYearItem[];
  semesters: SemesterItem[];
  classes: ClassItem[];
  majors?: MajorItem[];
  teachers?: any[];
  currentTeacherId?: string;
  activeYearId?: string | null;
}

export default function CreateExaminationForm({
  backUrl,
  userRole,
  subjects,
  academicYears,
  semesters,
  classes,
  majors = [],
  teachers = [],
  currentTeacherId = "",
  activeYearId = null,
}: CreateExaminationFormProps) {
  const router = useRouter();
  const isAdmin = userRole === "administrator";

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState(currentTeacherId || "");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [academicYearId, setAcademicYearId] = useState(
    activeYearId || academicYears[0]?.id || ""
  );
  const [semesterId, setSemesterId] = useState(
    semesters.find((s) => s.status === "active")?.id || semesters[0]?.id || ""
  );
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [passingScore, setPassingScore] = useState(75);

  // Date & Session State (Replaces cumbersome datetime-local)
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

  // Examination Type & Question Bank
  const [examinationTypes, setExaminationTypes] = useState<any[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [examinationTypeId, setExaminationTypeId] = useState<string>("");

  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [questionBankId, setQuestionBankId] = useState<string>("");

  // Participants (Classes) & Filters (Major & Grade Level)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const initialSubject = subjects.find((s) => s.id === subjectId);
  const [selectedMajorFilter, setSelectedMajorFilter] = useState<string>(
    initialSubject?.majorId || "all"
  );
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<number | "all">("all");

  // When subject changes, automatically update class major filter to match subject's major
  useEffect(() => {
    const subj = subjects.find((s) => s.id === subjectId);
    if (subj?.majorId) {
      setSelectedMajorFilter(subj.majorId);
    } else {
      setSelectedMajorFilter("all");
    }
  }, [subjectId, subjects]);

  // Anti-Cheat & Policy
  const [polRandomizeQ, setPolRandomizeQ] = useState(true);
  const [polRandomizeOpt, setPolRandomizeOpt] = useState(true);
  const [polMaxTabSwitches, setPolMaxTabSwitches] = useState(3);
  const [polFullScreen, setPolFullScreen] = useState(true);
  const [polBlockViolation, setPolBlockViolation] = useState(true);
  const [polTokenReq, setPolTokenReq] = useState(false);
  const [polGlobalToken, setPolGlobalToken] = useState("");

  // Submission State
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Helper to generate 6-character random token
  const generateRandomToken = (len = 6) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let res = "";
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // Fetch Examination Types
  useEffect(() => {
    setLoadingTypes(true);
    fetch("/api/examinations/types")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setExaminationTypes(json.data);
        }
      })
      .catch((err) => console.error("Gagal memuat tipe ujian:", err))
      .finally(() => setLoadingTypes(false));
  }, []);

  // Fetch Examination Sessions
  useEffect(() => {
    setLoadingSessions(true);
    fetch("/api/examinations/sessions")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setSessions(json.data);
          if (json.data.length > 0 && !sessionId) {
            setSessionId(json.data[0].id);
          }
        }
      })
      .catch((err) => console.error("Gagal memuat sesi ujian:", err))
      .finally(() => setLoadingSessions(false));
  }, []);

  // Fetch Question Banks whenever selected subject changes
  useEffect(() => {
    if (subjectId) {
      setLoadingBanks(true);
      fetch(`/api/question-banks?subjectId=${subjectId}`)
        .then((res) => res.json())
        .then((json) => {
          const list = Array.isArray(json) ? json : (json.data || []);
          setAvailableBanks(list);
        })
        .catch(() => setAvailableBanks([]))
        .finally(() => setLoadingBanks(false));
    } else {
      setAvailableBanks([]);
    }
  }, [subjectId]);

  // Keep endDate synced if user picks startDate later than endDate
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (!endDate || endDate < val) {
      setEndDate(val);
    }
  };

  // Selected session & subject helpers
  const selectedSession = sessions.find((s) => s.id === sessionId);
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // Available grade levels extracted from classes
  const availableGradeLevels = React.useMemo(() => {
    const grades = new Set<number>();
    classes.forEach((c) => {
      if (typeof c.gradeLevel === "number" && c.gradeLevel > 0) {
        grades.add(c.gradeLevel);
      } else {
        const trimmed = c.name.trim().toUpperCase();
        if (trimmed.startsWith("X ") || trimmed.startsWith("X-") || trimmed.startsWith("10 ") || trimmed.startsWith("10-")) grades.add(10);
        else if (trimmed.startsWith("XI ") || trimmed.startsWith("XI-") || trimmed.startsWith("11 ") || trimmed.startsWith("11-")) grades.add(11);
        else if (trimmed.startsWith("XII ") || trimmed.startsWith("XII-") || trimmed.startsWith("12 ") || trimmed.startsWith("12-")) grades.add(12);
        else if (trimmed.startsWith("XIII ") || trimmed.startsWith("XIII-") || trimmed.startsWith("13 ") || trimmed.startsWith("13-")) grades.add(13);
      }
    });
    const arr = Array.from(grades).sort((a, b) => a - b);
    return arr.length > 0 ? arr : [10, 11, 12];
  }, [classes]);

  // Filtered Question Banks based on selectedGradeFilter
  const filteredAvailableBanks = React.useMemo(() => {
    if (selectedGradeFilter === "all") return availableBanks;
    return availableBanks.filter((b) => b.gradeLevel === Number(selectedGradeFilter));
  }, [availableBanks, selectedGradeFilter]);

  // If selected question bank does not match the chosen grade level, reset selection
  useEffect(() => {
    if (questionBankId && selectedGradeFilter !== "all") {
      const match = availableBanks.find((b) => b.id === questionBankId);
      if (match && match.gradeLevel !== Number(selectedGradeFilter)) {
        setQuestionBankId("");
      }
    }
  }, [selectedGradeFilter, questionBankId, availableBanks]);

  // Match class grade helper
  const matchClassGrade = (c: ClassItem, gradeFilter: number | "all") => {
    if (gradeFilter === "all") return true;
    if (c.gradeLevel === gradeFilter) return true;
    const trimmed = c.name.trim().toUpperCase();
    if (gradeFilter === 10 && (trimmed.startsWith("X ") || trimmed.startsWith("X-") || trimmed.startsWith("10 ") || trimmed.startsWith("10-"))) return true;
    if (gradeFilter === 11 && (trimmed.startsWith("XI ") || trimmed.startsWith("XI-") || trimmed.startsWith("11 ") || trimmed.startsWith("11-"))) return true;
    if (gradeFilter === 12 && (trimmed.startsWith("XII ") || trimmed.startsWith("XII-") || trimmed.startsWith("12 ") || trimmed.startsWith("12-"))) return true;
    if (gradeFilter === 13 && (trimmed.startsWith("XIII ") || trimmed.startsWith("XIII-") || trimmed.startsWith("13 ") || trimmed.startsWith("13-"))) return true;
    return false;
  };

  // Displayed classes filtered by both major and grade level
  const displayedClasses = classes.filter((c) => {
    const matchMajor =
      selectedMajorFilter === "all" || c.majorId === selectedMajorFilter;
    const matchGrade = matchClassGrade(c, selectedGradeFilter);
    return matchMajor && matchGrade;
  });

  const isAllDisplayedSelected =
    displayedClasses.length > 0 &&
    displayedClasses.every((c) => selectedClassIds.includes(c.id));

  const toggleSelectAllDisplayed = () => {
    if (isAllDisplayedSelected) {
      const displayedIds = new Set(displayedClasses.map((c) => c.id));
      setSelectedClassIds(selectedClassIds.filter((id) => !displayedIds.has(id)));
    } else {
      const combined = Array.from(
        new Set([...selectedClassIds, ...displayedClasses.map((c) => c.id)])
      );
      setSelectedClassIds(combined);
    }
  };

  // Filter semesters by selected academic year
  const filteredSemesters = semesters.filter(
    (s) => !s.academicYearId || s.academicYearId === academicYearId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("Judul ujian wajib diisi");
      return;
    }
    if (!startDate) {
      setErrorMsg("Tanggal mulai ujian wajib diisi");
      return;
    }
    if (!endDate) {
      setErrorMsg("Tanggal selesai ujian wajib diisi");
      return;
    }
    if (endDate < startDate) {
      setErrorMsg("Tanggal selesai tidak boleh sebelum tanggal mulai");
      return;
    }

    // Determine start and end time based on selected session
    const startTimeStr = selectedSession?.startTime || "07:30";
    const endTimeStr = selectedSession?.endTime || "09:30";

    const formattedStartStr = `${startDate}T${startTimeStr.length === 5 ? startTimeStr + ":00" : startTimeStr}`;
    let startDateTime = new Date(formattedStartStr);

    let endDateTime: Date;
    if (selectedSession?.endTime) {
      const formattedEndStr = `${endDate}T${endTimeStr.length === 5 ? endTimeStr + ":00" : endTimeStr}`;
      endDateTime = new Date(formattedEndStr);
      // Safety check: if endDateTime is not after startDateTime, add duration
      if (endDateTime <= startDateTime) {
        endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
      }
    } else {
      endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      subjectId: subjectId || null,
      examinationTypeId: examinationTypeId || undefined,
      sessionId: sessionId || undefined,
      questionBankId: questionBankId || undefined,
      academicYearId,
      semesterId: semesterId || semesters[0]?.id,
      durationMinutes: Number(durationMinutes),
      passingScore: Number(passingScore),
      scheduledStart: startDateTime.toISOString(),
      scheduledEnd: endDateTime.toISOString(),
      teacherId: isAdmin && teacherId ? teacherId : undefined,
      policySettings: {
        randomizeQuestions: polRandomizeQ,
        randomizeOptions: polRandomizeOpt,
        maxTabSwitches: Number(polMaxTabSwitches),
        fullScreenRequired: polFullScreen,
        blockOnViolation: polBlockViolation,
        tokenRequired: polTokenReq,
        globalToken: polTokenReq ? polGlobalToken || undefined : undefined,
      },
      classGroupIds: selectedClassIds.length > 0 ? selectedClassIds : undefined,
    };

    try {
      const res = await fetch("/api/examinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || "Gagal membuat jadwal ujian");
        setSaving(false);
        return;
      }

      // Redirect back to schedule management
      router.push(backUrl);
      router.refresh();
    } catch (err: any) {
      console.error("Submit error:", err);
      setErrorMsg(err.message || "Terjadi kesalahan server saat menyimpan ujian");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Navbar / Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={backUrl}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
              title="Kembali ke Manajemen Ujian"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Buat Jadwal Pelaksanaan Ujian
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={backUrl}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
            >
              Batal
            </Link>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Jadwal (Draft)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-3 shadow-xs animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: INFORMASI UTAMA & PENANGGUNG JAWAB */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    1. Identitas & Penanggung Jawab Ujian
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tentukan nama paket ujian, guru pengampu, serta periode akademik.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Judul Ujian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Asesmen Sumatif Akhir Semester (ASAS) Ganjil - Matematika"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Deskripsi / Petunjuk Pelaksanaan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Catatan tambahan untuk proktor atau instruksi khusus untuk siswa..."
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] transition"
                />
              </div>

              {isAdmin && (
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Guru Pengampu / Penanggung Jawab Ujian
                  </label>
                  <select
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition"
                  >
                    <option value="">-- Tetapkan Administrator Sebagai Penanggung Jawab --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.displayName || t.name || t.fullName || t.username} ({t.nip || t.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Administrator dapat mendelegasikan paket ujian ini ke guru mata pelajaran terkait.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Tahun Ajaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.status === "active" ? "(Aktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Semester <span className="text-rose-500">*</span>
                </label>
                <select
                  value={semesterId}
                  onChange={(e) => setSemesterId(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition"
                >
                  {filteredSemesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.status === "active" ? "(Aktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: MAPEL, JENIS UJIAN, BANK SOAL & DURASI */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 text-[#65C443]">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  2. Mata Pelajaran, Jenis Ujian & Bank Soal
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih mata pelajaran, tipe ujian, serta kaitkan bank soal yang sudah dibuat.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setQuestionBankId("");
                  }}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Tingkat / Level Target
                </label>
                <select
                  value={selectedGradeFilter}
                  onChange={(e) => {
                    const val = e.target.value === "all" ? "all" : Number(e.target.value);
                    setSelectedGradeFilter(val);
                  }}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition font-medium"
                >
                  <option value="all">Semua Tingkat (10, 11, 12)</option>
                  {availableGradeLevels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Tingkat {lvl} ({lvl === 10 ? "X" : lvl === 11 ? "XI" : lvl === 12 ? "XII" : `${lvl}`})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Menyaring bank soal & rombel
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Jenis / Tipe Ujian
                </label>
                <select
                  value={examinationTypeId}
                  onChange={(e) => setExaminationTypeId(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition"
                >
                  <option value="">-- Pilih Jenis Ujian --</option>
                  {examinationTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.code}] {t.name}
                    </option>
                  ))}
                </select>
                {loadingTypes && (
                  <span className="text-[11px] text-slate-400 mt-1 block">Memuat tipe ujian...</span>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Durasi Pengerjaan <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="480"
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-medium">
                    Menit
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Gunakan Bank Soal (Impor Otomatis)
                </label>
                <select
                  value={questionBankId}
                  onChange={(e) => setQuestionBankId(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition"
                >
                  <option value="">-- Pilih Nanti / Tanpa Bank Soal Otomatis --</option>
                  {filteredAvailableBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      [Tingkat {b.gradeLevel}] {b.title} ({b.code}) • {b.actualQuestionsCount ?? b.questions?.length ?? b._count?.questions ?? b.totalQuestions ?? 0} Soal
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {loadingBanks
                    ? "Memuat daftar bank soal untuk mata pelajaran terpilih..."
                    : questionBankId
                    ? "Seluruh butir soal aktif dari bank soal terpilih akan langsung dikaitkan ke ujian ini."
                    : filteredAvailableBanks.length === 0
                    ? selectedGradeFilter !== "all"
                      ? `Belum ada bank soal Tingkat ${selectedGradeFilter} pada mata pelajaran ini.`
                      : "Belum ada bank soal pada mata pelajaran ini. Anda dapat menambahkan soal secara manual nanti."
                    : selectedGradeFilter !== "all"
                    ? `Menampilkan ${filteredAvailableBanks.length} bank soal khusus Tingkat ${selectedGradeFilter}.`
                    : "Pilih bank soal yang ingin langsung digunakan untuk jadwal ujian ini."}
                </p>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Nilai KKM (Passing Score)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-medium">
                    / 100
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: TANGGAL & SESI UJIAN (USER'S EXPLICIT REQUEST) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    3. Jadwal Pelaksanaan & Sesi Ujian
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tentukan tanggal pelaksanaan ujian serta pilih master sesi waktu yang digunakan.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Tanggal Mulai Ujian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Tanggal Selesai / Expired <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Pilih Sesi Ujian (Master Sesi)
                </label>
                <select
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#65C443] transition font-medium"
                >
                  <option value="">-- Tanpa Sesi Tertentu --</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) • {s.startTime || "--:--"} - {s.endTime || "--:--"} WIB
                    </option>
                  ))}
                </select>
                {loadingSessions && (
                  <span className="text-[11px] text-slate-400 mt-1 block">Memuat sesi...</span>
                )}
              </div>
            </div>

            {/* Session Preview Info Banner */}
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-semibold">
                    {selectedSession
                      ? `Sesi Terpilih: ${selectedSession.name} (${selectedSession.code})`
                      : "Sesi Belum Dipilih"}
                  </span>
                  <div className="text-[11px] text-indigo-700 mt-0.5">
                    {selectedSession
                      ? `Jam Pelaksanaan: ${selectedSession.startTime || "--:--"} s/d ${selectedSession.endTime || "--:--"} WIB`
                      : "Pilih opsi sesi di atas untuk menentukan jam mulai dan akhir ujian secara otomatis."}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-indigo-600 font-mono bg-white/80 px-2.5 py-1 rounded-lg border border-indigo-200/60 shrink-0">
                {startDate === endDate
                  ? `Tanggal: ${startDate}`
                  : `Periode: ${startDate} s/d ${endDate}`}
              </div>
            </div>
          </div>

          {/* SECTION 4: TARGET ROMBEL / KELAS PESERTA */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    4. Target Rombongan Belajar / Kelas Peserta
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pilih kelas yang diwajibkan mengikuti jadwal ujian ini.
                  </p>
                </div>
              </div>
              {displayedClasses.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllDisplayed}
                  className="text-xs text-[#0D274C] hover:underline font-semibold cursor-pointer"
                >
                  {isAllDisplayedSelected
                    ? selectedMajorFilter === "all" && selectedGradeFilter === "all"
                      ? "Batal Pilih Semua"
                      : "Batal Pilih Kelas Ini"
                    : selectedMajorFilter === "all" && selectedGradeFilter === "all"
                    ? "Pilih Semua Kelas"
                    : "Pilih Semua Kelas Terfilter"}
                </button>
              )}
            </div>

            {/* Filter Bar: Tingkat / Level Kelas & Jurusan */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              {/* Row 1: Tingkat / Level Kelas Filter Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0D274C] shrink-0" />
                  <span className="text-xs font-bold text-slate-800">Tingkat / Level Kelas:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedGradeFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      selectedGradeFilter === "all"
                        ? "bg-[#0D274C] text-white shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    Semua Tingkat
                  </button>
                  {availableGradeLevels.map((lvl) => {
                    const roman =
                      lvl === 10
                        ? "X"
                        : lvl === 11
                        ? "XI"
                        : lvl === 12
                        ? "XII"
                        : lvl === 13
                        ? "XIII"
                        : `${lvl}`;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSelectedGradeFilter(lvl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          selectedGradeFilter === lvl
                            ? "bg-[#0D274C] text-white shadow-xs"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        Kelas {lvl} ({roman})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Jurusan / Program Keahlian */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    {selectedSubject?.major ? (
                      <span className="text-xs text-slate-700">
                        Mapel Kejuruan:{" "}
                        <strong className="text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300/60 font-semibold">
                          {selectedSubject.major.name} ({selectedSubject.major.code})
                        </strong>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600 font-medium">
                        Mapel Umum (Lintas Jurusan)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600 font-medium shrink-0">Filter Jurusan:</span>
                  <select
                    value={selectedMajorFilter}
                    onChange={(e) => setSelectedMajorFilter(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-[#65C443] shadow-2xs"
                  >
                    {selectedSubject?.major && (
                      <option value={selectedSubject.majorId || ""}>
                        Hanya {selectedSubject.major.code} (Sesuai Mapel)
                      </option>
                    )}
                    <option value="all">Semua Jurusan ({classes.length} Kelas)</option>
                    {majors
                      ?.filter((m) => m.id !== selectedSubject?.majorId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          Jurusan {m.name} ({m.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {classes.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                Belum ada rombel/kelas yang terdaftar pada sistem.
              </p>
            ) : displayedClasses.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-xs text-slate-500">
                  Tidak ada rombel/kelas yang terdaftar untuk kombinasi tingkat kelas & jurusan terpilih.
                </p>
                <div className="flex items-center justify-center gap-3">
                  {selectedGradeFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setSelectedGradeFilter("all")}
                      className="text-xs text-[#0D274C] hover:underline font-semibold cursor-pointer"
                    >
                      Reset Tingkat (Semua Tingkat)
                    </button>
                  )}
                  {selectedMajorFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setSelectedMajorFilter("all")}
                      className="text-xs text-[#0D274C] hover:underline font-semibold cursor-pointer"
                    >
                      Reset Jurusan (Semua Jurusan)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1 max-h-52 overflow-y-auto pr-1">
                {displayedClasses.map((c) => {
                  const isChecked = selectedClassIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                        isChecked
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedClassIds(selectedClassIds.filter((id) => id !== c.id));
                            } else {
                              setSelectedClassIds([...selectedClassIds, c.id]);
                            }
                          }}
                          className="rounded accent-[#65C443] w-4 h-4 shrink-0"
                        />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.gradeLevel && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            Kls {c.gradeLevel}
                          </span>
                        )}
                        {c.major && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {c.major.code}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-slate-100">
              <span>
                <strong>{selectedClassIds.length}</strong> kelas dipilih untuk jadwal ini.
              </span>
              <span>
                Menampilkan <strong>{displayedClasses.length}</strong> dari <strong>{classes.length}</strong> total rombel terdaftar.
              </span>
            </div>
          </div>

          {/* SECTION 5: KEBIJAKAN ANTI-CHEAT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  5. Kebijakan Anti-Cheat & Integritas Ujian
                </h2>
                <p className="text-xs text-slate-500">
                  Konfigurasikan perlindungan integritas selama siswa mengerjakan ujian.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200 cursor-pointer font-medium hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={polRandomizeQ}
                  onChange={(e) => setPolRandomizeQ(e.target.checked)}
                  className="rounded accent-[#65C443] w-4 h-4"
                />
                <div>
                  <div className="font-semibold text-slate-900">Acak Urutan Butir Soal</div>
                  <div className="text-[11px] text-slate-500">
                    Setiap siswa akan menerima susunan nomor soal yang berbeda.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200 cursor-pointer font-medium hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={polRandomizeOpt}
                  onChange={(e) => setPolRandomizeOpt(e.target.checked)}
                  className="rounded accent-[#65C443] w-4 h-4"
                />
                <div>
                  <div className="font-semibold text-slate-900">Acak Opsi Pilihan Ganda</div>
                  <div className="text-[11px] text-slate-500">
                    Pilihan jawaban A, B, C, D diacak secara independen tiap siswa.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200 cursor-pointer font-medium hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={polFullScreen}
                  onChange={(e) => setPolFullScreen(e.target.checked)}
                  className="rounded accent-[#65C443] w-4 h-4"
                />
                <div>
                  <div className="font-semibold text-slate-900">Layar Penuh Wajib (Full Screen)</div>
                  <div className="text-[11px] text-slate-500">
                    Siswa dipaksa berada dalam mode layar penuh selama pengerjaan.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200 cursor-pointer font-medium hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={polBlockViolation}
                  onChange={(e) => setPolBlockViolation(e.target.checked)}
                  className="rounded accent-[#65C443] w-4 h-4"
                />
                <div>
                  <div className="font-semibold text-slate-900">Kunci Saat Batas Tab Habis</div>
                  <div className="text-[11px] text-slate-500">
                    Ujian terkunci otomatis jika siswa melanggar batas perpindahan tab ({polMaxTabSwitches}x).
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* SECTION 6: TOKEN CBT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    6. Konfigurasi Token Akses CBT
                  </h2>
                  <p className="text-xs text-slate-500">
                    Wajibkan token sebelum siswa dapat mulai mengerjakan lembar ujian.
                  </p>
                </div>
              </div>
              {polTokenReq && (
                <button
                  type="button"
                  onClick={() => setPolGlobalToken(generateRandomToken(6))}
                  className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1.5 cursor-pointer bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Acak Token Baru</span>
                </button>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={polTokenReq}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPolTokenReq(checked);
                    if (checked && !polGlobalToken) {
                      setPolGlobalToken(generateRandomToken(6));
                    }
                  }}
                  className="rounded accent-[#65C443] w-4 h-4"
                />
                <span>Wajibkan Siswa Memasukkan Token Ujian</span>
              </label>

              {polTokenReq && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-2 animate-in fade-in">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                      Kode Token Ujian (6 Karakter) *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required={polTokenReq}
                        maxLength={10}
                        value={polGlobalToken}
                        onChange={(e) =>
                          setPolGlobalToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                        }
                        placeholder="Contoh: NEX9KT"
                        className="w-full bg-white border border-teal-300 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest text-slate-900 font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                      <button
                        type="button"
                        onClick={() => setPolGlobalToken(generateRandomToken(6))}
                        className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shrink-0 transition cursor-pointer shadow-xs"
                      >
                        Acak
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed sm:pt-4">
                    Siswa tidak dapat memulai ujian sebelum memasukkan token ini pada layar konfirmasi.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={backUrl}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Jadwal Ujian (Draft)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
