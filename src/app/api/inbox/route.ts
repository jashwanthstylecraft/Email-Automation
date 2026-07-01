import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncOrgInbox } from '@/lib/inbox-sync';

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

    const result = await syncOrgInbox(orgId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
