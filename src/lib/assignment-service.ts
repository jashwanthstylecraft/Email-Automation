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

/**
 * One-time corrective pass: redistributes every currently-open (not yet
 * replied) email evenly across ALL Support Agents in the org, ignoring the
 * active-in-last-10-minutes filter (unlike assignEmailRoundRobin, which is
 * for live routing of brand-new mail). Use this to fix a backlog that got
 * skewed toward one agent -- e.g. by a bug that assigned emails to whoever
 * happened to open them instead of balancing fairly.
 */
export async function rebalanceOpenEmails(organizationId: string, actorEmail: string | null) {
  const agents = await prisma.user.findMany({
    where: { organizationId, role: 'Support Agent' },
    orderBy: { createdAt: 'asc' },
  });
  if (agents.length === 0) return { reassignedCount: 0 };

  const openEmails = await prisma.email.findMany({
    where: { organizationId, status: { in: OPEN_STATUSES } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  // Track counts in memory instead of re-querying per email -- this pass
  // touches every open email, so re-counting from the DB each time would be
  // both slow and racing against updates this same loop just made.
  const counts = new Map(agents.map(a => [a.id, 0]));
  let reassignedCount = 0;

  for (const email of openEmails) {
    const ranked = agents
      .map((agent, index) => ({ agent, index, count: counts.get(agent.id)! }))
      .sort((a, b) => a.count - b.count || a.index - b.index);
    const chosen = ranked[0].agent;

    await prisma.email.update({
      where: { id: email.id },
      data: { assignedUserId: chosen.id, assignedAt: new Date(), lockedByUserId: null, lockedAt: null },
    });
    await prisma.assignmentLog.create({
      data: {
        emailId: email.id,
        assignedToUserId: chosen.id,
        assignedToName: chosen.name,
        assignedBy: actorEmail || 'rebalance',
        assignmentMethod: 'manual',
      },
    });

    counts.set(chosen.id, counts.get(chosen.id)! + 1);
    reassignedCount++;
  }

  return { reassignedCount, counts: Object.fromEntries(agents.map(a => [a.name, counts.get(a.id)])) };
}
