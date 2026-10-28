import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { success: false, authenticated: false, user: null },
      { status: 401 }
    );
  }

  // Fetch active academic year & semester context
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "active" },
    include: {
      semesters: {
        where: { status: "active" },
      },
    },
  });

  // If student, get their current placement
  let studentEnrollment = null;
  if (session.user.roles.includes("student") && activeYear) {
    studentEnrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: session.user.id,
        academicYearId: activeYear.id,
      },
      include: {
        classGroup: {
          include: {
            major: true,
          },
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    user: session.user,
    academicContext: {
      activeYear: activeYear
        ? {
            id: activeYear.id,
            name: activeYear.name,
            startDate: activeYear.startDate,
            endDate: activeYear.endDate,
          }
        : null,
      activeSemester: activeYear?.semesters[0]
        ? {
            id: activeYear.semesters[0].id,
            name: activeYear.semesters[0].name,
          }
        : null,
      enrollment: studentEnrollment
        ? {
            id: studentEnrollment.id,
            classGroupId: studentEnrollment.classGroupId,
            className: studentEnrollment.classGroup.name,
            gradeLevel: studentEnrollment.classGroup.gradeLevel,
            majorName: studentEnrollment.classGroup.major?.name || null,
          }
        : null,
    },
  });
}
