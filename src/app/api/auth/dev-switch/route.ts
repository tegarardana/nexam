import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

const DEV_MODE_COOKIE_NAME = "nexam_dev_mode";

export async function POST(req: NextRequest) {
  try {
    const isDevModeActive = req.cookies.get(DEV_MODE_COOKIE_NAME)?.value === "true";

    const body = await req.json().catch(() => ({}));
    const { userId, username, adminPassword } = body;

    // Jika cookie dev mode belum ada, periksa apakah menyertakan adminPassword untuk otentikasi on-the-fly
    if (!isDevModeActive) {
      if (!adminPassword) {
        return NextResponse.json(
          {
            success: false,
            error: "Akses Dev Mode ditolak. Silakan verifikasi kata sandi administrator terlebih dahulu.",
          },
          { status: 403 }
        );
      }

      // Verifikasi admin password
      const adminUser = await prisma.user.findFirst({
        where: {
          isActive: true,
          archivedAt: null,
          userRoles: {
            some: {
              role: {
                name: "administrator",
              },
            },
          },
        },
      });

      if (!adminUser) {
        return NextResponse.json(
          { success: false, error: "Akun administrator tidak ditemukan." },
          { status: 404 }
        );
      }

      const { verifyPassword } = await import("@/lib/auth/password");
      const isPasswordValid = await verifyPassword(adminPassword, adminUser.passwordHash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { success: false, error: "Kata sandi administrator salah." },
          { status: 401 }
        );
      }
    }

    if (!userId && !username) {
      return NextResponse.json(
        { success: false, error: "Target pengguna (userId atau username) wajib diisi." },
        { status: 400 }
      );
    }

    // Ambil target pengguna
    const targetUser = await prisma.user.findUnique({
      where: userId ? { id: userId } : { username },
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

    if (!targetUser || !targetUser.isActive || targetUser.archivedAt !== null) {
      return NextResponse.json(
        { success: false, error: "Target pengguna tidak aktif atau tidak ditemukan." },
        { status: 404 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    // Buat session baru untuk target user
    const { token, expiresAt } = await createSession(targetUser.id, ip, userAgent);

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { lastLoginAt: new Date() },
    });

    // Extract roles and permissions
    const roles = targetUser.userRoles.map((ur) => ur.role.name);
    const permissionsSet = new Set<string>();
    for (const ur of targetUser.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(rp.permission.name);
      }
    }

    // Audit log
    await logAudit({
      actorId: targetUser.id,
      action: "auth:dev_switch_user",
      entityType: "users",
      entityId: targetUser.id,
      ipAddress: ip,
      afterValue: {
        switchedTo: targetUser.username,
        roles,
      },
    });

    // Tentukan URL redirect sesuai role
    let redirectUrl = "/student";
    if (roles.includes("administrator")) {
      redirectUrl = "/admin";
    } else if (roles.includes("teacher")) {
      redirectUrl = "/teacher";
    }

    const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https:");
    const response = NextResponse.json({
      success: true,
      message: `Berhasil beralih ke akun ${targetUser.displayName} (@${targetUser.username})`,
      redirectUrl,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.displayName,
        email: targetUser.email,
        roles,
        permissions: Array.from(permissionsSet),
      },
    });

    // Pasang session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_HOURS * 3600,
      expires: expiresAt,
    });

    // Pastikan cookie dev mode tetap aktif
    response.cookies.set({
      name: DEV_MODE_COOKIE_NAME,
      value: "true",
      httpOnly: false,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/dev-switch error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat beralih akun Dev Mode." },
      { status: 500 }
    );
  }
}

