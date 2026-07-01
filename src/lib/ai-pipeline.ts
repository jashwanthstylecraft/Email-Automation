import { prisma } from './prisma';

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
 * Wraps raw template text with polite greetings and closing signature.
 */
export function wrapResponseWithGreetingAndClosing(
  bodyText: string,
  senderEmail: string,
  greetingText: string,
  closingSignature: string
): string {
  const customerName = senderEmail.split('@')[0].split('.')[0].replace(/^\w/, (c) => c.toUpperCase());
  let res = bodyText;

  // 1. Interpolate placeholders first
  res = res.replace(/\{\{customer_name\}\}/g, customerName);
  res = res.replace(/\{\{closing\}\}/g, closingSignature);

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
async function expandTemplateWithAI(
  body: string,
  subject: string,
  sender: string,
  templateText: string,
  greetingText: string,
  closingSignature: string,
  geminiKey?: string,
  openaiKey?: string
): Promise<string> {
  const customerName = sender.split('@')[0].split('.')[0].replace(/^\w/, (c) => c.toUpperCase());
  const expansionPrompt = `
You are a professional customer support agent for StyleCraft US.
Write a polite, professional, and clear email reply to the customer's email using the approved template text as the absolute source of truth for the answer/instruction.

CUSTOMER EMAIL:
---
Subject: ${subject}
Body:
${body}
---

APPROVED TEMPLATE TEXT:
---
${templateText}
---

INSTRUCTIONS:
1. You MUST include the facts, URLs, and support guidelines in the APPROVED TEMPLATE TEXT verbatim. Do not alter links or numbers.
2. Use the greeting: "${greetingText} ${customerName},".
3. Use the closing signature: "${closingSignature}".
4. Elevate the tone to be highly helpful, professional, and empathetic, expanding on the short template details to make it a fully readable, contextually appropriate response.

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
 * Deterministic keyword-based matching engine that runs when API keys are missing or as a fallback.
 */
export async function runKeywordMatcher(
  body: string,
  subject: string,
  organizationId: string
): Promise<{ matchedTemplateId: string | null; confidenceScore: number; matchReason: string }> {
  const templates = await prisma.template.findMany({
    where: { organizationId },
  });

  const rules = await prisma.rule.findMany({
    where: { organizationId },
  });

  const normalizedText = (subject + ' ' + body).toLowerCase();
  type MatchTier = 'verbatim' | 'all-words' | 'partial';
  const matches: { templateId: string; score: number; keyword: string; tier: MatchTier }[] = [];
  const stopwords = new Set(['and', 'the', 'for', 'with', 'your', 'about', 'this', 'that', 'from', 'have', 'been', 'will', 'are', 'not', 'but', 'out']);

  for (const t of templates) {
    if (t.active === false) continue;

    // Retrieve the matching keywords from the rule referencing this template in-memory
    const rule = rules.find(r => r.actions.includes(t.id));
    const keywords: string[] = [];

    if (rule) {
      try {
        const conds = JSON.parse(rule.conditions);
        const rulesList = conds.rules || [];
        for (const r of rulesList) {
          if (r.value) {
            keywords.push(r.value.toLowerCase().trim());
          }
        }
      } catch (err) {}
    }

    // Also parse keywords added via the user feedback console
    const addedKeywords = (t.variables || '').split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k && k !== 'customer_name' && k !== 'closing' && k !== 'ticket_id' && k !== 'order_number' && k !== 'rma_number');
    keywords.push(...addedKeywords);

    // Include template title/name
    keywords.push(t.name.toLowerCase().trim());

    for (const kw of keywords) {
      if (kw.length >= 2) {
        // 1. Verbatim check
        if (normalizedText.includes(kw)) {
          matches.push({ templateId: t.id, score: kw.length * 10, keyword: kw, tier: 'verbatim' });
        } else {
          // 2. Individual words check (multi-word keyword phrases like "dryer shutting off")
          const words = kw.split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));
          if (words.length > 0) {
            let matchedWordsCount = 0;
            for (const w of words) {
              if (normalizedText.includes(w)) {
                matchedWordsCount++;
              }
            }
            if (matchedWordsCount === words.length) {
              matches.push({ templateId: t.id, score: kw.length * 5, keyword: kw, tier: 'all-words' });
            } else if (matchedWordsCount > 0 && words.length >= 2) {
              // Only a fraction of a multi-word phrase matched (e.g. one generic
              // word coincidentally present) — weak signal, not a real match.
              matches.push({ templateId: t.id, score: matchedWordsCount * 3, keyword: words.filter(w => normalizedText.includes(w)).join(' '), tier: 'partial' });
            }
          }
        }
      }
    }
  }

  if (matches.length === 0) {
    return { matchedTemplateId: null, confidenceScore: 0.0, matchReason: 'No keyword matches found' };
  }

  const scoreMap: Record<string, number> = {};
  const tierRank: Record<MatchTier, number> = { verbatim: 3, 'all-words': 2, partial: 1 };
  const bestTierMap: Record<string, MatchTier> = {};
  for (const m of matches) {
    scoreMap[m.templateId] = (scoreMap[m.templateId] || 0) + m.score;
    if (!bestTierMap[m.templateId] || tierRank[m.tier] > tierRank[bestTierMap[m.templateId]]) {
      bestTierMap[m.templateId] = m.tier;
    }
  }

  const sortedTemplates = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
  const bestMatchId = sortedTemplates[0][0];
  const bestTier = bestTierMap[bestMatchId];

  // Confidence reflects how the strongest match was found, not just that
  // something matched — a single coincidental word overlap ("partial")
  // must not be treated as confidently as an exact keyword/phrase hit,
  // otherwise unrelated emails get auto-drafted with the wrong template
  // instead of being routed to manual review.
  const confidenceByTier: Record<MatchTier, number> = {
    verbatim: 0.92,
    'all-words': 0.78,
    partial: 0.35,
  };

  return {
    matchedTemplateId: bestMatchId,
    confidenceScore: confidenceByTier[bestTier],
    matchReason: `Matched keyword (${bestTier}): "${matches.find(m => m.templateId === bestMatchId && m.tier === bestTier)?.keyword}"`
  };
}

/**
 * Fallback local rules-based engine that processes emails when no API keys are provided.
 */
async function runMockAIPipeline(
  body: string,
  subject: string,
  sender: string,
  organizationId: string
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
      const expandedBody = localMockExpandTemplate(template.name, template.body);
      draftReply = wrapResponseWithGreetingAndClosing(expandedBody, sender, greeting, closing);
      matchedTemplateId = template.id;
      aiConfidence = keywordMatch.confidenceScore;
      summary = `Customer matched rule: "${template.name}" via keywords.`;
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
  organizationId: string
): Promise<AIPipelineResult> {
  const settings = await prisma.settings.findUnique({
    where: { organizationId },
  });

  const geminiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
  const openaiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;

  const duplicate = await checkDuplicate(sender, subject, organizationId);

  if (!geminiKey && !openaiKey) {
    return runMockAIPipeline(body, subject, sender, organizationId);
  }

  const templates = await prisma.template.findMany({
    where: { organizationId },
  });

  const templatesListStr = templates.map(t => {
    return `- ID: "${t.id}", Title: "${t.name}", Keywords: "${t.variables || ''}"`;
  }).join('\n');

  const analysisPrompt = `
You are an advanced email intent classification and template-matching agent for StyleCraft US customer support.
Analyze the following incoming email:
---
Sender: ${sender}
Subject: ${subject}
Body:
${body}
---

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
            sender,
            template.body,
            greetingText,
            closingSignature,
            geminiKey,
            openaiKey
          );
          draftReply = wrapResponseWithGreetingAndClosing(rawDraft, sender, greetingText, closingSignature);
        } catch (expandErr) {
          console.error('AI expansion failed, using wrap fallback:', expandErr);
          const expandedBody = localMockExpandTemplate(template.name, template.body);
          draftReply = wrapResponseWithGreetingAndClosing(expandedBody, sender, greetingText, closingSignature);
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
              sender,
              template.body,
              greetingText,
              closingSignature,
              geminiKey,
              openaiKey
            );
            draftReply = wrapResponseWithGreetingAndClosing(rawDraft, sender, greetingText, closingSignature);
          } catch (expandErr) {
            const expandedBody = localMockExpandTemplate(template.name, template.body);
            draftReply = wrapResponseWithGreetingAndClosing(expandedBody, sender, greetingText, closingSignature);
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
            summary: `Matched keyword fallback: "${template.name}"`,
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
      summary: result.summary || `Customer inquiry regarding: ${subject}`,
      matchedTemplateId,
      aiProvider: provider,
    };
  } catch (error) {
    console.error('LLM Pipeline failed, falling back to local parsing:', error);
    const fallback = await runMockAIPipeline(body, subject, sender, organizationId);
    return { ...fallback, duplicate };
  }
}
