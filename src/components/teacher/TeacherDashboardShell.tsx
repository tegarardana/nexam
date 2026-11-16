"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import Header from "@/components/layout/Header";
import TeacherSidebar, { TeacherTab } from "@/components/teacher/TeacherSidebar";
import TeacherExaminationPanel from "@/components/teacher/TeacherExaminationPanel";
import ExamGradeRecapPanel from "@/components/admin/ExamGradeRecapPanel";
import { formatNameWithTitle } from "@/lib/format-user";
import {
  BookOpen,
  Users,
  ShieldAlert,
  ArrowRight,
  LayoutDashboard,
  ChevronRight,
  Search,
  FileQuestion,
  Calendar,
  GraduationCap,
  Activity,
  FileSpreadsheet,
  Sparkles,
  Download,
  CheckCircle2,
  XCircle,
  UserCheck,
  AlertCircle,
  Crown,
  Award,
  FileText,
  Wallet,
  Coins,
  Plus,
  Edit2,
  ShieldCheck,
  Check,
} from "lucide-react";

interface TeacherDashboardShellProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    title?: string | null;
    roles: string[];
  };
  activeYear?: {
    id: string;
    name: string;
    semesters: Array<{ id: string; name: string; status?: string }>;
  } | null;
  subjects: any[];
  academicYears: any[];
  semesters: any[];
  classGroups: any[];
  teachers: any[];
  assignments: any[];
  assignedProctorCount: number;
  homeroomClasses?: any[];
  scheduledExamsCount?: number;
  totalStudents?: number;
  initialTab?: TeacherTab;
}

