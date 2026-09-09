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
    const templateId = searchParams.get('templateId');
    const userId = searchParams.get('userId');
    const emailId = searchParams.get('emailId');

    const where: any = { organizationId: user.organizationId };
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
    const { title, noteBody, relatedTemplateId, relatedEmailId, isPinned } = body;

    if (!title || !noteBody) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
    }

    const note = await prisma.internalNote.create({
      data: {
        title,
        body: noteBody,
        relatedTemplateId: relatedTemplateId || null,
        relatedEmailId: relatedEmailId || null,
        isPinned: !!isPinned,
        createdByUserId: user.id,
        createdByName: user.email,
        updatedByUserId: user.id,
        updatedByName: user.email,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    return apiError(error);
  }
}
