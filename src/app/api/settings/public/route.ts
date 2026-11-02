import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settingsList = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
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
          ],
        },
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
    console.error("GET /api/settings/public error:", error);
    return NextResponse.json(
      {
        success: true,
        settings: {
          appName: "Nexam",
          appLogo: "",
          appTagline: "School Assessment & Examination Suite",
          institutionName: "SMK Negeri 1 Contoh",
          institutionLogo: "",
          institutionNpsn: "",
          institutionAddress: "",
          institutionPhone: "",
          institutionEmail: "",
          institutionWebsite: "",
          institutionHeadmaster: "",
        },
      },
      { status: 200 }
    );
  }
}

