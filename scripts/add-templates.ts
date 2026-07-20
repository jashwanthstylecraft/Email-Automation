import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { prisma } from '../src/lib/prisma';
import { extractKeywordsForTemplate, serializeKeywords } from '../src/lib/keyword-engine';

// ---------------------------------------------------------------------------
// Additive template installer.
//
// reseed-templates.ts WIPES every template and rule before recreating them,
// which also destroys keyword enrichment and feedback-added keywords. This
// script instead adds only the templates listed in NEW_TEMPLATE_KEYWORDS
// (reading their bodies from scratch/parsed_templates.json), each with:
//   - structured keywords (local extraction + the manual phrases below), and
//   - one automation rule matching those phrases in the subject OR body.
// It is idempotent: templates/rules that already exist are skipped. To add
// more templates later: append {name, body} to scratch/parsed_templates.json,
// add an entry here (and in reseed-templates.ts so reseeds keep it), rerun.
// ---------------------------------------------------------------------------

const NEW_TEMPLATE_KEYWORDS: Record<string, string[]> = {
  "Order Status / Tracking Request": ["order status", "where is my order", "track my order", "tracking number", "order update", "not seeing my order", "status of my order"],
  "Where Is My Refund": ["where is my refund", "refund status", "still waiting for refund", "refund not received", "havent received my refund", "haven't received my refund"],
  "Wrong Item Received": ["wrong item", "wrong product", "incorrect item", "not what i ordered", "received the wrong"],
  "Warranty Claim Status Follow-Up": ["claim status", "warranty claim status", "filed a claim", "claim update", "update on my claim"],
  "Product Recommendation / Which Model Should I Buy": ["which model", "which clipper should", "recommend a clipper", "what should i buy", "best clipper for", "which one should i buy"],
  "Clipper Maintenance & Oiling": ["how to oil", "oil my clipper", "clean my clipper", "maintain my clipper", "clipper maintenance", "blade maintenance", "how often should i oil"],
  "Replacement Parts Purchase": ["replacement blade", "replacement parts", "buy a new blade", "spare parts", "purchase parts", "buy replacement"],
  "Discount Code Not Working": ["discount code not working", "promo code", "coupon code", "code isn't working", "code not working", "code doesnt work"],
  "General Inquiry Acknowledgment": ["general inquiry", "general question"],
  "Out of Stock - No Restock Date (Next Drop TBD)": ["next drop tbd", "no restock date", "still out of stock", "everything is out of stock", "when will this be back in stock", "no eta on restock", "out of stock except"],
};

function slugId(prefix: string, name: string): string {
  return `${prefix}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

function detectVariables(body: string): string {
  const variablesList = ['customer_name', 'closing'];
  if (body.includes('[ORDER_NUMBER]')) variablesList.push('order_number');
  if (body.includes('[RMA_NUMBER]')) variablesList.push('rma_number');
  if (body.includes('[RA_NUMBER]')) variablesList.push('ra_number');
  if (body.includes('[PRODUCT_NAME]')) variablesList.push('product_name');
  if (body.includes('[TRACKING_LINK]')) variablesList.push('tracking_link');
  if (body.includes('[SHIPPING_ADDRESS]')) variablesList.push('shipping_address');
  if (body.includes('[SELLER_NAME]')) variablesList.push('seller_name');
  return variablesList.join(',');
}

// Same shape the rules engine consumes: every phrase is checked against BOTH
// the subject and the body, so a customer who puts the whole question in the
// subject line still triggers the right template.
function buildRuleConditions(keywords: string[]): string {
  return JSON.stringify({
    logic: 'OR',
    rules: keywords.flatMap(kw => [
      { field: 'subject', operator: 'contains', value: kw },
      { field: 'body', operator: 'contains', value: kw },
    ]),
  });
}

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No organization found in database.');

  const parsed: { name: string; body: string }[] = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'scratch', 'parsed_templates.json'), 'utf-8')
  );

  let createdTemplates = 0;
  let createdRules = 0;

  for (const [name, phrases] of Object.entries(NEW_TEMPLATE_KEYWORDS)) {
    const source = parsed.find(t => t.name === name);
    if (!source) {
      console.warn(`SKIP "${name}": not found in scratch/parsed_templates.json`);
      continue;
    }

    const templateId = slugId('template', name);
    const existingTemplate = await prisma.template.findUnique({ where: { id: templateId } });
    if (!existingTemplate) {
      // Manual phrases become primary keywords on top of local extraction so
      // the keyword matcher (runKeywordMatcher) can hit them immediately.
      const keywords = extractKeywordsForTemplate(name, source.body);
      keywords.primary = Array.from(new Set([...keywords.primary, ...phrases.map(p => p.toLowerCase())]));

      await prisma.template.create({
        data: {
          id: templateId,
          name,
          subject: `Regarding your StyleCraft inquiry: ${name}`,
          body: source.body,
          variables: detectVariables(source.body),
          keywords: serializeKeywords(keywords),
          organizationId: org.id,
        },
      });
      createdTemplates++;
      console.log(`Template created: "${name}"`);
    } else {
      console.log(`Template already exists, skipping: "${name}"`);
    }

    const ruleId = slugId('rule', name);
    const existingRule = await prisma.rule.findUnique({ where: { id: ruleId } });
    if (!existingRule) {
      await prisma.rule.create({
        data: {
          id: ruleId,
          name,
          conditions: buildRuleConditions(phrases),
          actions: JSON.stringify({ actionType: 'REPLY_TEMPLATE', templateId, status: 'WAITING' }),
          active: true,
          organizationId: org.id,
        },
      });
      createdRules++;
      console.log(`Rule created: "${name}"`);
    }
  }

  // Upgrade pre-existing rules that only inspect the body: give every
  // body-contains condition a subject-contains twin so subject-line-only
  // inquiries match too. Idempotent -- rules that already check the subject
  // are left untouched.
  const allRules = await prisma.rule.findMany({ where: { organizationId: org.id } });
  let upgradedRules = 0;
  for (const rule of allRules) {
    let group: { logic: string; rules: { field: string; operator: string; value: string }[] };
    try {
      group = JSON.parse(rule.conditions);
    } catch {
      continue;
    }
    if (!group?.rules?.length || group.logic !== 'OR') continue;
    if (group.rules.some(c => c.field === 'subject')) continue;

    const bodyConditions = group.rules.filter(c => c.field === 'body' && c.operator === 'contains');
    if (bodyConditions.length === 0) continue;

    group.rules = bodyConditions.flatMap(c => [{ ...c, field: 'subject' }, c]);
    await prisma.rule.update({ where: { id: rule.id }, data: { conditions: JSON.stringify(group) } });
    upgradedRules++;
  }

  console.log(`\nDone. Created ${createdTemplates} templates, ${createdRules} rules; upgraded ${upgradedRules} existing rules to also match subjects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
