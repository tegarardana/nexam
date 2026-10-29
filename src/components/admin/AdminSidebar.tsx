"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Briefcase,
  GraduationCap,
  Layers,
  Award,
  FileQuestion,
  Activity,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Sliders,
  FolderKanban,
  UserCheck,
  Tag,
} from "lucide-react";

export type AdminTab =
  | "dashboard"
  | "academic_years"
  | "subjects"
  | "majors"
  | "students"
  | "classes"
  | "teachers"
  | "question_banks"
  | "exam_types"
  | "exam_status"
  | "exam_results"
  | "exam_analysis"
  | "exam_grades"
  | "examinations"
  | "user_teachers"
  | "user_students"
  | "admins"
  | "audit";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function AdminSidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
  // Accordion state - Open by default for groups
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    general: true,
    exam_data: true,
    exam_exec: true,
    user_mgmt: true,
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleItemClick = (tab: AdminTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const isTabActive = (tab: AdminTab) => activeTab === tab;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:static ${
          mobileOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-20" : "lg:w-68"}`}
      >
        {/* Sidebar Header / Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0D274C] to-[#163B6E] shadow-sm shadow-[#0D274C]/20 border border-[#0D274C]/30 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <div className="transition-opacity duration-200 truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[#0D274C] tracking-tight text-base">Nexam</span>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-[#65C443] text-white">
                    CBT
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">Administrator Panel</div>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation Body (Scrollable) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-200">
          {/* 1. DASHBOARD OVERVIEW (Single Item) */}
          <div className="space-y-1">
            <button
              onClick={() => handleItemClick("dashboard")}
              title={isCollapsed ? "Dashboard" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer group ${
                isTabActive("dashboard")
                  ? "bg-[#0D274C] text-white shadow-sm shadow-[#0D274C]/25"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard
                className={`w-4.5 h-4.5 shrink-0 ${
                  isTabActive("dashboard") ? "text-[#65C443]" : "text-slate-500 group-hover:text-[#0D274C]"
                }`}
              />
              {!isCollapsed && <span className="truncate">Dashboard</span>}
            </button>
          </div>

          {/* 2. ACCORDION: DATA UMUM */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordion("general")}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-[#65C443]" />
                  <span>Data Umum</span>
                </span>
                {openAccordions.general ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="h-px bg-slate-200 my-2" title="Data Umum" />
            )}

            {(openAccordions.general || isCollapsed) && (
              <div className="space-y-0.5 pt-0.5">
                <button
                  onClick={() => handleItemClick("academic_years")}
                  title={isCollapsed ? "Tahun Pelajaran" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("academic_years")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Calendar
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("academic_years") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Tahun Pelajaran</span>}
                </button>

                <button
                  onClick={() => handleItemClick("subjects")}
                  title={isCollapsed ? "Mata Pelajaran" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("subjects")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <BookOpen
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("subjects") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Mata Pelajaran</span>}
                </button>

                <button
                  onClick={() => handleItemClick("majors")}
                  title={isCollapsed ? "Jurusan" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("majors")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Briefcase
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("majors") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Jurusan</span>}
                </button>

                <button
                  onClick={() => handleItemClick("students")}
                  title={isCollapsed ? "Siswa" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("students")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <GraduationCap
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("students") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Siswa</span>}
                </button>

                <button
                  onClick={() => handleItemClick("classes")}
                  title={isCollapsed ? "Kelas / Rombel" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("classes")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Layers
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("classes") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Kelas / Rombel</span>}
                </button>

                <button
                  onClick={() => handleItemClick("teachers")}
                  title={isCollapsed ? "Guru" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("teachers")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Award
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("teachers") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Guru</span>}
                </button>
              </div>
            )}
          </div>

          {/* 3. ACCORDION: DATA UJIAN */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordion("exam_data")}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <FileQuestion className="w-3.5 h-3.5 text-amber-500" />
                  <span>Data Ujian</span>
                </span>
                {openAccordions.exam_data ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="h-px bg-slate-200 my-2" title="Data Ujian" />
            )}

            {(openAccordions.exam_data || isCollapsed) && (
              <div className="space-y-0.5 pt-0.5">
                <button
                  onClick={() => handleItemClick("question_banks")}
                  title={isCollapsed ? "Bank Soal" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("question_banks")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FileQuestion
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("question_banks") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Bank Soal</span>}
                </button>

                <button
                  onClick={() => handleItemClick("exam_types")}
                  title={isCollapsed ? "Tipe Ujian" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("exam_types")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Tag
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("exam_types") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Tipe Ujian</span>}
                </button>
              </div>
            )}
          </div>

          {/* 4. ACCORDION: PELAKSANAAN UJIAN */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordion("exam_exec")}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-500" />
                  <span>Pelaksanaan Ujian</span>
                </span>
                {openAccordions.exam_exec ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="h-px bg-slate-200 my-2" title="Pelaksanaan Ujian" />
            )}

            {(openAccordions.exam_exec || isCollapsed) && (
              <div className="space-y-0.5 pt-0.5">
                <button
                  onClick={() => handleItemClick("exam_status")}
                  title={isCollapsed ? "Status Siswa" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("exam_status")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Activity
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("exam_status") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Status Siswa</span>}
                </button>

                <button
                  onClick={() => handleItemClick("exam_results")}
                  title={isCollapsed ? "Hasil Ujian" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("exam_results")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <BarChart3
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("exam_results") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Hasil Ujian</span>}
                </button>

                <button
                  onClick={() => handleItemClick("exam_analysis")}
                  title={isCollapsed ? "Analisis Soal" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("exam_analysis")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <PieChart
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("exam_analysis") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Analisis Soal</span>}
                </button>

                <button
                  onClick={() => handleItemClick("exam_grades")}
                  title={isCollapsed ? "Rekap Nilai" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("exam_grades")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FileSpreadsheet
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("exam_grades") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Rekap Nilai</span>}
                </button>
              </div>
            )}
          </div>

          {/* 5. HEADING: PENGATURAN & USER MANAGEMENT */}
          <div className="space-y-1 pt-2">
            {!isCollapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-slate-400" />
                <span>Pengaturan</span>
              </div>
            ) : (
              <div className="h-px bg-slate-200 my-2" title="Pengaturan" />
            )}

            {/* Accordion User Management */}
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordion("user_mgmt")}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>User Management</span>
                </span>
                {openAccordions.user_mgmt ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : null}

            {(openAccordions.user_mgmt || isCollapsed) && (
              <div className="space-y-0.5 pt-0.5">
                <button
                  onClick={() => handleItemClick("user_teachers")}
                  title={isCollapsed ? "User Management: Guru" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("user_teachers")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <UserCheck
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("user_teachers") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Guru (Aktivasi)</span>}
                </button>

                <button
                  onClick={() => handleItemClick("user_students")}
                  title={isCollapsed ? "User Management: Siswa" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("user_students")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <GraduationCap
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("user_students") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Siswa (Aktivasi)</span>}
                </button>

                <button
                  onClick={() => handleItemClick("admins")}
                  title={isCollapsed ? "User Management: Admin" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("admins")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <ShieldCheck
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("admins") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Admin</span>}
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Sidebar Footer: Desktop Collapse Toggle */}
        <div className="hidden lg:flex items-center justify-between p-3 border-t border-slate-200 bg-slate-50/80">
          {!isCollapsed && (
            <span className="text-[11px] font-medium text-slate-500 pl-1">
              Perkecil Sidebar
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0D274C] hover:bg-slate-200 transition cursor-pointer ml-auto"
            title={isCollapsed ? "Perluas Sidebar" : "Perkecil Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
