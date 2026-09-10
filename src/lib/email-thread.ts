// Splits a raw email body (which, once any reply has happened, is really a
// whole quoted conversation glued into one string) into its real content --
// stripping legal/compliance boilerplate, signature blocks, and quote
// markers -- and optionally into the individual message-reply-message turns
// a customer's mail client wrote it as. Pure string logic, safe to import
// from both server code (classification) and client components (the inbox
// thread view).

export interface ThreadMessage {
  // The raw "who and when" line as the client itself wrote it (e.g. "Tue,
  // Sep 1, 2026 at 4:37 PM UCC Liens <UCCLiens@lexingtonrecovery.com>") --
  // deliberately not split into separate sender/date fields, since that
  // split is inherently ambiguous across the many real formats clients use
  // and a wrong guess reads worse than showing the client's own line as-is.
  meta: string | null;
  text: string;
}

// Extremely standardized boilerplate genres (debt-collection compliance
// notices, confidentiality footers, bankruptcy/HIPAA disclaimers, mobile
// client signatures) -- phrased almost identically across unrelated
// senders, so a fixed phrase list catches the overwhelming majority without
// needing per-sender rules.
const BOILERPLATE_PARAGRAPH_MARKERS: RegExp[] = [
  /confidentiality notice/i,
  /this (?:e-?mail|message|communication)(?:s)? (?:is|and all attachments? transmitted with it are|and any attachments? (?:is|are)) (?:from a debt collector|intended (?:solely |only )?for the use of)/i,
  /is (?:from|sent by) a debt collector/i,
  /this is an attempt to collect a debt/i,
  /if (?:you are not|the reader of this message is not) the intended recipient/i,
  /if you have received this (?:message|email) in error/i,
  /legally privileged and confidential/i,
  /please notify the sender immediately/i,
  /dissemination, distribution,? (?:or )?copying/i,
  /automatic stay pursuant to (?:title\s*11|the (?:u\.?s\.?|united states) bankruptcy code)/i,
  /this notice is for compliance and\/or informational purposes/i,
  /does not constitute a demand for payment/i,
  /sent from my (?:iphone|android|samsung|ipad|mobile)/i,
  /get outlook for (?:ios|android)/i,
  /^\[image:[^\]]*\]$/im,
];

// A run of pure "[image: xyz]" placeholder lines (a plain-text mail client's
// rendering of a signature's icon/logo images) carries no real content.
const IMAGE_PLACEHOLDER_LINE_RE = /^\s*\[image:[^\]]*\]\s*$/i;

function stripSignatureBlock(text: string): string {
  const sigMatch = text.match(/^--\s*$/m);
  return sigMatch?.index !== undefined ? text.slice(0, sigMatch.index) : text;
}

// Most real signatures carry no "-- " delimiter at all -- they just follow
// straight on from a sign-off line ("Best regards,", "Thanks,", "Sincerely,")
// with a name, then company/title/phone/address/social-link clutter. That
// sign-off phrase is itself an extremely reliable boundary: it is
// essentially never followed by more of the actual message, only by the
// name and contact block. Everything from the first standalone sign-off
// line onward is dropped, as long as there's real content before it.
const VALEDICTION_LINE_RE = /^[ \t]*(?:best(?: regards| wishes)?|regards|warm(?:est)? regards|kind(?:est)? regards|many thanks|thanks(?: (?:so much|again|a (?:lot|bunch)))?|thank you(?: (?:so much|again))?|sincerely(?: yours)?|respectfully(?: yours)?|cheers|yours (?:truly|sincerely|faithfully)|with (?:gratitude|appreciation))[,.!]?[ \t]*$/im;

function stripValedictionSignoff(text: string): string {
  const match = text.match(VALEDICTION_LINE_RE);
  if (match?.index === undefined) return text;
  const before = text.slice(0, match.index).trim();
  // Guard against nuking a message that's little more than the sign-off
  // itself (e.g. a one-line "Thanks!" reply with nothing substantive above
  // it) -- keep the whole thing rather than returning near-nothing.
  if (before.length < 15) return text;
  return before;
}

function stripBoilerplateParagraphs(text: string): string {
  // A "blank" line inside a quoted block still carries its "> " marker(s),
  // so it never reads as empty to a plain \n{2,} split -- normalize those to
  // real blank lines first, or an entire quoted message becomes one giant
  // paragraph that a single stray phrase anywhere inside it can disqualify
  // wholesale.
  const normalized = text.replace(/^[ \t]*>+[ \t]*$/gm, '');
  const paragraphs = normalized.split(/\n{2,}/);
  const kept = paragraphs.filter((p) => {
    const trimmed = p.trim();
    if (!trimmed) return false;
    if (IMAGE_PLACEHOLDER_LINE_RE.test(trimmed)) return false;
    return !BOILERPLATE_PARAGRAPH_MARKERS.some((re) => re.test(trimmed));
  });
  return kept.join('\n\n');
}

function stripImagePlaceholderLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !IMAGE_PLACEHOLDER_LINE_RE.test(line))
    .join('\n');
}

// One turn's real content: signature block and boilerplate paragraphs gone,
// leading/trailing whitespace collapsed. Never returns an empty string for
// non-empty input -- falls back to the trimmed original so a message that's
// ENTIRELY boilerplate (rare) doesn't just vanish.
function cleanTurnText(raw: string): string {
  let text = stripSignatureBlock(raw);
  text = stripValedictionSignoff(text);
  text = stripImagePlaceholderLines(text);
  text = stripBoilerplateParagraphs(text);
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text || raw.trim();
}

function unquoteOneLevel(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n');
}

// Matches the header line a mail client inserts right before quoting a
// previous message -- covers the two conventions that account for nearly
// all real mail (Gmail/Apple Mail's "On ... wrote:", and classic Outlook's
// "-----Original Message-----" block).
// The "On <date/name>" info and "wrote:" can land on different physical
// lines once a client wraps a long sender name/date -- [\s\S] (not just .)
// lets the non-greedy match cross that line break.
const ON_WROTE_RE = /^On ([\s\S]{5,200}?)\s+wrote:[ \t]*$/im;
const ORIGINAL_MESSAGE_RE = /^-{2,}\s*Original Message\s*-{2,}\s*$/im;
const FORWARDED_RE = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/im;

// Collapsed to one line -- a client can wrap this across two physical
// lines (long sender name/date), which would otherwise show up as an
// awkward embedded line break wherever this is displayed.
function normalizeMeta(rawInfo: string): string {
  return rawInfo.replace(/\s+/g, ' ').trim();
}

// Best-effort split of a raw body into its individual message turns, oldest
// first (the order a conversation reads in). Every turn's text has already
// been through cleanTurnText. Falls back to a single turn (the whole
// cleaned body) when no quote boundary is found at all.
export function splitThread(rawBody: string): ThreadMessage[] {
  const messages: ThreadMessage[] = [];
  let remaining = (rawBody || '').replace(/\r\n/g, '\n').trim();
  let pendingMeta: string | null = null;
  let guard = 0;

  while (remaining && guard++ < 25) {
    const onWrote = remaining.match(ON_WROTE_RE);
    const original = remaining.match(ORIGINAL_MESSAGE_RE);
    const forwarded = remaining.match(FORWARDED_RE);
    const candidates = [onWrote, original, forwarded].filter((m): m is RegExpMatchArray => !!m && m.index !== undefined);
    const headerMatch = candidates.sort((a, b) => (a.index! - b.index!))[0] || null;

    const head = headerMatch ? remaining.slice(0, headerMatch.index) : remaining;
    const cleaned = cleanTurnText(head);
    if (cleaned) {
      messages.push({ meta: pendingMeta, text: cleaned });
    }
    if (!headerMatch) break;

    const headerLine = headerMatch[0];
    if (headerMatch === onWrote) {
      pendingMeta = normalizeMeta(onWrote![1]);
    } else {
      // Outlook/forwarded block -- the metadata lives on the next few
      // "From:/Sent:/To:/Subject:" lines rather than the header itself.
      const afterHeader = remaining.slice(headerMatch.index! + headerLine.length, headerMatch.index! + headerLine.length + 400);
      const fromLine = afterHeader.match(/^\s*From:\s*(.+)$/im);
      const sentLine = afterHeader.match(/^\s*(?:Sent|Date):\s*(.+)$/im);
      pendingMeta = [fromLine?.[1], sentLine?.[1]].filter(Boolean).map((s) => s!.trim()).join(' — ') || null;
    }

    const rest = remaining.slice(headerMatch.index! + headerLine.length).replace(/^\n+/, '');
    remaining = unquoteOneLevel(rest).trim();
  }

  return messages.reverse();
}

// Single-block equivalent for anything that just wants "the real text,
// noise gone" (keyword matching, AI classification, order-number
// extraction) without needing the turn-by-turn structure -- every turn
// found by splitThread, back in chronological reading order.
export function cleanEmailText(rawBody: string): string {
  const turns = splitThread(rawBody);
  return turns.map((t) => t.text).join('\n\n').trim() || (rawBody || '').trim();
}
