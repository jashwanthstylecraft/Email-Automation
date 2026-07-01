import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const documents = await prisma.document.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, fileType, fileSize, organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const document = await prisma.document.create({
      data: {
        title,
        content,
        fileType,
        fileSize: fileSize || content.length,
        organizationId,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'KNOWLEDGE_UPLOAD',
        details: `Knowledge base document "${title}" uploaded`,
      },
    });

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({ where: { id } });
    
    await prisma.document.delete({
      where: { id },
    });

    // Audit log
    if (doc) {
      await prisma.auditLog.create({
        data: {
          action: 'KNOWLEDGE_DELETE',
          details: `Knowledge base document "${doc.title}" deleted`,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
