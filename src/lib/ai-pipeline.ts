import crypto from 'crypto';
import { prisma } from './prisma';
import { parseKeywords, matchTemplates, TemplateForScoring, MatchResult } from './keyword-engine';
import { openai, OPENAI_MODEL, OPENAI_MAX_TOKENS, OPENAI_TEMPERATURE } from './openai-client';

export interface AIPipelineResult {
  language: string;
  category: string;
  businessType: string;
  sentiment: string;
  urgency: string;
  priority: string;
  aiConfidence: number;
  spam: boolean;
  duplicate: boolean;
  draftReply: string;
  summary?: string;
  matchedTemplateId?: string | null;
  aiProvider?: string;
}

const FALLBACK_RESPONSE = "Thank you for contacting StyleCraft Support. We have received your email, but we require more information or our team needs to review your request manually. A representative will follow up with you shortly.";

// Wholesale/distributor/reseller language -- distinguishes a business
// inquiry from a regular individual customer. Overlaps with
// keyword-engine.ts's INTENT_TERMS (distributor, wholesale, dealer,
// reseller, bulk order) plus a few more unambiguous B2B-only signals.
export const B2B_SIGNAL_TERMS = [
  'distributor', 'wholesale', 'dealer', 'reseller', 'bulk order',
  'purchase order', 'moq', 'minimum order quantity', 'resale certificate',
  'tax id', 'business license', 'net 30', 'b2b',
];

// Kept short and reply-focused on purpose -- classification (language,
// category, sentiment, urgency, priority) is handled by free local
// heuristics below, never by the API, and template matching always runs
// before this is ever reached, so this prompt only has one job: draft a
// brief reply for the remaining case (nothing in the template library
// matched).
const ANALYSIS_SYSTEM_PROMPT = "You are a professional email assistant. Based on this email subject and message, write a short, professional reply in max 3 sentences.";

/**
 * Checks if this email is a duplicate of a recent email from the same sender.
 */
async function checkDuplicate(sender: string, subject: string, organizationId: string): Promise<boolean> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentEmail = await prisma.email.findFirst({
    where: {
      organizationId,
      sender,
      subject,
      createdAt: {
        gte: tenMinutesAgo,
      },
    },
  });
  return !!recentEmail;
}

/**
 * Resolves the name to greet a customer by: a real parsed display name
 * (from the email's "From" header, or a previously-saved Customer.name)
 * always wins over guessing one from the address local-part.
 */
export function resolveCustomerName(senderEmail: string, parsedName?: string | null): string {
  const trimmed = parsedName?.trim();
  if (trimmed) return trimmed;
  return senderEmail.split('@')[0].split('.')[0].replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Best-effort extraction of the REAL customer's name from a forwarded
 * email's body. When a support rep forwards a contact-form submission or a
 * customer's own message, the envelope sender is the rep, not the
 * customer -- greeting by resolveCustomerName(sender, ...) in that case
 * addresses the reply to the rep instead of the person who actually wrote
 * in. Tries, in order: a structured contact-form "Name:" field, a Gmail
 * "Name email@domain via ..." forwarded-header line, and a "'Name' via
 * ..." forwarded-header line. Returns null (caller falls back to
 * resolveCustomerName) when none match, e.g. for a direct customer email
 * with no forwarding involved.
 */
