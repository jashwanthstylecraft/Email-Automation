import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { extractKeywordsForTemplate, parseKeywords, serializeKeywords } from '@/lib/keyword-engine';

// Exact keywords to map rules to templates for the 102 StyleCraft templates
const ALL_TEMPLATE_KEYWORDS: Record<string, string[]> = {
  "NOT Paying Warranty Fee / Their Own Label": ["not paying warranty fee", "their own label", "waive fee", "waived fee"],
  "“Register” for Warranty": ["register warranty", "warranty registration", "register clipper"],
  "Exceeded / Expired Warranty": ["warranty expired", "expired warranty", "exceeded warranty", "out of warranty"],
  "Returns": ["returns", "return policy", "refund period"],
  "Exceed Return Period": ["exceeded return period", "exceeded return", "past 30 days", "past 15 days"],
  "Problem with screws or blades": ["screws", "problem with screws", "blade screws", "screws won't come out"],
  "Instinct Battery Life": ["Instinct battery", "Instinct runtime", "Instinct battery life"],
  "Missing spare cutters (ZERO GAMMA+)": ["missing spare cutters", "spare cutters", "extra cutters"],
  "Missing package": ["missing package", "package missing", "lost package", "did not receive package"],
  "Return Authorization Amazon": ["return amazon", "amazon return"],
  "Lost package more than twice": ["lost package twice", "lost package more than twice", "shipped twice"],
  "Broken Product": ["broken product", "broken clipper", "broken housing", "housing cracked"],
  "Start new claim": ["start claim", "file claim", "warranty claim link"],
  "SCREW ON LEVER": ["screw on lever", "lever screw", "tighten lever"],
  "Blade Temperature": ["blade temperature", "cooler blade", "blade hot", "coolest operation"],
  "Difference between Evo and Hitter": ["Evo vs Hitter", "Evo and Hitter", "Hitter vs Evo"],
  "Chargers": ["charger", "intended charger", "charging accessories"],
  "Plug Converter / Adapter": ["plug converter", "adapter", "power adapter", "dual voltage"],
  "Cancelled order": ["cancelled order", "cancel order", "refund processed"],
  "Gamma - Do you ship out of the country?": ["ship out of country", "ship international", "outside the US"],
  "Says “In stock” but says it will ship later??": ["in stock but ships later", "ship later", "pre order stock"],
  "Switch fix - 2 versions": ["switch fix", "clipper switch", "switch screw"],
  "SENDING DISTRIBUTORS TO SC OUT OF US": ["distributors out of US", "distributor Canada", "sister brand"],
  "Order Shipped / Cannot Make Changes": ["order shipped", "cannot change address", "already shipped"],
  "“2 DAY SHIPPING”": ["2 day shipping", "two day shipping"],
  "Ergo VS X Ergos": ["Ergo vs X Ergo", "Ergo vs X Ergos", "X Ergo vs Ergo"],
  "Backorders Reply": ["backorder", "restock date", "pre order delay"],
  "Influencer requests": ["influencer request", "instagram influencer"],
  "Gamma+ International trade agreements": ["international trade agreement", "international trade agreements", "stop exports"],
  "REPLACEMENT": ["replacement", "waived fee replacement", "send machine replacement"],
  "Fusion new Fader blade": ["Fusion blade", "new Fader blade"],
  "Used products (Not used) / Arrived with Hair": ["used product", "arrived with hair", "hair on clipper"],
  "Questioning the warranty fee": ["questioning warranty fee", "warranty fee question", "$24.95 fee"],
  "Route Package lost": ["Route lost package", "Route package", "Route claim"],
  "Ebay Unverified seller": ["Ebay seller", "unverified seller", "not authorized seller"],
  "Any Item delay (bold)": ["item delay", "shipment delay", "delay shipping"],
  "Xcell dryer shutting off": ["dryer shutting off", "xcell shutting off"],
  "XCell Troubleshoot with explanation": ["xcell troubleshoot", "dryer clean filter", "cold air resolution"],
  "Overstock B2B": ["overstock B2B", "B2B wholesale"],
  "Evo description on Amazon/// guards don’t fit blade": ["evo description", "guards don't fit ultimate"],
  "Why did you send trimmer Guards that don’t fit?": ["guards don't fit blade", "bonus guards"],
  "Hanzo repair requests": ["Hanzo repair", "Hanzo warranty"],
  "Crunchy vs Forged": ["crunchy vs forged", "forged cutter", "crunchy cutter"],
  "“Wrong levers with Rebel”": ["wrong levers", "rebel levers"],
  "Looking for perfetto dryer (GAMA)": ["perfetto dryer", "perfetto gamma"],
  "Troubleshooting Xcell Dryer/PHONE CALL": ["troubleshoot xcell dryer", "dryer phone call"],
  "Xcell Cold Air Fix/WARRANTY FILED": ["xcell cold air fix", "xcell warranty filed"],
  "Do you ship to Ireland?": ["ship to Ireland", "StyleCraft to Ireland"],
  "“LOUD REBEL” Cam follower fix": ["loud rebel", "cam follower", "follower wears down"],
  "Difference between blades Black vs Gold Saber Trimmer": ["saber black vs gold", "black vs gold saber"],
  "Saber Trimmer Guards": ["saber trimmer guards", "saber guards"],
  "Netherlands": ["Netherlands distributor", "barberdepot.nl", "floralehaircare.com"],
  "Prime Nano Sprayer": ["Prime nano sprayer", "sprayer nozzle", "primed pump"],
  "Trimmer Blades Smoking": ["blades smoking", "smoke from trimmer"],
  "Uno Cutter Difference & Not Cutting Very Well": ["uno cutter difference", "uno not cutting"],
  "USB-C NOT Working / Charging": ["USB-C not working", "USB-C not charging"],
  "Cancelation response (PL already created)": ["cancellation response PL", "label already created"],
  "Website Returns": ["website returns", "return website", "stylecraftus return"],
  "Customer wants free items": ["wants free items", "free clippers", "complimentary products"],
  "Military Discount": ["military discount", "veteran discount"],
  "Order ID not found while trying to file claim": ["order ID not found"],
  "Washer Response (Blade moving/shifting)": ["washer response", "blades shifting", "blade moving"],
  "Saber Trimmer Pulling/Cutting": ["Saber trimmer pulling", "Saber trimmer cutting"],
  "Blade Smoking": ["blade smoking", "smoke blade"],
  "Influencer / Affiliate Request": ["influencer request", "affiliate request"],
  "Accept Cookies": ["accept cookies", "cookies checkout"],
  "USB-C Question / using cell phone cables": ["USB-C cell phone cables", "fast chargers battery"],
  "Pre-order but can release from reserve:": ["release from reserve", "pre-order reserve"],
  "Difference Between Regular & Tight Guards": ["regular vs tight guards", "blurrier fades"],
  "Ridges On Blades": ["ridges on blades", "ridges blade"],
  "Blade Cutting Length": ["blade cutting length", "clipper cutting length"],
  "Connect 3 Question": ["Connect 3", "charge 3 devices"],
  "Out of Warranty": ["out of warranty", "warranty expired"],
  "Zero Gapping Info": ["zero gapping", "how to zero gap"],
  "Question about Vector Motor": ["vector motor", "linear vector motor"],
  "Questioning warranty fee": ["questioning warranty fee", "$24.95 fee"],
  "Guard Rattling Troubleshoot": ["guard rattling", "rattling guard"],
  "Trimmer blade cutting/pulling": ["trimmer blade cutting", "trimmer blade pulling"],
  "Shortage Claims B2B": ["shortage claims B2B", "B2B shortage"],
  "Issue RA# B2B": ["issue RA# B2B", "B2B RA"],
  "Issue RA# Bold": ["issue RA# bold", "Bold RA"],
  "Wholesale Inquiry": ["wholesale inquiry", "distributor application"],
  "Rebel Shaver Foils": ["rebel shaver foils", "mesh foil"],
  "Give Away Free Goods": ["give away free goods", "free goods"],
  "Are the guards universal?": ["guards universal", "guards fit wahl"],
  "Are the blades universal?": ["blades universal", "blades fit wahl"],
  "Echo Blade Breaks": ["echo blade breaks", "broken echo blade"],
  "FAKE RECEIPTS ICONIC MEN (GROOMING) CANADA": ["fake receipts", "iconic men", "grooming Canada"],
  "Clipper is loud when opening/closing lever": ["clipper is loud", "loud clipper lever"],
  "NEW DISTRIBUTOR APPLICATION LINK": ["new distributor application link", "distributor application link"],
  "Bracket": ["bracket", "stretch bracket", "tight bracket"],
  "Customer Wants Product Dimensions": ["product dimensions", "technical datasheet"],
  "Warranty Responses": ["warranty responses", "warranty claim response"],
  "Canadian Warehouse for Canada Warranties": ["Canadian warehouse", "Canada warranty address"],
  "Cutting Lengths - Clippers & Lever Positions": ["cutting lengths", "lever positions"],
  "Claim Acceptance Link": ["claim acceptance link", "claim accepted link"],
  "Blade Gets Hot": ["blade gets hot", "blade overheating"],
  "DDP vs DDU": ["DDP vs DDU", "DDP or DDU"],
  "Receive Fake Email for Partnership": ["fake email partnership", "partnership scam"],
  "Twist & Curl Fits": ["twist & curl fits", "twist and curl"],
  "Difference Between Clippers & Trimmers": ["clippers vs trimmers", "clipper vs trimmer"],
  "Machine Heating Up - Internal Notes to Ask Customer": ["machine heating up", "heating up machine"],
  "BOLD ADDRESS": ["bold 3pl", "bold corporate", "boldcorporate.com"],
  "Switch fix - 1 version": ["switch lid", "switch lever piece", "metal conductor switch"],
  "Warranty Responses 2": ["machine successfully repaired", "repaired and shipped back", "warranty team repaired"]
};

