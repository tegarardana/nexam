import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: examinationId } = await params;

  try {
    const exam = await prisma.examination.findUnique({
      where: { id: examinationId },
      include: {
        subject: true,
        academicYear: true,
        semester: true,
        policySettings: true,
        questions: {
          orderBy: { sequenceOrder: "asc" },
          include: {
            question: { select: { id: true, type: true } },
            questionVersion: { select: { content: true } },
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan" }, { status: 404 });
    }

    // Fetch all participants
    const participants = await prisma.examinationParticipant.findMany({
      where: { examinationId },
      include: {
        student: {
          select: {
            id: true,
            username: true,
            displayName: true,
            nis: true,
          },
        },
        classGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { student: { username: "asc" } },
    });

    // Fetch all attempts with results, answers, student, and gradingRecords
    const attempts = await prisma.examinationAttempt.findMany({
      where: { examinationId },
      include: {
        student: {
          select: {
            id: true,
            username: true,
            displayName: true,
            nis: true,
          },
        },
        result: true,
        answers: true,
        gradingRecords: true,
        events: {
          select: { id: true, eventType: true, serverTimestamp: true },
        },
      },
      orderBy: { attemptNumber: "desc" },
    });

    // Map attempts by studentId (get latest attempt per student)
    const latestAttemptByStudent = new Map<string, any>();
    for (const att of attempts) {
      if (!latestAttemptByStudent.has(att.studentId)) {
        latestAttemptByStudent.set(att.studentId, att);
      }
    }

    const passingScore = Number(exam.passingScore) || 75;

    // Track participants map to also include unlisted students who attempted
    const studentMap = new Map<string, any>();

    // 1. Add registered participants
    for (const p of participants) {
      const att = latestAttemptByStudent.get(p.studentId);
      const res = att?.result;

      const totalScore = res ? Number(res.totalScore) : null;
      const maxScore = res ? Number(res.maxScore) : Number(exam.totalPoints) || 100;
      const percentage = res ? Number(res.percentage) : null;
      const objectiveScore = res?.objectiveScore ? Number(res.objectiveScore) : null;
      const essayScore = res?.essayScore ? Number(res.essayScore) : null;

      const hasPendingEssay =
        att?.status === "grading_pending" ||
        att?.gradingRecords?.some((g: any) => g.questionType === "essay" && g.gradingStatus === "pending");

      let passStatus: "passed" | "failed" | "pending" | "not_started" = "not_started";
      if (att) {
        if (["submitted", "completed"].includes(att.status)) {
          passStatus = percentage !== null && percentage >= passingScore ? "passed" : "failed";
        } else if (hasPendingEssay) {
          passStatus = "pending";
        } else {
          passStatus = "pending";
        }
      }

      let durationMinutes = null;
      if (att?.startedAt && att?.submittedAt) {
        durationMinutes = Math.round(
          (new Date(att.submittedAt).getTime() - new Date(att.startedAt).getTime()) / 60000
        );
      }

      studentMap.set(p.student.id, {
        studentId: p.student.id,
        attemptId: att?.id || null,
        nis: p.student.nis || p.student.username,
        studentName: p.student.displayName || p.student.username,
        classGroupId: p.classGroupId,
        className: p.classGroup?.name || "Tanpa Kelas",
        participantStatus: p.status,
        attemptStatus: att?.status || "not_started",
        startedAt: att?.startedAt ? att.startedAt.toISOString() : null,
        submittedAt: att?.submittedAt ? att.submittedAt.toISOString() : null,
        durationMinutes,
        totalScore,
        maxScore,
        percentage,
        objectiveScore,
        essayScore,
        passStatus,
        hasPendingEssay,
        isAdjusted: Boolean(res?.modificationReason),
        modificationReason: res?.modificationReason || null,
        incidentCount: att?.events?.length || att?.incidentCount || 0,
      });
    }

    // 2. Also ensure students who attempted but not in examination_participants table are included
    for (const att of attempts) {
      if (!studentMap.has(att.studentId)) {
        const res = att.result;
        const totalScore = res ? Number(res.totalScore) : null;
        const maxScore = res ? Number(res.maxScore) : Number(exam.totalPoints) || 100;
        const percentage = res ? Number(res.percentage) : null;
        const objectiveScore = res?.objectiveScore ? Number(res.objectiveScore) : null;
        const essayScore = res?.essayScore ? Number(res.essayScore) : null;

        const hasPendingEssay =
          att.status === "grading_pending" ||
          att.gradingRecords?.some((g: any) => g.questionType === "essay" && g.gradingStatus === "pending");

        let passStatus: "passed" | "failed" | "pending" | "not_started" = "not_started";
        if (["submitted", "completed"].includes(att.status)) {
          passStatus = percentage !== null && percentage >= passingScore ? "passed" : "failed";
        } else {
          passStatus = "pending";
        }

        let durationMinutes = null;
        if (att.startedAt && att.submittedAt) {
          durationMinutes = Math.round(
            (new Date(att.submittedAt).getTime() - new Date(att.startedAt).getTime()) / 60000
          );
        }

        studentMap.set(att.studentId, {
          studentId: att.studentId,
          attemptId: att.id,
          nis: att.student?.nis || att.student?.username || "-",
          studentName: att.student?.displayName || "Siswa",
          classGroupId: null,
          className: "-",
          participantStatus: "eligible",
          attemptStatus: att.status || "not_started",
          startedAt: att.startedAt ? att.startedAt.toISOString() : null,
          submittedAt: att.submittedAt ? att.submittedAt.toISOString() : null,
          durationMinutes,
          totalScore,
          maxScore,
          percentage,
          objectiveScore,
          essayScore,
          passStatus,
          hasPendingEssay,
          isAdjusted: Boolean(res?.modificationReason),
          modificationReason: res?.modificationReason || null,
          incidentCount: att.events?.length || att.incidentCount || 0,
        });
      }
    }

    const studentResults = Array.from(studentMap.values());

    // Calculate aggregated statistics
    const totalParticipants = studentResults.length;
    const completedResults = studentResults.filter((s) => s.percentage !== null);
    const completedCount = completedResults.length;
    const inProgressCount = studentResults.filter((s) =>
      ["in_progress", "warning", "blocked"].includes(s.attemptStatus)
    ).length;
    const notStartedCount = studentResults.filter((s) => s.attemptStatus === "not_started").length;

    let averagePercentage = 0;
    let highestPercentage = 0;
    let lowestPercentage = 0;
    let passedCount = 0;
    let failedCount = 0;

    if (completedCount > 0) {
      const percentages = completedResults.map((s) => s.percentage!);
      averagePercentage = Math.round(
        (percentages.reduce((a, b) => a + b, 0) / completedCount) * 10
      ) / 10;
      highestPercentage = Math.max(...percentages);
      lowestPercentage = Math.min(...percentages);
      passedCount = completedResults.filter((s) => s.passStatus === "passed").length;
      failedCount = completedResults.filter((s) => s.passStatus === "failed").length;
    }

    const passRate = completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        examination: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          subjectName: exam.subject?.name || "Mata Pelajaran",
          subjectCode: exam.subject?.code || "-",
          academicYear: exam.academicYear.name,
          semester: exam.semester.name,
          durationMinutes: exam.durationMinutes,
          passingScore,
          totalQuestions: exam.questions.length,
          status: exam.status,
          scheduledStart: exam.scheduledStart.toISOString(),
          scheduledEnd: exam.scheduledEnd.toISOString(),
        },
        statistics: {
          totalParticipants,
          completedCount,
          inProgressCount,
          notStartedCount,
          averagePercentage,
          highestPercentage,
          lowestPercentage,
          passedCount,
          failedCount,
          passRate,
        },
        students: studentResults,
      },
    });
  } catch (error) {
    console.error("GET /api/examinations/[id]/results error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat rekap hasil ujian" },
      { status: 500 }
    );
  }
}
