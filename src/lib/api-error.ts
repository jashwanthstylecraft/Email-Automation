import { NextResponse } from 'next/server';

// Every route's catch block used to hand error.message straight back to the
// client -- fine in dev, but in production that can echo raw Prisma/Node
// internals (query fragments, file paths, library versions) to whoever
// triggered the failure. Logs the real error server-side either way; the
// client only gets the detail in a non-production environment.
export function apiError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message, error instanceof Error ? error.stack : '');
  return NextResponse.json(
    { error: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : message },
    { status }
  );
}