export function extractForwardedCustomerName(body: string): string | null {
  const structured = body.match(/\*?Name:?\*?\s*([A-Za-z][A-Za-z\s.'-]{1,40}?)\s*(?:\n|\*[A-Za-z]+:\*)/i);
  if (structured) return structured[1].trim();

  const withEmail = body.match(/^\s*['"]?([A-Z][\w.'-]+(?:\s[A-Z][\w.'-]+){0,2})['"]?\s+[\w.+-]+@[\w.-]+\.\w+\s+via\b/m);
  if (withEmail) return withEmail[1].trim();

  const quoted = body.match(/^\s*'?([A-Z][\w.'-]+(?:\s[A-Z][\w.'-]+){0,2})'\s+via\b/m);
  if (quoted) return quoted[1].trim();

  return null;
}

/**
 * Strips forwarding/signature boilerplate from an email body before it's
 * used for keyword matching or sent to the AI. A rep's own signature (phone
 * number, address, brand name, awards, social links) repeats verbatim on
 * every email they forward, so left in, it can match a template's keywords
 * purely on brand-name overlap regardless of what the actual customer
 * wrote -- and can bury the real complaint past the word budget sent to
 * OpenAI when the signature/forward envelope comes first. Handles both
 * layouts seen in practice: real content first then a "-- " signature, and
 * a rep's signature first then a Gmail "---------- Forwarded message
 * ---------" block containing the real content.
 */
export function stripEmailBoilerplate(body: string): string {
  let text = body;

  const forwardMarker = text.indexOf('---------- Forwarded message ---------');
  if (forwardMarker !== -1) {
    const afterMarker = text.slice(forwardMarker).split('\n').slice(1);
    let i = 0;
    while (i < afterMarker.length && (/^(from|date|subject|to|cc):/i.test(afterMarker[i].trim()) || afterMarker[i].trim() === '')) i++;
    text = afterMarker.slice(i).join('\n');
  }

  const sigMatch = text.match(/^--\s*$/m);
  if (sigMatch?.index !== undefined) {
    text = text.slice(0, sigMatch.index);
  }

  return text.trim() || body.trim();
}

/**
 * Best-effort deterministic extraction of an order number the customer
 * mentioned in their own email. Matches StyleCraft's own order ID formats
 * (e.g. "S000097815", "G000062862") as well as generic "order # 12345" /
 * "order number: ABC123" phrasing.
 */
export function extractOrderNumberFromText(text: string): string | null {
  const idMatch = text.match(/\b[SG]0*\d{5,}\b/);
  if (idMatch) return idMatch[0];
  const phraseMatch = text.match(/order\s*(?:number|#|no\.?)?\s*[:#]?\s*([A-Z0-9-]{4,})/i);
  if (phraseMatch) return phraseMatch[1];
  return null;
}

/**
 * First 100 words of a body -- the only content sent to OpenAI, per email,
 * to keep token usage (and cost) minimal.
 */
export function first100Words(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 100).join(' ');
}

/**
 * Stable content fingerprint (subject + brief body) used as the cache key
 * so the same email is never sent to OpenAI twice.
 */
export function hashEmailContent(subject: string, briefBody: string): string {
  return crypto.createHash('sha256').update(`${subject.trim().toLowerCase()}|${briefBody.trim().toLowerCase()}`).digest('hex');
}

async function getCachedReply(organizationId: string, contentHash: string): Promise<string | null> {
  const cached = await prisma.aIReplyCache.findUnique({
    where: { organizationId_contentHash: { organizationId, contentHash } },
  });
  return cached?.replyText ?? null;
}

async function saveCachedReply(organizationId: string, contentHash: string, replyText: string): Promise<void> {
  await prisma.aIReplyCache.upsert({
    where: { organizationId_contentHash: { organizationId, contentHash } },
    create: { organizationId, contentHash, replyText },
    update: { replyText },
  });
}

// Natural-language fallback used when a bracket placeholder's real value
// can't be resolved -- ensures a raw "[ORDER_NUMBER]"-style token never
// reaches an agent or customer.
const PLACEHOLDER_FALLBACKS: Record<string, string> = {
  ORDER_NUMBER: 'your order',
  PRODUCT_NAME: 'the item',
  PART_NAME: 'the part',
  TRACKING_LINK: 'the tracking link once it is available',
  RMA_NUMBER: 'the RMA number provided',
  RA_NUMBER: 'the RA number provided',
  SHIPPING_ADDRESS: 'your shipping address',
  SELLER_NAME: 'the seller',
};

export interface PlaceholderValues {
  name: string;
  orderNumber?: string | null;
  productName?: string | null;
  partName?: string | null;
  trackingLink?: string | null;
  rmaNumber?: string | null;
  raNumber?: string | null;
  shippingAddress?: string | null;
  sellerName?: string | null;
}

/**
 * Universal safety net: replaces every known [BRACKET] placeholder still
 * present in a draft with a real extracted value, or a natural fallback
 * phrase when no value was found -- run on every draft, so a raw bracket
 * token never reaches an agent.
 */
export function fillKnownPlaceholders(text: string, values: PlaceholderValues): string {
  let res = text.replace(/\[NAME\]/g, values.name);

  const tokenValues: Record<string, string | null | undefined> = {
    ORDER_NUMBER: values.orderNumber,
    PRODUCT_NAME: values.productName,
    PART_NAME: values.partName,
    TRACKING_LINK: values.trackingLink,
    RMA_NUMBER: values.rmaNumber,
    RA_NUMBER: values.raNumber,
    SHIPPING_ADDRESS: values.shippingAddress,
    SELLER_NAME: values.sellerName,
  };

  for (const [token, value] of Object.entries(tokenValues)) {
    const pattern = new RegExp(`\\[${token}\\]`, 'g');
    res = res.replace(pattern, (value && value.trim()) || PLACEHOLDER_FALLBACKS[token]);
  }

  return res;
}

/**
 * Wraps raw template/reply text with polite greetings and closing signature.
 */
export function wrapResponseWithGreetingAndClosing(
  bodyText: string,
  customerName: string,
  greetingText: string,
  closingSignature: string,
  extractedValues?: Partial<PlaceholderValues>
): string {
  let res = bodyText;

  // 1. Interpolate placeholders first
  res = res.replace(/\{\{customer_name\}\}/g, customerName);
  res = res.replace(/\{\{closing\}\}/g, closingSignature);
  res = fillKnownPlaceholders(res, { name: customerName, ...extractedValues });

  // 2. Wrap greeting if missing
  const normalizedGreeting = greetingText.trim().toLowerCase();
  const startsWithGreeting = res.trim().toLowerCase().startsWith('hi') ||
                             res.trim().toLowerCase().startsWith('hello') ||
                             res.trim().toLowerCase().startsWith('dear') ||
                             res.trim().toLowerCase().startsWith('i hope') ||
                             res.trim().toLowerCase().startsWith(normalizedGreeting);

  if (!startsWithGreeting) {
    res = `${greetingText} ${customerName},\n\n` + res;
  }

  // 3. Wrap regards / closing if missing
  const hasClosing = res.includes(closingSignature) ||
                     res.trim().toLowerCase().endsWith('regards') ||
                     res.trim().toLowerCase().endsWith('support team') ||
                     res.trim().toLowerCase().endsWith('stylecraft');

  if (!hasClosing) {
    res = res + `\n\n${closingSignature}`;
  }

  return res;
}

/**
 * Adds a category-appropriate intro sentence before a matched template's
 * body -- this is the ONLY "expansion" a matched template gets; matching a
 * template never calls the API (per cost policy, a template match is used
 * directly with zero LLM calls).
 */
function expandMatchedTemplate(templateName: string, templateBody: string): string {
  const name = templateName.toLowerCase();
  let intro = '';

  if (name.includes('warranty') || name.includes('rma') || name.includes('address')) {
    intro = "Thank you for reaching out regarding your warranty service. Below is the approved warehouse address for your return. Please make sure to print your RMA form and write the RMA number clearly on the outside of the shipping box:";
  } else if (name.includes('return') || name.includes('refund')) {
    intro = "Thank you for contacting StyleCraft support. We would be happy to assist you with returning your order. Below are the return authorization rules and guidelines to complete your refund:";
  } else if (name.includes('lost') || name.includes('missing') || name.includes('route')) {
    intro = "We apologize for the issue with your shipment. To help resolve this as quickly as possible, please review the package tracking and Route claim details below:";
  } else if (name.includes('hot') || name.includes('overheating')) {
    intro = "We appreciate you reporting this issue with your clipper blades getting hot. To ensure optimal performance and safety, please follow the troubleshooting steps outlined below:";
  } else if (name.includes('switch') || name.includes('turn on')) {
    intro = "We are sorry to hear that your clipper switch is not functioning properly. Please review the simple alignment fix guide below:";
  } else if (name.includes('xcell') || name.includes('dryer')) {
    intro = "Thank you for contacting us regarding your XCell dryer. Below are the troubleshooting steps to resolve the airflow temperature issue:";
  } else if (name.includes('collab') || name.includes('influencer') || name.includes('affiliate')) {
    intro = "Thank you for your interest in partnering with StyleCraft US! Below are the details for our influencer and affiliate collaboration program:";
  } else if (name.includes('wholesale') || name.includes('distributor')) {
    intro = "Thank you for your inquiry about becoming a StyleCraft wholesale partner. Below is the information and application procedure to get started:";
  } else {
    intro = "Thank you for contacting us. We have matched your inquiry with our approved support guidelines. Please review the details below:";
  }

  return `${intro}\n\n${templateBody}`;
}

/**
 * Structured keyword-based matching engine (primary/secondary/product/problem/
 * intent/negative tiers, see src/lib/keyword-engine.ts). Free/local -- this
 * always runs before any API call, so a template match never costs a token.
 */
export async function runKeywordMatcher(
  body: string,
  subject: string,
  organizationId: string
): Promise<{ matchedTemplateId: string | null; confidenceScore: number; matchReason: string; suggestions?: MatchResult['suggestions'] }> {
  const templates = await prisma.template.findMany({ where: { organizationId } });

  const scoringInput: TemplateForScoring[] = templates.map(t => {
    const structured = parseKeywords(t.keywords);
    // User-added keywords (from the feedback "Add Keyword" flow) are stored
    // in `variables` alongside the interpolation placeholders -- fold the
    // real ones in as primary signal so they take effect immediately.
    const extraFromVariables = (t.variables || '')
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k && !['customer_name', 'closing', 'ticket_id', 'order_number', 'rma_number'].includes(k));
    return {
      id: t.id,
      name: t.name,
      active: t.active,
      keywords: { ...structured, primary: Array.from(new Set([...structured.primary, ...extraFromVariables])) },
    };
  });

  const result = matchTemplates(scoringInput, subject, body);
  if (!result.matchedTemplateId) {
    return { matchedTemplateId: null, confidenceScore: 0, matchReason: 'no keyword or phrase matched any approved template', suggestions: result.suggestions };
  }
  return {
    matchedTemplateId: result.matchedTemplateId,
    confidenceScore: result.confidenceScore,
    matchReason: result.matchReason,
    suggestions: result.suggestions,
  };
}

/**
 * The system prompt above asks for "a short, professional reply", which the
 * model tends to interpret as a full email complete with its own greeting
 * ("Dear [Customer],") and sign-off ("Best regards,\n[Your Name]"). Those
 * are generic placeholders the model invented, not real values -- left
 * alone they'd leak a literal "[Customer]"/"[Your Name]" into the draft AND
 * collide with wrapResponseWithGreetingAndClosing's own (correct, real-name)
 * greeting/closing, producing a duplicated sign-off. Strip them so that
 * function is the single source of truth for how the draft opens and ends.
 */
function stripAIOwnFraming(text: string): string {
  const original = text.trim();
  let result = original;

  // Strip a leading greeting the model invented ("Dear Yoana," / "Hello,").
  // Bounded to a short trailing name/phrase rather than an unbounded match
  // through to end-of-line -- GPT sometimes returns the whole reply as a
  // single line with no newlines at all, and an unbounded match would
  // swallow the entire message as "just a greeting", not only its opening
  // words.
  result = result.replace(/^(dear|hi|hello)\b[^,.\n]{0,30}[,.]\s*/i, '');

  // Strip a trailing sign-off the model invented ("Best regards,\n[Your
  // Name]") through to the end of the message. Safe to match greedily to
  // the end here (with `s` so `.` also consumes newlines) since nothing
  // legitimate follows a sign-off -- this is what actually removes an
  // invented "[Your Name]"/"[Your Position]" placeholder, which a
  // line-by-line approach can miss when it shares a line with real content.
  result = result.replace(/\s*(best regards|kind regards|warm regards|regards|sincerely)\b,?\s*[\s\S]*$/i, '');

  result = result.trim();

  // Never let stripping produce nothing -- if greeting/sign-off removal
  // ate the entire reply, keep the original text instead. A redundant
  // greeting is a cosmetic issue; a blank customer-facing reply is not.
  return result || original;
}

/**
 * Single OpenAI call for one email that matched no template -- minimal
 * context (subject + first 100 words), short output (max_tokens capped),
 * using the one shared client from src/lib/openai-client.ts.
 */
export async function generateReplyWithAI(subject: string, briefBody: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: OPENAI_MAX_TOKENS,
    temperature: OPENAI_TEMPERATURE,
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: `Subject: ${subject}\nMessage: ${briefBody}` },
    ],
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned an empty response');
  return stripAIOwnFraming(text.trim());
}

/**
 * Same as generateReplyWithAI but for N unmatched emails in ONE call
 * instead of N separate calls -- used by the live IMAP sync loop when more
 * than one unseen message needs a fresh reply. Token budget scales with
 * batch size (each reply still gets roughly the same per-email budget as a
 * single call) but is capped so one giant batch can't balloon cost.
 */
export async function generateRepliesBatch(items: { subject: string; briefBody: string }[]): Promise<string[]> {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [await generateReplyWithAI(items[0].subject, items[0].briefBody)];
  }

  const numberedList = items.map((it, i) => `${i + 1}. Subject: ${it.subject}\nMessage: ${it.briefBody}`).join('\n\n');
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: Math.min(OPENAI_MAX_TOKENS * items.length, 1200),
    temperature: OPENAI_TEMPERATURE,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `${ANALYSIS_SYSTEM_PROMPT} You will receive multiple emails, each numbered. Return ONLY a JSON object of the shape {"replies": ["...", "...", ...]} with exactly one short reply per email, in the same order as the input. Do not include markdown formatting.`,
      },
      { role: 'user', content: numberedList },
    ],
  });

  const text = completion.choices[0]?.message?.content || '';
  const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
  const replies = Array.isArray(parsed.replies) ? parsed.replies : [];
  if (replies.length !== items.length) {
    throw new Error(`Expected ${items.length} batched replies, got ${replies.length}`);
  }
  return replies.map((r: string) => stripAIOwnFraming(String(r)));
}

