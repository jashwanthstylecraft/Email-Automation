import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncOrgInbox } from '@/lib/inbox-sync';
import { getCurrentUser, isAdmin, getClientIp } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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

    // Spam and promotional/social ("Updates") mail is never surfaced in the
    // inbox -- the sync pipeline no longer stores it, but this filter is a
    // second line of defense against any pre-existing or manually-inserted
    // rows in those categories.
    const where: any = { organizationId: orgId, spam: false, gmailCategory: { not: 'updates' } };

    // The "status" param doubles as the mailbox tab selector. Most values
    // map straight to the Email.status column, but a few are pseudo-views
    // that need a different filter entirely.
    if (status === 'PRIMARY') {
      where.gmailCategory = 'primary';
    } else if (status === 'DRAFTS') {
      where.autoReplies = { some: { status: 'DRAFT' } };
    } else if (status && status !== 'ALL') {
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
      include: { autoReplies: true, customer: true },
    });

    return NextResponse.json({ emails });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, action } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    if (action === 'PURGE_SPAM_PROMO') {
      const user = await getCurrentUser();
      if (!isAdmin(user)) {
        return NextResponse.json({ error: 'Only an admin can purge spam/promotional mail.' }, { status: 403 });
      }
      const { count } = await prisma.email.deleteMany({
        where: { organizationId: orgId, OR: [{ spam: true }, { gmailCategory: 'updates' }] },
      });
      await logAudit({
        action: 'SPAM_PROMO_PURGED',
        user,
        entityType: 'email',
        ipAddress: getClientIp(request),
        details: `${user?.email || 'Admin'} purged ${count} spam/promotional email(s) from the inbox`,
      });
      return NextResponse.json({ success: true, deletedCount: count });
    }

    const result = await syncOrgInbox(orgId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
