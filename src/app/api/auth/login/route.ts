import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth/session";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/auth/rate-limit";
import { logAudit } from "@/lib/audit";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const body = await req.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid login credentials",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { username, password } = parseResult.data;
    const rateLimitKey = `${ip}:${username.toLowerCase()}`;

    // 1. Check rate limit
    const rateStatus = checkRateLimit(rateLimitKey);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed login attempts. Please try again in ${rateStatus.retryAfterSeconds} seconds.`,
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    // 2. Fetch user with roles and permissions
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive || user.archivedAt !== null) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // 3. Verify Argon2id password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      recordFailedAttempt(rateLimitKey);
      await logAudit({
        actorId: user.id,
        action: "auth:login_failed",
        entityType: "users",
        entityId: user.id,
        ipAddress: ip,
        afterValue: { reason: "invalid_password" },
      });
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // 4. Successful login: reset rate limiter
    resetRateLimit(rateLimitKey);

    // 5. Create session in DB
    const { token, expiresAt } = await createSession(user.id, ip, userAgent);

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Extract roles and permissions
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissionsSet = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(rp.permission.name);
      }
    }

    // Write audit log
    await logAudit({
      actorId: user.id,
      action: "auth:login_success",
      entityType: "users",
      entityId: user.id,
      ipAddress: ip,
    });

    // 6. Set HTTP-only Cookie
    const isProd = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        roles,
        permissions: Array.from(permissionsSet),
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_HOURS * 3600,
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("Login endpoint error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
