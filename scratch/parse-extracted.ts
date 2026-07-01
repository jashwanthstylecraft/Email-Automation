import fs from 'fs';
import path from 'path';

const requested = [
  "NOT Paying Warranty Fee / Their Own Label",
  "“Register” for Warranty",
  "Exceeded / Expired Warranty",
  "Returns",
  "Exceed Return Period",
  "Problem with screws or blades",
  "Instinct Battery Life",
  "Missing spare cutters (ZERO GAMMA+)",
  "Missing package",
  "Return Authorization Amazon",
  "Lost package more than twice",
  "Broken Product",
  "Start new claim",
  "SCREW ON LEVER",
  "Blade Temperature",
  "Difference between Evo and Hitter",
  "Chargers",
  "Plug Converter / Adapter",
  "Cancelled order",
  "Gamma - Do you ship out of the country?",
  "Says “In stock” but says it will ship later??",
  "Switch fix - 2 versions",
  "SENDING DISTRIBUTORS TO SC OUT OF US",
  "Order Shipped / Cannot Make Changes",
  "“2 DAY SHIPPING”",
  "Ergo VS X Ergos",
  "Backorders Reply",
  "Influencer requests",
  "Gamma+ International trade agreements",
  "REPLACEMENT",
  "Fusion new Fader blade",
  "Used products (Not used) / Arrived with Hair",
  "Questioning the warranty fee",
  "Route Package lost",
  "Ebay Unverified seller",
  "Any Item delay (bold)",
  "Xcell dryer shutting off",
  "XCell Troubleshoot with explanation",
  "Overstock B2B",
  "Evo description on Amazon/// guards don’t fit blade",
  "Why did you send trimmer Guards that don’t fit?",
  "Hanzo repair requests",
  "Crunchy vs Forged",
  "“Wrong levers with Rebel”",
  "Looking for perfetto dryer (GAMA)",
  "Troubleshooting Xcell Dryer/PHONE CALL",
  "Xcell Cold Air Fix/WARRANTY FILED",
  "Do you ship to Ireland?",
  "“LOUD REBEL” Cam follower fix",
  "Difference between blades Black vs Gold Saber Trimmer",
  "Saber Trimmer Guards",
  "Netherlands",
  "Prime Nano Sprayer",
  "Trimmer Blades Smoking",
  "Uno Cutter Difference & Not Cutting Very Well",
  "USB-C NOT Working / Charging",
  "Cancelation response (PL already created)",
  "Website Returns",
  "Customer wants free items",
  "Military Discount",
  "Order ID not found while trying to file claim",
  "Washer Response (Blade moving/shifting)",
  "Saber Trimmer Pulling/Cutting",
  "Blade Smoking",
  "Influencer / Affiliate Request",
  "Accept Cookies",
  "USB-C Question / using cell phone cables",
  "Pre-order but can release from reserve:",
  "Difference Between Regular & Tight Guards",
  "Ridges On Blades",
  "Blade Cutting Length",
  "Connect 3 Question",
  "Out of Warranty",
  "Zero Gapping Info",
  "Question about Vector Motor",
  "Questioning warranty fee",
  "Guard Rattling Troubleshoot",
  "Trimmer blade cutting/pulling",
  "Shortage Claims B2B",
  "Issue RA# B2B",
  "Issue RA# Bold",
  "Wholesale Inquiry",
  "Rebel Shaver Foils",
  "Give Away Free Goods",
  "Are the guards universal?",
  "Are the blades universal?",
  "Echo Blade Breaks",
  "FAKE RECEIPTS ICONIC MEN (GROOMING) CANADA",
  "Clipper is loud when opening/closing lever",
  "NEW DISTRIBUTOR APPLICATION LINK",
  "Bracket",
  "Customer Wants Product Dimensions",
  "Warranty Responses",
  "Canadian Warehouse for Canada Warranties",
  "Cutting Lengths - Clippers & Lever Positions",
  "Claim Acceptance Link",
  "Blade Gets Hot",
  "DDP vs DDU",
  "Receive Fake Email for Partnership",
  "Twist & Curl Fits",
  "Difference Between Clippers & Trimmers",
  "Machine Heating Up - Internal Notes to Ask Customer"
];

function parse() {
  const textFilePath = path.resolve(process.cwd(), 'scratch', 'extracted_text.txt');
  const text = fs.readFileSync(textFilePath, 'utf-8');
  const lines = text.split(/\r?\n/);

  // We want to find the exact line index for each header.
  // Since headers can be matched by normalized name, let's locate them.
  const headerLocations: { name: string; lineIndex: number }[] = [];

  for (const name of requested) {
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
    // If not exact match, try contains match
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
    } else {
      console.log(`Could not locate index for: ${name}`);
    }
  }

  // Sort locations by lineIndex asc
  headerLocations.sort((a, b) => a.lineIndex - b.lineIndex);

  console.log(`Located ${headerLocations.length} headers.`);

  // Now extract the body text for each header.
  // The body is the text between this header and the next header.
  const templates: { name: string; body: string }[] = [];

  for (let i = 0; i < headerLocations.length; i++) {
    const current = headerLocations[i];
    const next = headerLocations[i + 1];
    const startIndex = current.lineIndex + 1;
    const endIndex = next ? next.lineIndex : lines.length;

    const bodyLines = lines.slice(startIndex, endIndex);
    const body = bodyLines.join('\n').trim();
    templates.push({ name: current.name, body });
  }

  console.log(`Extracted ${templates.length} templates.`);
  
  // Let's verify a few
  console.log('--- Sample 1: ' + templates[0].name);
  console.log(templates[0].body.slice(0, 200) + '...');
  
  console.log('--- Sample 2: ' + templates[1].name);
  console.log(templates[1].body.slice(0, 200) + '...');

  console.log('--- Sample 3: ' + templates[templates.length - 1].name);
  console.log(templates[templates.length - 1].body.slice(0, 200) + '...');

  // Save the structured templates to a json file in scratch
  fs.writeFileSync(path.resolve(process.cwd(), 'scratch', 'parsed_templates.json'), JSON.stringify(templates, null, 2));
  console.log('Saved to parsed_templates.json');
}

parse();
