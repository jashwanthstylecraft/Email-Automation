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
    const search = searchParams.get('search');

    const where: any = { organizationId: user.organizationId };
    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { totalEmails: 'desc' },
    });

    return NextResponse.json({ customers });
  } catch (error: any) {
    return apiError(error);
  }
}
