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

    const integrations = await prisma.integration.findMany({
      where: { organizationId: user.organizationId },
    });

    return NextResponse.json({ integrations });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Only an admin can add an integration.' }, { status: 403 });
    }

    const body = await request.json();
    const { type, config, active } = body;

    const integration = await prisma.integration.create({
      data: {
        type,
        config: typeof config === 'string' ? config : JSON.stringify(config),
        active: active !== undefined ? active : true,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({ success: true, integration });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Only an admin can change an integration.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, config, active } = body;

    const existing = await prisma.integration.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const integration = await prisma.integration.update({
      where: { id },
      data: {
        config: typeof config === 'string' ? config : JSON.stringify(config),
        active,
      },
    });

    return NextResponse.json({ success: true, integration });
  } catch (error: any) {
    return apiError(error);
  }
}
