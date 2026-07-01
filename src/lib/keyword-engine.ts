// Structured keyword extraction + scoring engine for template matching.
// Pure logic (no server-only imports) so it can run both in API routes and
// directly in client components (e.g. the inbox "suggested templates" panel
// and the templates page keyword editor/tester).

export interface StructuredKeywords {
  primary: string[];
  secondary: string[];
  product: string[];
  problem: string[];
  intent: string[];
  negative: string[];
}

const EMPTY_KEYWORDS: StructuredKeywords = {
  primary: [], secondary: [], product: [], problem: [], intent: [], negative: [],
};

export function emptyKeywords(): StructuredKeywords {
  return { primary: [], secondary: [], product: [], problem: [], intent: [], negative: [] };
}

export function parseKeywords(raw: string | null | undefined): StructuredKeywords {
  if (!raw) return emptyKeywords();
  try {
    const parsed = JSON.parse(raw);
    return {
      primary: Array.isArray(parsed.primary) ? parsed.primary : [],
      secondary: Array.isArray(parsed.secondary) ? parsed.secondary : [],
      product: Array.isArray(parsed.product) ? parsed.product : [],
      problem: Array.isArray(parsed.problem) ? parsed.problem : [],
      intent: Array.isArray(parsed.intent) ? parsed.intent : [],
      negative: Array.isArray(parsed.negative) ? parsed.negative : [],
    };
  } catch {
    return emptyKeywords();
  }
}

export function serializeKeywords(kw: StructuredKeywords): string {
  return JSON.stringify(kw);
}

export function totalKeywordCount(kw: StructuredKeywords): number {
  return kw.primary.length + kw.secondary.length + kw.product.length + kw.problem.length + kw.intent.length + kw.negative.length;
}

// ---------------------------------------------------------------------------
// Domain vocabulary used for LOCAL (non-AI) keyword extraction. This lets us
// backfill every template with real, distinctive keywords even when the LLM
// quota is exhausted -- and gives the matcher signal beyond a bare template
// title, which was previously the only per-template differentiator.
// ---------------------------------------------------------------------------

const PRODUCT_TERMS = [
  'clipper', 'clippers', 'trimmer', 'trimmers', 'dryer', 'blade', 'blades', 'guard', 'guards',
  'switch', 'charger', 'chargers', 'battery', 'batteries', 'motor', 'foil', 'foils', 'cutter',
  'cutters', 'lever', 'levers', 'plug', 'adapter', 'screw', 'screws', 'bracket', 'washer',
  'cam follower', 'usb-c', 'usb c', 'xcell', 'gamma', 'gamma+', 'rebel', 'saber', 'evo', 'hitter',
  'ergo', 'ergos', 'uno', 'fusion', 'instinct', 'prime', 'nano', 'sprayer', 'echo', 'vector',
  'hanzo', 'zero gamma', 'connect 3', 'foil', 'sc', 'gama',
];

const ISSUE_SYNONYMS: Record<string, string[]> = {
  hot: ['hot', 'heating', 'overheating', 'burns', 'burning', 'temperature', 'too hot'],
  cold: ['cold', 'not hot', 'no heat', 'blowing cold', 'cold air'],
  broken: ['broken', 'defective', 'damaged', 'not working', "won't turn on", 'wont turn on', 'dead', 'malfunctioning', 'not functioning', 'wont power on', "won't power on"],
  missing: ['missing', 'lost', 'never arrived', 'never received', 'not received', 'did not receive', "didn't receive", 'not arrived', 'never got it', "didn't get it", 'did not get it', 'says delivered'],
  loud: ['loud', 'noisy', 'rattling', 'rattle'],
  smoking: ['smoking', 'smoke'],
  stuck: ['stuck', 'jammed', "won't open", "won't close", 'wont open', 'wont close'],
  pulling: ['pulling', 'snagging', 'cutting poorly', 'not cutting well', 'cutting/pulling'],
  shifting: ['shifting', 'moving', 'loose'],
  delay: ['delay', 'delayed', 'late', 'backorder', 'backordered'],
  cancel: ['cancel', 'cancelled', 'canceled', 'cancellation'],
  universal: ['universal', 'compatible', 'fit other brands', 'fits other'],
  fake: ['fake', 'counterfeit', 'unverified', 'unauthorized'],
  difference: ['difference between', 'vs', 'versus', 'compared to'],
};

