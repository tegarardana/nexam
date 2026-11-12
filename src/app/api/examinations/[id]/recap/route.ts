import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { formatNameWithTitle } from "@/lib/format-user";

export async function POST(
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
        examinationType: true,
        academicYear: true,
        semester: true,
        policySettings: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ success: false, error: "Jadwal ujian tidak ditemukan" }, { status: 404 });
    }

    // Check if the examination is finished before allowing recap
    const now = new Date();
    const isPastSchedule = Boolean(exam.scheduledEnd && now > new Date(exam.scheduledEnd));
    const isClosed =
      exam.status === "closed" ||
      exam.status === "finalized" ||
      exam.status === "archived" ||
      isPastSchedule;

    if (!isClosed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ujian masih berlangsung dan belum selesai. Rekap nilai hanya dapat dilakukan setelah sesi ujian selesai atau ditutup.",
        },
        { status: 400 }
      );
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

    // Fetch all attempts with results, grading records, and events
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
        gradingRecords: true,
        events: {
          select: { id: true },
        },
      },
      orderBy: { attemptNumber: "desc" },
    });

    // Map latest attempt per student
    const latestAttemptByStudent = new Map<string, any>();
    for (const att of attempts) {
      if (!latestAttemptByStudent.has(att.studentId)) {
        latestAttemptByStudent.set(att.studentId, att);
      }
    }

    const passingScore = Number(exam.passingScore) || 75;
    const targetClassesSet = new Set<string>();

    // Compile student records
    const studentMap = new Map<string, any>();

    // 1. Registered participants
    for (const p of participants) {
      if (p.classGroup?.name) {
        targetClassesSet.add(p.classGroup.name);
      }

      const att = latestAttemptByStudent.get(p.studentId);
      const res = att?.result;

      const totalScore = res ? Number(res.totalScore) : 0;
      const percentage = res ? Number(res.percentage) : 0;
      const objectiveScore = res?.objectiveScore ? Number(res.objectiveScore) : 0;
      const essayScore = res?.essayScore ? Number(res.essayScore) : 0;

      const isSubmitted = att && ["submitted", "completed"].includes(att.status);
      const isPassed = isSubmitted && percentage >= passingScore;

      studentMap.set(p.student.id, {
        studentId: p.student.id,
        username: p.student.username,
        nis: p.student.nis || p.student.username,
        displayName: p.student.displayName || p.student.username,
        className: p.classGroup?.name || "Tanpa Kelas",
        classGroupId: p.classGroupId,
        attemptStatus: att?.status || "not_started",
        isSubmitted,
        objectiveScore,
        essayScore,
        totalScore,
        percentage,
        isPassed,
        submittedAt: att?.submittedAt ? att.submittedAt.toISOString() : null,
        incidentCount: att?.events?.length || att?.incidentCount || 0,
      });
    }

    // 2. Unregistered students who attempted
    for (const att of attempts) {
      if (!studentMap.has(att.studentId)) {
        const res = att.result;
        const totalScore = res ? Number(res.totalScore) : 0;
        const percentage = res ? Number(res.percentage) : 0;
        const objectiveScore = res?.objectiveScore ? Number(res.objectiveScore) : 0;
        const essayScore = res?.essayScore ? Number(res.essayScore) : 0;

        const isSubmitted = ["submitted", "completed"].includes(att.status);
        const isPassed = isSubmitted && percentage >= passingScore;

        studentMap.set(att.studentId, {
          studentId: att.studentId,
          username: att.student?.username || "unknown",
          nis: att.student?.nis || att.student?.username || "-",
          displayName: att.student?.displayName || "Siswa",
          className: "Lainnya",
          classGroupId: null,
          attemptStatus: att.status || "not_started",
          isSubmitted,
          objectiveScore,
          essayScore,
          totalScore,
          percentage,
          isPassed,
          submittedAt: att.submittedAt ? att.submittedAt.toISOString() : null,
          incidentCount: att.events?.length || att.incidentCount || 0,
        });
      }
    }

    const studentRecords = Array.from(studentMap.values());
    const totalParticipants = studentRecords.length;
    const submittedRecords = studentRecords.filter((s) => s.isSubmitted);
    const submittedCount = submittedRecords.length;

    let averageScore = 0;
    let highestScore = 0;
    let lowestScore = 0;
    let passingCount = 0;
    let failingCount = 0;

    if (submittedCount > 0) {
      const scores = submittedRecords.map((s) => s.percentage);
      averageScore = Math.round((scores.reduce((a, b) => a + b, 0) / submittedCount) * 100) / 100;
      highestScore = Math.max(...scores);
      lowestScore = Math.min(...scores);
      passingCount = submittedRecords.filter((s) => s.isPassed).length;
      failingCount = submittedCount - passingCount;
    }

    const targetClasses = Array.from(targetClassesSet).sort().join(", ") || "Semua Kelas";

    // Upsert ExamGradeRecap snapshot
    const existingRecap = await prisma.examGradeRecap.findFirst({
      where: { examinationId },
    });

    const recapData = {
      examinationId,
      examTitle: exam.title,
      examTypeCode: exam.examinationType?.code || null,
      examTypeName: exam.examinationType?.name || null,
      subjectCode: exam.subject?.code || null,
      subjectName: exam.subject?.name || "Umum",
      academicYearName: exam.academicYear.name,
      semesterName: exam.semester.name,
      targetClasses,
      scheduledStart: exam.scheduledStart,
      scheduledEnd: exam.scheduledEnd,
      durationMinutes: exam.durationMinutes,
      passingScore: exam.passingScore || 75.0,
      totalPoints: exam.totalPoints,
      totalParticipants,
      submittedCount,
      averageScore,
      highestScore,
      lowestScore,
      passingCount,
      failingCount,
      studentRecords: studentRecords as any,
      status: "locked",
      lockedAt: new Date(),
      lockedById: session.user.id,
      lockedByName: formatNameWithTitle(session.user.displayName, session.user.title) || session.user.username,
    };

    let recapRecord;
    if (existingRecap) {
      recapRecord = await prisma.examGradeRecap.update({
        where: { id: existingRecap.id },
        data: recapData,
      });
    } else {
      recapRecord = await prisma.examGradeRecap.create({
        data: recapData,
      });
    }

    // Update examination status to finalized if closed
    if (exam.status === "closed") {
      await prisma.examination.update({
        where: { id: examinationId },
        data: { status: "finalized" },
      });
    }

    await logAudit({
      actorId: session.user.id,
      action: "examination:recap_locked",
      entityType: "exam_grade_recaps",
      entityId: recapRecord.id,
      afterValue: {
        examTitle: exam.title,
        totalParticipants,
        submittedCount,
        averageScore,
        passingCount,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Hasil ujian berhasil direkap dan dikunci secara permanen.",
      data: recapRecord,
    });
  } catch (error) {
    console.error("POST /api/examinations/[id]/recap error:", error);
    return NextResponse.json({ success: false, error: "Gagal memproses rekap nilai ujian" }, { status: 500 });
  }
}

