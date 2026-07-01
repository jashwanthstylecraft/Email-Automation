import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

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
  "Machine Heating Up - Internal Notes to Ask Customer": ["machine heating up", "heating up machine"]
};

export async function POST(request: Request) {
  try {
    const { documentId, organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // 1. Read document content from disk or database
    let extractedText = '';
    const textFilePath = 'C:\\ANTIGRAVITY\\EMAIL AUTOMATION\\scratch\\extracted_text.txt';
    if (fs.existsSync(textFilePath)) {
      extractedText = fs.readFileSync(textFilePath, 'utf-8');
    }

    if (!extractedText && documentId) {
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (doc) {
        extractedText = doc.content;
      }
    }

    if (!extractedText) {
      return NextResponse.json({ error: 'No document text found for parsing templates.' }, { status: 400 });
    }

    // 2. Parse 102 templates deterministically based on exact line matching
    const lines = extractedText.split(/\r?\n/);
    const requestedTemplateTitles = Object.keys(ALL_TEMPLATE_KEYWORDS);
    const headerLocations: { name: string; lineIndex: number }[] = [];

    for (const name of requestedTemplateTitles) {
      const normName = name.replace(/[“”"']/g, '').toLowerCase().trim();
      let bestIdx = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const normLine = line.replace(/[“”"']/g, '').toLowerCase().trim();
        if (normLine === normName) {
          bestIdx = i;
          break;
        }
      }

      if (bestIdx === -1) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const normLine = line.replace(/[“”"']/g, '').toLowerCase().trim();
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

      // Create or Update Template record
      const templateId = `template-${current.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const template = await prisma.template.upsert({
        where: { id: templateId },
        create: {
          id: templateId,
          name: current.name,
          subject: `Regarding your StyleCraft inquiry: ${current.name}`,
          body: bodyText,
          variables: variablesList.join(','),
          organizationId
        },
        update: {
          name: current.name,
          body: bodyText,
          variables: variablesList.join(',')
        }
      });
      createdTemplatesCount++;

      // Create or Update Rule matching keywords
      const keywords = ALL_TEMPLATE_KEYWORDS[current.name] || [current.name.toLowerCase()];
      const conditionsGroup = {
        logic: 'OR',
        rules: keywords.map(kw => ({
          field: 'body',
          operator: 'contains',
          value: kw
        }))
      };

      const action = {
        actionType: 'REPLY_TEMPLATE',
        templateId: template.id,
        status: 'WAITING'
      };

      const ruleId = `rule-${current.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
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
