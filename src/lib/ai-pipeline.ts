import { prisma } from './prisma';
import { parseKeywords, matchTemplates, TemplateForScoring, MatchResult } from './keyword-engine';
import { getThreadContext } from './customer-service';

export interface AIPipelineResult {
  language: string;
  category: string;
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
 * Best-effort deterministic extraction of an order number the customer
 * mentioned in their own email -- used as the no-AI-key fallback and as a
 * last-resort safety net even when AI is configured. Matches StyleCraft's
 * own order ID formats (e.g. "S000097815", "G000062862") as well as generic
 * "order # 12345" / "order number: ABC123" phrasing.
 */
export function extractOrderNumberFromText(text: string): string | null {
  const idMatch = text.match(/\b[SG]0*\d{5,}\b/);
  if (idMatch) return idMatch[0];
  const phraseMatch = text.match(/order\s*(?:number|#|no\.?)?\s*[:#]?\s*([A-Z0-9-]{4,})/i);
  if (phraseMatch) return phraseMatch[1];
  return null;
}

// Natural-language fallback used when a bracket placeholder's real value
// can't be resolved (no AI configured, or AI left it untouched) -- ensures
// a raw "[ORDER_NUMBER]"-style token never reaches an agent or customer.
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
 * phrase when no value was found -- run on every draft regardless of which
 * pipeline produced it, so a raw bracket token never reaches an agent.
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
 * Wraps raw template text with polite greetings and closing signature.
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
 * Helper to add polite context to short templates in local mock fallback mode.
 */
function localMockExpandTemplate(templateName: string, templateBody: string): string {
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
 * Uses Gemini or OpenAI to expand short templates with context.
 */
export async function expandTemplateWithAI(
  body: string,
  subject: string,
  customerName: string,
  templateText: string,
  greetingText: string,
  closingSignature: string,
  geminiKey?: string,
  openaiKey?: string
): Promise<string> {
  const expansionPrompt = `
You are a professional customer support agent for StyleCraft US.
Write a polite, professional, and clear email reply to the customer's email using the approved template text as the absolute source of truth for the answer/instruction.

CUSTOMER EMAIL:
---
Subject: ${subject}
Body:
${body}
---

APPROVED TEMPLATE TEXT (may contain bracket placeholders like [NAME], [ORDER_NUMBER], [PRODUCT_NAME], [PART_NAME], [TRACKING_LINK], [RMA_NUMBER], [SHIPPING_ADDRESS]):
---
${templateText}
---

The customer's real name is: ${customerName}

INSTRUCTIONS:
1. Keep every URL, fee amount, and policy instruction written in the APPROVED TEMPLATE TEXT verbatim -- do not alter links, dollar amounts, or day/business-day windows.
2. Replace [NAME] with the customer's real name given above.
3. For every other bracket placeholder ([ORDER_NUMBER], [PRODUCT_NAME], [PART_NAME], [TRACKING_LINK], [RMA_NUMBER], [SHIPPING_ADDRESS], etc.), read the CUSTOMER EMAIL above and substitute the actual value the customer mentioned (their order number, the product or part they named, an address they gave, etc.).
4. Never leave a raw bracket placeholder in your output. If the customer's email genuinely does not mention a detail some placeholder needs, rephrase that sentence naturally without it (e.g. ask them to confirm it, or drop the specific reference) instead of leaving the bracket.
5. Use the greeting: "${greetingText} ${customerName},".
6. Use the closing signature: "${closingSignature}".
7. Elevate the tone to be highly helpful, professional, and empathetic, expanding on the short template details to make it a fully readable, contextually appropriate response.

Return only the final email reply body text. Do not include markdown formatting or backticks around it.
`;

  if (geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: expansionPrompt }] }]
      }),
    });
    if (response.ok) {
      const data = await response.json();
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) return txt.trim();
    }
  } else if (openaiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: expansionPrompt }],
      }),
    });
    if (response.ok) {
      const data = await response.json();
      const txt = data.choices?.[0]?.message?.content;
      if (txt) return txt.trim();
    }
  }

  throw new Error('No API key resolved or LLM call failed');
}

/**
 * Structured keyword-based matching engine (primary/secondary/product/problem/
 * intent/negative tiers, see src/lib/keyword-engine.ts) that runs when API
 * keys are missing or as a rescue path when the LLM's own match is unusable.
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
 * Fallback local rules-based engine that processes emails when no API keys are provided.
 */
