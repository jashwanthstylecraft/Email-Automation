import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const b2bSenders = await prisma.b2BSender.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ b2bSenders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { value, organizationId } = body;

    if (!organizationId || !value || !value.trim()) {
      return NextResponse.json({ error: 'value and organizationId are required' }, { status: 400 });
    }

    const b2bSender = await prisma.b2BSender.create({
      data: { value: value.trim().toLowerCase(), organizationId },
    });

    return NextResponse.json({ success: true, b2bSender });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'That sender/domain is already on the list' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
