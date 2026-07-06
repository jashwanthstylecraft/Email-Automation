import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// getCurrentUser() already refreshes lastSeenAt as a side effect -- this
// endpoint exists purely so the client can ping it on an interval, keeping
// "active" accurate even on pages that make few/no other API calls.
export async function POST() {
  const user = await getCurrentUser();
  return NextResponse.json({ ok: !!user });
}
