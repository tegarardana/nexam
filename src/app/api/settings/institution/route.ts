import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const SETTING_KEYS = [
  "app_name",
  "app_logo",
  "app_tagline",
  "institution_name",
  "institution_logo",
  "institution_npsn",
  "institution_address",
  "institution_phone",
  "institution_email",
  "institution_website",
  "institution_headmaster",
] as const;

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user.roles.includes("administrator")) {
      return NextResponse.json({ error: "Unauthorized: Akses khusus administrator" }, { status: 403 });
    }

    const settingsList = await prisma.systemSetting.findMany({
      where: {
        key: { in: [...SETTING_KEYS] },
      },
    });

    const settingsMap: Record<string, string> = {};
    for (const item of settingsList) {
      settingsMap[item.key] = item.value;
    }

    return NextResponse.json({
      success: true,
      settings: {
        appName: settingsMap["app_name"] || "Nexam",
        appLogo: settingsMap["app_logo"] || "",
        appTagline: settingsMap["app_tagline"] || "School Assessment & Examination Suite",
        institutionName: settingsMap["institution_name"] || "SMK Negeri 1 Contoh",
        institutionLogo: settingsMap["institution_logo"] || settingsMap["app_logo"] || "",
        institutionNpsn: settingsMap["institution_npsn"] || "",
        institutionAddress: settingsMap["institution_address"] || "",
        institutionPhone: settingsMap["institution_phone"] || "",
        institutionEmail: settingsMap["institution_email"] || "",
        institutionWebsite: settingsMap["institution_website"] || "",
        institutionHeadmaster: settingsMap["institution_headmaster"] || "",
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/settings/institution error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil pengaturan instansi", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user.roles.includes("administrator")) {
      return NextResponse.json({ error: "Unauthorized: Akses khusus administrator" }, { status: 403 });
    }

    const body = await req.json();
    const {
      appName,
      appLogo,
      appTagline,
      institutionName,
      institutionLogo,
      institutionNpsn,
      institutionAddress,
      institutionPhone,
      institutionEmail,
      institutionWebsite,
      institutionHeadmaster,
    } = body;

    const updates: Record<string, string> = {
      app_name: typeof appName === "string" ? appName.trim() : "Nexam",
      app_logo: typeof appLogo === "string" ? appLogo.trim() : "",
      app_tagline: typeof appTagline === "string" ? appTagline.trim() : "",
      institution_name: typeof institutionName === "string" ? institutionName.trim() : "",
      institution_logo: typeof institutionLogo === "string" ? institutionLogo.trim() : "",
      institution_npsn: typeof institutionNpsn === "string" ? institutionNpsn.trim() : "",
      institution_address: typeof institutionAddress === "string" ? institutionAddress.trim() : "",
      institution_phone: typeof institutionPhone === "string" ? institutionPhone.trim() : "",
      institution_email: typeof institutionEmail === "string" ? institutionEmail.trim() : "",
      institution_website: typeof institutionWebsite === "string" ? institutionWebsite.trim() : "",
      institution_headmaster: typeof institutionHeadmaster === "string" ? institutionHeadmaster.trim() : "",
    };

    // If institution_logo is empty but appLogo is set, sync them if applicable
    if (!updates.institution_logo && updates.app_logo) {
      updates.institution_logo = updates.app_logo;
    }

    // Upsert each setting
    const now = new Date();
    await prisma.$transaction(
      Object.entries(updates).map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: {
            key,
            value: value || "",
            updatedById: session.user.id,
            updatedAt: now,
          },
          update: {
            value: value || "",
            updatedById: session.user.id,
            updatedAt: now,
          },
        })
      )
    );

    await logAudit({
      actorId: session.user.id,
      action: "UPDATE_INSTITUTION_SETTINGS",
      entityType: "SystemSetting",
      entityId: "institution_profile",
      afterValue: updates,
    });

    return NextResponse.json({
      success: true,
      message: "Profil lembaga dan pengaturan aplikasi berhasil diperbarui",
      settings: {
        appName: updates.app_name,
        appLogo: updates.app_logo,
        appTagline: updates.app_tagline,
        institutionName: updates.institution_name,
        institutionLogo: updates.institution_logo,
        institutionNpsn: updates.institution_npsn,
        institutionAddress: updates.institution_address,
        institutionPhone: updates.institution_phone,
        institutionEmail: updates.institution_email,
        institutionWebsite: updates.institution_website,
        institutionHeadmaster: updates.institution_headmaster,
      },
    });
  } catch (error: unknown) {
    console.error("POST /api/settings/institution error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan pengaturan instansi", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

