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
    return { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
  } catch {
    return null;
  }
}

export function getClientIp(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || null;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'Admin';
}
