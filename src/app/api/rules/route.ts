import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const rules = await prisma.rule.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, conditions, actions, active, organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const rule = await prisma.rule.create({
      data: {
        name,
        conditions: typeof conditions === 'string' ? conditions : JSON.stringify(conditions),
        actions: typeof actions === 'string' ? actions : JSON.stringify(actions),
        active: active !== undefined ? active : true,
        organizationId,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, conditions, actions, active } = body;

    const rule = await prisma.rule.update({
      where: { id },
      data: {
        name,
        conditions: typeof conditions === 'string' ? conditions : JSON.stringify(conditions),
        actions: typeof actions === 'string' ? actions : JSON.stringify(actions),
        active,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    await prisma.rule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Rule deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
