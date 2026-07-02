import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const failedMatch = await prisma.failedMatch.findUnique({
      where: { id },
      include: { email: { include: { autoReplies: true } } },
    });
    if (!failedMatch) {
      return NextResponse.json({ error: 'Failed match not found' }, { status: 404 });
    }
    return NextResponse.json({ failedMatch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, notes, correctedTemplateId } = await request.json();
    const user = await getCurrentUser();

    const existing = await prisma.failedMatch.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Failed match not found' }, { status: 404 });
    }

    const updated = await prisma.failedMatch.update({
      where: { id },
      data: {
        status: status !== undefined ? status : undefined,
        notes: notes !== undefined ? notes : undefined,
        correctedTemplateId: correctedTemplateId !== undefined ? correctedTemplateId : undefined,
        reviewedAt: status && status !== 'Open' ? new Date() : undefined,
      },
    });

    await logAudit({
      action: 'FAILED_MATCH_REVIEWED',
      user,
      entityType: 'email',
      entityId: existing.emailId,
      beforeValue: existing.status,
      afterValue: status || existing.status,
      details: `${user?.email || 'Unknown user'} updated failed match review status from ${existing.status} to ${status || existing.status}`,
    });

    return NextResponse.json({ success: true, failedMatch: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
