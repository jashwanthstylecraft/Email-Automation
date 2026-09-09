import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rules = await prisma.rule.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Only an admin can create a rule.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, conditions, actions, active } = body;

    const rule = await prisma.rule.create({
      data: {
        name,
        conditions: typeof conditions === 'string' ? conditions : JSON.stringify(conditions),
        actions: typeof actions === 'string' ? actions : JSON.stringify(actions),
        active: active !== undefined ? active : true,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Only an admin can change a rule.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, conditions, actions, active } = body;

    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

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
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Only an admin can delete a rule.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await prisma.rule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Rule deleted' });
  } catch (error: any) {
    return apiError(error);
  }
}
