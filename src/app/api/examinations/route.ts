import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { CreateExaminationSchema } from "@/lib/validation/examination";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const subjectId = searchParams.get("subjectId");
  const academicYearId = searchParams.get("academicYearId");

  try {
    const { syncExaminationStates } = await import("@/lib/examination-state");
    await syncExaminationStates();

    const examinations = await prisma.examination.findMany({
      where: {
        status: status || undefined,
        subjectId: subjectId || undefined,
        academicYearId: academicYearId || undefined,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        examinationType: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        createdBy: { select: { id: true, displayName: true } },
        policySettings: true,
        _count: {
          select: {
            questions: true,
            participants: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: examinations });
  } catch (error) {
    console.error("GET /api/examinations error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat daftar ujian" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTeacherOrAdmin =
    session.user.roles.includes("administrator") || session.user.roles.includes("teacher");
  if (!isTeacherOrAdmin) {
    return NextResponse.json({ success: false, error: "Forbidden: Hanya guru/admin yang dapat membuat ujian" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = CreateExaminationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      subjectId,
      academicYearId,
      semesterId,
      durationMinutes,
      scheduledStart,
      scheduledEnd,
      totalPoints,
      passingScore,
      policySettings,
      teacherId,
      examinationTypeId,
      questionBankId,
      classGroupIds,
    } = parsed.data;

    const isAdmin = session.user.roles.includes("administrator");
    const creatorId = isAdmin && teacherId ? teacherId : session.user.id;

    const examination = await prisma.$transaction(async (tx) => {
      const exam = await tx.examination.create({
        data: {
          title,
          description: description || null,
          subjectId: subjectId || null,
          academicYearId,
          semesterId,
          durationMinutes,
          scheduledStart,
          scheduledEnd,
          totalPoints,
          passingScore: passingScore || null,
          status: "draft",
          createdById: creatorId,
          examinationTypeId: examinationTypeId || null,
        },
      });

      // Create policy settings
      await tx.examinationPolicySetting.create({
        data: {
          examinationId: exam.id,
          ...policySettings,
        },
      });

      // Auto-assign questions from questionBankId if selected
      if (questionBankId) {
        const bankQuestions = await tx.question.findMany({
          where: { questionBankId, status: "active" },
          include: {
            versions: {
              where: { isCurrent: true },
              take: 1,
            },
          },
          orderBy: { createdAt: "asc" },
        });

        const questionData = bankQuestions
          .filter((q) => q.versions.length > 0)
          .map((q, idx) => ({
            examinationId: exam.id,
            questionId: q.id,
            questionVersionId: q.versions[0].id,
            sequenceOrder: idx + 1,
            points: (q.versions[0].gradingConfig as any)?.points || 1,
            isOptional: false,
          }));

        if (questionData.length > 0) {
          await tx.examinationQuestion.createMany({
            data: questionData,
          });
        }
      }

      return exam;
    });

    // Auto-enroll participants if classGroupIds provided
    if (classGroupIds && classGroupIds.length > 0) {
      const { enrollClassGroups } = await import("@/lib/examination-participants");
      await enrollClassGroups(examination.id, classGroupIds);
    }

    await logAudit({
      actorId: session.user.id,
      action: "examination:create",
      entityType: "examinations",
      entityId: examination.id,
      afterValue: examination,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: examination }, { status: 201 });
  } catch (error) {
    console.error("POST /api/examinations error:", error);
    return NextResponse.json({ success: false, error: "Gagal membuat ujian baru" }, { status: 500 });
  }
}
