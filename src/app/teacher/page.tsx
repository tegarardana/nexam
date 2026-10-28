import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import Header from "@/components/layout/Header";
import TeacherExaminationPanel from "@/components/teacher/TeacherExaminationPanel";
import {
  BookOpen,
  Users,
  FileSpreadsheet,
  MonitorCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
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
  const [allSubjects, academicYears, semesters, classGroups] = await Promise.all([
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
                Selamat Datang, {session.user.displayName}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                NIP / Akun: <span className="text-[#0D274C] font-mono font-semibold">{session.user.username}</span> • Status Mengajar Aktif
              </p>
            </div>

            <div className="flex items-center gap-3 bg-green-50 border border-green-200 p-3.5 rounded-xl shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-white border border-green-200 flex items-center justify-center text-green-600 shadow-xs">
                <Users className="w-5 h-5 text-[#65C443]" />
              </div>
              <div>
                <div className="text-xs text-green-800/80 font-medium">Total Siswa Binaan</div>
                <div className="text-sm font-bold text-green-700">{totalStudents} Siswa Terdaftar</div>
              </div>
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
            assignments={JSON.parse(JSON.stringify(assignments))}
            currentTeacherId={session.user.id}
            activeYearName={activeYear?.name}
            userRoles={session.user.roles}
          />
        </div>
      </main>
    </div>
  );
}
