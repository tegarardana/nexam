/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Activity,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  FileQuestion,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";

export type TeacherTab =
  | "dashboard"
  | "class_management"
  | "question_banks"
  | "exam_schedules"
  | "exam_status"
  | "exam_results"
  | "exam_analysis"
  | "exam_grades";

interface TeacherSidebarProps {
  activeTab: TeacherTab;
  onSelectTab: (tab: TeacherTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  assignedProctorCount?: number;
  isHomeroomTeacher?: boolean;
  homeroomClassName?: string;
}

export default function TeacherSidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  assignedProctorCount = 0,
  isHomeroomTeacher = false,
  homeroomClassName,
}: TeacherSidebarProps) {
  // Accordion state - Open by default for Pelaksanaan Ujian
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    exam_exec: true,
  });

  const [brandSettings, setBrandSettings] = useState<{ appName: string; appLogo: string }>({
    appName: "Nexam",
    appLogo: "",
  });

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings) {
          setBrandSettings({
            appName: data.settings.appName || "Nexam",
            appLogo: data.settings.appLogo || "",
          });
        }
      })
      .catch(() => {});

    const handleUpdate = (e: any) => {
      if (e.detail) {
        setBrandSettings({
          appName: e.detail.appName || "Nexam",
          appLogo: e.detail.appLogo || "",
        });
      }
    };

    window.addEventListener("nexam-settings-updated", handleUpdate);
    return () => window.removeEventListener("nexam-settings-updated", handleUpdate);
  }, []);

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleItemClick = (tab: TeacherTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const isTabActive = (tab: TeacherTab) => activeTab === tab;

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
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${
          mobileOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-20" : "lg:w-68"}`}
      >
        {/* Sidebar Header / Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-3 overflow-hidden">
            {brandSettings.appLogo ? (
              <img
                src={brandSettings.appLogo}
                alt={brandSettings.appName}
                className="w-9 h-9 object-contain shrink-0"
              />
            ) : (
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0D274C] to-[#163B6E] shadow-sm shadow-[#0D274C]/20 border border-[#0D274C]/30 shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
            )}
            {!isCollapsed && (
              <div className="transition-opacity duration-200 truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[#0D274C] tracking-tight text-base truncate">
                    {brandSettings.appName || "Nexam"}
                  </span>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-[#65C443] text-white">
                    CBT
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">Portal Guru & Pengawas</div>
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
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-200">
          {/* 1. DASHBOARD & MANAJEMEN KELAS (Single Items) */}
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

            {/* Khusus Wali Kelas: Menu Manajemen Kelas */}
            {isHomeroomTeacher && (
              <button
                onClick={() => handleItemClick("class_management")}
                title={isCollapsed ? `Manajemen Kelas ${homeroomClassName ? `(${homeroomClassName})` : ""}` : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer group ${
                  isTabActive("class_management")
                    ? "bg-[#0D274C] text-white shadow-sm shadow-[#0D274C]/25"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <GraduationCap
                  className={`w-4.5 h-4.5 shrink-0 ${
                    isTabActive("class_management") ? "text-[#65C443]" : "text-slate-500 group-hover:text-[#0D274C]"
                  }`}
                />
                {!isCollapsed && (
                  <div className="flex items-center justify-between w-full min-w-0">
                    <span className="truncate">Manajemen Kelas</span>
                    {homeroomClassName && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200 ml-1 shrink-0 truncate max-w-[70px]">
                        {homeroomClassName}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )}
          </div>

          {/* 2. ACCORDION: UJIAN / ULANGAN (Mirrors Admin Panel) */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordion("exam_exec")}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-500" />
                  <span>Ujian / Ulangan</span>
                </span>
                {openAccordions.exam_exec ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="h-px bg-slate-200 my-2" title="Ujian / Ulangan" />
            )}

            {(openAccordions.exam_exec || isCollapsed) && (
              <div className="space-y-0.5 pt-0.5">
                {/* Bank Soal */}
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

                {/* Jadwal */}
                <button
                  onClick={() => handleItemClick("exam_schedules")}
                  title={isCollapsed ? "Jadwal" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer group ${
                    isTabActive("exam_schedules")
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Calendar
                    className={`w-4 h-4 shrink-0 ${
                      isTabActive("exam_schedules") ? "text-[#65C443]" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Jadwal</span>}
                </button>

                {/* Status Siswa */}
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
                  {!isCollapsed && (
                    <div className="flex items-center justify-between w-full min-w-0">
                      <span className="truncate">Status Siswa</span>
                      {assignedProctorCount > 0 && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full border border-blue-200 ml-1 shrink-0">
                          {assignedProctorCount}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {/* Hasil Ujian */}
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

                {/* Analisis Soal */}
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

                {/* Rekap Nilai */}
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
        </nav>

        {/* Sidebar Footer: Desktop Collapse Toggle */}
        <div className="hidden lg:flex items-center justify-between p-3 border-t border-slate-200 bg-slate-50/80 shrink-0">
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
