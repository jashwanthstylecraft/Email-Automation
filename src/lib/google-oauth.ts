// Minimal Google OAuth2 "Authorization Code" flow -- no auth library needed,
// Google's endpoints are plain REST. Kept deliberately small: this app only
// ever needs one thing from it (a verified email address for an allowlisted
// account), not a general-purpose auth provider abstraction.

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Always show the account chooser -- someone on a shared machine
    // already signed into a different Google account shouldn't silently
    // authenticate as whoever they last used.
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

interface GoogleTokenResponse {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name: string | null;
  googleId: string; // the token's "sub" claim
}

// Exchanges the authorization code for tokens, then validates the ID token
// via Google's own tokeninfo endpoint (a plain HTTPS call that does the
// signature/issuer/audience/expiry verification server-side) rather than
// pulling in a JWT/JWKS verification library for the one thing this app
// needs to check.
export async function exchangeCodeForIdentity(code: string, redirectUri: string): Promise<GoogleIdentity> {
  const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData: GoogleTokenResponse = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.id_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Google did not return an ID token');
  }

  const infoRes = await fetch(`${GOOGLE_TOKENINFO_ENDPOINT}?id_token=${encodeURIComponent(tokenData.id_token)}`);
  const info = await infoRes.json();
  if (!infoRes.ok || !info.email || !info.sub) {
    throw new Error('Could not verify the Google ID token');
  }

  // tokeninfo already checked the audience matches our client_id and the
  // token hasn't expired -- but double-check the audience explicitly rather
  // than trusting that implicitly, since a misconfigured/shared OAuth
  // client is exactly the scenario worth guarding against here.
  if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Google ID token was not issued for this application');
  }

  return {
    email: String(info.email).toLowerCase(),
    emailVerified: info.email_verified === 'true' || info.email_verified === true,
    name: info.name || null,
    googleId: String(info.sub),
  };
}
