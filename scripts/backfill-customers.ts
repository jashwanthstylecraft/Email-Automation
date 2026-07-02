import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

// One-time backfill: link every existing Email to a Customer record,
// grouped by sender, so the "emails from this sender" / thread-context
// features work for historical data too, not just emails synced after
// the customer-linking feature shipped.
async function main() {
  const emails = await prisma.email.findMany({
    where: { customerId: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, sender: true, organizationId: true, status: true },
  });
  console.log(`Backfilling customer links for ${emails.length} emails...`);

  const bySender = new Map<string, typeof emails>();
  for (const e of emails) {
    const key = `${e.organizationId}::${e.sender}`;
    if (!bySender.has(key)) bySender.set(key, []);
    bySender.get(key)!.push(e);
  }

  for (const [key, group] of bySender) {
    const [organizationId, email] = key.split('::');
    const totalReplies = group.filter(e => e.status === 'REPLIED').length;
    const lastEmailAt = group[group.length - 1] ? new Date() : null;

    const customer = await prisma.customer.upsert({
      where: { organizationId_email: { organizationId, email } },
      update: { totalEmails: { increment: group.length }, totalReplies: { increment: totalReplies }, lastEmailAt: new Date() },
      create: { organizationId, email, totalEmails: group.length, totalReplies, lastEmailAt: new Date() },
    });

    await prisma.email.updateMany({
      where: { id: { in: group.map(e => e.id) } },
      data: { customerId: customer.id },
    });

    console.log(`  ${email}: ${group.length} emails linked -> customer ${customer.id}`);
  }
  console.log('Done.');
}
main();
