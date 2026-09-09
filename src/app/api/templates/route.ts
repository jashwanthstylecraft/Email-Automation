import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getClientIp, isAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { apiError } from '@/lib/api-error';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.template.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
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
    const { name, subject, body: templateBody, variables, keywords, images, active, notes } = body;

    const template = await prisma.template.create({
      data: {
        name,
        subject,
        body: templateBody,
        variables: variables || 'customer_name,closing',
        keywords: keywords || '{}',
        images: images || '[]',
        active: active !== undefined ? !!active : true,
        notes: notes || null,
        organizationId: user.organizationId,
      },
    });

    await logAudit({
      action: 'TEMPLATE_CREATED',
      user,
      entityType: 'template',
      entityId: template.id,
      afterValue: template.name,
      ipAddress: getClientIp(request),
      details: `${user.email} created template "${template.name}"`,
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, subject, body: templateBody, variables, keywords, images, active, notes } = body;

    const existing = await prisma.template.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        name,
        subject,
        body: templateBody,
        variables,
        keywords: keywords !== undefined ? keywords : undefined,
        images: images !== undefined ? images : undefined,
        active: active !== undefined ? !!active : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    // Only log a meaningful diff when the body/keywords actually changed
    // (this endpoint is also hit by lightweight toggles like Active/Inactive).
    const bodyChanged = templateBody !== undefined && templateBody !== existing.body;
    const keywordsChanged = keywords !== undefined && keywords !== existing.keywords;
    const activeChanged = active !== undefined && !!active !== existing.active;

    if (bodyChanged || keywordsChanged) {
      await logAudit({
        action: 'TEMPLATE_EDITED',
        user,
        entityType: 'template',
        entityId: id,
        beforeValue: bodyChanged ? existing.body : existing.keywords,
        afterValue: bodyChanged ? templateBody : keywords,
        ipAddress: getClientIp(request),
        details: `${user.email} edited ${bodyChanged ? 'the body' : 'the keywords'} of template "${existing.name}"`,
      });
    }
    if (activeChanged) {
      await logAudit({
        action: active ? 'TEMPLATE_ENABLED' : 'TEMPLATE_DISABLED',
        user,
        entityType: 'template',
        entityId: id,
        beforeValue: String(existing.active),
        afterValue: String(!!active),
        ipAddress: getClientIp(request),
        details: `${user.email} ${active ? 'enabled' : 'disabled'} template "${existing.name}"`,
      });
    }

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Only Admins can delete templates' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    const existing = await prisma.template.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.template.delete({
      where: { id },
    });

    await logAudit({
      action: 'TEMPLATE_DELETED',
      user,
      entityType: 'template',
      entityId: id,
      beforeValue: existing.name,
      ipAddress: getClientIp(request),
      details: `${user.email} deleted template "${existing.name}"`,
    });

    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (error: any) {
    return apiError(error);
  }
}
