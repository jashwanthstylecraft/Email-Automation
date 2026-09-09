import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signSessionCookie } from '@/lib/session';
import { apiError } from '@/lib/api-error';

// After this many wrong passwords in a row, further attempts are refused
// (even with the correct password) until the lockout window passes -- there
// was no protection at all against unlimited password guessing before this.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const passwordValid = await bcrypt.compare(password || '', user.passwordHash);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
        },
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        signature: user.signature,
      },
    });

    // Signed so the cookie's contents can't be edited client-side to
    // impersonate a different user id -- see src/lib/session.ts.
    response.cookies.set('auth-session', signSessionCookie({
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.organizationId,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return response;
  } catch (error: any) {
    return apiError(error);
  }
}
