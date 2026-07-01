import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { runKeywordMatcher } from '../src/lib/ai-pipeline';

// One-off correction pass: re-run the (now fixed) keyword matcher against
// every email whose match came from the old, noisy title-word-decomposition
// logic, and clear/replace it with what the current matcher actually finds.
async function main() {
  const emails = await prisma.email.findMany({
    where: { aiProvider: 'Keyword Matcher' },
  });
  console.log(`Rechecking ${emails.length} keyword-matched emails against the fixed matcher...`);

  for (const e of emails) {
    const fresh = await runKeywordMatcher(e.body, e.subject, e.organizationId);

    if (fresh.matchedTemplateId === e.matchedTemplateId) {
      console.log(`UNCHANGED "${e.subject.slice(0, 50)}" — still matches ${fresh.matchedTemplateId || 'nothing'}`);
      continue;
    }

    await prisma.email.update({
      where: { id: e.id },
      data: {
        matchedTemplateId: fresh.matchedTemplateId,
        aiConfidence: fresh.confidenceScore,
        summary: fresh.matchedTemplateId
          ? `Matched keyword — ${fresh.matchReason}.`
          : 'No approved template matched this email; needs manual review.',
        // A stale wrong match doesn't deserve to look "reviewed" — put it
        // back in the manual review queue if it was previously auto-drafted.
        status: e.status === 'UNREAD' ? 'WAITING' : e.status,
      },
    });

    // Drop the stale AI-generated draft tied to the old (wrong) template
    const staleDraft = await prisma.autoReply.findFirst({
      where: { emailId: e.id, status: 'DRAFT' },
    });
    if (staleDraft) {
      await prisma.autoReply.delete({ where: { id: staleDraft.id } });
    }

    console.log(`FIXED     "${e.subject.slice(0, 50)}": ${e.matchedTemplateId || 'none'} -> ${fresh.matchedTemplateId || 'none'} (${fresh.matchReason})`);
  }
}
main();
