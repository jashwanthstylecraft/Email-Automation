import * as XLSX from 'xlsx';
import { prisma } from './prisma';
import { emptyKeywords, serializeKeywords, type StructuredKeywords } from './keyword-engine';

export interface ParsedTemplateRow {
  name: string;
  keywords: string[];
  body: string;
  notes: string;
  active: boolean;
}

// A sheet row that's reference material for staff (an internal address, a
// fraud note, a B2B-only definition) rather than a ready-to-send customer
// reply is imported inactive -- it still shows up in the Templates list and
// can be picked manually, but it's excluded from keyword auto-matching and
// auto-drafting so it never gets sent to a customer unreviewed. Detected the
// same way the sheet's own authors flagged them: in the name or the notes.
const REFERENCE_NAME_MARKERS = ['(reference)'];
const REFERENCE_NOTE_MARKERS = [
  'internal', 'not a customer-facing reply', 'verify before sending', 'do not send', "don't send",
];

function isReferenceOnly(name: string, notes: string): boolean {
  const nameLower = name.toLowerCase();
  const notesLower = notes.toLowerCase();
  return REFERENCE_NAME_MARKERS.some((m) => nameLower.includes(m))
    || REFERENCE_NOTE_MARKERS.some((m) => notesLower.includes(m));
}

// Expects a "Templates" sheet (falls back to the first sheet) with columns
// TemplateName, Keywords (comma-separated), ResponseBody, Notes, in that
// order -- matches the layout of the spreadsheet this was built against. An
// explicit "Active" column (TRUE/FALSE) overrides the reference-detection
// heuristic when present, so future sheet edits can control it directly.
export function parseTemplatesFromWorkbook(buffer: Buffer): ParsedTemplateRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'templates') || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  if (json.length === 0) return [];

  const header = json[0].map((h: any) => (h || '').toString().trim().toLowerCase());
  const activeColIdx = header.indexOf('active');

  return json
    .slice(1)
    .filter((r: any[]) => (r[0] || '').toString().trim() !== '')
    .map((r: any[]): ParsedTemplateRow => {
      const name: string = (r[0] || '').toString().trim();
      const keywordsRaw: string = (r[1] || '').toString();
      const body: string = (r[2] || '').toString().trim();
      const notes: string = (r[3] || '').toString().trim();
      const keywords: string[] = Array.from(
        new Set(keywordsRaw.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean))
      );

      let active = !isReferenceOnly(name, notes);
      if (activeColIdx !== -1) {
        const raw = (r[activeColIdx] || '').toString().trim().toLowerCase();
        if (raw === 'false' || raw === '0' || raw === 'no') active = false;
        else if (raw === 'true' || raw === '1' || raw === 'yes') active = true;
      }

      return { name, keywords, body, notes, active };
    });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// Full replace: every existing template and rule for this org is deleted
// first, so the spreadsheet becomes the single source of truth rather than
// merging with whatever was there before (matches the explicit choice made
// when this was built -- old keyword sets were "not working properly").
export async function applyTemplateImport(organizationId: string, rows: ParsedTemplateRow[]): Promise<{ count: number }> {
  await prisma.template.deleteMany({ where: { organizationId } });
  await prisma.rule.deleteMany({ where: { organizationId } });

  let count = 0;
  for (const row of rows) {
    const slug = slugify(row.name);
    const templateId = `template-${slug}`;

    const variablesList = ['customer_name', 'closing'];
    if (row.body.includes('[ORDER_NUMBER]')) variablesList.push('order_number');
    if (row.body.includes('[RMA_NUMBER]')) variablesList.push('rma_number');
    if (row.body.includes('[RA_NUMBER]')) variablesList.push('ra_number');
    if (row.body.includes('[PRODUCT_NAME]')) variablesList.push('product_name');
    if (row.body.includes('[TRACKING_LINK]')) variablesList.push('tracking_link');
    if (row.body.includes('[SHIPPING_ADDRESS]')) variablesList.push('shipping_address');
    if (row.body.includes('[SELLER_NAME]')) variablesList.push('seller_name');

    // All of the sheet's own keywords go into `primary` -- the live matcher
    // (flattenTemplateKeywords) unions every non-negative tier anyway, so
    // this is scoring-equivalent to spreading them across tiers, without
    // guessing which tier each hand-written phrase "belongs" in.
    const structured: StructuredKeywords = { ...emptyKeywords(), primary: row.keywords };

    await prisma.template.create({
      data: {
        id: templateId,
        name: row.name,
        subject: `Regarding your StyleCraft inquiry: ${row.name}`,
        body: row.body,
        variables: variablesList.join(','),
        keywords: serializeKeywords(structured),
        active: row.active,
        notes: row.notes || null,
        organizationId,
      },
    });

    const conditionsGroup = {
      logic: 'OR',
      rules: row.keywords.flatMap((kw) => [
        { field: 'subject', operator: 'contains', value: kw },
        { field: 'body', operator: 'contains', value: kw },
      ]),
    };
    const action = { actionType: 'REPLY_TEMPLATE', templateId, status: 'WAITING' };

    await prisma.rule.create({
      data: {
        id: `rule-${slug}`,
        name: row.name,
        conditions: JSON.stringify(conditionsGroup),
        actions: JSON.stringify(action),
        active: row.active,
        organizationId,
      },
    });

    count++;
  }

  return { count };
}

// Accepts either a full Google Sheets share URL or an already-formed export
// URL -- so pasting the normal browser address-bar link into Settings just
// works.
export function toSheetExportUrl(sheetUrl: string): string {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
  }
  return sheetUrl;
}
