import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
