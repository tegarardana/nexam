import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  const auth = await authenticateApi("report:audit_view", ["administrator"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const entityType = searchParams.get("entityType");
  const search = searchParams.get("search");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const format = searchParams.get("format");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const skip = (page - 1) * limit;

  const whereClause: any = {};
  if (action) whereClause.action = { contains: action, mode: "insensitive" };
  if (entityType) whereClause.entityType = entityType;
  if (startDate || endDate) {
    whereClause.timestamp = {};
    if (startDate) whereClause.timestamp.gte = new Date(startDate);
    if (endDate) whereClause.timestamp.lte = new Date(endDate);
  }
  if (search) {
    whereClause.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search, mode: "insensitive" } },
      { actor: { username: { contains: search, mode: "insensitive" } } },
      { actor: { displayName: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Handle CSV export if requested
  if (format === "csv") {
    const allLogs = await prisma.auditLog.findMany({
      where: whereClause,
      take: 2000,
      orderBy: { timestamp: "desc" },
      include: {
        actor: {
          select: { username: true, displayName: true },
        },
      },
    });

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];
    lines.push("\uFEFFNo,Waktu,Pelaku (Actor),Aksi,Entitas,ID Entitas,IP Address");
    allLogs.forEach((log, idx) => {
      lines.push([
        escapeCsv(idx + 1),
        escapeCsv(new Date(log.timestamp).toLocaleString("id-ID")),
        escapeCsv(log.actor ? `${log.actor.displayName || log.actor.username} (${log.actor.username})` : "Sistem"),
        escapeCsv(log.action),
        escapeCsv(log.entityType),
        escapeCsv(log.entityId || "-"),
        escapeCsv(log.ipAddress || "-"),
      ].join(","));
    });

    return new NextResponse(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Audit_Log_${Date.now()}.csv"`,
      },
    });
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where: whereClause }),
    prisma.auditLog.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