/**
 * Pulls a few recent human edits to AI/template drafts for this org and
 * formats them as a short "here's how agents have refined drafts before"
 * block, so an on-demand regeneration can learn from real feedback instead
 * of guessing at house style. Built entirely on the existing
 * AutoReply.wasEdited/originalDraftBody/responseBody trail -- no separate
 * feedback table needed. Returns '' when there's nothing usable yet.
 */
export async function getRecentEditFeedbackExamples(organizationId: string, limit = 3): Promise<string> {
  const edited = await prisma.autoReply.findMany({
    where: { wasEdited: true, originalDraftBody: { not: null }, email: { organizationId } },
    orderBy: { editedAt: 'desc' },
    take: limit * 2, // over-fetch since some will be filtered out below
    select: { originalDraftBody: true, responseBody: true },
  });

  const truncate = (s: string) => (s.length > 250 ? `${s.slice(0, 250)}...` : s);
  const examples = edited
    .filter((r) => r.originalDraftBody && r.originalDraftBody.trim() !== r.responseBody.trim())
    .slice(0, limit)
    .map((r, i) => `${i + 1}. AI wrote: "${truncate(r.originalDraftBody!.trim())}"\n   Agent edited to: "${truncate(r.responseBody.trim())}"`);

  if (examples.length === 0) return '';
  return `Here is how support agents have previously refined AI-drafted replies for this organization -- learn from the style/phrasing adjustments they made and apply similar judgment where relevant:\n${examples.join('\n')}`;
}

