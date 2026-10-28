import React from "react";
import { redirect, notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import Header from "@/components/layout/Header";
import ClassStudentsPageContent from "@/components/admin/ClassStudentsPageContent";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminClassStudentsPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user.roles.includes("administrator");
  if (!isAdmin) {
    redirect(session.user.roles.includes("teacher") ? "/teacher" : "/student");
  }

  const { id } = await params;

  // Active academic context
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "active" },
    include: { semesters: { where: { status: "active" } } },
  });

  const activeSemester = activeYear?.semesters[0]?.name || "Semester Aktif";

  // Check if class exists
  const classGroup = await prisma.classGroup.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!classGroup) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Header
        user={session.user}
        activeYear={activeYear?.name}
        activeSemester={activeSemester}
      />
      <main className="flex-1 pb-16">
        <ClassStudentsPageContent initialClassId={id} />
      </main>
    </div>
  );
}
