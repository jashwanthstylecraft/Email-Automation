import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const PLACEHOLDER_NAMES = new Set(['customer_name', 'closing', 'ticket_id', 'order_number', 'rma_number']);
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const DELAY_MS = 4500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateKeywords(name: string, body: string): Promise<string[]> {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY is not set');

  const prompt = `You are labeling a customer-support response template so an automated system can match incoming customer emails to it.

Template title: "${name}"
Template response body:
"""
${body.slice(0, 1200)}
"""

List 3 to 6 short, DISTINCTIVE keyword phrases (2-4 words each) that a CUSTOMER would plausibly write in their own email if this specific template were the correct reply. Focus on concrete nouns/issues (product part names, specific complaints, specific questions) — not generic words like "thank you", "help", "question", "issue", "email", "customer".

Return ONLY a JSON array of strings, e.g. ["clipper switch broken", "blade overheating"]. No markdown, no explanation.`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (res.status === 429) {
      const backoff = 8000 * (attempt + 1);
      console.log(`  rate limited, waiting ${backoff}ms...`);
      await sleep(backoff);
      continue;
    }

    if (!res.ok) throw new Error(`Gemini returned ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((k: any) => String(k).toLowerCase().trim()).filter(Boolean);
  }

  throw new Error('Gemini returned 429 after retries');
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
