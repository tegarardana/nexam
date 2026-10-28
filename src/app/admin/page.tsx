import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import Header from "@/components/layout/Header";
import AdminManagementPanel from "@/components/admin/AdminManagementPanel";
import {
  GraduationCap,
  Layers,
  BookOpen,
  Calendar,
  ShieldCheck,
  Activity,
  Briefcase,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.roles.includes("administrator")) {
    redirect(session.user.roles.includes("teacher") ? "/teacher" : "/student");
  }

  // Active academic context
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "active" },
    include: { semesters: { where: { status: "active" } } },
  });

  // Calculate platform statistics
  const [totalStudents, totalTeachers, totalClasses, totalMajors] =
    await Promise.all([
      prisma.userRole.count({ where: { role: { name: "student" } } }),
      prisma.userRole.count({ where: { role: { name: "teacher" } } }),
      prisma.classGroup.count({ where: { isActive: true } }),
      prisma.major.count({ where: { isActive: true, archivedAt: null } }),
    ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Header
        user={session.user}
        activeYear={activeYear?.name}
        activeSemester={activeYear?.semesters[0]?.name}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#65C443]/10 border border-[#65C443]/20 text-emerald-800 text-xs font-semibold mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-[#65C443]" />
                <span>Panel Kendali Administrator Sekolah</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Pusat Manajemen Akademik & Pengguna
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Tahun Ajaran Aktif:{" "}
                <span className="text-[#0D274C] font-bold">
                  {activeYear?.name || "Belum Ditentukan"}
                </span>{" "}
                {activeYear?.semesters[0] && `• Semester ${activeYear.semesters[0].name}`}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
              <Activity className="w-4 h-4 text-[#65C443] animate-pulse" />
              <span>Sistem Siap (Fase 1 Berjalan)</span>
            </div>
          </div>
        </div>

        {/* Statistical Summary Cards - 4 Card Angka */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Peserta / Siswa</span>
              <div className="w-8 h-8 rounded-lg bg-[#65C443]/10 flex items-center justify-center text-[#65C443]">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalStudents}</div>
            <div className="text-[11px] text-slate-400">Siswa terdaftar di sistem</div>
          </div>

          <div className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Guru / Pendidik</span>
              <div className="w-8 h-8 rounded-lg bg-[#0D274C]/10 flex items-center justify-center text-[#0D274C]">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalTeachers}</div>
            <div className="text-[11px] text-slate-400">Guru pengampu & wali kelas</div>
          </div>

          <div className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Rombel / Kelas</span>
              <div className="w-8 h-8 rounded-lg bg-[#65C443]/10 flex items-center justify-center text-[#65C443]">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalClasses}</div>
            <div className="text-[11px] text-slate-400">Rombongan belajar aktif</div>
          </div>

          <div className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Program Keahlian</span>
              <div className="w-8 h-8 rounded-lg bg-[#0D274C]/10 flex items-center justify-center text-[#0D274C]">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalMajors}</div>
            <div className="text-[11px] text-slate-400">Jurusan / konsentrasi aktif</div>
          </div>
        </div>

        {/* Interactive Management Panel */}
        <AdminManagementPanel
          initialStats={{ totalStudents, totalTeachers, totalClasses, totalMajors }}
          activeYearId={activeYear?.id || null}
          activeYearName={activeYear?.name || null}
          activeSemesterName={activeYear?.semesters[0]?.name || null}
        />
      </main>
    </div>
  );
}
