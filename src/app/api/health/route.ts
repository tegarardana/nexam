import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const start = performance.now();
  let dbOk = false;

  try {
    // Quick probe to ensure PostgreSQL connection pool is healthy
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    dbOk = false;
  }

  const durationMs = Math.round(performance.now() - start);

  const status = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status: dbOk ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      database: dbOk ? "connected" : "disconnected",
      latencyMs: durationMs,
      version: "0.1.0",
    },
    { status }
  );
}
