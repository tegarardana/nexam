import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import Header from "@/components/layout/Header";
import TeacherExaminationPanel from "@/components/teacher/TeacherExaminationPanel";
import { formatNameWithTitle } from "@/lib/format-user";
import {
  BookOpen,
  Users,
  MonitorCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface TeacherDashboardPageProps {
  searchParams?: Promise<{
    tab?: string;
    view?: string;
  }>;
}

export default async function TeacherDashboardPage(props: TeacherDashboardPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  // Active academic context
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "active" },
    include: { semesters: { where: { status: "active" } } },
  });

  // Query platform resources for examination & question creation
  const [allSubjects, academicYears, semesters, classGroups, allTeachers, assignedProctorCount] = await Promise.all([
    prisma.subject.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.academicYear.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, status: true },
    }),
    prisma.semester.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, status: true, academicYearId: true },
    }),
    prisma.classGroup.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, academicYearId: true },
    }),
    prisma.user.findMany({
      where: {
        userRoles: { some: { role: { name: "teacher" } } },
        isActive: true,
      },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        title: true,
        username: true,
        nip: true,
        email: true,
      },
    }),
    prisma.examinationProctorAssignment.count({
      where: {
        proctorId: session.user.id,
        examination: {
          status: { in: ["scheduled", "in_progress", "ready"] },
        },
      },
    }),
  ]);

  // Teacher subject offerings
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId: session.user.id },
    include: {
      subjectOffering: {
        include: {
          subject: true,
          classGroup: {
            include: {
              major: true,
              _count: { select: { studentEnrollments: true } },
            },
          },
          academicYear: true,
        },
      },
    },
  });

  const totalStudents = assignments.reduce(
    (sum, a) => sum + (a.subjectOffering.classGroup._count.studentEnrollments || 0),
    0
  );

  const validViewModes = ["schedule", "monitoring", "results", "analysis", "grades"] as const;
  const initialViewMode =
    searchParams?.view && validViewModes.includes(searchParams.view as (typeof validViewModes)[number])
      ? (searchParams.view as (typeof validViewModes)[number])
      : "schedule";

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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[#0D274C] text-xs font-semibold mb-3">
                <BookOpen className="w-3.5 h-3.5 text-[#65C443]" />
                <span>Portal Pengajar & Pengawas Ujian</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Selamat Datang, {formatNameWithTitle(session.user.displayName, session.user.title)}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                NIP / Akun: <span className="text-[#0D274C] font-mono font-semibold">{session.user.username}</span> • Status Mengajar Aktif
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

              <Link
                href="/teacher?view=monitoring"
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition shadow-xs group ${
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
              </Link>
            </div>
          </div>
        </div>

        {/* Phase 2: Bank Soal & Manajemen Ujian */}
        <div className="pt-2">
          <TeacherExaminationPanel
            subjects={allSubjects}
            academicYears={academicYears}
            semesters={semesters}
            classGroups={classGroups}
            activeYearId={activeYear?.id}
            activeYearName={activeYear?.name}
            activeSemesterId={activeYear?.semesters[0]?.id || null}
            activeSemesterName={activeYear?.semesters[0]?.name || null}
            assignments={JSON.parse(JSON.stringify(assignments))}
            currentTeacherId={session.user.id}
            userRoles={session.user.roles}
            teachers={allTeachers}
            viewMode={initialViewMode}
          />
        </div>
      </main>
    </div>
  );
}
