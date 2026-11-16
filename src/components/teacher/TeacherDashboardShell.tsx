"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  totalStudents: number;
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
  totalStudents,
  initialTab = "dashboard",
}: TeacherDashboardShellProps) {
  const router = useRouter();

  // Sidebar collapse & mobile drawer state (mirrors admin panel)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TeacherTab>(initialTab);
  const [qbSearchTerm, setQbSearchTerm] = useState("");

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
            ) : (
              <nav className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 overflow-hidden" aria-label="Breadcrumb">
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
          {/* Welcome Banner (Prominently displayed on Dashboard) */}
          {activeTab === "dashboard" && (
            <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm animate-in fade-in duration-150">
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[#0D274C] text-xs font-semibold mb-3">
                    <BookOpen className="w-3.5 h-3.5 text-[#65C443]" />
                    <span>Portal Pengajar & Pengawas Ujian</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    Selamat Datang, {formatNameWithTitle(user.displayName, user.title)}
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    NIP / Akun: <span className="text-[#0D274C] font-mono font-semibold">{user.username}</span> • Status Mengajar Aktif
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 p-3.5 rounded-xl shadow-xs">
                    <div className="w-10 h-10 rounded-lg bg-white border border-green-200 flex items-center justify-center text-green-600 shadow-xs">
                      <Users className="w-5 h-5 text-[#65C443]" />
                    </div>
                    <div>
                      <div className="text-xs text-green-800/80 font-medium">Total Siswa Binaan</div>
                      <div className="text-sm font-bold text-green-700">{totalStudents} Siswa Terdaftar</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectTab("exam_status")}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition shadow-xs group cursor-pointer text-left ${
                      assignedProctorCount > 0
                        ? "bg-blue-50/80 border-blue-200 hover:bg-blue-100/80 hover:border-blue-300"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-white border flex items-center justify-center shadow-xs ${
                        assignedProctorCount > 0 ? "border-blue-200 text-blue-600" : "border-slate-200 text-slate-500"
                      }`}
                    >
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                        <span>Tugas Pengawas Ujian</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <div className={`text-sm font-bold ${assignedProctorCount > 0 ? "text-blue-700" : "text-slate-700"}`}>
                        {assignedProctorCount} Sesi Ditugaskan
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: DASHBOARD (JADWAL UJIAN & BANK SOAL MAPEL) */}
          {activeTab === "dashboard" && (
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
