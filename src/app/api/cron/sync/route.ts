import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncOrgInbox } from '@/lib/inbox-sync';
import { apiError } from '@/lib/api-error';

/**
 * Scheduled inbox sync (Vercel Cron hits this on a timer, see vercel.json).
 * Serverless hosting can't run the always-on IMAP listener this app was
 * originally built around, so this polls every organization's inbox instead.
 */
export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const organizations = await prisma.organization.findMany({ select: { id: true } });
    const results = await Promise.all(
      organizations.map((org) => syncOrgInbox(org.id).catch((err: any) => ({
        orgId: org.id,
        success: false,
        error: err.message,
      })))
    );

    return NextResponse.json({ ranAt: new Date().toISOString(), results });
  } catch (error: any) {
    return apiError(error);
  }
}
