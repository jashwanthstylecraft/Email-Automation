import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const status = searchParams.get('status');
    const templateId = searchParams.get('templateId');
    const sender = searchParams.get('sender');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const where: any = { email: { organizationId: orgId } };
    if (status && status !== 'ALL') where.status = status;
    if (templateId) where.aiSelectedTemplateId = templateId;
    if (userId) where.userId = userId;
    if (sender) where.email = { ...where.email, sender: { contains: sender, mode: 'insensitive' } };
    if (dateFrom) where.createdAt = { gte: new Date(dateFrom) };

    const failedMatches = await prisma.failedMatch.findMany({
      where,
      include: { email: { select: { subject: true, sender: true, recipient: true, createdAt: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ failedMatches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
