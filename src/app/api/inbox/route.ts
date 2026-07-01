import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncNewMockEmail } from '@/lib/sync-service';
import { syncLiveIMAPEmail } from '@/lib/live-sync-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const sentiment = searchParams.get('sentiment');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const where: any = { organizationId: orgId };

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }
    if (sentiment && sentiment !== 'ALL') {
      where.sentiment = sentiment;
    }
    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { sender: { contains: search } },
        { subject: { contains: search } },
        { body: { contains: search } },
      ];
    }

    const emails = await prisma.email.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { autoReplies: true },
    });

    return NextResponse.json({ emails });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { orgId } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Find the first inbox of this organization to sync
    const inbox = await prisma.inbox.findFirst({
      where: { organizationId: orgId },
    });

    if (!inbox) {
      return NextResponse.json({ error: 'No configured inbox found' }, { status: 404 });
    }

    const hasLiveIMAP = !!(process.env.IMAP_USER && process.env.IMAP_PASSWORD && process.env.IMAP_HOST);

    if (hasLiveIMAP) {
      console.log(`Live IMAP configuration detected. Running live email sync for inbox ${inbox.id}...`);
      const result = await syncLiveIMAPEmail(inbox.id);
      return NextResponse.json({ success: true, isLive: true, ...result });
    } else {
      console.log(`No live IMAP configuration. Generating mock email for organization...`);
      const result = await syncNewMockEmail(inbox.id);
      return NextResponse.json({ success: true, isLive: false, syncedCount: 1, emails: [result.email] });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
