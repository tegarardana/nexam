import React from "react";
import { redirect, notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import Header from "@/components/layout/Header";
import QuestionBankPageContent from "@/components/question-bank/QuestionBankPageContent";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ subjectId: string }>;
}

export default async function AdminQuestionBankPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user.roles.includes("administrator");
  if (!isAdmin) {
    redirect(session.user.roles.includes("teacher") ? "/teacher" : "/student");
  }

  const { subjectId } = await params;

  // Active academic context
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "active" },
    include: { semesters: { where: { status: "active" } } },
  });

  const [subject, teachers] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: subjectId },
      include: { major: true },
    }),
    prisma.user.findMany({
      where: {
        archivedAt: null,
        userRoles: { some: { role: { name: "teacher" } } },
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        nip: true,
      },
      orderBy: { displayName: "asc" },
    }),
  ]);

  if (!subject) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Header
        user={session.user}
        activeYear={activeYear?.name}
        activeSemester={activeYear?.semesters[0]?.name}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <QuestionBankPageContent
          subject={subject}
          isAdmin={true}
          teachers={teachers}
          backUrl="/admin"
          backLabel="Kembali ke Panel Admin"
        />
      </main>
    </div>
  );
}
