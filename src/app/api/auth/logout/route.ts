import { NextRequest, NextResponse } from "next/server";
import { invalidateSession, SESSION_COOKIE_NAME, getCurrentSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await invalidateSession(token);
    }

    if (session) {
      await logAudit({
        actorId: session.user.id,
        action: "auth:logout",
        entityType: "users",
        entityId: session.user.id,
      });
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred during logout" },
      { status: 500 }
    );
  }
}
