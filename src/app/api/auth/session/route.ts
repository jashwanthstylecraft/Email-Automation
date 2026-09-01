import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth-session');

    let userSession = null;
    if (sessionCookie?.value) {
      try {
        userSession = JSON.parse(sessionCookie.value);
      } catch (err) {
        // Ignore parse error
      }
    }

    if (!userSession) {
      return NextResponse.json({ user: null });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userSession.id },
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-session');
  return NextResponse.json({ success: true });
}