/**
 * Uses Gemini or OpenAI to discover every template heading line in an
 * arbitrary reference document, in order -- this is what lets a brand-new
 * document introduce brand-new template categories that ALL_TEMPLATE_KEYWORDS
 * has never heard of, instead of only ever re-syncing the ~112 names already
 * known. The model is only ever asked to locate and copy heading lines
 * verbatim, never to write or paraphrase reply content -- every template's
 * actual body text still comes from slicing the raw document text between
 * these headings, exactly as before, so there is no hallucination risk on
 * the parts an agent or customer will actually read.
 */
async function discoverTemplateHeadings(
  documentText: string,
  geminiKey?: string,
  openaiKey?: string
): Promise<string[] | null> {
  if (!geminiKey && !openaiKey) return null;

  const prompt = `
The document below contains a series of canned customer-support reply templates. Each template consists of a short heading line (its title/category), followed by that template's reply body text (one or more paragraphs).

DOCUMENT:
---
${documentText}
---

Identify EVERY template heading line in this document, in the order they appear. A heading line is short (usually under 15 words), stands alone on its own line, and is followed by reply body text -- it is never itself a full sentence of reply text, a greeting, or an address block line.

Copy each heading EXACTLY as it appears in the document -- character for character, including punctuation, capitalization, and quote marks. Do not paraphrase, summarize, translate, or invent any heading. Do not include any body/reply text.

Return ONLY a JSON object of the shape {"headings": ["...", "...", ...]}, with no markdown formatting.
`;

  try {
    let responseText = '';
    if (geminiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);
      const data = await response.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (openaiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a JSON generator.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) throw new Error(`OpenAI API returned status ${response.status}`);
      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || '';
    }

    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    const headings = Array.isArray(parsed.headings) ? parsed.headings.filter((h: any) => typeof h === 'string' && h.trim()) : null;
    return headings && headings.length > 0 ? headings : null;
  } catch (error) {
    console.error('AI heading discovery failed, falling back to known template list:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { documentId, organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // 1. Read document content -- the document the user actually picked
    // always wins. The hardcoded local text file is only a fallback for the
    // Knowledge page's empty-state "bootstrap" button (which calls this
    // endpoint with no documentId at all); it must never override a real
    // uploaded document's content.
    let extractedText = '';

    if (documentId) {
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (doc) {
        extractedText = doc.content;
      }
    }

    if (!extractedText) {
      const textFilePath = 'C:\\ANTIGRAVITY\\EMAIL AUTOMATION\\scratch\\extracted_text.txt';
      if (fs.existsSync(textFilePath)) {
        extractedText = fs.readFileSync(textFilePath, 'utf-8');
      }
    }

    if (!extractedText) {
      return NextResponse.json({ error: 'No document text found for parsing templates.' }, { status: 400 });
    }

    // 2. Discover which template headings are actually in THIS document.
    // AI discovery goes first so a brand-new document can introduce
    // brand-new template categories -- ALL_TEMPLATE_KEYWORDS only covers
    // names we already knew about, so relying on it alone can re-sync
    // existing templates but can never discover a new one. The model only
    // ever locates/copies heading lines verbatim; body text always comes
    // from slicing the raw document below, never from the AI.
    const settings = await prisma.settings.findUnique({ where: { organizationId } });
    const geminiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
    const openaiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;

    const discoveredHeadings = await discoverTemplateHeadings(extractedText, geminiKey, openaiKey);
    const requestedTemplateTitles = discoveredHeadings || Object.keys(ALL_TEMPLATE_KEYWORDS);

    const lines = extractedText.split(/\r?\n/);
    const headerLocations: { name: string; lineIndex: number }[] = [];

    // Strip quotes AND a trailing period -- reference docs often punctuate
    // headings ("Switch fix - 1 version.") while the stored template name
    // doesn't, which otherwise defeats both the exact-match and
    // substring-fallback checks below.
    const normalize = (s: string) => s.replace(/[“”"']/g, '').replace(/\.$/, '').toLowerCase().trim();

    for (const name of requestedTemplateTitles) {
      const normName = normalize(name);
      let bestIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const normLine = normalize(line);
        if (normLine === normName) {
          bestIdx = i;
          break;
        }
      }

      if (bestIdx === -1) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const normLine = normalize(line);
          if (normLine.length > 5 && normName.includes(normLine)) {
            bestIdx = i;
            break;
          }
        }
      }

      if (bestIdx !== -1) {
        headerLocations.push({ name, lineIndex: bestIdx });
      }
    }

    // Sort locations by lineIndex ascending
    headerLocations.sort((a, b) => a.lineIndex - b.lineIndex);

    let createdTemplatesCount = 0;
    let createdRulesCount = 0;

    for (let i = 0; i < headerLocations.length; i++) {
      const current = headerLocations[i];
      const next = headerLocations[i + 1];
      const startIndex = current.lineIndex + 1;
      const endIndex = next ? next.lineIndex : lines.length;

      const bodyLines = lines.slice(startIndex, endIndex);
      const bodyText = bodyLines.join('\n').trim();

      if (!bodyText) continue;

      // Extract variables/placeholders list
      const variablesList = ['customer_name', 'closing'];
      if (bodyText.includes('[ORDER_NUMBER]')) variablesList.push('order_number');
      if (bodyText.includes('[RMA_NUMBER]')) variablesList.push('rma_number');
      if (bodyText.includes('[RA_NUMBER]')) variablesList.push('ra_number');
      if (bodyText.includes('[PRODUCT_NAME]')) variablesList.push('product_name');
      if (bodyText.includes('[TRACKING_LINK]')) variablesList.push('tracking_link');
      if (bodyText.includes('[SHIPPING_ADDRESS]')) variablesList.push('shipping_address');
      if (bodyText.includes('[SELLER_NAME]')) variablesList.push('seller_name');

      // IMPORTANT: this must stay byte-for-byte the same slug formula every
      // template/rule ID in this app has ever been created with (plain
      // lowercase + non-alphanumeric-to-dash, no quote/period stripping).
      // Changing it would silently orphan every existing row whose name
      // contains punctuation (curly quotes, "?", etc.) -- the upsert would
      // stop matching their id and create a duplicate instead of updating.
      const slugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Create or Update Template record. `keywords` (StructuredKeywords) is
      // what the live matching engine (runKeywordMatcher / matchTemplates in
      // src/lib/keyword-engine.ts) actually reads to suggest/draft a reply --
      // populating it here is what makes a template usable going forward,
      // not just a stored row (Template.variables alone was never enough).
      const templateId = `template-${slugify(current.name)}`;
      const existingTemplate = await prisma.template.findUnique({ where: { id: templateId } });

      const structuredKeywords = extractKeywordsForTemplate(current.name, bodyText);
      const manualPhrases = ALL_TEMPLATE_KEYWORDS[current.name];
      if (manualPhrases) {
        structuredKeywords.primary = Array.from(new Set([...structuredKeywords.primary, ...manualPhrases.map(p => p.toLowerCase())]));
      }
      // Preserve any keywords an agent previously added by hand (the
      // Templates page / "Add Keyword" feedback flow both write into
      // Template.keywords) -- re-analyzing must never silently discard them.
      if (existingTemplate) {
        const previous = parseKeywords(existingTemplate.keywords);
        (Object.keys(structuredKeywords) as (keyof typeof structuredKeywords)[]).forEach(k => {
          structuredKeywords[k] = Array.from(new Set([...structuredKeywords[k], ...previous[k]]));
        });
      }
      const keywordsJson = serializeKeywords(structuredKeywords);
      const template = await prisma.template.upsert({
        where: { id: templateId },
        create: {
          id: templateId,
          name: current.name,
          subject: `Regarding your StyleCraft inquiry: ${current.name}`,
          body: bodyText,
          variables: variablesList.join(','),
          keywords: keywordsJson,
          organizationId
        },
        update: {
          name: current.name,
          body: bodyText,
          variables: variablesList.join(','),
          keywords: keywordsJson
        }
      });
      createdTemplatesCount++;

      // Create or Update Rule matching keywords -- every phrase is checked
      // against BOTH the subject and the body, so a customer who puts the
      // whole question in the subject line still triggers the right
      // template (matches the twin-condition shape used everywhere else,
      // e.g. scripts/add-templates.ts's buildRuleConditions). Falls back to
      // the auto-extracted primary/intent keywords for any name that isn't
      // in the manually-curated map -- i.e. every newly-discovered template
      // still gets a sensible Rule, not just the ~112 previously-known ones.
      const keywords = manualPhrases || Array.from(new Set([...structuredKeywords.primary, ...structuredKeywords.intent])).slice(0, 8);
      const conditionsGroup = {
        logic: 'OR',
        rules: keywords.flatMap(kw => [
          { field: 'subject', operator: 'contains', value: kw },
          { field: 'body', operator: 'contains', value: kw },
        ])
      };

      const action = {
        actionType: 'REPLY_TEMPLATE',
        templateId: template.id,
        status: 'WAITING'
      };

      const ruleId = `rule-${slugify(current.name)}`;
      await prisma.rule.upsert({
        where: { id: ruleId },
        create: {
          id: ruleId,
          name: current.name,
          conditions: JSON.stringify(conditionsGroup),
          actions: JSON.stringify(action),
          active: true,
          organizationId
        },
        update: {
          conditions: JSON.stringify(conditionsGroup),
          actions: JSON.stringify(action),
          active: true
        }
      });
      createdRulesCount++;
    }

    // 3. Add audit log
    await prisma.auditLog.create({
      data: {
        action: 'KNOWLEDGE_ANALYSIS',
        details: `Successfully analyzed responses reference file. Imported ${createdTemplatesCount} templates and generated ${createdRulesCount} rules.`
      }
    });

    return NextResponse.json({
      success: true,
      templatesCount: createdTemplatesCount,
      rulesCount: createdRulesCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
