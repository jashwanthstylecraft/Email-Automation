import { prisma } from './prisma';

/**
 * Upserts the Customer record for an incoming email's sender and links the
 * email to it. Powers the "group emails by sender" / thread-context features
 * -- every synced email attaches to a running per-customer profile instead
 * of being treated as an isolated, unrelated request.
 */
export async function upsertCustomerForEmail(organizationId: string, senderEmail: string, emailId: string) {
  const customer = await prisma.customer.upsert({
    where: { organizationId_email: { organizationId, email: senderEmail } },
    update: { totalEmails: { increment: 1 }, lastEmailAt: new Date() },
    create: { organizationId, email: senderEmail, totalEmails: 1, lastEmailAt: new Date() },
  });
  await prisma.email.update({ where: { id: emailId }, data: { customerId: customer.id } });
  return customer;
}

/**
 * Fetches recent emails from the same sender (thread context) so the AI
 * pipeline can see "this customer already asked X" instead of treating a
 * follow-up as a brand new, isolated request.
 */
export async function getThreadContext(organizationId: string, senderEmail: string, excludeEmailId?: string, take = 5) {
  return prisma.email.findMany({
    where: {
      organizationId,
      sender: senderEmail,
      ...(excludeEmailId ? { id: { not: excludeEmailId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: { subject: true, body: true, matchedTemplateId: true, status: true, createdAt: true },
  });
}

/**
 * If this sender already received a SENT reply using the same matched
 * template within the last 24 hours, this is very likely a duplicate/
 * near-duplicate situation (e.g. a follow-up email, or a re-sync glitch) --
 * it should NOT be silently auto-sent again with the same canned response.
 */
export async function checkRecentDuplicateReply(organizationId: string, senderEmail: string, matchedTemplateId: string | null): Promise<boolean> {
  if (!matchedTemplateId) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentSent = await prisma.autoReply.findFirst({
    where: {
      status: 'SENT',
      sentAt: { gte: since },
      email: {
        organizationId,
        sender: senderEmail,
        matchedTemplateId,
      },
    },
  });
  return !!recentSent;
}