/**
 * On-demand, tone-adjusted reply generation for a single email -- used by
 * the inbox "Regenerate Draft" action, not by the sync-time pipeline above.
 * When a matched template's body is supplied, the model is instructed to
 * rewrite THAT approved content in the requested tone rather than invent
 * new policy, so facts/policy stay stable and only phrasing changes.
 */

// Condensed from the StyleCraftUS Brand Voice Guide (July 2026), adapted for
// support replies rather than marketing copy: the guide's "hype"/street-drop
// energy is right for product talk but wrong for an apology, so this
// explicitly scopes which parts of the voice apply in which situation --
// the community warmth and service promise always do, hype language doesn't.
const BRAND_VOICE_GUIDE = `Write as StyleCraftUS support -- a family-owned, US-based pro tool brand with 50+ years of combined industry experience, talking to a fellow barber/stylist like part of "the Fam," not a call-center script. Channel this voice:
- Bold & Competitive: confident and declarative about the tools and craft -- never arrogant toward the customer, and never dismissive of competitors.
- Tech-Credible: specific about engineering (named motors/technology, torque, vibration, heat management) when it's actually relevant -- never vague fluff like "cutting-edge quality."
- Community-First ("the Fam"): warm, loyal, reciprocal. Refer to "the Fam" where it fits naturally, and close in the spirit of "If you are not happy, we are not happy." Never generic corporate phrasing like "we appreciate your business" or "valued customer."
- Street-Culture Fluent: plugged into barber culture -- never forced slang or memes.
- Craft-Proud & Family-Built: proud of the founder story (Ken & Austin Russo) and craftsmanship; heritage backs up innovation, it doesn't replace it.
Match the energy to the situation: bring the bold/tech-credible swagger for general or product questions, but for complaints, refunds, or problems lead with straightforward empathy and urgency instead -- the community warmth and "if you're not happy, we're not happy" service promise apply everywhere, hype language does not belong in an apology. Keep it concise (max 5 sentences).`;

