import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.internalNote.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, noteBody, relatedTemplateId, relatedEmailId, isPinned } = body;

    const note = await prisma.internalNote.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        body: noteBody !== undefined ? noteBody : undefined,
        relatedTemplateId: relatedTemplateId !== undefined ? relatedTemplateId : undefined,
        relatedEmailId: relatedEmailId !== undefined ? relatedEmailId : undefined,
        isPinned: isPinned !== undefined ? !!isPinned : undefined,
        updatedByUserId: user.id,
        updatedByName: user.email,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.internalNote.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    await prisma.internalNote.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Note deleted' });
  } catch (error: any) {
    return apiError(error);
  }
}
