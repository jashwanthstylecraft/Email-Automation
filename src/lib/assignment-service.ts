import { prisma } from './prisma';
import { isRecentlyActive } from './auth';

const OPEN_STATUSES = ['UNREAD', 'WAITING'];

/**
 * Assigns one email to whichever currently-active Support Agent has the
 * fewest open (unresolved) emails right now. Ties are broken by a stable
 * Support 1 -> Support 2 -> Support 3 order. Counts are re-read from the
 * database on every call (not cached in memory), so calling this once per
 * email in a loop naturally balances a whole batch correctly -- each
 * assignment is immediately visible to the next call's count query.
 *
 * Returns null if no support agent is currently active (assignment is
 * skipped rather than forced onto someone who isn't at their desk).
 */
export async function assignEmailRoundRobin(organizationId: string, emailId: string) {
  const agents = await prisma.user.findMany({
    where: { organizationId, role: 'Support Agent' },
    orderBy: { createdAt: 'asc' },
  });

  const activeAgents = agents.filter(a => isRecentlyActive(a.lastSeenAt));
  if (activeAgents.length === 0) return null;

  const withCounts = await Promise.all(
    activeAgents.map(async (agent, index) => ({
      agent,
      index, // stable tie-break order (Support 1 -> 2 -> 3, by createdAt)
      openCount: await prisma.email.count({
        where: { organizationId, assignedUserId: agent.id, status: { in: OPEN_STATUSES } },
      }),
    }))
  );

  withCounts.sort((a, b) => a.openCount - b.openCount || a.index - b.index);
  const chosen = withCounts[0].agent;

  await prisma.email.update({
    where: { id: emailId },
    data: { assignedUserId: chosen.id, assignedAt: new Date() },
  });

  await prisma.assignmentLog.create({
    data: {
      emailId,
      assignedToUserId: chosen.id,
      assignedToName: chosen.name,
      assignedBy: 'round_robin',
      assignmentMethod: 'round_robin',
    },
  });

  return chosen;
}
