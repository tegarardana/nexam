import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import CreateExaminationForm from "@/components/examinations/CreateExaminationForm";

export const dynamic = "force-dynamic";

export default async function AdminCreateExaminationPage() {
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

  // Query platform resources
  const [allSubjects, academicYears, semesters, classes, teacherUsers] = await Promise.all([
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
        username: true,
        nip: true,
        email: true,
      },
    }),
  ]);

  return (
    <CreateExaminationForm
      backUrl="/admin?tab=exam_schedules"
      userRole="administrator"
      subjects={allSubjects}
      academicYears={academicYears}
      semesters={semesters}
      classes={classes}
      teachers={teacherUsers}
      activeYearId={activeYear?.id || null}
    />
  );
}
