import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { bulkUserActionSchema } from "@/lib/validation/user";

export async function POST(req: NextRequest) {
  const auth = await authenticateApi("user:update");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = bulkUserActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validasi gagal", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { userIds, action } = parsed.data;

    let updatedCount = 0;

    if (action === "activate") {
      const res = await prisma.user.updateMany({
        where: { id: { in: userIds }, archivedAt: null },
        data: { isActive: true },
      });
      updatedCount = res.count;
    } else if (action === "deactivate") {
      const res = await prisma.user.updateMany({
        where: { id: { in: userIds }, archivedAt: null },
        data: { isActive: false },
      });
      updatedCount = res.count;
    } else if (action === "delete") {
      // Need user:delete permission for bulk delete
      const deleteAuth = await authenticateApi("user:delete");
      if (deleteAuth instanceof NextResponse) return deleteAuth;

      const res = await prisma.user.updateMany({
        where: { id: { in: userIds }, archivedAt: null },
        data: {
          archivedAt: new Date(),
          isActive: false,
        },
      });
      updatedCount = res.count;
    }

    await logAudit({
      actorId: auth.user.id,
      action: `user:bulk_${action}`,
      entityType: "users",
      entityId: "bulk",
      afterValue: { action, count: updatedCount, userIds },
    });

    return NextResponse.json({
      success: true,
      message: `Aksi massal (${action}) berhasil diproses untuk ${updatedCount} pengguna.`,
      count: updatedCount,
    });
  } catch (error: any) {
    console.error("POST /api/users/bulk error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses aksi massal pengguna" },
      { status: 500 }
    );
  }
}
