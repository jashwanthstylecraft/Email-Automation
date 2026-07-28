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
  'of', 'or', 'if', 'my', 'me', 'i', 'at']);

function cleanTitle(name: string): string {
  return name.toLowerCase().replace(/[“”"']/g, '').replace(/[^a-z0-9\s&/-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function meaningfulWords(phrase: string): string[] {
  return phrase.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Deterministic, non-AI keyword extraction from a template's own title and
 * body. Used to bootstrap every template with real keywords immediately
 * without spending any API quota on 100+ templates at once, and as a
 * fallback whenever LLM-based enrichment hasn't reached a given template yet.
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

function phraseMatches(text: string, phrase: string): boolean {
  if (!phrase || phrase.length < 2) return false;
  if (text.includes(phrase)) return true;
  const words = meaningfulWords(phrase);
  if (words.length >= 2) {
    return words.every(w => text.includes(w));
  }
  return false;
}

/**
 * Cleans and tokenizes raw email text (subject + body) into a set of
 * individual meaningful words: lowercase, strip punctuation/special
 * characters, split on whitespace, drop stop words. This is what an
 * incoming email is reduced to before it's compared against a template's
 * keyword list -- a true word-by-word "bag of words", not substring search.
 */
export function tokenizeEmailText(text: string): Set<string> {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = cleaned.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Every keyword tier EXCEPT `negative` (a disqualifier, not a positive
 * signal) flattened into one plain list -- the "keywords: [...]" per
 * template the matching algorithm actually compares against.
 */
export function flattenTemplateKeywords(kw: StructuredKeywords): string[] {
  return Array.from(new Set([...kw.primary, ...kw.secondary, ...kw.product, ...kw.problem, ...kw.intent]
    .map(k => k.trim().toLowerCase())
    .filter(Boolean)));
}

/**
 * Percentage-based keyword-overlap scoring:
 *   matchScore = (number of matching keywords / total keywords in template) * 100
 * A multi-word keyword phrase ("blade gets hot") counts as matched only when
 * EVERY one of its words is present in the (cleaned, tokenized) email text --
 * comparing every word, not just a loose substring check.
 */
export function scoreTemplate(template: TemplateForScoring, emailText: string): ScoredTemplate {
  const text = emailText.toLowerCase();
  const kw = template.keywords;

  // Negative keywords disqualify this template outright -- used to
  // disambiguate near-duplicate templates (e.g. don't suggest "Blade Gets
  // Hot" when the email is actually about "Blade Smoking").
  const negativeHit = kw.negative.find(n => phraseMatches(text, n));
  if (negativeHit) {
    return { templateId: template.id, name: template.name, score: -1, matchedTerms: [], disqualified: true };
  }

  const templateKeywords = flattenTemplateKeywords(kw);
  if (templateKeywords.length === 0) {
    return { templateId: template.id, name: template.name, score: 0, matchedTerms: [], disqualified: false };
  }

  const emailWords = tokenizeEmailText(text);
  const matchedTerms = templateKeywords.filter(term => {
    const termWords = term.split(/\s+/).filter(Boolean);
    // A term word might itself have been stripped by the tokenizer's
    // stopword/length filter (short product codes, etc.) -- fall back to a
    // raw substring check for those so real matches aren't lost.
    return termWords.length > 0 && termWords.every(w => emailWords.has(w) || text.includes(w));
  });

  const score = (matchedTerms.length / templateKeywords.length) * 100;

  return { templateId: template.id, name: template.name, score, matchedTerms, disqualified: false };
}

// Only accept a match when its percentage score is strictly above 30% --
// below that, the overlap is too thin to trust over a manual/AI-drafted
// reply.
export const MIN_MATCH_SCORE = 30;

export interface MatchResult {
  matchedTemplateId: string | null;
  confidenceScore: number;
  matchReason: string;
  matchedTerms: string[];
  suggestions: { templateId: string; name: string; score: number; confidence: number }[];
}

// Score is already a 0-100 percentage; map it onto the confidence range the
// rest of the app expects (Email.aiConfidence, UI thresholds, etc.).
function scoreToConfidence(score: number): number {
  return Math.max(0.3, Math.min(0.97, score / 100));
}

export function matchTemplates(templates: TemplateForScoring[], subject: string, body: string): MatchResult {
  const emailText = `${subject} ${body}`.toLowerCase();
  const scored = templates
    .filter(t => t.active !== false)
    .map(t => scoreTemplate(t, emailText))
    .filter(s => !s.disqualified)
    // Rank by match score first; on a tie, the template with more total
    // keyword matches wins (not just a higher percentage off a shorter list).
    .sort((a, b) => b.score - a.score || b.matchedTerms.length - a.matchedTerms.length);

  const suggestions = scored.slice(0, 3).map(s => ({
    templateId: s.templateId,
    name: s.name,
    score: s.score,
    confidence: scoreToConfidence(s.score),
  }));

  const best = scored[0];
  if (!best || best.score <= MIN_MATCH_SCORE) {
    return {
      matchedTemplateId: null,
      confidenceScore: 0,
      matchReason: 'No approved template scored above the 30% match threshold',
      matchedTerms: [],
      suggestions,
    };
  }

  return {
    matchedTemplateId: best.templateId,
    confidenceScore: scoreToConfidence(best.score),
    matchReason: `matched ${best.matchedTerms.length} keyword(s) (${Math.round(best.score)}%): ${best.matchedTerms.slice(0, 3).join(', ')}`,
    matchedTerms: best.matchedTerms,
    suggestions,
  };
}
