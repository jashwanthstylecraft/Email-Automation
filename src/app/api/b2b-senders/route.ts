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

    const b2bSenders = await prisma.b2BSender.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ b2bSenders });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { value } = body;

    if (!value || !value.trim()) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }

    const b2bSender = await prisma.b2BSender.create({
      data: { value: value.trim().toLowerCase(), organizationId: user.organizationId },
    });

    return NextResponse.json({ success: true, b2bSender });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'That sender/domain is already on the list' }, { status: 409 });
    }
    return apiError(error);
  }
}
