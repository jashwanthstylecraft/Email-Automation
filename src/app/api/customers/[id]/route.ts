import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer || customer.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const emails = await prisma.email.findMany({
      where: { customerId: id },
      include: { autoReplies: true },
      orderBy: { createdAt: 'desc' },
    });

    const failedMatches = await prisma.failedMatch.findMany({
      where: { email: { customerId: id } },
      orderBy: { createdAt: 'desc' },
    });

    const notes = await prisma.internalNote.findMany({
      where: { relatedEmailId: { in: emails.map(e => e.id) } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ customer, emails, failedMatches, notes });
  } catch (error: any) {
    return apiError(error);
  }
}