async function runMockAIPipeline(
  body: string,
  subject: string,
  sender: string,
  organizationId: string,
  parsedSenderName?: string | null
): Promise<AIPipelineResult> {
  const normalizedText = (subject + ' ' + body).toLowerCase();
  
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

  // 4. Sentiment Analysis
  let sentiment = 'NEUTRAL';
  const isAngryText = normalizedText.includes('sucks') || normalizedText.includes('terrible') || normalizedText.includes('broken') || normalizedText.includes('unacceptable') || normalizedText.includes('useless') || normalizedText.includes('fix this') || normalizedText.includes('immediately');
  const isAllCaps = body.length > 10 && body === body.toUpperCase();
  
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

  // 6. Duplicate Check
  const duplicate = await checkDuplicate(sender, subject, organizationId);

  // 7. Keyword matching fallback
  const keywordMatch = await runKeywordMatcher(body, subject, organizationId);
  
  let draftReply = FALLBACK_RESPONSE;
  let summary = `Customer inquiry regarding: ${subject}`;
  let matchedTemplateId: string | null = null;
  let aiConfidence = 0.50;

  if (keywordMatch.matchedTemplateId) {
    const template = await prisma.template.findUnique({
      where: { id: keywordMatch.matchedTemplateId },
    });
    if (template) {
      const settings = await prisma.settings.findUnique({ where: { organizationId } });
      const greeting = settings?.greeting || 'Hello';
      const closing = settings?.closing || 'Regards,\nStyleCraft US Support Team';
      const customerName = resolveCustomerName(sender, parsedSenderName);
      const orderNumber = extractOrderNumberFromText(`${subject} ${body}`);
      const expandedBody = localMockExpandTemplate(template.name, template.body);
      draftReply = wrapResponseWithGreetingAndClosing(expandedBody, customerName, greeting, closing, { orderNumber });
      matchedTemplateId = template.id;
      aiConfidence = keywordMatch.confidenceScore;
      summary = `Matched "${template.name}" — ${keywordMatch.matchReason}.`;
    }
  }

  return {
    language,
    category,
    sentiment,
    urgency,
    priority,
    aiConfidence,
    spam,
    duplicate,
    draftReply,
    summary,
    matchedTemplateId,
    aiProvider: 'Keyword Matcher',
  };
}

/**
 * Runs the AI classification and semantic matching pipeline.
 */
