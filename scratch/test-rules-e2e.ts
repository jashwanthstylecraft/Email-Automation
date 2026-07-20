// End-to-end automation test: insert a synthetic email whose SUBJECT alone
// carries the intent, run the real rules engine on it, verify the matched
// template draft, then remove the synthetic row (AutoReply rows cascade).
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { processAutomationRules } from '../src/lib/rules-engine';

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No organization');

  const email = await prisma.email.create({
    data: {
      sender: 'automation-test@example.com',
      recipient: 'support@stylecraftus.com',
      subject: 'Where is my order?',
      body: 'Hi, I placed an order last week. Thanks.',
      preview: 'Hi, I placed an order last week.',
      organizationId: org.id,
    },
  });

  try {
    const result = await processAutomationRules(email.id);
    if (!result) {
      console.log('FAIL: no rule matched (email routed to manual review)');
      return;
    }
    console.log(`Rule applied: "${result.ruleApplied}" action=${result.action}`);
    const reply = await prisma.autoReply.findFirst({ where: { emailId: email.id } });
    console.log(`Draft status: ${reply?.status}`);
    console.log(`Draft starts: ${reply?.responseBody.slice(0, 120)}...`);
    const after = await prisma.email.findUnique({ where: { id: email.id } });
    console.log(`Email status after automation: ${after?.status}`);
  } finally {
    await prisma.email.delete({ where: { id: email.id } });
    // remove the synthetic customer shell if the pipeline created one (it
    // didn't here -- upsert happens at sync time -- but stay tidy) and the
    // synthetic rule-trigger stats are harmless.
    await prisma.customer.deleteMany({ where: { email: 'automation-test@example.com' } });
    console.log('Synthetic test email cleaned up.');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
