import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user.roles.includes("administrator")) {
      return NextResponse.json({ error: "Unauthorized: Akses khusus administrator" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const target = (formData.get("target") as string) || "both"; // "app_logo" | "institution_logo" | "both"

    if (!file) {
      return NextResponse.json({ error: "File logo tidak ditemukan" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipe file tidak didukung. Harap upload gambar (PNG, JPEG, WebP, SVG)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file terlalu besar. Maksimal 5MB" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "branding");
    await mkdir(uploadsDir, { recursive: true });

    // Generate safe unique filename
    const ext = path.extname(file.name) || ".png";
    const randomHash = crypto.randomBytes(6).toString("hex");
    const safeBaseName = path
      .basename(file.name, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 20);
    const fileName = `logo_${Date.now()}_${safeBaseName}_${randomHash}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    await writeFile(filePath, buffer);

    const base64Data = `data:${file.type};base64,${buffer.toString("base64")}`;
    const logoValue = file.size <= 2.5 * 1024 * 1024 ? base64Data : `/uploads/branding/${fileName}`;
    const now = new Date();

    const keysToUpdate: string[] = [];
    if (target === "app_logo" || target === "both") {
      keysToUpdate.push("app_logo");
    }
    if (target === "institution_logo" || target === "both") {
      keysToUpdate.push("institution_logo");
    }

    await prisma.$transaction(
      keysToUpdate.map((key) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: {
            key,
            value: logoValue,
            updatedById: session.user.id,
            updatedAt: now,
          },
          update: {
            value: logoValue,
            updatedById: session.user.id,
            updatedAt: now,
          },
        })
      )
    );

    await logAudit({
      actorId: session.user.id,
      action: "UPLOAD_BRANDING_LOGO",
      entityType: "SystemSetting",
      entityId: target,
      afterValue: { logoValue, keysToUpdate },
    });

    return NextResponse.json({
      success: true,
      url: logoValue,
      fileName: file.name,
      fileSize: file.size,
      updatedKeys: keysToUpdate,
    });
  } catch (error: unknown) {
    console.error("POST /api/settings/upload-logo error:", error);
    return NextResponse.json(
      { error: "Gagal mengunggah logo", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

