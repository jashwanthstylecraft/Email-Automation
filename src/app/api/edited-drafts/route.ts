import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const status = searchParams.get('status'); // DRAFT, SENT, REJECTED
    const editedBy = searchParams.get('editedBy');
    const sender = searchParams.get('sender');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const where: any = {
      wasEdited: true,
      email: { organizationId: orgId },
    };
    if (status && status !== 'ALL') where.status = status;
    if (editedBy) where.editedBy = editedBy;
    if (sender) where.email = { ...where.email, sender: { contains: sender, mode: 'insensitive' } };

    const editedDrafts = await prisma.autoReply.findMany({
      where,
      include: { email: { select: { id: true, subject: true, sender: true, body: true, matchedTemplateId: true, aiConfidence: true, status: true } } },
      orderBy: { editedAt: 'desc' },
    });

    return NextResponse.json({ editedDrafts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
