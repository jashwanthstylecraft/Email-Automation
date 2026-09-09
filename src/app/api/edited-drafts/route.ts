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
    const status = searchParams.get('status'); // DRAFT, SENT, REJECTED
    const editedBy = searchParams.get('editedBy');
    const sender = searchParams.get('sender');

    const where: any = {
      wasEdited: true,
      email: { organizationId: user.organizationId },
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
    return apiError(error);
  }
}
