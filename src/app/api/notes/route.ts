import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const search = searchParams.get('search');
    const templateId = searchParams.get('templateId');
    const userId = searchParams.get('userId');
    const emailId = searchParams.get('emailId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const where: any = { organizationId: orgId };
    if (templateId) where.relatedTemplateId = templateId;
    if (userId) where.createdByUserId = userId;
    if (emailId) where.relatedEmailId = emailId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    const notes = await prisma.internalNote.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      include: { relatedEmail: { select: { id: true, subject: true, sender: true } } },
    });

    return NextResponse.json({ notes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, noteBody, relatedTemplateId, relatedEmailId, isPinned, organizationId } = body;
    const user = await getCurrentUser();

    if (!organizationId || !title || !noteBody) {
      return NextResponse.json({ error: 'title, body, and organizationId are required' }, { status: 400 });
    }

    const note = await prisma.internalNote.create({
      data: {
        title,
        body: noteBody,
        relatedTemplateId: relatedTemplateId || null,
        relatedEmailId: relatedEmailId || null,
        isPinned: !!isPinned,
        createdByUserId: user?.id || null,
        createdByName: user?.email || 'Unknown',
        updatedByUserId: user?.id || null,
        updatedByName: user?.email || 'Unknown',
        organizationId,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
