import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { saveAnswer } from "@/lib/exam-engine/attempt-manager";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: examinationId } = await params;

  try {
    const body = await request.json();
    const { examinationQuestionId, answerValue, clientSequence, isDoubtful } = body;

    if (!examinationQuestionId) {
      return NextResponse.json(
        { success: false, error: "examinationQuestionId wajib diisi." },
        { status: 400 }
      );
    }

    const result = await saveAnswer(
      session.user.id,
      examinationId,
      examinationQuestionId,
      answerValue,
      Number(clientSequence) || 0,
      Boolean(isDoubtful)
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan jawaban." },
      { status: statusCode }
    );
  }
}
