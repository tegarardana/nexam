import crypto from "crypto";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "nexam_session";
export const SESSION_DURATION_HOURS = 8;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

export interface ActiveSession {
  sessionId: string;
  user: SessionUser;
  expiresAt: Date;
}

/**
 * Compute SHA-256 hash of a session token for secure database lookup.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a cryptographically random session token.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new user session in the database.
 */
export async function createSession(
  userId: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  return { token, expiresAt };
}

/**
 * Validate a raw session token and return the authenticated user with roles and permissions.
 */
export async function validateSessionToken(token: string): Promise<ActiveSession | null> {
  if (!token || token.length < 32) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
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
      },
    },
  });

  if (!session) {
    return null;
  }

  // Check if session has been explicitly invalidated or expired
  if (session.invalidatedAt !== null || session.expiresAt <= now) {
    return null;
  }

  // Check if user account is deactivated
  if (!session.user.isActive || session.user.archivedAt !== null) {
    return null;
  }

  // Touch last_active_at if more than 5 minutes elapsed
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  if (session.lastActiveAt < fiveMinutesAgo) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastActiveAt: now },
    });
  }

  // Extract flat roles and deduplicated permissions
  const roles = session.user.userRoles.map((ur) => ur.role.name);
  const permissionsSet = new Set<string>();
  for (const ur of session.user.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissionsSet.add(rp.permission.name);
    }
  }

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      email: session.user.email,
      isActive: session.user.isActive,
      roles,
      permissions: Array.from(permissionsSet),
    },
  };
}

/**
 * Read the session cookie and return the authenticated user context (Server Component / Route Handler helper).
 */
export async function getCurrentSession(): Promise<ActiveSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await validateSessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Revoke a session by token (used upon user logout).
 */
export async function invalidateSession(token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashToken(token);
  try {
    await prisma.userSession.updateMany({
      where: { tokenHash, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });
    return true;
  } catch (err) {
    console.error("Error invalidating session:", err);
    return false;
  }
}

/**
 * Force-revoke all sessions for a specific user (admin action or password reset).
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { userId, invalidatedAt: null },
    data: { invalidatedAt: new Date() },
  });
}
