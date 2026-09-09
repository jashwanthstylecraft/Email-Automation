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
    const businessType = searchParams.get('businessType');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    // Capped and paginated -- with thousands of emails now in a real
    // mailbox, an unbounded findMany() shipped a multi-MB JSON payload
    // (full body text + full autoReply bodies for every single row) on
    // every fetch, which is exactly what made the page feel unresponsive.
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

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
    if (status === 'INBOX' || !status) {
      // The inbox proper: only mail that still needs action. Replied
      // (handled) and escalated/archived mail lives in its own tabs.
      where.status = { in: ['UNREAD', 'WAITING'] };
    } else if (status === 'PRIMARY') {
      where.gmailCategory = 'primary';
      where.status = { not: 'ESCALATED' };
    } else if (status === 'DRAFTS') {
      where.autoReplies = { some: { status: 'DRAFT' } };
    } else if (status === 'ALL') {
      // "All" is every conversation except the Deleted/Archived tab's.
      where.status = { not: 'ESCALATED' };
    } else {
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
    if (businessType && businessType !== 'ALL') {
      where.businessType = businessType;
    } else if (!search) {
      // "ALL" means all real customer mail -- INTERNAL (staff/automated
      // senders, tagged instead of discarded so nothing's silently lost)
      // is noise here and only shows up under its own explicit filter.
      // But an active search is an explicit "find this" request -- it
      // should search everything, Internal included, not silently hide
      // matches just because of the passive noise-reduction default.
      where.businessType = { not: 'INTERNAL' };
    }

    if (search) {
      where.OR = [
        { sender: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          // Only what a list row actually renders (the "Sent · who" badge) --
          // the full responseBody per reply, multiplied across every row, was
          // a big chunk of the old payload. The single-email detail fetch
          // pulls the complete AutoReply rows separately when opened.
          autoReplies: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true, approvedBy: true, sentAt: true } },
          customer: true,
        },
      }),
      prisma.email.count({ where }),
    ]);

    // Attachments can be several MB of base64 each -- fine for a single
    // email's own detail fetch, but multiplied across a whole list this
    // would balloon the response. The list only needs to know whether any
    // exist (for a paperclip indicator); the full data loads with the
    // single-email GET when someone actually opens it.
    const emailsForList = emails.map(({ attachments, ...rest }) => {
      let count = 0;
      try {
        count = JSON.parse(attachments || '[]').length;
      } catch {
        count = 0;
      }
      return { ...rest, attachmentCount: count };
    });

    return NextResponse.json({
      emails: emailsForList,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
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