export async function runAIPipeline(
  body: string,
  subject: string,
  sender: string,
  organizationId: string,
  parsedSenderName?: string | null
): Promise<AIPipelineResult> {
  const settings = await prisma.settings.findUnique({
    where: { organizationId },
  });

  const geminiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
  const openaiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;

  const duplicate = await checkDuplicate(sender, subject, organizationId);
  const customerName = resolveCustomerName(sender, parsedSenderName);
  const orderNumber = extractOrderNumberFromText(`${subject} ${body}`);

  if (!geminiKey && !openaiKey) {
    return runMockAIPipeline(body, subject, sender, organizationId, parsedSenderName);
  }

  const templates = await prisma.template.findMany({
    where: { organizationId },
  });

  const templatesListStr = templates.map(t => {
    return `- ID: "${t.id}", Title: "${t.name}", Keywords: "${t.variables || ''}"`;
  }).join('\n');

  const threadContext = await getThreadContext(organizationId, sender, undefined, 5);
  const threadContextStr = threadContext.length > 0
    ? threadContext.map(e => {
        const tmplName = e.matchedTemplateId ? templates.find(t => t.id === e.matchedTemplateId)?.name : null;
        return `- [${e.createdAt.toISOString().slice(0, 10)}] Subject: "${e.subject}" ${tmplName ? `(previously matched: "${tmplName}")` : ''}`;
      }).join('\n')
    : 'None — this is the first email from this sender.';

  const analysisPrompt = `
You are an advanced email intent classification and template-matching agent for StyleCraft US customer support.
Analyze the following incoming email:
---
Sender: ${sender}
Subject: ${subject}
Body:
${body}
---

PREVIOUS emails from this same sender (most recent first) — use this context if the
new email is a follow-up, references an earlier issue, or contradicts what was said
before. Do not treat an obvious follow-up as a brand new, unrelated request:
${threadContextStr}

Approved response templates in the database:
${templatesListStr}

Your task is to analyze the email and return a JSON object with the following fields:
1. "language": Two-letter language code (e.g. "en", "es").
2. "category": The customer intent category. Choose one of the template titles if it fits, or return "General Inquiry".
3. "sentiment": Must be one of: "POSITIVE", "NEUTRAL", "NEGATIVE", "ANGRY".
4. "urgency": Must be one of: "LOW", "MEDIUM", "HIGH".
5. "priority": Must be one of: "LOW", "MEDIUM", "HIGH", "URGENT".
6. "summary": A brief 1-sentence summary of the customer's issue.
7. "matchedTemplateId": The ID of the best matching template from the approved templates database list above. Return null if no template matches or is unclear.
8. "confidenceScore": A decimal number between 0.0 and 1.0 representing your confidence in this template match.
9. "spam": Boolean (true/false) indicating if this is marketing spam, advertising, or phishing.
10. "contextReason": If the previous-email context above changed which template you selected compared to what the new email's text alone would suggest, briefly explain why (1 sentence). Otherwise null.

Return ONLY a valid JSON object. Do not include markdown code block formatting.
`;

  try {
    let responseText = '';
    const provider = geminiKey ? 'Gemini' : 'OpenAI';
    
    if (geminiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: analysisPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }
      
      const data = await response.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (openaiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a JSON generator.' },
            { role: 'user', content: analysisPrompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
      }

      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || '';
    }

    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    let draftReply = FALLBACK_RESPONSE;
    let matchedTemplateId: string | null = null;
    const confidenceScore = typeof result.confidenceScore === 'number' ? result.confidenceScore : 0.50;

    if (result.matchedTemplateId) {
      const template = await prisma.template.findUnique({
        where: { id: result.matchedTemplateId },
      });
      if (template) {
        matchedTemplateId = template.id;
        const greetingText = settings?.greeting || 'Hello';
        const closingSignature = settings?.closing || 'Regards,\nStyleCraft US Support Team';
        
        try {
          const rawDraft = await expandTemplateWithAI(
            body,
            subject,
            customerName,
            template.body,
            greetingText,
            closingSignature,
            geminiKey,
            openaiKey
          );
          draftReply = wrapResponseWithGreetingAndClosing(rawDraft, customerName, greetingText, closingSignature, { orderNumber });
        } catch (expandErr) {
          console.error('AI expansion failed, using wrap fallback:', expandErr);
          const expandedBody = localMockExpandTemplate(template.name, template.body);
          draftReply = wrapResponseWithGreetingAndClosing(expandedBody, customerName, greetingText, closingSignature, { orderNumber });
        }
      }
    }

    if (!matchedTemplateId) {
      // The LLM either found no match or suggested a templateId that
      // doesn't exist in the database (e.g. it slightly misquoted the id).
      // Always try the keyword matcher before giving up to the canned
      // fallback text — the fallback must only be used when NO approved
      // template matches through either method, not just when the LLM's
      // own (possibly wrong) confidence happened to be high.
      const keywordMatch = await runKeywordMatcher(body, subject, organizationId);
      if (keywordMatch.matchedTemplateId) {
        const template = await prisma.template.findUnique({
          where: { id: keywordMatch.matchedTemplateId },
        });
        if (template) {
          matchedTemplateId = template.id;
          const greetingText = settings?.greeting || 'Hello';
          const closingSignature = settings?.closing || 'Regards,\nStyleCraft US Support Team';
          
          try {
            const rawDraft = await expandTemplateWithAI(
              body,
              subject,
              customerName,
              template.body,
              greetingText,
              closingSignature,
              geminiKey,
              openaiKey
            );
            draftReply = wrapResponseWithGreetingAndClosing(rawDraft, customerName, greetingText, closingSignature, { orderNumber });
          } catch (expandErr) {
            const expandedBody = localMockExpandTemplate(template.name, template.body);
            draftReply = wrapResponseWithGreetingAndClosing(expandedBody, customerName, greetingText, closingSignature, { orderNumber });
          }

          return {
            language: result.language || 'en',
            category: result.category || 'General Question',
            sentiment: result.sentiment || 'NEUTRAL',
            urgency: result.urgency || 'MEDIUM',
            priority: result.priority || 'MEDIUM',
            aiConfidence: keywordMatch.confidenceScore,
            spam: !!result.spam,
            duplicate,
            draftReply,
            summary: `Matched "${template.name}" — ${keywordMatch.matchReason}.`,
            matchedTemplateId,
            aiProvider: 'Keyword Matcher',
          };
        }
      }
    }

    return {
      language: result.language || 'en',
      category: result.category || 'General Question',
      sentiment: result.sentiment || 'NEUTRAL',
      urgency: result.urgency || 'MEDIUM',
      priority: result.priority || 'MEDIUM',
      aiConfidence: confidenceScore,
      spam: !!result.spam,
      duplicate,
      draftReply,
      summary: result.contextReason ? `${result.summary || subject} (${result.contextReason})` : (result.summary || `Customer inquiry regarding: ${subject}`),
      matchedTemplateId,
      aiProvider: provider,
    };
  } catch (error) {
    console.error('LLM Pipeline failed, falling back to local parsing:', error);
    const fallback = await runMockAIPipeline(body, subject, sender, organizationId, parsedSenderName);
    return { ...fallback, duplicate };
  }
}
