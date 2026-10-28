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

export default async function TeacherQuestionBankPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("teacher") || session.user.roles.includes("administrator");
  if (!isTeacherOrAdmin) {
    redirect("/student");
  }

  const { subjectId } = await params;

  // Active academic context
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "active" },
    include: { semesters: { where: { status: "active" } } },
  });

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { major: true },
  });

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
          isAdmin={false}
          currentTeacherId={session.user.id}
          backUrl="/teacher"
          backLabel="Kembali ke Portal Guru"
        />
      </main>
    </div>
  );
}
