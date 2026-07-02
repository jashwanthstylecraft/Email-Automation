import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const search = searchParams.get('search');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const where: any = { organizationId: orgId };
    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { totalEmails: 'desc' },
    });

    return NextResponse.json({ customers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
