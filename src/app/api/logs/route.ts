import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

// NOTE: AuditLog/LearningLog have no organizationId column at the schema
// level, so this can't be scoped to the caller's own org without a
// migration + backfill. Today's production only has a single organization,
// so the practical exposure is limited to "requires login" for now -- but
// this is a real gap to close (add organizationId to both models, backfill
// via their emailId/userId relations) before a second org is ever onboarded.
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');

    const where: any = {};
    if (userId) where.userId = userId;
    if (userEmail) where.userEmail = userEmail;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300
    });

    const learningLogs = await prisma.learningLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({ logs, learningLogs });
  } catch (error: any) {
    return apiError(error);
  }
}
