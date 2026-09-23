import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSessionCookie } from '@/lib/session';
import { exchangeCodeForIdentity } from '@/lib/google-oauth';

function redirectToLoginWithError(origin: string, message: string) {
  const url = new URL('/login', origin);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);

  const oauthError = searchParams.get('error');
  if (oauthError) {
    // The user cancelled/denied on Google's own consent screen -- not a bug,
    // just send them back without alarming "something went wrong" wording.
    return redirectToLoginWithError(origin, 'Google sign-in was cancelled.');
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieStore = request.headers.get('cookie') || '';
  const expectedState = cookieStore.match(/(?:^|;\s*)google-oauth-state=([^;]+)/)?.[1];

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToLoginWithError(origin, 'Google sign-in failed to verify (expired or invalid request). Please try again.');
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const identity = await exchangeCodeForIdentity(code, redirectUri);

    if (!identity.emailVerified) {
      return redirectToLoginWithError(origin, 'Your Google account email is not verified.');
    }

    // Google-only accounts are provisioned explicitly (see the account list
    // in Settings/Team) -- a verified Google email that doesn't match one of
    // them, or matches an existing PASSWORD account, is refused rather than
    // silently granted or silently merged into a different login method.
    const user = await prisma.user.findFirst({
      where: { email: { equals: identity.email, mode: 'insensitive' } },
      include: { organization: true },
    });

    if (!user || user.authProvider !== 'google') {
      return redirectToLoginWithError(origin, 'This Google account is not set up for sign-in here. Contact your admin.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), googleId: identity.googleId, failedLoginAttempts: 0, lockedUntil: null },
    });

    const response = NextResponse.redirect(new URL('/dashboard', origin));
    response.cookies.set('auth-session', signSessionCookie({
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.organizationId,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    response.cookies.set('google-oauth-state', '', { path: '/', maxAge: 0 });
    return response;
  } catch (error: any) {
    console.error('Google OAuth callback failed:', error);
    return redirectToLoginWithError(origin, 'Google sign-in failed. Please try again.');
  }
}
