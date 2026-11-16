import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import TeacherDashboardShell from "@/components/teacher/TeacherDashboardShell";
import { TeacherTab } from "@/components/teacher/TeacherSidebar";

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

  const tabParam = searchParams?.tab;
  const viewParam = searchParams?.view;
  let initialTab: TeacherTab = "dashboard";
  if (tabParam === "exam_status" || viewParam === "monitoring") {
    initialTab = "exam_status";
  } else if (tabParam === "exam_results" || viewParam === "results") {
    initialTab = "exam_results";
  } else if (tabParam === "exam_analysis" || viewParam === "analysis") {
    initialTab = "exam_analysis";
  } else if (tabParam === "exam_grades" || viewParam === "grades") {
    initialTab = "exam_grades";
  }

  return (
    <TeacherDashboardShell
      user={session.user}
      activeYear={activeYear}
      subjects={allSubjects}
      academicYears={academicYears}
      semesters={semesters}
      classGroups={classGroups}
      teachers={allTeachers}
      assignments={JSON.parse(JSON.stringify(assignments))}
      assignedProctorCount={assignedProctorCount}
      totalStudents={totalStudents}
      initialTab={initialTab}
    />
  );
}
