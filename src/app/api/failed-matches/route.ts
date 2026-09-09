import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const templateId = searchParams.get('templateId');
    const sender = searchParams.get('sender');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');

    const where: any = { email: { organizationId: user.organizationId } };
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
    return apiError(error);
  }
}
