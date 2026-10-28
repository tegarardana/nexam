import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import AdminManagementPanel from "@/components/admin/AdminManagementPanel";

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
    <AdminManagementPanel
      user={session.user}
      initialStats={{ totalStudents, totalTeachers, totalClasses, totalMajors }}
      activeYearId={activeYear?.id || null}
      activeYearName={activeYear?.name || null}
      activeSemesterName={activeYear?.semesters[0]?.name || null}
    />
  );
}
