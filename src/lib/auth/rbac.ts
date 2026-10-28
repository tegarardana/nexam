import { NextResponse } from "next/server";
import { getCurrentSession, ActiveSession, SessionUser } from "./session";

export function hasRole(user: SessionUser, role: string): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(user: SessionUser, roles: string[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}

export function hasPermission(user: SessionUser, permission: string): boolean {
  // Administrators bypass module-level permission checks
  if (user.roles.includes("administrator")) {
    return true;
  }
  return user.permissions.includes(permission);
}

/**
 * Authentication & authorization guard for API Route Handlers.
 * Returns either the active session or an error NextResponse (401 / 403).
 */
export async function authenticateApi(
  requiredPermission?: string,
  requiredRoles?: string[]
): Promise<ActiveSession | NextResponse> {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasAnyRole(session.user, requiredRoles) && !session.user.roles.includes("administrator")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: insufficient role privileges", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
  }

  if (requiredPermission) {
    if (!hasPermission(session.user, requiredPermission)) {
      return NextResponse.json(
        { success: false, error: `Forbidden: requires permission '${requiredPermission}'`, code: "FORBIDDEN" },
        { status: 403 }
      );
    }
  }

  return session;
}