export async function generateToneAdjustedReply(
  subject: string,
  briefBody: string,
  tone: string,
  templateBody?: string | null,
  feedbackBlock?: string
): Promise<string> {
  let systemPrompt = tone === 'Brand Voice'
    ? `You are a customer support email assistant for StyleCraft. ${BRAND_VOICE_GUIDE}`
    : `You are a professional customer support email assistant for StyleCraft. Write the reply body in a ${tone} tone. Keep it concise (max 5 sentences).`;

  if (templateBody) {
    const rewriteInstruction = tone === 'Brand Voice'
      ? 'Base your reply on the substance of the following approved response template, but substantially rewrite it in the StyleCraftUS brand voice described above -- keep the factual/policy content intact, but the wording should sound distinctly like that voice, not like the template\'s original neutral phrasing'
      : 'Base your reply on the following approved response template -- keep all factual and policy details from it intact, and only rewrite the phrasing/style to match the requested tone';
    systemPrompt += ` ${rewriteInstruction}:\n"""\n${templateBody}\n"""`;
  }

  if (feedbackBlock) {
    systemPrompt += `\n\n${feedbackBlock}`;
  }

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 500,
    temperature: OPENAI_TEMPERATURE,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Subject: ${subject}\nMessage: ${briefBody}` },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned an empty response');
  return stripAIOwnFraming(text.trim());
}

interface ClassifiedEmail {
  language: string;
  category: string;
  businessType: string;
  sentiment: string;
  urgency: string;
  priority: string;
  spam: boolean;
  duplicate: boolean;
  customerName: string;
  orderNumber: string | null;
  greeting: string;
  closing: string;
  subject: string;
  briefBody: string;
  matched: { templateId: string; draftReply: string; confidence: number; summary: string } | null;
}

/**
 * Free local classification (language/spam/category/sentiment/urgency/
 * priority) plus the free keyword-based template matcher -- shared by both
 * the single-email and batched entry points below. Never touches the API:
 * a template match is built right here with zero LLM calls, and everything
 * needed for the (possible) API call afterward -- subject, brief body,
 * customer name, greeting/closing -- is bundled into the return value.
 */
async function classifyEmail(
  body: string,
  subject: string,
  sender: string,
  organizationId: string,
  parsedSenderName?: string | null
): Promise<ClassifiedEmail> {
  const cleanBody = stripEmailBoilerplate(body);
  const normalizedText = (subject + ' ' + cleanBody).toLowerCase();

  // 1. Language Detection
  let language = 'en';
  if (normalizedText.includes('hola') || normalizedText.includes('gracias') && normalizedText.includes('por favor')) {
    language = 'es';
  } else if (normalizedText.includes('bonjour') || (normalizedText.includes("s'il") && normalizedText.includes('plaît'))) {
    language = 'fr';
  }

  // 2. Spam Detection
  let spam = false;
  if (
    normalizedText.includes('crypto discount') ||
    normalizedText.includes('replica watches') ||
    normalizedText.includes('bitcoin multiplication') ||
    normalizedText.includes('cheap watches') ||
    normalizedText.includes('viagra')
  ) {
    spam = true;
  }

  // 3. Category Detection
  let category = 'General Question';
  if (normalizedText.includes('refund') || normalizedText.includes('charge') || normalizedText.includes('double billed') || normalizedText.includes('billing') || normalizedText.includes('invoice')) {
    category = 'Billing';
  } else if (normalizedText.includes('password') || normalizedText.includes('reset') || normalizedText.includes('login') || normalizedText.includes('credentials')) {
    category = 'Product Question';
  } else if (normalizedText.includes('pricing') || normalizedText.includes('enterprise') || normalizedText.includes('demo') || normalizedText.includes('cost') || normalizedText.includes('sales')) {
    category = 'Sales Inquiry';
  } else if (normalizedText.includes('broken') || normalizedText.includes('error') || normalizedText.includes('500') || normalizedText.includes('crash') || normalizedText.includes('bug')) {
    category = 'Technical Issue';
  }

  // 3b. Business Type Detection (B2C vs B2B) -- wholesale/distributor/
  // reseller language vs. regular individual-customer language. Seeded from
  // the B2B-flavored terms already present in keyword-engine.ts's
  // INTENT_TERMS list, extended with a few more unambiguous B2B signals.
  const businessType = B2B_SIGNAL_TERMS.some((term) => normalizedText.includes(term)) ? 'B2B' : 'B2C';

  // 4. Sentiment Analysis
  let sentiment = 'NEUTRAL';
  const isAngryText = normalizedText.includes('sucks') || normalizedText.includes('terrible') || normalizedText.includes('broken') || normalizedText.includes('unacceptable') || normalizedText.includes('useless') || normalizedText.includes('fix this') || normalizedText.includes('immediately');
  const isAllCaps = cleanBody.length > 10 && cleanBody === cleanBody.toUpperCase();

  if (isAngryText || isAllCaps) {
    sentiment = 'ANGRY';
  } else if (normalizedText.includes('wrong') || normalizedText.includes('problem') || normalizedText.includes('fail') || normalizedText.includes('unhappy')) {
    sentiment = 'NEGATIVE';
  } else if (normalizedText.includes('great') || normalizedText.includes('love') || normalizedText.includes('thanks') || normalizedText.includes('helpful') || normalizedText.includes('awesome')) {
    sentiment = 'POSITIVE';
  }

  // 5. Urgency & Priority Detection
  let urgency = 'MEDIUM';
  let priority = 'MEDIUM';

  if (sentiment === 'ANGRY' || normalizedText.includes('urgent') || normalizedText.includes('asap') || normalizedText.includes('immediate') || category === 'Technical Issue') {
    urgency = 'HIGH';
    priority = 'HIGH';
  } else if (sentiment === 'NEGATIVE' || category === 'Billing') {
    urgency = 'MEDIUM';
    priority = 'MEDIUM';
  } else {
    urgency = 'LOW';
    priority = 'LOW';
  }

  if (sentiment === 'ANGRY' && priority === 'HIGH') {
    priority = 'URGENT';
  }

  const duplicate = await checkDuplicate(sender, subject, organizationId);
  const customerName = extractForwardedCustomerName(cleanBody) || resolveCustomerName(sender, parsedSenderName);
  const orderNumber = extractOrderNumberFromText(`${subject} ${cleanBody}`);

  const settings = await prisma.settings.findUnique({ where: { organizationId } });
  const greeting = settings?.greeting || 'Hello';
  const closing = settings?.closing || 'Regards,\nStyleCraft US Support Team';

  // Template match -- before anything touches the API. Uses cleanBody so a
  // forwarding rep's own signature (brand name, phone number, awards) can
  // never contribute keyword-match signal regardless of what the actual
  // customer wrote.
  const keywordMatch = await runKeywordMatcher(cleanBody, subject, organizationId);
  let matched: ClassifiedEmail['matched'] = null;
  if (keywordMatch.matchedTemplateId) {
    const template = await prisma.template.findUnique({ where: { id: keywordMatch.matchedTemplateId } });
    if (template) {
      const expandedBody = expandMatchedTemplate(template.name, template.body);
      const draftReply = wrapResponseWithGreetingAndClosing(expandedBody, customerName, greeting, closing, { orderNumber });
      matched = {
        templateId: template.id,
        draftReply,
        confidence: keywordMatch.confidenceScore,
        summary: `Matched "${template.name}" — ${keywordMatch.matchReason}.`,
      };
    }
  }

  return {
    language, category, businessType, sentiment, urgency, priority, spam, duplicate,
    customerName, orderNumber, greeting, closing, subject,
    briefBody: first100Words(cleanBody), matched,
  };
}

function matchedToResult(c: ClassifiedEmail): AIPipelineResult {
  const m = c.matched!;
  return {
    language: c.language, category: c.category, businessType: c.businessType, sentiment: c.sentiment, urgency: c.urgency, priority: c.priority,
    aiConfidence: m.confidence, spam: c.spam, duplicate: c.duplicate, draftReply: m.draftReply,
    summary: m.summary, matchedTemplateId: m.templateId, aiProvider: 'Keyword Matcher',
  };
}

function finalizeUnmatchedResult(c: ClassifiedEmail, replyText: string, aiProvider: string): AIPipelineResult {
  const draftReply = wrapResponseWithGreetingAndClosing(replyText, c.customerName, c.greeting, c.closing, { orderNumber: c.orderNumber });
  return {
    language: c.language, category: c.category, businessType: c.businessType, sentiment: c.sentiment, urgency: c.urgency, priority: c.priority,
    aiConfidence: 0.5, spam: c.spam, duplicate: c.duplicate, draftReply,
    summary: `Customer inquiry regarding: ${c.subject}`, matchedTemplateId: null, aiProvider,
  };
}

/**
 * Runs the full email-processing pipeline for ONE email: free local
 * classification, then the free keyword-based template matcher -- a
 * template match is used directly with ZERO API calls. OpenAI is only ever
 * consulted for the remaining case (no template matched), with minimal
 * input and a cache so the same email content is never analyzed twice.
 */
export async function runAIPipeline(
  body: string,
  subject: string,
  sender: string,
  organizationId: string,
  parsedSenderName?: string | null
): Promise<AIPipelineResult> {
  const c = await classifyEmail(body, subject, sender, organizationId, parsedSenderName);
  if (c.matched) return matchedToResult(c);

  let replyText = FALLBACK_RESPONSE;
  let aiProvider = 'Keyword Matcher';

  if (process.env.OPENAI_API_KEY) {
    const contentHash = hashEmailContent(subject, c.briefBody);
    const cached = await getCachedReply(organizationId, contentHash);
    if (cached) {
      replyText = cached;
      aiProvider = 'OpenAI (cached)';
    } else {
      try {
        replyText = await generateReplyWithAI(subject, c.briefBody);
        await saveCachedReply(organizationId, contentHash, replyText);
        aiProvider = `OpenAI (${OPENAI_MODEL})`;
      } catch (error) {
        console.error('OpenAI reply generation failed, using fallback response:', error);
      }
    }
  }

  return finalizeUnmatchedResult(c, replyText, aiProvider);
}

/**
 * Same pipeline as runAIPipeline, but for N emails from the same sync run:
 * every email is classified and template-matched individually (all free),
 * then every email that matched NO template is sent to OpenAI in a single
 * batched call instead of N separate calls. Returned array is in the same
 * order as `items`. Used by the live IMAP sync loop, which processes many
 * unseen messages per run.
 */
export async function runAIPipelineBatch(
  items: { body: string; subject: string; sender: string; organizationId: string; parsedSenderName?: string | null }[]
): Promise<AIPipelineResult[]> {
  if (items.length === 0) return [];

  const classified = await Promise.all(
    items.map(it => classifyEmail(it.body, it.subject, it.sender, it.organizationId, it.parsedSenderName))
  );

  const results: (AIPipelineResult | null)[] = classified.map(c => (c.matched ? matchedToResult(c) : null));
  const pendingIdx = classified.map((_, i) => i).filter(i => !classified[i].matched);

  if (pendingIdx.length === 0) {
    return results as AIPipelineResult[];
  }

  if (!process.env.OPENAI_API_KEY) {
    pendingIdx.forEach(i => { results[i] = finalizeUnmatchedResult(classified[i], FALLBACK_RESPONSE, 'Keyword Matcher'); });
    return results as AIPipelineResult[];
  }

  // All emails in one sync run belong to the same inbox/organization.
  const organizationId = items[0].organizationId;
  const cachedTexts = await Promise.all(
    pendingIdx.map(i => getCachedReply(organizationId, hashEmailContent(classified[i].subject, classified[i].briefBody)))
  );

  const stillNeeded = pendingIdx.filter((_, k) => !cachedTexts[k]);
  let freshReplies: string[] = [];
  if (stillNeeded.length > 0) {
    try {
      freshReplies = await generateRepliesBatch(stillNeeded.map(i => ({ subject: classified[i].subject, briefBody: classified[i].briefBody })));
      await Promise.all(stillNeeded.map((i, k) =>
        saveCachedReply(organizationId, hashEmailContent(classified[i].subject, classified[i].briefBody), freshReplies[k])
      ));
    } catch (error) {
      console.error('Batched OpenAI reply generation failed, using fallback response for this batch:', error);
    }
  }

  let freshCursor = 0;
  pendingIdx.forEach((i, k) => {
    const cached = cachedTexts[k];
    if (cached) {
      results[i] = finalizeUnmatchedResult(classified[i], cached, 'OpenAI (cached)');
    } else if (freshReplies[freshCursor] !== undefined) {
      results[i] = finalizeUnmatchedResult(classified[i], freshReplies[freshCursor], `OpenAI (${OPENAI_MODEL})`);
      freshCursor++;
    } else {
      results[i] = finalizeUnmatchedResult(classified[i], FALLBACK_RESPONSE, 'Keyword Matcher');
    }
  });

  return results as AIPipelineResult[];
}
