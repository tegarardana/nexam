import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface LogAuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeValue?: Record<string, any> | null;
  afterValue?: Record<string, any> | null;
  ipAddress?: string | null;
}

const REDACT_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "tokenHash",
  "token_hash",
  "secret",
]);

function sanitizeValues(obj: Record<string, any> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!obj) return undefined;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_KEYS.has(key)) {
      result[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = sanitizeValues(value);
    } else {
      result[key] = value;
    }
  }
  return result as Prisma.InputJsonValue;
}

/**
 * Append an immutable audit record to the audit_logs table.
 */
export async function logAudit({
  actorId,
  action,
  entityType,
  entityId,
  beforeValue,
  afterValue,
  ipAddress,
}: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entityType,
        entityId: entityId || null,
        beforeValue: sanitizeValues(beforeValue),
        afterValue: sanitizeValues(afterValue),
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
