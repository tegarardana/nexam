import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import CreateExaminationForm from "@/components/examinations/CreateExaminationForm";

export const dynamic = "force-dynamic";

export default async function TeacherCreateExaminationPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("teacher") || session.user.roles.includes("administrator");
  if (!isTeacherOrAdmin) {
    redirect("/student");
  }

  // Active academic context
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "active" },
    include: { semesters: { where: { status: "active" } } },
  });

  // Query platform resources
  const [allSubjects, academicYears, semesters, classes, allMajors] = await Promise.all([
    prisma.subject.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        majorId: true,
        major: { select: { id: true, name: true, code: true } },
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
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        academicYearId: true,
        majorId: true,
        major: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.major.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <CreateExaminationForm
      backUrl="/teacher"
      userRole={session.user.roles.includes("administrator") ? "administrator" : "teacher"}
      subjects={allSubjects}
      academicYears={academicYears}
      semesters={semesters}
      classes={classes}
      majors={allMajors}
      currentTeacherId={session.user.id}
      activeYearId={activeYear?.id || null}
    />
  );
}
