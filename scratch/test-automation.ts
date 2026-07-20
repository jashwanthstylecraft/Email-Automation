// Verifies the automation stack end-to-end against the live DB (read-only):
//  1. keyword matcher (ai-pipeline path) resolves sample inquiries --
//     including subject-only ones -- to the correct template
//  2. every rule's conditions parse and now include subject matching
//  3. every rule's REPLY_TEMPLATE action points at a template that exists
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { parseKeywords, matchTemplates, TemplateForScoring } from '../src/lib/keyword-engine';

const SAMPLES: { subject: string; body: string; expect: string }[] = [
  { subject: 'Where is my order?', body: '', expect: 'template-order-status---tracking-request' },
  { subject: 'Refund status', body: 'I returned my clipper two weeks ago and still waiting for refund.', expect: 'template-where-is-my-refund' },
  { subject: 'You sent me the wrong item', body: 'I ordered a Saber trimmer but received the wrong product.', expect: 'template-wrong-item-received' },
  { subject: 'Update on my claim', body: 'I filed a claim last week, any claim update?', expect: 'template-warranty-claim-status-follow-up' },
  { subject: 'Which clipper should I get?', body: 'I am a beginner barber, which model is best clipper for fades?', expect: 'template-product-recommendation---which-model-should-i-buy' },
  { subject: 'How often should I oil my clipper?', body: '', expect: 'template-clipper-maintenance---oiling' },
  { subject: 'Buy replacement blade', body: 'Where can I purchase a replacement blade for my Ergo?', expect: 'template-replacement-parts-purchase' },
  { subject: 'Promo code not working', body: 'My discount code not working at checkout.', expect: 'template-discount-code-not-working' },
  // regression: an existing (pre-change) template must still match
  { subject: 'Missing package', body: 'Tracking says delivered but I never received my package.', expect: 'template-missing-package' },
];

async function main() {
  const templates = await prisma.template.findMany();
  const scoring: TemplateForScoring[] = templates.map(t => ({
    id: t.id, name: t.name, active: t.active, keywords: parseKeywords(t.keywords),
  }));

  console.log(`Templates in DB: ${templates.length}\n--- Keyword matcher (subject+body) ---`);
  let pass = 0;
  for (const s of SAMPLES) {
    const r = matchTemplates(scoring, s.subject, s.body);
    const ok = r.matchedTemplateId === s.expect;
    if (ok) pass++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  "${s.subject}" -> ${r.matchedTemplateId} (conf ${r.confidenceScore.toFixed(2)})${ok ? '' : ` expected ${s.expect}`}`);
  }
  console.log(`${pass}/${SAMPLES.length} matcher samples passed`);

  console.log('\n--- Rules audit ---');
  const rules = await prisma.rule.findMany();
  const templateIds = new Set(templates.map(t => t.id));
  let parseErrors = 0, noSubject = 0, danglingTemplate = 0;
  for (const rule of rules) {
    try {
      const group = JSON.parse(rule.conditions);
      if (!group.rules.some((c: any) => c.field === 'subject')) noSubject++;
      const action = JSON.parse(rule.actions);
      if (action.actionType === 'REPLY_TEMPLATE' && !templateIds.has(action.templateId)) {
        danglingTemplate++;
        console.log(`  dangling template in rule "${rule.name}" -> ${action.templateId}`);
      }
    } catch {
      parseErrors++;
      console.log(`  unparseable conditions/actions in rule "${rule.name}"`);
    }
  }
  console.log(`Rules: ${rules.length} total, ${parseErrors} parse errors, ${noSubject} without subject matching, ${danglingTemplate} dangling template refs`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
