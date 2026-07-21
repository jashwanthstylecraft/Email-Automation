import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { openai, OPENAI_MODEL, OPENAI_TEMPERATURE } from '../src/lib/openai-client';

const PLACEHOLDER_NAMES = new Set(['customer_name', 'closing', 'ticket_id', 'order_number', 'rma_number']);
const DELAY_MS = 4500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateKeywords(name: string, body: string): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

  const prompt = `You are labeling a customer-support response template so an automated system can match incoming customer emails to it.

Template title: "${name}"
Template response body:
"""
${body.slice(0, 1200)}
"""

List 3 to 6 short, DISTINCTIVE keyword phrases (2-4 words each) that a CUSTOMER would plausibly write in their own email if this specific template were the correct reply. Focus on concrete nouns/issues (product part names, specific complaints, specific questions) — not generic words like "thank you", "help", "question", "issue", "email", "customer".

Return ONLY a JSON object of the shape {"keywords": ["...", "..."]}. No markdown, no explanation.`;

  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: OPENAI_TEMPERATURE,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err: any) {
      if (err?.status === 429) {
        const backoff = 8000 * (attempt + 1);
        console.log(`  rate limited, waiting ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }

    const text = res.choices[0]?.message?.content || '{}';
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    return keywords.map((k: any) => String(k).toLowerCase().trim()).filter(Boolean);
  }

  throw new Error('OpenAI returned 429 after retries');
}

async function processTemplate(t: { id: string; name: string; body: string; variables: string }) {
  const existing = t.variables.split(',').map(v => v.trim()).filter(Boolean);
  const existingKeywords = existing.filter(v => !PLACEHOLDER_NAMES.has(v.toLowerCase()));

  if (existingKeywords.length >= 3) {
    console.log(`SKIP  "${t.name}" — already has ${existingKeywords.length} keywords`);
    return;
  }

  try {
    const newKeywords = await generateKeywords(t.name, t.body);
    const placeholders = existing.filter(v => PLACEHOLDER_NAMES.has(v.toLowerCase()));
    const merged = Array.from(new Set([...placeholders, ...existingKeywords, ...newKeywords]));

    await prisma.template.update({
      where: { id: t.id },
      data: { variables: merged.join(', ') },
    });
    console.log(`OK    "${t.name}" -> +${newKeywords.length} keywords: ${newKeywords.join(' | ')}`);
  } catch (err: any) {
    console.error(`FAIL  "${t.name}": ${err.message}`);
  }
}

async function main() {
  const templates = await prisma.template.findMany();
  console.log(`Enriching keywords for ${templates.length} templates (serial, ${DELAY_MS}ms between calls)...`);

  for (const t of templates) {
    await processTemplate(t);
    await sleep(DELAY_MS);
  }
  console.log('Done.');
}

main();
