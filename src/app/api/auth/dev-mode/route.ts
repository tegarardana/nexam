import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";

const DEV_MODE_COOKIE_NAME = "nexam_dev_mode";

export async function GET(req: NextRequest) {
  try {
    const isDevModeActive = req.cookies.get(DEV_MODE_COOKIE_NAME)?.value === "true";

    if (!isDevModeActive) {
      return NextResponse.json({
        success: true,
        active: false,
        users: [],
      });
    }

    // Ambil daftar pengguna untuk mode dev
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        archivedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        studentEnrollments: {
          where: { status: "active" },
          include: {
            classGroup: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { displayName: "asc" },
      ],
      take: 60,
    });

    const formattedUsers = users.map((u) => {
      const primaryRole = u.userRoles[0]?.role?.name || "student";
      const className = u.studentEnrollments[0]?.classGroup?.name || null;

      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        title: u.title,
        email: u.email,
        nis: u.nis,
        nip: u.nip,
        role: primaryRole,
        roles: u.userRoles.map((r) => r.role.name),
        className,
      };
    });

    return NextResponse.json({
      success: true,
      active: true,
      users: formattedUsers,
    });
  } catch (error) {
    console.error("GET /api/auth/dev-mode error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat status Dev Mode" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, adminUsername } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Kata sandi administrator wajib diisi." },
        { status: 400 }
      );
    }

    // Cari user admin (bisa berdasarkan adminUsername jika diberikan, atau cari user pertama dengan role administrator)
    const adminUser = await prisma.user.findFirst({
      where: {
        ...(adminUsername ? { username: adminUsername } : {}),
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
        { success: false, error: "Akun administrator tidak ditemukan di sistem." },
        { status: 404 }
      );
    }

    // Verifikasi kata sandi
    const isPasswordValid = await verifyPassword(password, adminUser.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Kata sandi administrator tidak sesuai." },
        { status: 401 }
      );
    }

    // Ambil daftar user yang dapat dipilih untuk trial
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        archivedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        studentEnrollments: {
          where: { status: "active" },
          include: {
            classGroup: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { displayName: "asc" },
      ],
      take: 60,
    });

    const formattedUsers = users.map((u) => {
      const primaryRole = u.userRoles[0]?.role?.name || "student";
      const className = u.studentEnrollments[0]?.classGroup?.name || null;

      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        title: u.title,
        email: u.email,
        nis: u.nis,
        nip: u.nip,
        role: primaryRole,
        roles: u.userRoles.map((r) => r.role.name),
        className,
      };
    });

    const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https:");
    const response = NextResponse.json({
      success: true,
      message: "Dev Mode berhasil diaktifkan.",
      active: true,
      users: formattedUsers,
    });

    // Set cookie dev mode selama 7 hari
    response.cookies.set({
      name: DEV_MODE_COOKIE_NAME,
      value: "true",
      httpOnly: false, // dapat dibaca frontend untuk memunculkan switcher
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/dev-mode error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat memverifikasi Dev Mode." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https:");
    const response = NextResponse.json({
      success: true,
      message: "Dev Mode dinonaktifkan.",
      active: false,
    });

    response.cookies.set({
      name: DEV_MODE_COOKIE_NAME,
      value: "",
      httpOnly: false,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("DELETE /api/auth/dev-mode error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menonaktifkan Dev Mode." },
      { status: 500 }
    );
  }
}

