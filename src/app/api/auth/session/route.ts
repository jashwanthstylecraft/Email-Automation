import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

export async function GET() {
  try {
    // getCurrentUser() verifies the cookie's signature before trusting the
    // id inside it -- do not read/parse the raw cookie here directly.
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ user: null });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { organization: true },
    });

    if (!dbUser) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        organizationId: dbUser.organizationId,
        organizationName: dbUser.organization.name,
        signature: dbUser.signature,
      },
    });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-session');
  return NextResponse.json({ success: true });
}
