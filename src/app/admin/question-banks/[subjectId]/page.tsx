import React from "react";
import { redirect, notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import AdminQuestionBankShell from "@/components/admin/AdminQuestionBankShell";
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
    <AdminQuestionBankShell
      user={session.user}
      activeYear={activeYear?.name}
      activeSemester={activeYear?.semesters[0]?.name}
      subjectName={subject.name}
    >
      <QuestionBankPageContent
        subject={subject}
        isAdmin={true}
        teachers={teachers}
        backUrl="/admin?tab=question_banks"
        backLabel="Kembali"
      />
    </AdminQuestionBankShell>
  );
}
