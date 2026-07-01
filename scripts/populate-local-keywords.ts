import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { extractKeywordsForTemplate, serializeKeywords, totalKeywordCount } from '../src/lib/keyword-engine';

async function main() {
  const templates = await prisma.template.findMany();
  console.log(`Generating local keyword sets for ${templates.length} templates...`);

  for (const t of templates) {
    const keywords = extractKeywordsForTemplate(t.name, t.body);
    const count = totalKeywordCount(keywords);
    await prisma.template.update({
      where: { id: t.id },
      data: { keywords: serializeKeywords(keywords) },
    });
    console.log(`"${t.name}" -> ${count} keywords (primary:${keywords.primary.length} product:${keywords.product.length} problem:${keywords.problem.length} secondary:${keywords.secondary.length} intent:${keywords.intent.length})`);
  }
  console.log('Done.');
}
main();