const INTENT_TERMS = [
  'warranty', 'return', 'refund', 'replacement', 'rma', 'ra number', 'ra#', 'claim',
  'distributor', 'wholesale', 'influencer', 'affiliate', 'collaboration', 'collab',
  'discount', 'shipping', 'international', 'domestic', 'pre-order', 'preorder', 'in stock',
  'out of stock', 'register', 'registration', 'proof of purchase', 'military discount',
  'dealer', 'reseller', 'bulk order', 'sponsorship', 'brand ambassador',
];

const STOPWORDS = new Set(['and', 'the', 'for', 'with', 'your', 'about', 'this', 'that', 'from',
  'have', 'been', 'will', 'are', 'not', 'but', 'out', 'you', 'why', 'did', 'send', 'does', 'was',
  'were', 'has', 'had', 'can', 'could', 'would', 'should', 'a', 'an', 'is', 'it', 'in', 'on', 'to',
  'of', 'or', 'if', 'my', 'me', 'i']);

function cleanTitle(name: string): string {
  return name.toLowerCase().replace(/[“”"']/g, '').replace(/[^a-z0-9\s&/-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function meaningfulWords(phrase: string): string[] {
  return phrase.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Deterministic, non-AI keyword extraction from a template's own title and
 * body. Used to bootstrap every template with real keywords immediately
 * (Gemini's free-tier quota is too small to do this for 100+ templates
 * on demand), and as a fallback whenever the LLM-based enrichment hasn't
 * reached a given template yet.
 */
export function extractKeywordsForTemplate(name: string, body: string): StructuredKeywords {
  const title = cleanTitle(name);
  const text = `${title} ${body}`.toLowerCase();
  const result = emptyKeywords();

  // Primary: the full template title, but only if it carries real signal
  // (>= 2 meaningful words) -- a bare single generic word ("Netherlands",
  // "Bracket") is not distinctive enough to stand alone as a strong keyword.
  if (meaningfulWords(title).length >= 2) {
    result.primary.push(title);
  }

  // Product/problem terms are derived from the TITLE first -- a template's
  // title reliably names its actual subject, whereas scanning the whole
  // body picks up incidental mentions (a template about wholesale/B2B may
  // mention "shortage" or "delay" once in passing, which would otherwise
  // make it collide with templates that are genuinely ABOUT that problem).
  // Body-wide scanning is only used as a fallback when the title itself
  // doesn't reveal any known product/issue term.
  const titleProducts = PRODUCT_TERMS.filter(p => title.includes(p));
  const titleIssueGroups = Object.values(ISSUE_SYNONYMS).filter(group => group.some(term => title.includes(term)));

  const foundProducts = titleProducts.length > 0 ? titleProducts : PRODUCT_TERMS.filter(p => text.includes(p));
  result.product.push(...foundProducts);

  if (titleIssueGroups.length > 0) {
    // The title explicitly names the issue -- safe to expand to every
    // synonym in the group so future emails phrased differently still hit.
    for (const group of titleIssueGroups) {
      result.problem.push(...group);
    }
  } else {
    // No issue named in the title: only the SPECIFIC phrase actually found
    // in the body is added, not the whole synonym group. A template that
    // merely mentions "shortage" in passing shouldn't also start matching
    // "never got it" or "says delivered" just because they share a group.
    for (const group of Object.values(ISSUE_SYNONYMS)) {
      const found = group.filter(term => text.includes(term));
      result.problem.push(...found);
    }
  }

  // Intent/policy terms present in this template.
  result.intent.push(...INTENT_TERMS.filter(t => text.includes(t)));

  // Secondary: combine product + problem terms into specific 2-word phrases
  // ("blade hot", "hot blade") that differentiate near-duplicate templates
  // far better than either word alone (e.g. "Blade Gets Hot" vs "Blade
  // Smoking" vs "Blade Cutting Length").

  const combos: string[] = [];
  for (const product of titleProducts.slice(0, 2)) {
    for (const group of titleIssueGroups.slice(0, 2)) {
      for (const issueWord of group.slice(0, 3)) {
        if (issueWord.split(' ').length === 1) {
          combos.push(`${product} ${issueWord}`, `${issueWord} ${product}`);
        } else {
          combos.push(`${product} ${issueWord}`);
        }
      }
    }
  }
  result.secondary.push(...Array.from(new Set(combos)).slice(0, 10));

  // De-duplicate everything.
  (Object.keys(result) as (keyof StructuredKeywords)[]).forEach(k => {
    result[k] = Array.from(new Set(result[k].map(s => s.trim().toLowerCase()).filter(Boolean)));
  });

  return result;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface TemplateForScoring {
  id: string;
  name: string;
  keywords: StructuredKeywords;
  active?: boolean;
}

export interface ScoredTemplate {
  templateId: string;
  name: string;
  score: number;
  matchedTerms: string[];
  disqualified: boolean;
}

const MIN_TITLE_WORDS_FOR_STRONG_MATCH = 2;

function phraseMatches(text: string, phrase: string): boolean {
  if (!phrase || phrase.length < 2) return false;
  if (text.includes(phrase)) return true;
  const words = meaningfulWords(phrase);
  if (words.length >= 2) {
    return words.every(w => text.includes(w));
  }
  return false;
}

export function scoreTemplate(template: TemplateForScoring, emailText: string): ScoredTemplate {
  const text = emailText.toLowerCase();
  const kw = template.keywords;
  let score = 0;
  const matchedTerms: string[] = [];

  // Negative keywords disqualify this template outright -- used to
  // disambiguate near-duplicate templates (e.g. don't suggest "Blade Gets
  // Hot" when the email is actually about "Blade Smoking").
  const negativeHit = kw.negative.find(n => phraseMatches(text, n));
  if (negativeHit) {
    return { templateId: template.id, name: template.name, score: -1, matchedTerms: [], disqualified: true };
  }

  // Exact template title match -- strongest possible signal, but only when
  // the title itself is specific (multi-word). A single generic word title
  // ("Netherlands") coincidentally appearing in an email is not real evidence.
  const titleWords = meaningfulWords(cleanTitle(template.name));
  if (titleWords.length >= MIN_TITLE_WORDS_FOR_STRONG_MATCH && text.includes(cleanTitle(template.name))) {
    score += 50;
    matchedTerms.push(template.name);
  }

  const scoreGroup = (terms: string[], weight: number, cap: number) => {
    let added = 0;
    for (const term of terms) {
      if (added >= cap) break;
      if (phraseMatches(text, term)) {
        score += weight;
        matchedTerms.push(term);
        added += weight;
      }
    }
  };

  scoreGroup(kw.primary, 22, 44);
  scoreGroup(kw.intent, 22, 44);
  scoreGroup(kw.secondary, 10, 20);
  // Bare product words are ambiguous on their own (many templates share
  // "blade"), so they carry the least weight -- they nudge the ranking,
  // they don't drive it alone. Problem phrases are often multi-word and
  // fairly specific ("never got it", "says delivered") even without a
  // product word alongside them, so two independent problem-phrase hits
  // are enough to clear the match threshold on their own.
  scoreGroup(kw.product, 8, 16);
  scoreGroup(kw.problem, 10, 20);

  return { templateId: template.id, name: template.name, score, matchedTerms: Array.from(new Set(matchedTerms)), disqualified: false };
}

// Minimum total score to accept a match at all. Below this, the signal is
// too weak/coincidental to be trusted -- correctly returns "no match"
// instead of confidently picking the wrong template. Set just below a
// single strong intent/primary hit (22) so one clear, specific signal
// ("I want to return this" -> "return") is enough, but two-plus weak bare
// product/problem words (8 each) still aren't, on their own.
export const MIN_MATCH_SCORE = 20;

export interface MatchResult {
  matchedTemplateId: string | null;
  confidenceScore: number;
  matchReason: string;
  matchedTerms: string[];
  suggestions: { templateId: string; name: string; score: number; confidence: number }[];
}

function scoreToConfidence(score: number): number {
  return Math.max(0.3, Math.min(0.97, score / 70));
}

export function matchTemplates(templates: TemplateForScoring[], subject: string, body: string): MatchResult {
  const emailText = `${subject} ${body}`.toLowerCase();
  const scored = templates
    .filter(t => t.active !== false)
    .map(t => scoreTemplate(t, emailText))
    .filter(s => !s.disqualified)
    // On a tied score, prefer the shorter/more generic title -- a more
    // specific variant ("Exceed Return Period") should only outrank the
    // generic default ("Returns") when it has genuinely extra matching
    // signal, not just the same single shared word.
    .sort((a, b) => b.score - a.score || a.name.length - b.name.length);

  const suggestions = scored.slice(0, 3).map(s => ({
    templateId: s.templateId,
    name: s.name,
    score: s.score,
    confidence: scoreToConfidence(s.score),
  }));

  const best = scored[0];
  if (!best || best.score < MIN_MATCH_SCORE) {
    return {
      matchedTemplateId: null,
      confidenceScore: 0,
      matchReason: 'No approved template scored above the match threshold',
      matchedTerms: [],
      suggestions,
    };
  }

  return {
    matchedTemplateId: best.templateId,
    confidenceScore: scoreToConfidence(best.score),
    matchReason: `matched on: ${best.matchedTerms.slice(0, 3).join(', ')}`,
    matchedTerms: best.matchedTerms,
    suggestions,
  };
}
