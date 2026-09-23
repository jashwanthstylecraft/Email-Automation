import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from '@/lib/google-oauth';

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: 'Google sign-in is not configured on this deployment yet.' }, { status: 503 });
  }

  const redirectUri = `${new URL(request.url).origin}/api/auth/google/callback`;
  const state = crypto.randomBytes(24).toString('base64url');

  const response = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
  // Short-lived, checked once by the callback to confirm this is really the
  // same browser that just started this flow (CSRF protection on the
  // redirect-back step).
  response.cookies.set('google-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}
