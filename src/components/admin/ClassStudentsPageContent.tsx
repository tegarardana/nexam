"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  UserCheck,
  Search,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronRight,
  Filter,
  Layers,
  Save,
  UserPlus,
  Trash2,
  ArrowRight,
  CheckSquare,
  Square,
  Briefcase,
  Hash,
} from "lucide-react";
import * as XLSX from "xlsx";

interface ClassStudentsPageContentProps {
  initialClassId: string;
}

export default function ClassStudentsPageContent({ initialClassId }: ClassStudentsPageContentProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classData, setClassData] = useState<any>(null);

  // Tabs: "roster" (Daftar & Penempatan Siswa) vs "bulk" (Update Data Sekelas)
  const [activeTab, setActiveTab] = useState<"roster" | "bulk">("roster");

  // Roster & Unassigned State
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [searchRoster, setSearchRoster] = useState("");
  const [searchUnassigned, setSearchUnassigned] = useState("");
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<string[]>([]);
  const [selectedEnrolledIdsToRemove, setSelectedEnrolledIdsToRemove] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [statusActionMessage, setStatusActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Bulk Update State
  const [bulkStudents, setBulkStudents] = useState<any[]>([]);
  const [bulkUniformPassword, setBulkUniformPassword] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  // Fetch Class & Enrollments
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const resClass = await fetch(`/api/academic/classes/${initialClassId}`);
      const jsonClass = await resClass.json();
      if (!resClass.ok || !jsonClass.success) {
        throw new Error(jsonClass.error || "Gagal memuat data kelas");
      }
      setClassData(jsonClass.data);

      // Fetch enrollments and unassigned students
      const [resE, resU] = await Promise.all([
        fetch(`/api/academic/enrollments?classGroupId=${initialClassId}`),
        fetch(`/api/academic/enrollments?unassigned=true&academicYearId=${jsonClass.data.academicYear?.id || ""}`),
      ]);

      const jsonE = await resE.json();
      const jsonU = await resU.json();

      if (jsonE.success) {
        setEnrollments(jsonE.data || []);
        // Prepare bulk students list
        const initialBulk = (jsonE.data || []).map((e: any) => ({
          enrollmentId: e.id,
          id: e.student.id,
          displayName: e.student.displayName,
          username: e.student.username,
          nis: e.student.nis || "",
          nisn: e.student.nisn || "",
          rawPassword: e.student.rawPassword || "-",
          newPassword: "",
          isActive: e.student.isActive ?? true,
        }));
        setBulkStudents(initialBulk);
      }

      if (jsonU.success) {
        setUnassignedStudents(jsonU.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [initialClassId]);

  // Batch Assign Unassigned Students to this Class
  const handleAssignSelectedStudents = async () => {
    if (selectedUnassignedIds.length === 0 || !classData) return;
    setAssignLoading(true);
    setStatusActionMessage(null);
    try {
      const res = await fetch("/api/academic/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_enroll",
          classGroupId: classData.id,
          academicYearId: classData.academicYear?.id,
          studentIds: selectedUnassignedIds,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setStatusActionMessage({ type: "success", text: `${selectedUnassignedIds.length} siswa berhasil ditempatkan ke kelas ${classData.name}!` });
        setSelectedUnassignedIds([]);
        fetchAllData();
      } else {
        setStatusActionMessage({ type: "error", text: json.error || "Gagal menempatkan siswa." });
      }
    } catch {
      setStatusActionMessage({ type: "error", text: "Terjadi gangguan koneksi jaringan." });
    } finally {
      setAssignLoading(false);
    }
  };

  // Batch Remove Students from this Class
  const handleRemoveSelectedStudents = async () => {
    if (selectedEnrolledIdsToRemove.length === 0) return;
    if (!confirm(`Keluarkan ${selectedEnrolledIdsToRemove.length} siswa terpilih dari kelas ${classData.name}?`)) return;
    setAssignLoading(true);
    setStatusActionMessage(null);
    try {
      const res = await fetch("/api/academic/enrollments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentIds: selectedEnrolledIdsToRemove,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setStatusActionMessage({ type: "success", text: `${selectedEnrolledIdsToRemove.length} siswa berhasil dikeluarkan dari kelas.` });
        setSelectedEnrolledIdsToRemove([]);
        fetchAllData();
      } else {
        setStatusActionMessage({ type: "error", text: json.error || "Gagal mengeluarkan siswa." });
      }
    } catch {
      setStatusActionMessage({ type: "error", text: "Terjadi gangguan koneksi jaringan." });
    } finally {
      setAssignLoading(false);
    }
  };

  // Bulk Set Password
  const handleBulkSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkUniformPassword.trim()) return;
    setBulkSubmitting(true);
    setBulkMessage(null);
    try {
      const res = await fetch(`/api/academic/classes/${initialClassId}/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_password",
          password: bulkUniformPassword.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setBulkMessage({ type: "success", text: json.message || "Password seluruh siswa sekelas berhasil direset seragam!" });
        setBulkStudents((prev) =>
          prev.map((s) => ({ ...s, rawPassword: bulkUniformPassword.trim(), newPassword: "" }))
        );
        setBulkUniformPassword("");
      } else {
        setBulkMessage({ type: "error", text: json.error || "Gagal mereset password sekelas." });
      }
    } catch {
      setBulkMessage({ type: "error", text: "Terjadi gangguan koneksi jaringan." });
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Bulk Set Status (Aktif / Non-Aktif)
  const handleBulkSetStatus = async (status: boolean) => {
    setBulkSubmitting(true);
    setBulkMessage(null);
    try {
      const res = await fetch(`/api/academic/classes/${initialClassId}/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          isActive: status,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setBulkMessage({ type: "success", text: json.message || `Status siswa sekelas berhasil diubah ke ${status ? "Aktif" : "Non-Aktif"}!` });
        setBulkStudents((prev) => prev.map((s) => ({ ...s, isActive: status })));
      } else {
        setBulkMessage({ type: "error", text: json.error || "Gagal mengubah status siswa." });
      }
    } catch {
      setBulkMessage({ type: "error", text: "Terjadi gangguan koneksi jaringan." });
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Batch Save Inline Edits
  const handleBatchSaveInlineEdits = async () => {
    if (bulkStudents.length === 0) return;
    setBulkSubmitting(true);
    setBulkMessage(null);
    try {
      const payloadStudents = bulkStudents.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        username: s.username,
        nis: s.nis,
        nisn: s.nisn,
        isActive: s.isActive,
        password: s.newPassword && s.newPassword.trim() !== "" ? s.newPassword.trim() : undefined,
      }));

      const res = await fetch(`/api/academic/classes/${initialClassId}/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_update",
          students: payloadStudents,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setBulkMessage({ type: "success", text: json.message || "Data siswa sekelas berhasil disimpan!" });
        setBulkStudents((prev) =>
          prev.map((s) => ({
            ...s,
            rawPassword: s.newPassword ? s.newPassword : s.rawPassword,
            newPassword: "",
          }))
        );
      } else {
        setBulkMessage({ type: "error", text: json.error || "Gagal memperbarui data siswa." });
      }
    } catch {
      setBulkMessage({ type: "error", text: "Terjadi gangguan koneksi jaringan." });
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Re-upload CSV / Excel File
  const handleReuploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setBulkMessage(null);

    try {
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      let rows: any[] = [];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      } else {
        const text = await file.text();
        const lines = text.split("\n").filter((l) => l.trim() !== "");
        if (lines.length > 1) {
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
            const obj: any = {};
            headers.forEach((h, idx) => {
              obj[h] = values[idx] || "";
            });
            rows.push(obj);
          }
        }
      }

      if (rows.length === 0) {
        setBulkMessage({ type: "error", text: "Berkas kosong atau format header tidak terbaca." });
        return;
      }

      // Match rows with current bulkStudents
      let matchedCount = 0;
      setBulkStudents((prev) =>
        prev.map((student) => {
          const match = rows.find(
            (r) =>
              (r.username && r.username.toLowerCase() === student.username.toLowerCase()) ||
              (r.Username && r.Username.toLowerCase() === student.username.toLowerCase()) ||
              (r.nis && String(r.nis) === String(student.nis)) ||
              (r.NIS && String(r.NIS) === String(student.nis)) ||
              (r["Nama Siswa"] && r["Nama Siswa"].toLowerCase() === student.displayName.toLowerCase())
          );

          if (match) {
            matchedCount++;
            const newPass = match.password || match.Password || match["Password Awal"] || match["Password Baru"] || "";
            const newName = match["Nama Siswa"] || match.name || match.displayName || student.displayName;
            const newNis = match.nis || match.NIS || student.nis;
            const newNisn = match.nisn || match.NISN || student.nisn;
            const statusStr = String(match.status || match.Status || "").toLowerCase();
            const newActive = statusStr.includes("non") ? false : true;

            return {
              ...student,
              displayName: newName,
              nis: newNis,
              nisn: newNisn,
              newPassword: newPass && newPass !== "-" ? newPass : student.newPassword,
              isActive: statusStr ? newActive : student.isActive,
            };
          }
          return student;
        })
      );

      setBulkMessage({
        type: "success",
        text: `Berhasil mencocokkan ${matchedCount} siswa dari berkas '${file.name}'. Tekan 'Simpan Perubahan Sekelas' untuk menyimpan permanen.`,
      });
    } catch (err: any) {
      setBulkMessage({ type: "error", text: `Gagal membaca berkas: ${err.message}` });
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!classData || enrollments.length === 0) return;
    const rows = enrollments.map((e, idx) => ({
      No: idx + 1,
      "Nama Siswa": e.student.displayName,
      NIS: e.student.nis || "-",
      NISN: e.student.nisn || "-",
      Username: e.student.username,
      "Password Awal": e.student.rawPassword || "-",
      Status: e.student.isActive ? "Aktif" : "Non-Aktif",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 15 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Siswa ${classData.name}`);
    XLSX.writeFile(wb, `Data_Siswa_${classData.name.replace(/\s+/g, "_")}.xlsx`);
  };

  // Filtered Roster
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      const q = searchRoster.toLowerCase();
      return (
        e.student.displayName.toLowerCase().includes(q) ||
        e.student.username.toLowerCase().includes(q) ||
        (e.student.nis && e.student.nis.toLowerCase().includes(q)) ||
        (e.student.nisn && e.student.nisn.toLowerCase().includes(q))
      );
    });
  }, [enrollments, searchRoster]);

  // Filtered Unassigned
  const filteredUnassigned = useMemo(() => {
    return unassignedStudents.filter((s) => {
      const q = searchUnassigned.toLowerCase();
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        (s.nis && s.nis.toLowerCase().includes(q))
      );
    });
  }, [unassignedStudents, searchUnassigned]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-gray-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat data siswa kelas...</span>
        </div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Gagal Membuka Halaman Siswa</h2>
          <p className="text-sm text-rose-300 max-w-md mx-auto">{error || "Data kelas tidak ditemukan."}</p>
          <Link
            href="/admin?tab=classes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-200 text-xs font-semibold hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Jurusan & Kelas</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto p-6 sm:p-8 lg:p-8 space-y-7 sm:space-y-8 animate-in fade-in duration-200">
      {/* SECTION 1: Top Header Bar / Breadcrumb / Back button */}
      <div>
        {/* Breadcrumb Navigasi (di atas) */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-4">
          <Link href="/admin" className="hover:text-[#0D274C] transition">
            Panel Admin
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/admin?tab=classes" className="hover:text-[#0D274C] transition">
            Jurusan & Kelas
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold">Siswa {classData.name}</span>
        </div>

        {/* Row Tombol Kembali & Tombol Aksi */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href="/admin?tab=classes"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition cursor-pointer shadow-xs group"
            title="Kembali ke Jurusan & Kelas"
          >
            <ArrowLeft className="w-4 h-4 text-[#65C443] group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs font-semibold">Kembali</span>
          </Link>

          {/* Action Bar (Export & Detail) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65C443]/15 hover:bg-[#65C443] border border-[#65C443]/30 hover:border-[#65C443] text-emerald-800 hover:text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              title="Unduh Berkas Excel (.xlsx) Daftar Siswa Kelas Ini"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor Excel</span>
            </button>
            <Link
              href={`/admin/classes/${classData.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D274C] hover:bg-[#163B6E] text-white text-xs font-semibold transition cursor-pointer shadow-sm"
            >
              <span>Lihat Detail Kelas</span>
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 2: Class Mini Summary Banner */}
      <div
        className="rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#65C443]/10 border border-[#65C443]/20 flex items-center justify-center text-[#65C443] shrink-0">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
              <span>{classData.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-normal">
                Tingkat {classData.gradeLevel}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span>Jurusan: <strong className="text-slate-800">{classData.major?.name || "Umum"}</strong></span>
              <span>•</span>
              <span>Wali Kelas: <strong className="text-slate-800">{classData.homeroomTeacher?.displayName || "Belum Ditentukan"}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-200 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right">
            <div className="text-xs text-slate-500">Total Siswa Terdaftar</div>
            <div className="text-2xl font-black text-slate-900 font-mono">{enrollments.length} <span className="text-xs font-normal text-slate-500">Siswa</span></div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Tab Navigation */}
      <div className="pb-6 sm:pb-7 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("roster")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              activeTab === "roster"
                ? "bg-[#0D274C] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Daftar & Penempatan Siswa ({enrollments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("bulk")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              activeTab === "bulk"
                ? "bg-[#0D274C] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <RefreshCw className="w-4 h-4 text-[#65C443]" />
            <span>Update Data Sekelas & Re-Upload</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: Card-card Tabel / Konten Tab */}
      {activeTab === "roster" && (
        <div className="space-y-6">
          {statusActionMessage && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                statusActionMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {statusActionMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{statusActionMessage.text}</span>
              </div>
              <button onClick={() => setStatusActionMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Box Kiri: Siswa Belum Punya Kelas (Unassigned) */}
            <div
              className="lg:col-span-5 rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-amber-500" />
                      <span>Siswa Tanpa Kelas ({unassignedStudents.length})</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Pilih siswa untuk dimasukkan ke rombel {classData.name}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedUnassignedIds.length === filteredUnassigned.length) {
                        setSelectedUnassignedIds([]);
                      } else {
                        setSelectedUnassignedIds(filteredUnassigned.map((s) => s.id));
                      }
                    }}
                    className="text-[11px] text-[#0D274C] hover:text-[#65C443] font-semibold cursor-pointer"
                  >
                    {selectedUnassignedIds.length === filteredUnassigned.length && filteredUnassigned.length > 0
                      ? "Batal Semua"
                      : "Pilih Semua"}
                  </button>
                </div>

                {/* Search Unassigned */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchUnassigned}
                    onChange={(e) => setSearchUnassigned(e.target.value)}
                    placeholder="Cari siswa tanpa kelas..."
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>

                {/* Unassigned List */}
                <div className="overflow-y-auto max-h-[440px] space-y-2 pr-1 divide-y divide-slate-100">
                  {filteredUnassigned.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-xs">
                      Tidak ada siswa tanpa kelas yang ditemukan.
                    </div>
                  ) : (
                    filteredUnassigned.map((s) => {
                      const isSelected = selectedUnassignedIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedUnassignedIds((prev) =>
                              isSelected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                            );
                          }}
                          className={`p-3.5 sm:p-4 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-[#65C443]/10 border-[#65C443]/40"
                              : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#65C443] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <div className="overflow-hidden">
                              <div className="text-xs font-bold text-slate-900 truncate">{s.displayName}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                NIS: {s.nis || "-"} • @{s.username}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action Button: Assign to this class */}
              <button
                type="button"
                onClick={handleAssignSelectedStudents}
                disabled={assignLoading || selectedUnassignedIds.length === 0}
                className="w-full py-3 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <ArrowRight className="w-4 h-4" />
                <span>
                  {assignLoading
                    ? "Menempatkan..."
                    : `Tempatkan ${selectedUnassignedIds.length} Siswa ke ${classData.name}`}
                </span>
              </button>
            </div>

            {/* Box Kanan: Siswa Terdaftar di Kelas Ini */}
            <div
              className="lg:col-span-7 rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#65C443]" />
                      <span>Siswa Kelas {classData.name} ({enrollments.length})</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Daftar siswa resmi rombongan belajar pada tahun ajaran ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEnrolledIdsToRemove.length === filteredEnrollments.length) {
                        setSelectedEnrolledIdsToRemove([]);
                      } else {
                        setSelectedEnrolledIdsToRemove(filteredEnrollments.map((e) => e.id));
                      }
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                  >
                    {selectedEnrolledIdsToRemove.length === filteredEnrollments.length && filteredEnrollments.length > 0
                      ? "Batal Pilih"
                      : "Pilih Semua"}
                  </button>
                </div>

                {/* Search Roster */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchRoster}
                    onChange={(e) => setSearchRoster(e.target.value)}
                    placeholder="Cari siswa terdaftar..."
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>

                {/* Table Roster */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[440px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase font-semibold border-b border-slate-200 tracking-wider">
                      <tr>
                        <th className="py-3.5 px-3.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              selectedEnrolledIdsToRemove.length === filteredEnrollments.length &&
                              filteredEnrollments.length > 0
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEnrolledIdsToRemove(filteredEnrollments.map((en) => en.id));
                              } else {
                                setSelectedEnrolledIdsToRemove([]);
                              }
                            }}
                            className="rounded border-slate-300 text-[#65C443] focus:ring-[#65C443] cursor-pointer"
                          />
                        </th>
                        <th className="py-3.5 px-4">Nama Siswa</th>
                        <th className="py-3.5 px-3.5">NIS / NISN</th>
                        <th className="py-3.5 px-4">Akun</th>
                        <th className="py-3.5 px-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredEnrollments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-16 text-center text-slate-400">
                            Belum ada siswa terdaftar pada kelas ini.
                          </td>
                        </tr>
                      ) : (
                        filteredEnrollments.map((en) => {
                          const isChecked = selectedEnrolledIdsToRemove.includes(en.id);
                          return (
                            <tr key={en.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3.5 px-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedEnrolledIdsToRemove((prev) =>
                                      isChecked ? prev.filter((id) => id !== en.id) : [...prev, en.id]
                                    );
                                  }}
                                  className="rounded border-slate-300 text-[#65C443] focus:ring-[#65C443] cursor-pointer"
                                />
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900">{en.student.displayName}</div>
                                {en.notes && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200 mt-1 inline-block">
                                    {en.notes}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-3.5 font-mono text-slate-600 text-[11px]">
                                <div>{en.student.nis || "-"}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{en.student.nisn || "-"}</div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                                <div>@{en.student.username}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">Pass: {en.student.rawPassword || "-"}</div>
                              </td>
                              <td className="py-3.5 px-3.5 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    en.student.isActive
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-slate-100 text-slate-500 border border-slate-200"
                                  }`}
                                >
                                  {en.student.isActive ? "Aktif" : "Non-Aktif"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button: Remove selected */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Terpilih: <strong>{selectedEnrolledIdsToRemove.length}</strong> siswa
                </span>
                <button
                  type="button"
                  onClick={handleRemoveSelectedStudents}
                  disabled={assignLoading || selectedEnrolledIdsToRemove.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-semibold transition cursor-pointer disabled:opacity-40 inline-flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Keluarkan Dari Kelas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UPDATE DATA SEKELAS (MASS ACTIONS & RE-UPLOAD) */}
      {activeTab === "bulk" && (
        <div className="space-y-8">
          {bulkMessage && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                bulkMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {bulkMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{bulkMessage.text}</span>
              </div>
              <button onClick={() => setBulkMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Bulk Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
            {/* Action 1: Reset Password Seragam */}
            <form
              onSubmit={handleBulkSetPassword}
              className="rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <div className="flex items-center gap-2 text-[#0D274C] font-bold text-xs uppercase tracking-wide">
                  <Key className="w-4 h-4" />
                  <span>Reset Password Seragam</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Ubah password seluruh {bulkStudents.length} siswa sekelas menjadi kata sandi yang sama.
                </p>
                <input
                  type="text"
                  required
                  value={bulkUniformPassword}
                  onChange={(e) => setBulkUniformPassword(e.target.value)}
                  placeholder="Password baru (e.g. Siswa2026!)"
                  className="w-full mt-3.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>
              <button
                type="submit"
                disabled={bulkSubmitting || !bulkUniformPassword.trim()}
                className="w-full py-2.5 sm:py-3 rounded-xl bg-[#0D274C] hover:bg-[#163B6E] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                Terapkan Password Seragam
              </button>
            </form>

            {/* Action 2: Ubah Status Siswa Sekelas */}
            <div
              className="rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <div className="flex items-center gap-2 text-[#65C443] font-bold text-xs uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Status Akun Sekelas</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Aktifkan atau non-aktifkan seluruh akun siswa di kelas {classData.name} sekaligus.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleBulkSetStatus(true)}
                  disabled={bulkSubmitting}
                  className="py-2.5 sm:py-3 rounded-xl bg-[#65C443]/15 hover:bg-[#65C443] border border-[#65C443]/30 text-emerald-800 hover:text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Set Semua Aktif
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetStatus(false)}
                  disabled={bulkSubmitting}
                  className="py-2.5 sm:py-3 rounded-xl bg-rose-50 hover:bg-rose-600 border border-rose-200 text-rose-700 hover:text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Set Non-Aktif
                </button>
              </div>
            </div>

            {/* Action 3: Re-upload File Ekspor */}
            <div
              className="rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wide">
                  <Upload className="w-4 h-4" />
                  <span>Re-upload File Ekspor</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Unggah kembali berkas CSV/Excel ekspor yang telah diedit secara offline.
                </p>
              </div>
              <label className="w-full py-2.5 sm:py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 text-center">
                <Upload className="w-4 h-4" />
                <span className="truncate">{csvFileName ? csvFileName : "Pilih File CSV / Excel"}</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleReuploadFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Editable Students Table */}
          <div
            className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden space-y-4"
          >
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Daftar Kredensial Siswa Sekelas</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Anda dapat mengedit nama, NIS, status, dan password baru secara inline pada tabel di bawah.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBatchSaveInlineEdits}
                disabled={bulkSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{bulkSubmitting ? "Menyimpan..." : "Simpan Perubahan Sekelas"}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">No</th>
                    <th className="py-3.5 px-4">Nama Siswa</th>
                    <th className="py-3.5 px-4">NIS</th>
                    <th className="py-3.5 px-4">NISN</th>
                    <th className="py-3.5 px-4">Username</th>
                    <th className="py-3.5 px-4">Password Awal</th>
                    <th className="py-3.5 px-4">Password Baru (Opsional)</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {bulkStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        Tidak ada siswa pada kelas ini.
                      </td>
                    </tr>
                  ) : (
                    bulkStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            value={s.displayName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkStudents((prev) =>
                                prev.map((item) => (item.id === s.id ? { ...item, displayName: val } : item))
                              );
                            }}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            value={s.nis}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkStudents((prev) =>
                                prev.map((item) => (item.id === s.id ? { ...item, nis: val } : item))
                              );
                            }}
                            className="w-28 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            value={s.nisn}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkStudents((prev) =>
                                prev.map((item) => (item.id === s.id ? { ...item, nisn: val } : item))
                              );
                            }}
                            className="w-32 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{s.username}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{s.rawPassword}</td>
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            placeholder="Ganti password..."
                            value={s.newPassword}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkStudents((prev) =>
                                prev.map((item) => (item.id === s.id ? { ...item, newPassword: val } : item))
                              );
                            }}
                            className="w-36 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-amber-700 font-mono text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] placeholder:text-slate-400"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setBulkStudents((prev) =>
                                prev.map((item) => (item.id === s.id ? { ...item, isActive: !item.isActive } : item))
                              );
                            }}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                              s.isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {s.isActive ? "Aktif" : "Non-Aktif"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
              <span>Total Siswa: <strong className="text-slate-800">{bulkStudents.length}</strong></span>
              <button
                type="button"
                onClick={handleBatchSaveInlineEdits}
                disabled={bulkSubmitting}
                className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
