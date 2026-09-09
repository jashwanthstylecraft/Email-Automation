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

    const documents = await prisma.document.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ documents });
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
    const { title, content, fileType, fileSize } = body;

    const document = await prisma.document.create({
      data: {
        title,
        content,
        fileType,
        fileSize: fileSize || content.length,
        organizationId: user.organizationId,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'KNOWLEDGE_UPLOAD',
        userId: user.id,
        userEmail: user.email,
        details: `${user.email} uploaded knowledge base document "${title}"`,
      },
    });

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc || doc.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await prisma.document.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'KNOWLEDGE_DELETE',
        userId: user.id,
        userEmail: user.email,
        details: `${user.email} deleted knowledge base document "${doc.title}"`,
      },
    });

    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (error: any) {
    return apiError(error);
  }
}
