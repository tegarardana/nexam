import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "all"; // all | recapped | pending
  const academicYearId = searchParams.get("academicYearId");
  const subjectId = searchParams.get("subjectId");
  const search = searchParams.get("search")?.toLowerCase().trim();

  try {
    // 1. Fetch all ExamGradeRecaps
    const recaps = await prisma.examGradeRecap.findMany({
      orderBy: { lockedAt: "desc" },
    });

    // 2. Fetch all examinations in progress, closed, or finalized
    const examinations = await prisma.examination.findMany({
      where: {
        status: { in: ["in_progress", "closed", "finalized"] },
        ...(academicYearId ? { academicYearId } : {}),
        ...(subjectId ? { subjectId } : {}),
      },
      include: {
        subject: true,
        examinationType: true,
        academicYear: true,
        semester: true,
        participants: {
          include: {
            classGroup: { select: { name: true } },
          },
        },
        attempts: {
          select: {
            id: true,
            status: true,
            studentId: true,
          },
        },
      },
      orderBy: { scheduledStart: "desc" },
    });

    // Set of examination IDs that are already recapped
    const recappedExamIds = new Set(
      recaps.map((r) => r.examinationId).filter(Boolean) as string[]
    );

    // Build unified items list
    const items: any[] = [];

    // Add all existing recaps
    for (const r of recaps) {
      items.push({
        id: r.id,
        recapId: r.id,
        examinationId: r.examinationId,
        isRecapped: true,
        examTitle: r.examTitle,
        examTypeCode: r.examTypeCode,
        examTypeName: r.examTypeName,
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
        academicYearName: r.academicYearName,
        semesterName: r.semesterName,
        targetClasses: r.targetClasses,
        scheduledStart: r.scheduledStart,
        scheduledEnd: r.scheduledEnd,
        durationMinutes: r.durationMinutes,
        passingScore: Number(r.passingScore),
        totalPoints: Number(r.totalPoints),
        totalParticipants: r.totalParticipants,
        submittedCount: r.submittedCount,
        averageScore: Number(r.averageScore),
        highestScore: Number(r.highestScore),
        lowestScore: Number(r.lowestScore),
        passingCount: r.passingCount,
        failingCount: r.failingCount,
        lockedAt: r.lockedAt,
        lockedByName: r.lockedByName,
        status: r.status,
      });
    }

    // Add examinations that have not yet been recapped
    for (const exam of examinations) {
      if (!recappedExamIds.has(exam.id)) {
        const targetClassesSet = new Set<string>();
        for (const p of exam.participants) {
          if (p.classGroup?.name) {
            targetClassesSet.add(p.classGroup.name);
          }
        }
        const targetClasses = Array.from(targetClassesSet).sort().join(", ") || "Semua Kelas";

        const submittedAttempts = exam.attempts.filter((a) =>
          ["submitted", "completed"].includes(a.status)
        );

        items.push({
          id: exam.id,
          recapId: null,
          examinationId: exam.id,
          isRecapped: false,
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
          passingScore: Number(exam.passingScore) || 75.0,
          totalPoints: Number(exam.totalPoints) || 100.0,
          totalParticipants: exam.participants.length,
          submittedCount: submittedAttempts.length,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          passingCount: 0,
          failingCount: 0,
          lockedAt: null,
          lockedByName: null,
          status: exam.status,
        });
      }
    }

    // Filter items based on criteria
    let filteredItems = items;

    if (statusFilter === "recapped") {
      filteredItems = filteredItems.filter((i) => i.isRecapped);
    } else if (statusFilter === "pending") {
      filteredItems = filteredItems.filter((i) => !i.isRecapped);
    }

    if (search) {
      filteredItems = filteredItems.filter(
        (i) =>
          i.examTitle.toLowerCase().includes(search) ||
          i.subjectName.toLowerCase().includes(search) ||
          (i.subjectCode && i.subjectCode.toLowerCase().includes(search)) ||
          i.targetClasses.toLowerCase().includes(search)
      );
    }

    const summary = {
      totalExams: items.length,
      totalRecapped: items.filter((i) => i.isRecapped).length,
      totalPending: items.filter((i) => !i.isRecapped).length,
    };

    return NextResponse.json({
      success: true,
      data: filteredItems,
      summary,
    });
  } catch (error) {
    console.error("GET /api/examinations/recap error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat rekap nilai" }, { status: 500 });
  }
}

