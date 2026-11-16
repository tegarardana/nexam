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
  const [
    allSubjects,
    academicYears,
    semesters,
    classGroups,
    allTeachers,
    assignedProctorCount,
    homeroomClasses,
    scheduledExamsCount,
  ] = await Promise.all([
    prisma.subject.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        subjectCategory: { select: { id: true, name: true } },
        major: { select: { id: true, name: true } },
        _count: { select: { questionBanks: true, questions: true } },
      },
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
    prisma.classGroup.findMany({
      where: {
        homeroomTeacherId: session.user.id,
        isActive: true,
      },
      include: {
        major: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true, status: true } },
        homeroomTeacher: {
          select: {
            id: true,
            displayName: true,
            title: true,
            nip: true,
            username: true,
          },
        },
        studentEnrollments: {
          where: { status: "active" },
          include: {
            student: {
              select: {
                id: true,
                username: true,
                displayName: true,
                nis: true,
                nisn: true,
                gender: true,
                email: true,
                isActive: true,
              },
            },
          },
          orderBy: { student: { displayName: "asc" } },
        },
        _count: {
          select: {
            studentEnrollments: { where: { status: "active" } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.examination.count({
      where: {
        createdById: session.user.id,
        status: { in: ["scheduled", "in_progress", "ready"] },
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

  const isHomeroomTeacher = homeroomClasses.length > 0;

  const tabParam = searchParams?.tab;
  const viewParam = searchParams?.view;
  let initialTab: TeacherTab = "dashboard";
  if (tabParam === "class_management" && isHomeroomTeacher) {
    initialTab = "class_management";
  } else if (tabParam === "question_banks") {
    initialTab = "question_banks";
  } else if (tabParam === "exam_schedules") {
    initialTab = "exam_schedules";
  } else if (tabParam === "exam_status" || viewParam === "monitoring") {
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
      homeroomClasses={JSON.parse(JSON.stringify(homeroomClasses))}
      scheduledExamsCount={scheduledExamsCount}
      initialTab={initialTab}
    />
  );
}
