import { cookies } from 'next/headers';
import { prisma } from './prisma';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

/**
 * Reads the auth-session cookie server-side and returns the acting user.
 * Used by mutating API routes to attribute audit logs / feedback / notes to
 * a real person instead of leaving them anonymous.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth-session');
    if (!sessionCookie?.value) return null;
    const parsed = JSON.parse(sessionCookie.value);
    if (!parsed?.id) return null;
    const user = await prisma.user.findUnique({ where: { id: parsed.id } });
    if (!user) return null;
    // Fire-and-forget activity heartbeat -- "is this agent active" is derived
    // from how recently they made ANY authenticated request, not a separate
    // online/offline flag that could get stuck if a tab closes uncleanly.
    prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    return { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
  } catch {
    return null;
  }
}

// An agent is considered "active" if they've made an authenticated request
// within this window. Used for round-robin assignment eligibility and the
// admin inactivity warning.
export const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export function isRecentlyActive(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() < ACTIVE_WINDOW_MS;
}

// A "currently viewing" lock expires after this long with no activity, so
// the "Currently being handled by X" banner doesn't stick forever if an
// agent closes the tab without navigating away cleanly.
export const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function isLockActive(lockedAt: Date | null): boolean {
  if (!lockedAt) return false;
  return Date.now() - lockedAt.getTime() < LOCK_TTL_MS;
}

// Separate, longer threshold for the admin "user inactive / emails pending"
// warning -- distinct from ACTIVE_WINDOW_MS (round-robin eligibility), which
// needs to be much tighter since it decides who gets new work right now.
export const INACTIVITY_WARNING_MS = 30 * 60 * 1000; // 30 minutes

export function isInactiveTooLong(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return true;
  return Date.now() - lastSeenAt.getTime() >= INACTIVITY_WARNING_MS;
}

export function getClientIp(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || null;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'Admin';
}
