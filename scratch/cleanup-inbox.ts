// One-time inbox cleanup (2026-07-15):
//   KEEP  -> emails from sakif@stylecraftus.com that are still open
//            (UNREAD / WAITING / ESCALATED = upcoming work)
//   DELETE-> every email from any other sender, plus sakif's already-REPLIED
//            (past/handled) emails
// Then removes Customer records left with no emails and recomputes the
// counters on the survivors. AutoReplies/FailedMatches/AssignmentLogs/
// notes-links cascade via the schema.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const KEEP_SENDER = 'sakif@stylecraftus.com';

async function main() {
  const before = await prisma.email.count();

  const otherSenders = await prisma.email.deleteMany({
    where: { sender: { not: KEEP_SENDER } },
  });
  const pastSakif = await prisma.email.deleteMany({
    where: { sender: KEEP_SENDER, status: 'REPLIED' },
  });

  // Customers whose emails are now all gone are stale profile shells.
  const customers = await prisma.customer.findMany({ include: { _count: { select: { emails: true } } } });
  let removedCustomers = 0;
  for (const c of customers) {
    if (c._count.emails === 0) {
      await prisma.customer.delete({ where: { id: c.id } });
      removedCustomers++;
    } else {
      const emails = await prisma.email.findMany({
        where: { customerId: c.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          totalEmails: emails.length,
          totalReplies: 0, // no REPLIED emails remain by definition
          lastEmailAt: emails[0]?.createdAt ?? null,
        },
      });
    }
  }

  const remaining = await prisma.email.findMany({
    orderBy: { createdAt: 'asc' },
    select: { sender: true, subject: true, status: true, createdAt: true },
  });

  console.log(`Emails before: ${before}`);
  console.log(`Deleted: ${otherSenders.count} from other senders, ${pastSakif.count} already-replied from ${KEEP_SENDER}`);
  console.log(`Removed ${removedCustomers} orphaned customer records`);
  console.log(`\nRemaining ${remaining.length} emails:`);
  for (const e of remaining) {
    console.log(`  [${e.createdAt.toISOString().slice(0, 10)}] ${e.status.padEnd(8)} ${e.subject}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
