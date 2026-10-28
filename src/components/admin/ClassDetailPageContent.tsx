"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Briefcase,
  Users,
  ShieldCheck,
  UserCheck,
  User,
  Search,
  Download,
  Edit2,
  Crown,
  FileSpreadsheet,
  Award,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronRight,
  Filter,
  Layers,
  Phone,
  Mail,
  Hash,
  Coins,
  Wallet,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";

interface ClassDetailPageContentProps {
  initialClassId: string;
}

export default function ClassDetailPageContent({ initialClassId }: ClassDetailPageContentProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classData, setClassData] = useState<any>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGender, setFilterGender] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [activeTab, setActiveTab] = useState<"roster" | "structure">("roster");

  // Modal Assign Role (Unified for Structure and Roster)
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [modalRoleTitle, setModalRoleTitle] = useState("");
  const [modalSelectedEnrollmentId, setModalSelectedEnrollmentId] = useState("");
  const [modalCurrentHolderName, setModalCurrentHolderName] = useState<string | null>(null);
  const [modalCurrentEnrollmentId, setModalCurrentEnrollmentId] = useState<string | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [roleSuccessMessage, setRoleSuccessMessage] = useState<string | null>(null);

  // Edit Student Modal State
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState("");
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentGender, setEditStudentGender] = useState("");
  const [editStudentNis, setEditStudentNis] = useState("");
  const [editStudentNisn, setEditStudentNisn] = useState("");
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [editStudentUsername, setEditStudentUsername] = useState("");
  const [editStudentPassword, setEditStudentPassword] = useState("");
  const [editStudentIsActive, setEditStudentIsActive] = useState(true);
  const [editStudentSubmitting, setEditStudentSubmitting] = useState(false);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);

  // Open Edit Student Modal
  const openEditStudentModal = (s: any) => {
    setEditingStudentId(s.studentId);
    setEditStudentName(s.displayName || "");
    setEditStudentGender(s.genderCode === "L" || s.genderCode === "P" ? s.genderCode : "");
    setEditStudentNis(s.nis !== "-" ? s.nis : "");
    setEditStudentNisn(s.nisn !== "-" ? s.nisn : "");
    setEditStudentEmail(s.email !== "-" ? s.email : "");
    setEditStudentUsername(s.username || "");
    setEditStudentPassword("");
    setEditStudentIsActive(s.status === "active");
    setEditStudentError(null);
    setShowEditStudentModal(true);
  };

  // Submit Edit Student
  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditStudentSubmitting(true);
    setEditStudentError(null);

    const payload: any = {
      updateType: "student",
      displayName: editStudentName,
      username: editStudentUsername,
      gender: editStudentGender || null,
      nis: editStudentNis || null,
      nisn: editStudentNisn || null,
      email: editStudentEmail || null,
      isActive: editStudentIsActive,
    };
    if (editStudentPassword.trim() !== "") {
      payload.password = editStudentPassword;
    }

    try {
      const res = await fetch(`/api/users/${editingStudentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setShowEditStudentModal(false);
        fetchClassDetail();
      } else {
        setEditStudentError(json.error || "Gagal menyimpan perubahan siswa.");
      }
    } catch {
      setEditStudentError("Kesalahan jaringan.");
    } finally {
      setEditStudentSubmitting(false);
    }
  };

  // Fetch Class Detail
  const fetchClassDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/academic/classes/${initialClassId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat rincian kelas");
      }
      setClassData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassDetail();
  }, [initialClassId]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (roleModalOpen) setRoleModalOpen(false);
        if (showEditStudentModal) setShowEditStudentModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [roleModalOpen, showEditStudentModal]);

  // Open Assign Modal From Structure Card
  const openAssignModalForRole = (roleName: string, currentHolder?: any) => {
    setModalRoleTitle(roleName);
    setModalCurrentHolderName(currentHolder?.displayName || null);
    setModalCurrentEnrollmentId(currentHolder?.enrollmentId || null);
    setModalSelectedEnrollmentId(currentHolder?.enrollmentId || "");
    setRoleSuccessMessage(null);
    setRoleModalOpen(true);
  };

  // Open Assign Modal From Student Table Row
  const openAssignModalForStudent = (student: any) => {
    setModalRoleTitle(student.roleInClass === "Anggota Kelas" ? "" : student.roleInClass);
    setModalCurrentHolderName(student.displayName);
    setModalCurrentEnrollmentId(student.enrollmentId);
    setModalSelectedEnrollmentId(student.enrollmentId);
    setRoleSuccessMessage(null);
    setRoleModalOpen(true);
  };

  // Handle Save Role Assignment
  const handleSaveRoleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSelectedEnrollmentId) {
      alert("Silakan pilih siswa yang akan ditugaskan.");
      return;
    }
    setRoleUpdating(true);
    setRoleSuccessMessage(null);
    try {
      // If position had a different previous holder, clear previous holder first
      if (modalCurrentEnrollmentId && modalCurrentEnrollmentId !== modalSelectedEnrollmentId) {
        await fetch(`/api/academic/classes/${initialClassId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_student_role",
            enrollmentId: modalCurrentEnrollmentId,
            roleInClass: null,
          }),
        });
      }

      // Assign role to selected student
      const res = await fetch(`/api/academic/classes/${initialClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_student_role",
          enrollmentId: modalSelectedEnrollmentId,
          roleInClass: modalRoleTitle.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memperbarui jabatan siswa");
      }

      setRoleSuccessMessage(json.message || "Jabatan berhasil diperbarui.");
      setTimeout(() => {
        setRoleModalOpen(false);
        setRoleSuccessMessage(null);
        fetchClassDetail();
      }, 700);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRoleUpdating(false);
    }
  };

  // Handle Clear Role Assignment
  const handleClearRoleAssignment = async () => {
    if (!modalCurrentEnrollmentId) return;
    if (!confirm(`Kosongkan jabatan '${modalRoleTitle}' dari siswa saat ini?`)) return;
    setRoleUpdating(true);
    setRoleSuccessMessage(null);
    try {
      const res = await fetch(`/api/academic/classes/${initialClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_student_role",
          enrollmentId: modalCurrentEnrollmentId,
          roleInClass: null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengosongkan jabatan");
      }
      setRoleSuccessMessage("Jabatan berhasil dikosongkan.");
      setTimeout(() => {
        setRoleModalOpen(false);
        setRoleSuccessMessage(null);
        fetchClassDetail();
      }, 700);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRoleUpdating(false);
    }
  };

  // Unified Officer Card Renderer for Organizational Structure
  const renderOfficerCard = ({
    roleTitle,
    holder,
    icon: IconComponent,
    theme,
    isStudentRole = true,
  }: {
    roleTitle: string;
    holder: any;
    icon: any;
    theme: "emerald" | "amber" | "sky" | "teal" | "purple";
    isStudentRole?: boolean;
  }) => {
    const themeMap = {
      emerald: {
        border: "#E2E8F0",
        badge: "bg-[#65C443]/15 text-[#2e7d18] border border-[#65C443]/30",
        iconBox: "bg-[#65C443]/15 border border-[#65C443]/30 text-[#2e7d18]",
        hoverBorder: "hover:border-[#65C443]",
      },
      amber: {
        border: "#E2E8F0",
        badge: "bg-amber-50 text-amber-700 border border-amber-200",
        iconBox: "bg-amber-50 border border-amber-200 text-amber-600",
        hoverBorder: "hover:border-amber-400",
      },
      sky: {
        border: "#E2E8F0",
        badge: "bg-sky-50 text-sky-700 border border-sky-200",
        iconBox: "bg-sky-50 border border-sky-200 text-sky-600",
        hoverBorder: "hover:border-sky-400",
      },
      teal: {
        border: "#E2E8F0",
        badge: "bg-teal-50 text-teal-700 border border-teal-200",
        iconBox: "bg-teal-50 border border-teal-200 text-teal-600",
        hoverBorder: "hover:border-teal-400",
      },
      purple: {
        border: "#E2E8F0",
        badge: "bg-purple-50 text-purple-700 border border-purple-200",
        iconBox: "bg-purple-50 border border-purple-200 text-purple-600",
        hoverBorder: "hover:border-purple-400",
      },
    };

    const styles = themeMap[theme];
    const isOccupied = Boolean(holder?.displayName || holder?.name);
    const displayName = holder?.displayName || holder?.name || "Belum Ditetapkan";
    const idInfo = holder?.nis ? `NIS: ${holder.nis}` : holder?.nip ? `NIP: ${holder.nip}` : "Posisi Kosong";

    return (
      <div
        className={`rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm transition flex flex-col justify-between ${styles.hoverBorder} hover:shadow-md min-h-[175px] relative group space-y-4`}
      >
        {/* Top Bar: Role badge + Action */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${styles.badge}`}
          >
            <IconComponent className="w-3.5 h-3.5" />
            <span>{roleTitle}</span>
          </span>

          {isStudentRole ? (
            <button
              type="button"
              onClick={() => openAssignModalForRole(roleTitle, holder)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#0D274C] hover:text-white border border-slate-200 text-slate-700 transition text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs group/btn"
              title={`Atur atau ganti penugasan ${roleTitle}`}
            >
              <Edit2 className="w-3.5 h-3.5 text-[#65C443] group-hover/btn:text-white" />
              <span>{isOccupied ? "Ubah" : "+ Tetapkan"}</span>
            </button>
          ) : (
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Pengampu Utama
            </span>
          )}
        </div>

        {/* Body: Avatar box + Holder Info */}
        <div className="flex items-center gap-4 my-1">
          <div
            className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 ${styles.iconBox}`}
          >
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <div
              className={`text-base font-bold truncate ${
                isOccupied ? "text-slate-900" : "text-slate-400 italic"
              }`}
            >
              {displayName}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-1 truncate flex items-center gap-2">
              <span>{idInfo}</span>
            </div>
          </div>
        </div>

        {/* Footer: Status Indicator */}
        <div className="pt-3.5 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-slate-500">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOccupied ? "bg-[#65C443] ring-4 ring-[#65C443]/20" : "bg-slate-300"
              }`}
            />
            <span className={isOccupied ? "text-slate-700 font-medium" : "text-slate-400"}>
              {isOccupied ? "Terisi" : "Belum Ditugaskan"}
            </span>
          </div>
          {holder?.genderCode && (
            <span className="text-slate-500 text-[10px]">
              {holder.genderCode === "L" ? "Laki-laki" : "Perempuan"}
            </span>
          )}
        </div>
      </div>
    );
  };
  const filteredStudents = useMemo(() => {
    if (!classData?.students) return [];
    return classData.students.filter((s: any) => {
      const matchesSearch =
        s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nis.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nisn.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGender =
        filterGender === "all" ||
        (filterGender === "L" && s.genderCode === "L") ||
        (filterGender === "P" && s.genderCode === "P");

      const matchesRole =
        filterRole === "all" ||
        (filterRole === "official" && s.roleInClass !== "Anggota Kelas") ||
        (filterRole === "member" && s.roleInClass === "Anggota Kelas");

      return matchesSearch && matchesGender && matchesRole;
    });
  }, [classData?.students, searchTerm, filterGender, filterRole]);

  // Export to Excel
  const handleExportToExcel = () => {
    if (!classData || !classData.students) return;

    const exportRows = classData.students.map((s: any, idx: number) => ({
      No: idx + 1,
      "Nama Siswa": s.displayName,
      NIS: s.nis,
      NISN: s.nisn,
      "Jenis Kelamin": s.gender,
      "Jabatan Kelas": s.roleInClass,
      Username: s.username,
      "Password Awal": s.rawPassword,
      Status: s.status === "active" ? "Aktif" : s.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Data Siswa ${classData.name}`);
    XLSX.writeFile(wb, `Daftar_Siswa_${classData.name.replace(/\s+/g, "_")}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-slate-500 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#65C443] border-t-transparent rounded-full animate-spin" />
          <span>Memuat informasi rincian kelas...</span>
        </div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Gagal Membuka Halaman Kelas</h2>
          <p className="text-sm text-rose-600 max-w-md mx-auto">{error || "Data kelas tidak ditemukan."}</p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Panel Admin</span>
          </Link>
        </div>
      </div>
    );
  }

  const { structure } = classData;

  return (
    <div className="max-w-7xl w-full mx-auto p-6 sm:p-8 lg:p-8 space-y-7 sm:space-y-8 animate-in fade-in duration-200">
      {/* SECTION 1: Header / Breadcrumb / Tombol Kembali */}
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
          <span className="text-slate-900 font-bold">{classData.name}</span>
        </div>

        {/* Row Tombol Kembali & Tombol Aksi */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href="/admin?tab=classes"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-slate-900 transition cursor-pointer shadow-xs group"
            title="Kembali ke Jurusan & Kelas"
          >
            <ArrowLeft className="w-4 h-4 text-[#65C443] group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs font-semibold">Kembali</span>
          </Link>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold transition cursor-pointer shadow-sm shadow-[#65C443]/20"
              title="Unduh Berkas Excel (.xlsx) Daftar Siswa Kelas Ini"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Siswa (Excel)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Card Informasi Kelas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Nama & Kode Kelas */}
        <div
          className="rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm flex flex-col justify-between min-h-[200px] space-y-4 hover:border-[#65C443]/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0D274C]/10 border border-[#0D274C]/20 flex items-center justify-center text-[#0D274C] shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-700">Identitas Rombel</span>
            </span>
            <span className="text-[11px] px-3 py-1 rounded-lg bg-[#65C443]/15 text-[#2e7d18] font-bold border border-[#65C443]/30">
              Tingkat {classData.gradeLevel}
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{classData.name}</div>
            <div className="text-xs text-slate-500 mt-2 font-mono flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{classData.code}</span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Tahun Ajaran:</span>
            <strong className="text-slate-800 font-semibold">{classData.academicYear?.name || "-"}</strong>
          </div>
        </div>

        {/* Card 2: Jurusan */}
        <div
          className="rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm flex flex-col justify-between min-h-[200px] space-y-4 hover:border-amber-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-700">Program Keahlian</span>
            </span>
            <span className="text-[11px] px-3 py-1 rounded-lg bg-amber-50 text-amber-700 font-mono font-bold border border-amber-200">
              {classData.major?.code || "UMUM"}
            </span>
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 leading-snug">{classData.major?.name || "Umum"}</div>
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
              {classData.major?.description || "Konsentrasi keahlian / kelas reguler"}
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Tipe:</span>
            <span className="text-amber-700 font-semibold">
              {classData.major?.id ? "Kejuruan / Peminatan" : "Reguler (SMP/MTs/SD)"}
            </span>
          </div>
        </div>

        {/* Card 3: Wali Kelas */}
        <div
          className="rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm flex flex-col justify-between min-h-[200px] space-y-4 hover:border-[#65C443]/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#65C443]/15 border border-[#65C443]/30 flex items-center justify-center text-[#2e7d18] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-700">Wali Kelas</span>
            </span>
            <span className="text-[11px] px-3 py-1 rounded-lg bg-[#65C443]/15 text-[#2e7d18] font-semibold border border-[#65C443]/30">
              Guru Pengampu
            </span>
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 truncate">
              {classData.homeroomTeacher?.displayName || (
                <span className="text-amber-600 font-semibold">Belum Ditentukan</span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
              <span>NIP:</span>
              <strong className="text-slate-800 font-mono">
                {classData.homeroomTeacher?.nip || classData.homeroomTeacher?.nuptk || "-"}
              </strong>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between truncate">
            <span>Email:</span>
            <span className="text-slate-700 truncate max-w-[150px]">
              {classData.homeroomTeacher?.email || classData.homeroomTeacher?.username || "-"}
            </span>
          </div>
        </div>

        {/* Card 4: Jumlah Siswa & Demografi */}
        <div
          className="rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 shadow-sm flex flex-col justify-between min-h-[200px] space-y-4 hover:border-cyan-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-700">Populasi Kelas</span>
            </span>
            <span className="text-[11px] px-3 py-1 rounded-lg bg-[#65C443]/15 text-[#2e7d18] font-bold border border-[#65C443]/30">
              100% Aktif
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-slate-900 font-mono">
              {classData.totalStudents} <span className="text-xs font-normal text-slate-500">Siswa</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-200" title="Siswa Laki-laki">
                L: {classData.totalMale}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-pink-50 text-pink-700 font-mono font-semibold border border-pink-200" title="Siswa Perempuan">
                P: {classData.totalFemale}
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Kapasitas Rombel:</span>
            <span className="text-cyan-700 font-semibold">Standar Kurikulum</span>
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
                ? "bg-[#0D274C] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#65C443]" />
            <span>Daftar Siswa Rombel ({classData.totalStudents})</span>
          </button>

          <button
            onClick={() => setActiveTab("structure")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              activeTab === "structure"
                ? "bg-[#0D274C] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Crown className="w-4 h-4 text-amber-500" />
            <span>Struktur Organisasi Kelas</span>
          </button>
        </div>
      </div>

      {/* VIEW TAB 1: DAFTAR SISWA */}
      {activeTab === "roster" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama siswa, NIS, NISN, atau username..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-2 focus:ring-[#65C443]/20 transition shadow-xs"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Gender:</span>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-white text-slate-800">Semua</option>
                  <option value="L" className="bg-white text-slate-800">Laki-laki ({classData.totalMale})</option>
                  <option value="P" className="bg-white text-slate-800">Perempuan ({classData.totalFemale})</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-xs">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>Jabatan:</span>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-white text-slate-800">Semua</option>
                  <option value="official" className="bg-white text-slate-800">Pengurus Kelas</option>
                  <option value="member" className="bg-white text-slate-800">Anggota Biasa</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="py-4 px-4 w-12 text-center">No</th>
                    <th className="py-4 px-5">Nama Lengkap Siswa</th>
                    <th className="py-4 px-4">NIS / NISN</th>
                    <th className="py-4 px-3.5 w-20 text-center">L/P</th>
                    <th className="py-4 px-4">Jabatan Kelas</th>
                    <th className="py-4 px-4">Username & Kredensial</th>
                    <th className="py-4 px-3.5 w-24 text-center">Status</th>
                    <th className="py-4 px-4 w-40 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        Tidak ada siswa yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s: any, idx: number) => {
                      const isLeader = s.roleInClass.toLowerCase().includes("ketua");
                      const isSecretary = s.roleInClass.toLowerCase().includes("sekretaris");
                      const isTreasurer = s.roleInClass.toLowerCase().includes("bendahara");
                      const isSection = s.roleInClass.toLowerCase().startsWith("seksi");

                      return (
                        <tr key={s.enrollmentId} className="hover:bg-slate-50/80 transition">
                          <td className="py-4 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-4 px-5">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{s.displayName}</span>
                              {isLeader && (
                                <span title="Pengurus Inti Kelas" className="inline-flex">
                                  <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{s.studentId}</div>
                          </td>
                          <td className="py-4 px-4 font-mono text-slate-600">
                            <div>NIS: {s.nis}</div>
                            <div className="text-[10px] text-slate-400">NISN: {s.nisn}</div>
                          </td>
                          <td className="py-4 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.genderCode === "L"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : s.genderCode === "P"
                                  ? "bg-pink-50 text-pink-700 border border-pink-200"
                                  : "text-slate-400"
                              }`}
                            >
                              {s.genderCode}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                isLeader
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : isSecretary
                                  ? "bg-sky-50 text-sky-700 border border-sky-200"
                                  : isTreasurer
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : isSection
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {s.roleInClass}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-[11px]">
                            <div className="text-slate-800 font-semibold">{s.username}</div>
                            <div className="text-slate-400 text-[10px]">
                              Pass: <span className="text-slate-600">{s.rawPassword}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3.5 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                s.status === "active"
                                  ? "bg-[#65C443]/15 text-[#2e7d18] border border-[#65C443]/30"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {s.status === "active" ? "Aktif" : s.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditStudentModal(s)}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-cyan-500 hover:text-cyan-700 text-slate-700 transition text-[11px] inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="Edit data dan akun siswa"
                              >
                                <Edit2 className="w-3 h-3 text-cyan-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => openAssignModalForStudent(s)}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-amber-500 hover:text-amber-700 text-slate-700 transition text-[11px] inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="Tugaskan Jabatan di Struktur Kelas"
                              >
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                                <span>Jabatan</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>
                Menampilkan <strong className="text-slate-800">{filteredStudents.length}</strong> dari <strong className="text-slate-800">{classData.totalStudents}</strong> siswa
              </span>
              <span className="font-medium text-slate-600">Rombel {classData.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 2: STRUKTUR ORGANISASI KELAS (BAGAN VISUAL) */}
      {activeTab === "structure" && (
        <div className="space-y-10 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-12 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <span>Bagan Struktur Organisasi {classData.name}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Struktur kepengurusan kelas resmi. Klik tombol <strong className="text-slate-700">Ubah</strong> atau <strong className="text-slate-700">+ Tetapkan</strong> pada posisi mana saja untuk mengatur penugasan siswa secara langsung.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => openAssignModalForRole("Seksi ", null)}
                className="px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-[#65C443]/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Seksi Bidang</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("roster")}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Lihat Daftar Siswa</span>
              </button>
            </div>
          </div>

          {/* Hierarchical Hierarchy Board */}
          <div className="space-y-14 py-4">
            {/* LEVEL 1: WALI KELAS */}
            <div className="flex flex-col items-center">
              <div className="text-center mb-5">
                <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-800 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 inline-flex items-center gap-2 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Level 1 • Pembina & Wali Kelas</span>
                </span>
              </div>
              <div className="w-full max-w-lg mx-auto">
                {renderOfficerCard({
                  roleTitle: "Wali Kelas",
                  holder: structure.homeroomTeacher,
                  icon: ShieldCheck,
                  theme: "emerald",
                  isStudentRole: false,
                })}
              </div>

              {/* Connecting Line Down */}
              <div className="w-0.5 h-12 bg-slate-300 my-6 sm:my-8" />
            </div>

            {/* LEVEL 2: KETUA & WAKIL KETUA KELAS */}
            <div>
              <div className="text-center mb-5">
                <span className="text-[11px] uppercase font-bold tracking-wider text-amber-800 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 inline-flex items-center gap-2 shadow-2xs">
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  <span>Level 2 • Pimpinan Murid (Ketua & Wakil Ketua)</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-10 max-w-4xl mx-auto">
                {renderOfficerCard({
                  roleTitle: "Ketua Kelas",
                  holder: structure.leader,
                  icon: Crown,
                  theme: "amber",
                  isStudentRole: true,
                })}
                {renderOfficerCard({
                  roleTitle: "Wakil Ketua Kelas",
                  holder: structure.viceLeader,
                  icon: Award,
                  theme: "amber",
                  isStudentRole: true,
                })}
              </div>

              {/* Connecting Line Down */}
              <div className="w-0.5 h-12 bg-slate-300 mx-auto my-6 sm:my-8" />
            </div>

            {/* LEVEL 3: SEKRETARIS & BENDAHARA */}
            <div>
              <div className="text-center mb-5">
                <span className="text-[11px] uppercase font-bold tracking-wider text-sky-800 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 inline-flex items-center gap-2 shadow-2xs">
                  <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                  <span>Level 3 • Pengurus Administrasi & Keuangan</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 max-w-6xl mx-auto">
                {renderOfficerCard({
                  roleTitle: "Sekretaris 1",
                  holder: structure.secretary1,
                  icon: BookOpen,
                  theme: "sky",
                  isStudentRole: true,
                })}
                {renderOfficerCard({
                  roleTitle: "Sekretaris 2",
                  holder: structure.secretary2,
                  icon: FileText,
                  theme: "sky",
                  isStudentRole: true,
                })}
                {renderOfficerCard({
                  roleTitle: "Bendahara 1",
                  holder: structure.treasurer1,
                  icon: Wallet,
                  theme: "teal",
                  isStudentRole: true,
                })}
                {renderOfficerCard({
                  roleTitle: "Bendahara 2",
                  holder: structure.treasurer2,
                  icon: Coins,
                  theme: "teal",
                  isStudentRole: true,
                })}
              </div>

              {/* Connecting Line Down */}
              <div className="w-0.5 h-12 bg-slate-300 mx-auto my-6 sm:my-8" />
            </div>

            {/* LEVEL 4: SEKSI-SEKSI / KOORDINATOR BIDANG */}
            <div>
              <div className="text-center mb-5">
                <span className="text-[11px] uppercase font-bold tracking-wider text-purple-800 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-200 inline-flex items-center gap-2 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Level 4 • Seksi-Seksi & Koordinator Bidang</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
                {/* Render All Assigned Sections & Custom Roles */}
                {[...(structure.sections || []), ...(structure.customRoles || [])].map((sec: any) => (
                  <div key={sec.enrollmentId}>
                    {renderOfficerCard({
                      roleTitle: sec.roleInClass,
                      holder: sec,
                      icon: Sparkles,
                      theme: "purple",
                      isStudentRole: true,
                    })}
                  </div>
                ))}

                {/* Add New Section Action Card */}
                <button
                  type="button"
                  onClick={() => openAssignModalForRole("Seksi ", null)}
                  className="rounded-2xl p-6 border-2 border-dashed border-slate-300 hover:border-[#65C443] bg-white hover:bg-slate-50/80 transition flex flex-col items-center justify-center text-center gap-2 text-slate-600 hover:text-[#0D274C] min-h-[165px] cursor-pointer group shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#65C443]/10 border border-[#65C443]/20 flex items-center justify-center text-[#65C443] group-hover:scale-105 group-hover:bg-[#65C443]/20 transition shrink-0">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[#0D274C] transition">
                    + Tambah Seksi Bidang
                  </div>
                  <div className="text-[10px] text-slate-500 max-w-[220px]">
                    Seksi Kebersihan, Keamanan, Perlengkapan, Kerohanian, dll.
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED MODAL: ASSIGN JABATAN STRUKTUR SISWA */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Atur Jabatan Pengurus Kelas</span>
              </h3>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoleAssignment} className="space-y-4 text-xs">
              {/* Nama Posisi / Jabatan */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Posisi / Nama Jabatan:</label>
                <input
                  type="text"
                  value={modalRoleTitle}
                  onChange={(e) => setModalRoleTitle(e.target.value)}
                  placeholder="Contoh: Ketua Kelas, Wakil Ketua Kelas, Sekretaris 1, Bendahara, Seksi Kebersihan"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-medium text-xs"
                />

                {/* Preset Suggestions */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Pilihan Cepat:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Ketua Kelas",
                      "Wakil Ketua Kelas",
                      "Sekretaris 1",
                      "Sekretaris 2",
                      "Bendahara 1",
                      "Bendahara 2",
                      "Seksi Kebersihan",
                      "Seksi Keamanan",
                      "Seksi Perlengkapan",
                      "Seksi Kerohanian",
                      "Seksi Absensi",
                    ].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setModalRoleTitle(role)}
                        className={`px-2 py-0.5 rounded text-[10px] border transition cursor-pointer ${
                          modalRoleTitle === role
                            ? "bg-[#0D274C] text-white border-[#0D274C]"
                            : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pilih Siswa */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Siswa yang Mengemban Jabatan:</label>
                <select
                  value={modalSelectedEnrollmentId}
                  onChange={(e) => setModalSelectedEnrollmentId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-medium text-xs cursor-pointer"
                >
                  <option value="">-- Pilih Siswa dari Rombel ({classData?.students?.length || 0} Siswa) --</option>
                  {classData?.students?.map((s: any) => (
                    <option key={s.enrollmentId} value={s.enrollmentId}>
                      {s.displayName} (NIS: {s.nis}) {s.roleInClass && s.roleInClass !== "Anggota Kelas" ? `[Saat ini: ${s.roleInClass}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Occupant Alert & Clear Option */}
              {modalCurrentHolderName && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="text-slate-600">
                    Pemegang saat ini: <strong className="text-slate-900">{modalCurrentHolderName}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearRoleAssignment}
                    className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                    title="Kosongkan jabatan ini tanpa menghapus siswa dari rombel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan Posisi</span>
                  </button>
                </div>
              )}

              {roleSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{roleSuccessMessage}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-200 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={roleUpdating}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
                >
                  {roleUpdating ? "Menyimpan..." : "Simpan Penugasan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DATA SISWA */}
      {showEditStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#0D274C]" />
                  <span>Edit Data Siswa</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sesuaikan identitas, akun login, dan status siswa secara rinci.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditStudentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {editStudentError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editStudentError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditStudent} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">NIS (Nomor Induk Siswa)</label>
                  <input
                    type="text"
                    value={editStudentNis}
                    onChange={(e) => setEditStudentNis(e.target.value)}
                    placeholder="Contoh: 202601001"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">NISN (Nasional)</label>
                  <input
                    type="text"
                    value={editStudentNisn}
                    onChange={(e) => setEditStudentNisn(e.target.value)}
                    placeholder="Contoh: 0081234567"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Lengkap Siswa *</label>
                <input
                  required
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="Contoh: Ahmad Fauzan"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Jenis Kelamin</label>
                  <select
                    value={editStudentGender}
                    onChange={(e) => setEditStudentGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] text-xs cursor-pointer"
                  >
                    <option value="">-- Pilih Kelamin --</option>
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Status Akun</label>
                  <select
                    value={editStudentIsActive ? "active" : "inactive"}
                    onChange={(e) => setEditStudentIsActive(e.target.value === "active")}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] text-xs cursor-pointer"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Username Login *</label>
                  <input
                    required
                    type="text"
                    value={editStudentUsername}
                    onChange={(e) => setEditStudentUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Email Siswa (Opsional)</label>
                  <input
                    type="email"
                    value={editStudentEmail}
                    onChange={(e) => setEditStudentEmail(e.target.value)}
                    placeholder="email@sekolah.sch.id"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] text-xs"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <label className="block text-slate-700 font-medium">
                  Ubah Kata Sandi (Kosongkan jika tidak diubah)
                </label>
                <input
                  type="password"
                  value={editStudentPassword}
                  onChange={(e) => setEditStudentPassword(e.target.value)}
                  placeholder="Ketik kata sandi baru minimal 6 karakter..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditStudentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editStudentSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  {editStudentSubmitting ? "Menyimpan..." : "Simpan Perubahan Siswa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
