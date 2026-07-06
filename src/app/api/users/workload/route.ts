import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isAdmin, isRecentlyActive, isInactiveTooLong } from '@/lib/auth';

const OPEN_STATUSES = ['UNREAD', 'WAITING'];
// How long an open email can sit assigned before it's flagged overdue.
const OVERDUE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Per-agent workload counters used by the Classify lanes and the
 * admin-only activity view. Support agents only ever see their own row
 * unless they're an Admin (isAdmin gates the org-wide view).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agents = await prisma.user.findMany({
      where: isAdmin(currentUser)
        ? { organizationId: orgId, role: 'Support Agent' }
        : { organizationId: orgId, role: 'Support Agent', id: currentUser.id },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();
    const workload = await Promise.all(
      agents.map(async (agent) => {
        const [openCount, respondedCount, assignedTotal, draftsGenerated, overdueCount] = await Promise.all([
          prisma.email.count({ where: { organizationId: orgId, assignedUserId: agent.id, status: { in: OPEN_STATUSES } } }),
          prisma.email.count({ where: { organizationId: orgId, assignedUserId: agent.id, status: 'REPLIED' } }),
          prisma.email.count({ where: { organizationId: orgId, assignedUserId: agent.id } }),
          prisma.autoReply.count({ where: { email: { organizationId: orgId, assignedUserId: agent.id } } }),
          prisma.email.count({
            where: {
              organizationId: orgId,
              assignedUserId: agent.id,
              status: { in: OPEN_STATUSES },
              assignedAt: { lt: new Date(now - OVERDUE_MS) },
            },
          }),
        ]);

        return {
          userId: agent.id,
          name: agent.name,
          email: agent.email,
          isActive: isRecentlyActive(agent.lastSeenAt),
          lastSeenAt: agent.lastSeenAt,
          openCount,
          leftToRespond: openCount,
          respondedCount,
          assignedTotal,
          draftsGenerated,
          overdueCount,
          isInactiveWithPending: isInactiveTooLong(agent.lastSeenAt) && openCount > 0,
        };
      })
    );

    return NextResponse.json({ workload });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