export default function TeacherDashboardShell({
  user,
  activeYear,
  subjects,
  academicYears,
  semesters,
  classGroups,
  teachers,
  assignments,
  assignedProctorCount,
  homeroomClasses = [],
  scheduledExamsCount = 0,
  initialTab = "dashboard",
}: TeacherDashboardShellProps) {
  const router = useRouter();

  // Sidebar collapse & mobile drawer state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TeacherTab>(initialTab);
  const [qbSearchTerm, setQbSearchTerm] = useState("");

  // Homeroom Classes State (editable for organizational structure updates)
  const [classesData, setClassesData] = useState<any[]>(homeroomClasses);
  const [selectedClassId, setSelectedClassId] = useState<string>(
    homeroomClasses?.[0]?.id || ""
  );

  // Class Management Sub-tabs: "structure" | "roster"
  const [classSubTab, setClassSubTab] = useState<"structure" | "roster">("structure");
  const [studentSearch, setStudentSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "L" | "P">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Role Assignment Modal State
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [modalRoleTitle, setModalRoleTitle] = useState("");
  const [modalCurrentHolderName, setModalCurrentHolderName] = useState<string | null>(null);
  const [modalCurrentEnrollmentId, setModalCurrentEnrollmentId] = useState<string | null>(null);
  const [modalSelectedEnrollmentId, setModalSelectedEnrollmentId] = useState<string>("");
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [roleSuccessMessage, setRoleSuccessMessage] = useState<string | null>(null);

  // Sync with prop updates
  useEffect(() => {
    setClassesData(homeroomClasses);
    if (!selectedClassId && homeroomClasses?.[0]?.id) {
      setSelectedClassId(homeroomClasses[0].id);
    }
  }, [homeroomClasses, selectedClassId]);

  // Close role modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && roleModalOpen) {
        setRoleModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [roleModalOpen]);

  const isHomeroomTeacher = Boolean(classesData && classesData.length > 0);
  const currentHomeroomClass =
    classesData.find((c: any) => c.id === selectedClassId) || classesData?.[0];

  const homeroomStudentCount =
    classesData?.reduce(
      (acc, c) => acc + (c._count?.studentEnrollments || c.studentEnrollments?.length || 0),
      0
    ) || 0;

  // Unique subjects taught
  const uniqueSubjectIds = new Set(
    assignments?.map((a) => a.subjectOffering?.subject?.id || a.subjectOffering?.subjectId).filter(Boolean)
  );
  const uniqueSubjectCount = uniqueSubjectIds.size || assignments.length;

  const activeSemester = activeYear?.semesters[0];

  const filteredQbSubjects = (subjects || []).filter((sub: any) => {
    if (!qbSearchTerm.trim()) return true;
    const term = qbSearchTerm.toLowerCase();
    return (
      sub.name?.toLowerCase().includes(term) ||
      sub.code?.toLowerCase().includes(term) ||
      sub.subjectCategory?.name?.toLowerCase().includes(term) ||
      sub.category?.toLowerCase().includes(term)
    );
  });

  const handleSelectTab = (tab: TeacherTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (tab === "dashboard") {
        params.delete("tab");
        params.delete("view");
      } else {
        params.set("tab", tab);
        const viewMap: Record<TeacherTab, string> = {
          dashboard: "schedule",
          class_management: "class",
          question_banks: "question_banks",
          exam_schedules: "schedule",
          exam_status: "monitoring",
          exam_results: "results",
          exam_analysis: "analysis",
          exam_grades: "grades",
        };
        params.set("view", viewMap[tab]);
      }
      const newUrl = params.toString() ? `/teacher?${params.toString()}` : "/teacher";
      router.replace(newUrl, { scroll: false });
    }
  };

  const handlePanelModeChange = (mode: "schedule" | "monitoring" | "results" | "analysis" | "grades") => {
    const tabMap: Record<string, TeacherTab> = {
      schedule: "exam_schedules",
      monitoring: "exam_status",
      results: "exam_results",
      analysis: "exam_analysis",
      grades: "exam_grades",
    };
    const nextTab = tabMap[mode] || "dashboard";
    if (nextTab !== activeTab) {
      handleSelectTab(nextTab);
    }
  };

  const getTabTitle = (tab: TeacherTab): string => {
    switch (tab) {
      case "dashboard":
        return "Dashboard";
      case "class_management":
        return "Manajemen Kelas";
      case "question_banks":
        return "Bank Soal Ujian";
      case "exam_schedules":
        return "Jadwal Pelaksanaan Ujian";
      case "exam_status":
        return "Status Siswa (Monitoring CBT)";
      case "exam_results":
        return "Hasil Ujian Peserta";
      case "exam_analysis":
        return "Analisis Butir Soal";
      case "exam_grades":
        return "Rekap Nilai Siswa";
      default:
        return "Dashboard";
    }
  };

  // Build students list & structure hierarchy from current class
  const classEnrollments = currentHomeroomClass?.studentEnrollments || [];
  const studentsList = classEnrollments.map((en: any, index: number) => ({
    enrollmentId: en.id,
    studentId: en.student?.id,
    number: index + 1,
    displayName: en.student?.displayName || "-",
    username: en.student?.username || "-",
    nis: en.student?.nis || "-",
    nisn: en.student?.nisn || "-",
    gender: en.student?.gender === "L" ? "Laki-laki" : en.student?.gender === "P" ? "Perempuan" : "-",
    genderCode: en.student?.gender || "-",
    email: en.student?.email || "-",
    isActive: Boolean(en.student?.isActive),
    status: en.status || "active",
    roleInClass: en.notes || "Anggota Kelas",
    enrolledAt: en.enrolledAt,
  }));

  const structure = {
    homeroomTeacher: currentHomeroomClass?.homeroomTeacher
      ? {
          id: currentHomeroomClass.homeroomTeacher.id,
          name: currentHomeroomClass.homeroomTeacher.displayName,
          nip: currentHomeroomClass.homeroomTeacher.nip || "-",
          title: currentHomeroomClass.homeroomTeacher.title || "-",
          position: "Wali Kelas",
        }
      : {
          id: user.id,
          name: user.displayName,
          nip: (user as any).nip || user.username,
          title: user.title || "-",
          position: "Wali Kelas",
        },
    leader:
      studentsList.find(
        (s: any) =>
          s.roleInClass.toLowerCase().includes("ketua kelas") ||
          s.roleInClass.toLowerCase() === "ketua"
      ) || null,
    viceLeader:
      studentsList.find((s: any) =>
        s.roleInClass.toLowerCase().includes("wakil ketua")
      ) || null,
    secretary1:
      studentsList.find(
        (s: any) =>
          s.roleInClass.toLowerCase() === "sekretaris 1" ||
          s.roleInClass.toLowerCase() === "sekretaris"
      ) || null,
    secretary2:
      studentsList.find(
        (s: any) => s.roleInClass.toLowerCase() === "sekretaris 2"
      ) || null,
    treasurer1:
      studentsList.find(
        (s: any) =>
          s.roleInClass.toLowerCase() === "bendahara 1" ||
          s.roleInClass.toLowerCase() === "bendahara"
      ) || null,
    treasurer2:
      studentsList.find(
        (s: any) => s.roleInClass.toLowerCase() === "bendahara 2"
      ) || null,
    sections: studentsList.filter(
      (s: any) =>
        s.roleInClass.toLowerCase().startsWith("seksi") ||
        s.roleInClass.toLowerCase().startsWith("koordinator")
    ),
    customRoles: studentsList.filter(
      (s: any) =>
        s.roleInClass !== "Anggota Kelas" &&
        !s.roleInClass.toLowerCase().includes("ketua") &&
        !s.roleInClass.toLowerCase().includes("sekretaris") &&
        !s.roleInClass.toLowerCase().includes("bendahara") &&
        !s.roleInClass.toLowerCase().startsWith("seksi") &&
        !s.roleInClass.toLowerCase().startsWith("koordinator")
    ),
  };

  // Filter students for Roster table
  const filteredEnrollments = studentsList.filter((s: any) => {
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      const matchName = s.displayName?.toLowerCase().includes(q);
      const matchNis = s.nis?.toLowerCase().includes(q);
      const matchNisn = s.nisn?.toLowerCase().includes(q);
      const matchUser = s.username?.toLowerCase().includes(q);
      const matchRole = s.roleInClass?.toLowerCase().includes(q);
      if (!matchName && !matchNis && !matchNisn && !matchUser && !matchRole) return false;
    }

    if (genderFilter !== "all") {
      if (s.genderCode !== genderFilter) return false;
    }

    if (statusFilter !== "all") {
      if (statusFilter === "active" && !s.isActive) return false;
      if (statusFilter === "inactive" && s.isActive) return false;
    }

    return true;
  });

  const classTotalStudents = studentsList.length;
  const classMaleCount = studentsList.filter((s: any) => s.genderCode === "L").length;
  const classFemaleCount = studentsList.filter((s: any) => s.genderCode === "P").length;
  const classActiveCount = studentsList.filter((s: any) => s.isActive).length;

  // Open Assign Modal From Structure Card
  const openAssignModalForRole = (roleName: string, currentHolder?: any) => {
    setModalRoleTitle(roleName);
    setModalCurrentHolderName(currentHolder?.displayName || currentHolder?.name || null);
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
    if (!currentHomeroomClass) return;
    if (!modalSelectedEnrollmentId) {
      alert("Silakan pilih siswa yang akan ditugaskan.");
      return;
    }
    setRoleUpdating(true);
    setRoleSuccessMessage(null);
    try {
      // If position had a different previous holder, clear previous holder first
      if (modalCurrentEnrollmentId && modalCurrentEnrollmentId !== modalSelectedEnrollmentId) {
        await fetch(`/api/academic/classes/${currentHomeroomClass.id}`, {
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
      const res = await fetch(`/api/academic/classes/${currentHomeroomClass.id}`, {
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

      // Update local state
      setClassesData((prevClasses) =>
        prevClasses.map((c) => {
          if (c.id !== currentHomeroomClass.id) return c;
          return {
            ...c,
            studentEnrollments: (c.studentEnrollments || []).map((en: any) => {
              if (
                modalCurrentEnrollmentId &&
                en.id === modalCurrentEnrollmentId &&
                modalCurrentEnrollmentId !== modalSelectedEnrollmentId
              ) {
                return { ...en, notes: null };
              }
              if (en.id === modalSelectedEnrollmentId) {
                return { ...en, notes: modalRoleTitle.trim() || null };
              }
              return en;
            }),
          };
        })
      );

      setRoleSuccessMessage(json.message || "Jabatan berhasil diperbarui.");
      setTimeout(() => {
        setRoleModalOpen(false);
        setRoleSuccessMessage(null);
        router.refresh();
      }, 700);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRoleUpdating(false);
    }
  };

  // Handle Clear Role Assignment
  const handleClearRoleAssignment = async () => {
    if (!currentHomeroomClass || !modalCurrentEnrollmentId) return;
    if (!confirm(`Kosongkan jabatan '${modalRoleTitle}' dari siswa saat ini?`)) return;
    setRoleUpdating(true);
    setRoleSuccessMessage(null);
    try {
      const res = await fetch(`/api/academic/classes/${currentHomeroomClass.id}`, {
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
        throw new Error(json.error || "Gagal mengosongkan jabatan siswa");
      }

      // Update local state
      setClassesData((prevClasses) =>
        prevClasses.map((c) => {
          if (c.id !== currentHomeroomClass.id) return c;
          return {
            ...c,
            studentEnrollments: (c.studentEnrollments || []).map((en: any) =>
              en.id === modalCurrentEnrollmentId ? { ...en, notes: null } : en
            ),
          };
        })
      );

      setRoleSuccessMessage("Jabatan berhasil dikosongkan.");
      setTimeout(() => {
        setRoleModalOpen(false);
        setRoleSuccessMessage(null);
        router.refresh();
      }, 700);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRoleUpdating(false);
    }
  };

  // Export class students to Excel (.xlsx)
  const handleExportClassStudents = () => {
    if (!currentHomeroomClass || studentsList.length === 0) return;
    const rows = studentsList.map((s: any, idx: number) => ({
      No: idx + 1,
      "Nama Siswa": s.displayName,
      NIS: s.nis,
      NISN: s.nisn,
      Username: s.username,
      "Jabatan di Kelas": s.roleInClass,
      "Jenis Kelamin": s.gender,
      "Status Akun": s.isActive ? "Aktif" : "Non-Aktif",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 32 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Siswa ${currentHomeroomClass.name}`);
    XLSX.writeFile(
      wb,
      `Data_Siswa_${currentHomeroomClass.name.replace(/\s+/g, "_")}.xlsx`
    );
  };

  // Officer Card Component for Organizational Chart
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
    theme: "amber" | "sky" | "teal" | "purple" | "emerald";
    isStudentRole?: boolean;
  }) => {
    const themeMap = {
      emerald: {
        badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        iconBox: "bg-emerald-50 border border-emerald-200 text-emerald-600",
        hoverBorder: "hover:border-emerald-400",
      },
      amber: {
        badge: "bg-amber-50 text-amber-700 border border-amber-200",
        iconBox: "bg-amber-50 border border-amber-200 text-amber-600",
        hoverBorder: "hover:border-amber-400",
      },
      sky: {
        badge: "bg-sky-50 text-sky-700 border border-sky-200",
        iconBox: "bg-sky-50 border border-sky-200 text-sky-600",
        hoverBorder: "hover:border-sky-400",
      },
      teal: {
        badge: "bg-teal-50 text-teal-700 border border-teal-200",
        iconBox: "bg-teal-50 border border-teal-200 text-teal-600",
        hoverBorder: "hover:border-teal-400",
      },
      purple: {
        badge: "bg-purple-50 text-purple-700 border border-purple-200",
        iconBox: "bg-purple-50 border border-purple-200 text-purple-600",
        hoverBorder: "hover:border-purple-400",
      },
    };

    const styles = themeMap[theme];
    const isOccupied = Boolean(holder?.displayName || holder?.name);
    const displayName = isOccupied
      ? formatNameWithTitle(holder?.displayName || holder?.name, holder?.title)
      : "Belum Ditetapkan";
    const idInfo = holder?.nis
      ? `NIS: ${holder.nis}`
      : holder?.nip
      ? `NIP: ${holder.nip}`
      : "Posisi Kosong";

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

        {/* Footer / Status */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">
            {isStudentRole ? "Pengurus Rombel Murid" : "Pembina & Wali Kelas"}
          </span>
          <span
            className={`font-semibold ${
              isOccupied ? "text-slate-700" : "text-amber-600"
            }`}
          >
            {isOccupied ? "Aktif Bertugas" : "Perlu Penugasan"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Collapsible Sidebar (Portal Guru) */}
      <TeacherSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        assignedProctorCount={assignedProctorCount}
        isHomeroomTeacher={isHomeroomTeacher}
        homeroomClassName={currentHomeroomClass?.name}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Header with Breadcrumb & Mobile Menu Button */}
        <Header
          user={user}
          activeYear={activeYear?.name}
          activeSemester={activeSemester?.name}
          onToggleMobileMenu={() => setMobileSidebarOpen(true)}
          breadcrumb={
            activeTab === "dashboard" ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <div className="w-7 h-7 rounded-lg bg-[#0D274C]/5 border border-[#0D274C]/10 flex items-center justify-center text-[#0D274C]">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-slate-800 text-sm">Dashboard Pengajar</span>
              </div>
            ) : activeTab === "class_management" ? (
              <nav
                className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 overflow-hidden"
                aria-label="Breadcrumb"
              >
                <button
                  type="button"
                  onClick={() => handleSelectTab("dashboard")}
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#0D274C] font-medium transition cursor-pointer shrink-0"
                  title="Ke Dashboard"
                >
                  <div className="w-6 h-6 rounded-md bg-slate-100 hover:bg-[#0D274C]/10 flex items-center justify-center text-slate-500 hover:text-[#0D274C] transition">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                  </div>
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="font-bold text-[#0D274C] whitespace-nowrap truncate max-w-[180px] sm:max-w-none">
                  Manajemen Kelas {currentHomeroomClass ? `(${currentHomeroomClass.name})` : ""}
                </span>
              </nav>
            ) : (
              <nav
                className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 overflow-hidden"
                aria-label="Breadcrumb"
              >
                <button
                  type="button"
                  onClick={() => handleSelectTab("dashboard")}
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#0D274C] font-medium transition cursor-pointer shrink-0"
                  title="Ke Dashboard"
                >
                  <div className="w-6 h-6 rounded-md bg-slate-100 hover:bg-[#0D274C]/10 flex items-center justify-center text-slate-500 hover:text-[#0D274C] transition">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                  </div>
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-slate-500 font-medium whitespace-nowrap shrink-0">
                  Ujian / Ulangan
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="font-bold text-[#0D274C] whitespace-nowrap truncate max-w-[140px] sm:max-w-xs md:max-w-none">
                  {getTabTitle(activeTab)}
                </span>
              </nav>
            )
          }
        />

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* VIEW: DASHBOARD OVERVIEW */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Modern Welcome Banner (Mirip Admin) */}
              <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[#0D274C] text-xs font-semibold">
                        <BookOpen className="w-3.5 h-3.5 text-[#65C443]" />
                        <span>Portal Pengajar & Pengawas CBT</span>
                      </div>
                      {isHomeroomTeacher && currentHomeroomClass && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Wali Kelas: {currentHomeroomClass.name}</span>
                        </div>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                      Selamat Datang, {formatNameWithTitle(user.displayName, user.title)}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      NIP / Akun:{" "}
                      <span className="text-[#0D274C] font-mono font-semibold">{user.username}</span>
                      {activeYear && (
                        <span>
                          {" "}
                          • TA {activeYear.name}{" "}
                          {activeSemester ? `(Semester ${activeSemester.name})` : ""}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#65C443] animate-pulse" />
                    <span className="font-semibold text-slate-700">Status Mengajar Aktif</span>
                  </div>
                </div>
              </div>

              {/* Statistical Summary Cards (Mirip Admin Panel) */}
              {/* Jika Wali Kelas: 4 Kolom. Jika Bukan Wali Kelas: 3 Kolom */}
              <div
                className={`grid gap-4 ${
                  isHomeroomTeacher ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"
                }`}
              >
                {/* 1. Mata Pelajaran Diampu */}
                <div
                  onClick={() => handleSelectTab("question_banks")}
                  className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2 hover:border-[#0D274C]/50 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Mata Pelajaran Diampu</span>
                    <div className="w-8 h-8 rounded-lg bg-[#0D274C]/10 flex items-center justify-center text-[#0D274C] group-hover:bg-[#0D274C] group-hover:text-white transition">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {uniqueSubjectCount}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{assignments.length} Rombel Kelas Mengajar</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* 2. Jadwal Ujian Aktif */}
                <div
                  onClick={() => handleSelectTab("exam_schedules")}
                  className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2 hover:border-[#65C443]/50 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Jadwal Ujian Aktif</span>
                    <div className="w-8 h-8 rounded-lg bg-[#65C443]/10 flex items-center justify-center text-[#65C443] group-hover:bg-[#65C443] group-hover:text-white transition">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {scheduledExamsCount}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Sesi Ujian Disiapkan</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* 3. Tugas Pengawas CBT */}
                <div
                  onClick={() => handleSelectTab("exam_status")}
                  className={`rounded-xl p-4 sm:p-5 bg-white border shadow-sm space-y-2 transition cursor-pointer group ${
                    assignedProctorCount > 0
                      ? "border-blue-200 hover:border-blue-400 hover:shadow-md"
                      : "border-slate-200 hover:border-slate-400 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Tugas Pengawas CBT</span>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                        assignedProctorCount > 0
                          ? "bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-600 group-hover:text-white"
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {assignedProctorCount}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      {assignedProctorCount > 0
                        ? "Sesi Membutuhkan Pengawasan"
                        : "Tidak Ada Sesi Pengawasan"}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* 4. Siswa di Kelas (HANYA MUNCUL KEPADA WALI KELAS!) */}
                {isHomeroomTeacher && (
                  <div
                    onClick={() => handleSelectTab("class_management")}
                    className="rounded-xl p-4 sm:p-5 bg-white border border-emerald-200 shadow-sm space-y-2 hover:border-emerald-500 hover:shadow-md transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                      <span className="truncate">
                        Siswa di Kelas {currentHomeroomClass?.name || ""}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800">
                      {homeroomStudentCount}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Rombel Binaan • Kelola Siswa</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Action Shortcuts (Aksi Cepat & Jalan Pintas Mirip Admin) */}
              <div className="rounded-2xl p-6 bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#65C443]" />
                    <span>Aksi Cepat & Jalan Pintas</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">
                    Akses Cepat Fitur CBT & Akademik
                  </span>
                </div>

                <div
                  className={`grid gap-3 ${
                    isHomeroomTeacher
                      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                      : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectTab("question_banks")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-[#0D274C]/5 hover:border-[#0D274C]/30 transition text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-[#0D274C] group-hover:border-[#0D274C]/30 shadow-2xs mb-2 transition">
                      <FileQuestion className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-[#0D274C] transition">
                      Bank Soal
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      Kelola kisi-kisi & butir soal
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTab("exam_schedules")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-[#65C443]/5 hover:border-[#65C443]/30 transition text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-[#65C443] group-hover:border-[#65C443]/30 shadow-2xs mb-2 transition">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-[#65C443] transition">
                      Jadwal Ujian
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      Buat & atur pelaksanaan
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTab("exam_status")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-sky-50 hover:border-sky-300 transition text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-sky-600 group-hover:border-sky-300 shadow-2xs mb-2 transition">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-sky-700 transition">
                      Pantau CBT Live
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      Status siswa & kendali tes
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTab("exam_grades")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-emerald-50 hover:border-emerald-300 transition text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-emerald-700 group-hover:border-emerald-300 shadow-2xs mb-2 transition">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-800 transition">
                      Rekap Nilai
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      Lihat & ekspor nilai siswa
                    </div>
                  </button>

                  {isHomeroomTeacher && (
                    <button
                      type="button"
                      onClick={() => handleSelectTab("class_management")}
                      className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 hover:border-emerald-300 transition text-left group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 group-hover:text-emerald-800 shadow-2xs mb-2 transition">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-bold text-emerald-900">
                        Kelola Kelas & Struktur
                      </div>
                      <div className="text-[11px] text-emerald-700 mt-0.5 line-clamp-1">
                        Siswa & struktur {currentHomeroomClass?.name || ""}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: MANAJEMEN KELAS & STRUKTUR ORGANISASI (KHUSUS WALI KELAS) */}
          {activeTab === "class_management" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {!isHomeroomTeacher ? (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Akses Terbatas</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Menu Manajemen Kelas hanya tersedia untuk pengajar yang ditugaskan sebagai Wali Kelas oleh Administrator Sekolah.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTab("dashboard")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D274C] text-white text-xs font-semibold cursor-pointer"
                  >
                    <span>Kembali ke Dashboard</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Multi-class switcher if teacher has more than 1 class */}
                  {classesData.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="text-xs font-bold text-slate-600 shrink-0 mr-1">
                        Pilih Kelas:
                      </span>
                      {classesData.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedClassId(c.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                            currentHomeroomClass?.id === c.id
                              ? "bg-[#0D274C] text-white shadow-xs"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Class Header Banner */}
                  <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Kelas Binaan Wali Kelas</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                          Kelas {currentHomeroomClass?.name || "-"}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-700">
                            Tingkat {currentHomeroomClass?.gradeLevel || "-"}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-700">
                            Jurusan: {currentHomeroomClass?.major?.name || "Semua Jurusan"}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-700">
                            TA {currentHomeroomClass?.academicYear?.name || activeYear?.name || "-"}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                            Wali Kelas: {formatNameWithTitle(user.displayName, user.title)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={handleExportClassStudents}
                          disabled={classEnrollments.length === 0}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs hover:shadow-sm transition cursor-pointer"
                          title="Unduh daftar lengkap siswa kelas ini dalam format Excel (.xlsx)"
                        >
                          <Download className="w-4 h-4" />
                          <span>Ekspor Excel (.xlsx)</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4 Summary Metric Cards for this Class */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                        <span>Total Siswa</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <Users className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                        {classTotalStudents}
                      </div>
                      <div className="text-[11px] text-slate-400">Siswa terdaftar di rombel</div>
                    </div>

                    <div className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                        <span>Siswa Laki-laki</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <UserCheck className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                        {classMaleCount}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {classTotalStudents > 0
                          ? `${Math.round((classMaleCount / classTotalStudents) * 100)}% dari rombel`
                          : "0%"}
                      </div>
                    </div>

                    <div className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                        <span>Siswa Perempuan</span>
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                          <UserCheck className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                        {classFemaleCount}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {classTotalStudents > 0
                          ? `${Math.round((classFemaleCount / classTotalStudents) * 100)}% dari rombel`
                          : "0%"}
                      </div>
                    </div>

                    <div className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                        <span>Akun Aktif</span>
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-teal-700">
                        {classActiveCount}
                      </div>
                      <div className="text-[11px] text-slate-400">Siap mengikuti ujian CBT</div>
                    </div>
                  </div>

                  {/* Sub-tab Navigation (Struktur Organisasi vs Daftar Siswa) */}
                  <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-2xl w-fit">
                    <button
                      type="button"
                      onClick={() => setClassSubTab("structure")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        classSubTab === "structure"
                          ? "bg-white text-[#0D274C] shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Crown className="w-4 h-4 text-amber-500" />
                      <span>Struktur Organisasi Kelas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassSubTab("roster")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        classSubTab === "roster"
                          ? "bg-white text-[#0D274C] shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Users className="w-4 h-4 text-slate-500" />
                      <span>Daftar Siswa Rombel ({classTotalStudents})</span>
                    </button>
                  </div>

                  {/* SUB-VIEW 1: STRUKTUR ORGANISASI KELAS (BAGAN VISUAL & PENGATURAN) */}
                  {classSubTab === "structure" && (
                    <div className="space-y-10 animate-in fade-in duration-150">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Crown className="w-5 h-5 text-amber-500" />
                            <span>Bagan Struktur Kepengurusan Kelas {currentHomeroomClass?.name}</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Sebagai wali kelas, Anda dapat mengatur dan mengubah penugasan pengurus kelas. Klik tombol{" "}
                            <strong className="text-slate-700">Ubah</strong> atau{" "}
                            <strong className="text-slate-700">+ Tetapkan</strong> pada posisi mana saja.
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => openAssignModalForRole("Seksi ", null)}
                            className="px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Seksi Bidang</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setClassSubTab("roster")}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                          >
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>Lihat Daftar Siswa</span>
                          </button>
                        </div>
                      </div>

                      {/* Hierarchical Hierarchy Board */}
                      <div className="space-y-12 py-2">
                        {/* LEVEL 1: WALI KELAS */}
                        <div className="flex flex-col items-center">
                          <div className="text-center mb-4">
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
                          <div className="w-0.5 h-10 bg-slate-300 my-4" />
                        </div>

                        {/* LEVEL 2: KETUA & WAKIL KETUA KELAS */}
                        <div>
                          <div className="text-center mb-4">
                            <span className="text-[11px] uppercase font-bold tracking-wider text-amber-800 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 inline-flex items-center gap-2 shadow-2xs">
                              <Crown className="w-3.5 h-3.5 text-amber-600" />
                              <span>Level 2 • Pimpinan Murid (Ketua & Wakil Ketua)</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
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
                          <div className="w-0.5 h-10 bg-slate-300 mx-auto my-4" />
                        </div>

                        {/* LEVEL 3: SEKRETARIS & BENDAHARA */}
                        <div>
                          <div className="text-center mb-4">
                            <span className="text-[11px] uppercase font-bold tracking-wider text-sky-800 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 inline-flex items-center gap-2 shadow-2xs">
                              <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                              <span>Level 3 • Pengurus Administrasi & Keuangan</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-6xl mx-auto">
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
                          <div className="w-0.5 h-10 bg-slate-300 mx-auto my-4" />
                        </div>

                        {/* LEVEL 4: SEKSI-SEKSI & KOORDINATOR BIDANG */}
                        <div>
                          <div className="text-center mb-4">
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
                              className="rounded-2xl p-6 border-2 border-dashed border-slate-300 hover:border-[#65C443] bg-white hover:bg-slate-50/80 transition flex flex-col items-center justify-center text-center gap-2 text-slate-600 hover:text-[#0D274C] min-h-[175px] cursor-pointer group shadow-sm"
                            >
                              <div className="w-12 h-12 rounded-2xl bg-[#65C443]/10 border border-[#65C443]/20 flex items-center justify-center text-[#65C443] group-hover:scale-105 group-hover:bg-[#65C443]/20 transition shrink-0">
                                <Plus className="w-6 h-6" />
                              </div>
                              <div className="text-xs font-bold text-slate-900 group-hover:text-[#0D274C] transition">
                                + Tambah Seksi Bidang
                              </div>
                              <div className="text-[10px] text-slate-500 max-w-[220px]">
                                Seksi Kebersihan, Keamanan, Perlengkapan, Kerohanian, Absensi, dll.
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW 2: DAFTAR SISWA (ROSTER TABLE & ROLE MANAGEMENT) */}
                  {classSubTab === "roster" && (
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-150">
                      {/* Filter & Search Header */}
                      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Daftar Siswa Kelas {currentHomeroomClass?.name || ""}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Menampilkan {filteredEnrollments.length} dari {classTotalStudents} siswa aktif
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Cari nama, NIS, atau jabatan..."
                              value={studentSearch}
                              onChange={(e) => setStudentSearch(e.target.value)}
                              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:bg-white w-48 sm:w-56"
                            />
                          </div>

                          {/* Gender Filter */}
                          <select
                            value={genderFilter}
                            onChange={(e) => setGenderFilter(e.target.value as any)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#65C443] focus:bg-white cursor-pointer"
                          >
                            <option value="all">Semua Gender</option>
                            <option value="L">Laki-laki (L)</option>
                            <option value="P">Perempuan (P)</option>
                          </select>

                          {/* Status Filter */}
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#65C443] focus:bg-white cursor-pointer"
                          >
                            <option value="all">Semua Status</option>
                            <option value="active">Akun Aktif</option>
                            <option value="inactive">Akun Non-Aktif</option>
                          </select>
                        </div>
                      </div>

                      {/* Table View */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                              <th className="py-3 px-4 w-12 text-center">No</th>
                              <th className="py-3 px-4">NIS / NISN</th>
                              <th className="py-3 px-4">Nama Lengkap Siswa</th>
                              <th className="py-3 px-4">Username Akun</th>
                              <th className="py-3 px-4 text-center">Jabatan Kelas</th>
                              <th className="py-3 px-4 text-center">Jenis Kelamin</th>
                              <th className="py-3 px-4 text-center">Status Akun</th>
                              <th className="py-3 px-4 text-center">Aksi Struktur</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredEnrollments.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-12 text-center text-slate-400">
                                  <div className="space-y-2">
                                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                                    <div className="text-sm font-semibold text-slate-600">
                                      Tidak ada data siswa yang cocok
                                    </div>
                                    <p className="text-xs text-slate-400">
                                      Coba ubah kata kunci pencarian atau reset filter.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredEnrollments.map((s: any, idx: number) => {
                                const hasRole = s.roleInClass && s.roleInClass !== "Anggota Kelas";
                                return (
                                  <tr
                                    key={s.enrollmentId}
                                    className="hover:bg-slate-50/80 transition group"
                                  >
                                    <td className="py-3 px-4 text-center text-slate-400 font-medium">
                                      {idx + 1}
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-semibold text-slate-800">
                                          {s.nis || "-"}
                                        </span>
                                        {s.nisn && (
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            / {s.nisn}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="font-bold text-slate-900 group-hover:text-[#0D274C] transition">
                                        {s.displayName || "-"}
                                      </div>
                                      {s.email && (
                                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                                          {s.email}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                        {s.username}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {hasRole ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                          <Crown className="w-3 h-3 text-purple-600" />
                                          <span>{s.roleInClass}</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-[11px]">Anggota Kelas</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {s.genderCode === "L" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                          Laki-laki
                                        </span>
                                      ) : s.genderCode === "P" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                          Perempuan
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {s.isActive ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          <span>Aktif</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                          <XCircle className="w-3 h-3 text-slate-400" />
                                          <span>Non-Aktif</span>
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <button
                                        type="button"
                                        onClick={() => openAssignModalForStudent(s)}
                                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#0D274C] hover:text-white text-slate-700 border border-slate-200 transition text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs group/btn"
                                        title="Atur Jabatan Siswa di Struktur Kelas"
                                      >
                                        <Edit2 className="w-3 h-3 text-[#65C443] group-hover/btn:text-white" />
                                        <span>Atur Jabatan</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Table Footer */}
                      <div className="p-3 bg-slate-50/60 border-t border-slate-200 text-slate-500 text-xs flex items-center justify-between">
                        <span>Total Data: {filteredEnrollments.length} Siswa</span>
                        <span className="text-[11px] text-slate-400">
                          Sinkronisasi Rombongan Belajar Nexam CBT
                        </span>
                      </div>
                    </div>
                  )}

                  {/* UNIFIED MODAL: ATUR JABATAN STRUKTUR SISWA */}
                  {roleModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
                      <div className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl space-y-4">
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
                              <option value="">-- Pilih Siswa dari Rombel ({studentsList.length} Siswa) --</option>
                              {studentsList.map((s: any) => (
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
                                disabled={roleUpdating}
                                className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer text-xs disabled:opacity-50"
                              >
                                Kosongkan Posisi
                              </button>
                            </div>
                          )}

                          {/* Success Message Banner */}
                          {roleSuccessMessage && (
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{roleSuccessMessage}</span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => setRoleModalOpen(false)}
                              disabled={roleUpdating}
                              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="submit"
                              disabled={roleUpdating}
                              className="px-5 py-2 rounded-xl bg-[#0D274C] hover:bg-[#163B6E] text-white font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                            >
                              {roleUpdating ? (
                                <span>Menyimpan...</span>
                              ) : (
                                <>
                                  <Check className="w-4 h-4 text-[#65C443]" />
                                  <span>Simpan Penugasan</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* VIEW: BANK SOAL UJIAN (KATALOG BANK SOAL MAPEL) */}
          {activeTab === "question_banks" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Katalog Bank Soal Ujian CBT</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih mata pelajaran untuk mengelola butir soal, mengatur paket ujian, dan melihat kisi-kisi soal.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari mata pelajaran..."
                      value={qbSearchTerm}
                      onChange={(e) => setQbSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQbSubjects.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                    Tidak ada mata pelajaran yang sesuai.
                  </div>
                ) : (
                  filteredQbSubjects.map((sub: any) => {
                    const isTaughtByMe = assignments?.some(
                      (a: any) =>
                        a.subjectOffering?.subject?.id === sub.id ||
                        a.subjectOffering?.subjectId === sub.id
                    );

                    return (
                      <div
                        key={sub.id}
                        className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-[#65C443]/50 hover:shadow-md transition flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {sub.code || "MAPEL"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isTaughtByMe && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                                  Diampu Anda
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                {sub.subjectCategory?.name || sub.category || "Umum"}
                              </span>
                            </div>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900">{sub.name}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {sub.major?.name
                              ? `Jurusan: ${sub.major.name}`
                              : "Mata Pelajaran Umum (Semua Jurusan)"}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {sub._count?.questionBanks || 0} Paket Bank Soal
                          </span>
                          <Link
                            href={`/teacher/question-banks/${sub.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0D274C] hover:bg-[#163B6E] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                          >
                            <span>Buka Bank Soal</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW: JADWAL UJIAN */}
          {activeTab === "exam_schedules" && (
            <div className="pt-1 animate-in fade-in duration-150">
              <TeacherExaminationPanel
                subjects={subjects}
                academicYears={academicYears}
                semesters={semesters}
                classGroups={classGroups}
                activeYearId={activeYear?.id}
                activeYearName={activeYear?.name}
                activeSemesterId={activeSemester?.id || null}
                activeSemesterName={activeSemester?.name || null}
                assignments={assignments}
                currentTeacherId={user.id}
                userRoles={user.roles}
                teachers={teachers}
                viewMode="schedule"
                onViewModeChange={handlePanelModeChange}
              />
            </div>
          )}

          {/* VIEW: STATUS SISWA (MONITORING UJIAN CBT LIVE) */}
          {activeTab === "exam_status" && (
            <div className="pt-1 animate-in fade-in duration-150">
              <TeacherExaminationPanel
                subjects={subjects}
                academicYears={academicYears}
                semesters={semesters}
                classGroups={classGroups}
                activeYearId={activeYear?.id}
                activeYearName={activeYear?.name}
                activeSemesterId={activeSemester?.id || null}
                activeSemesterName={activeSemester?.name || null}
                assignments={assignments}
                currentTeacherId={user.id}
                userRoles={user.roles}
                teachers={teachers}
                viewMode="monitoring"
                onViewModeChange={handlePanelModeChange}
              />
            </div>
          )}

          {/* VIEW: HASIL UJIAN PESERTA */}
          {activeTab === "exam_results" && (
            <div className="pt-1 animate-in fade-in duration-150">
              <TeacherExaminationPanel
                subjects={subjects}
                academicYears={academicYears}
                semesters={semesters}
                classGroups={classGroups}
                activeYearId={activeYear?.id}
                activeYearName={activeYear?.name}
                activeSemesterId={activeSemester?.id || null}
                activeSemesterName={activeSemester?.name || null}
                assignments={assignments}
                currentTeacherId={user.id}
                userRoles={user.roles}
                teachers={teachers}
                viewMode="results"
                onViewModeChange={handlePanelModeChange}
              />
            </div>
          )}

          {/* VIEW: ANALISIS BUTIR SOAL */}
          {activeTab === "exam_analysis" && (
            <div className="pt-1 animate-in fade-in duration-150">
              <TeacherExaminationPanel
                subjects={subjects}
                academicYears={academicYears}
                semesters={semesters}
                classGroups={classGroups}
                activeYearId={activeYear?.id}
                activeYearName={activeYear?.name}
                activeSemesterId={activeSemester?.id || null}
                activeSemesterName={activeSemester?.name || null}
                assignments={assignments}
                currentTeacherId={user.id}
                userRoles={user.roles}
                teachers={teachers}
                viewMode="analysis"
                onViewModeChange={handlePanelModeChange}
              />
            </div>
          )}

          {/* VIEW: REKAP NILAI SISWA (EXAM GRADE RECAP) */}
          {activeTab === "exam_grades" && (
            <div className="pt-1 animate-in fade-in duration-150">
              <ExamGradeRecapPanel
                subjects={subjects}
                academicYears={academicYears}
                classes={classGroups}
                activeYearId={activeYear?.id}
                activeYearName={activeYear?.name}
                activeSemesterId={activeSemester?.id || null}
                activeSemesterName={activeSemester?.name || null}
                userRoles={user.roles}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
