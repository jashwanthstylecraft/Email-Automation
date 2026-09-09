import crypto from 'crypto';

// The auth-session cookie used to be raw JSON.stringify(...) with nothing
// verifying it server-side -- httpOnly stops JS on the page from reading it,
// but it does NOT stop the browser's own user from editing the cookie value
// directly (devtools, curl, any HTTP client) and handing the server back
// whatever {id, role, orgId} they want. Since getCurrentUser() trusted the
// id field and looked the user up fresh, that meant anyone who knew (or
// guessed -- these are just UUIDs that show up in plenty of API responses)
// a valid user id could log in as them with zero password check. Signing the
// payload with an HMAC and verifying it here closes that: a cookie whose
// signature doesn't match its content is simply rejected as unauthenticated.
//
// No SESSION_SECRET is provisioned anywhere yet, so this falls back to a key
// derived from DATABASE_URL (present in every environment this app runs in,
// and never exposed to a client) rather than requiring a new secret to be
// added to Vercel before sessions work again. Set a real SESSION_SECRET
// there when convenient -- it's picked up automatically, no code change.
function getSessionSecret(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit) return explicit;
  const seed = process.env.DATABASE_URL || 'insecure-fallback-secret-set-SESSION_SECRET';
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function sign(payloadB64: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('base64url');
}

export function signSessionCookie(payload: Record<string, unknown>): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionCookie(raw: string): any | null {
  const dot = raw.lastIndexOf('.');
  if (dot === -1) return null;
  const payloadB64 = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}
