import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, noteBody, relatedTemplateId, relatedEmailId, isPinned } = body;
    const user = await getCurrentUser();

    const note = await prisma.internalNote.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        body: noteBody !== undefined ? noteBody : undefined,
        relatedTemplateId: relatedTemplateId !== undefined ? relatedTemplateId : undefined,
        relatedEmailId: relatedEmailId !== undefined ? relatedEmailId : undefined,
        isPinned: isPinned !== undefined ? !!isPinned : undefined,
        updatedByUserId: user?.id || null,
        updatedByName: user?.email || 'Unknown',
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.internalNote.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Note deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
