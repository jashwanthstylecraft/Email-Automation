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

function check() {
  const textFilePath = path.resolve(process.cwd(), 'scratch', 'extracted_text.txt');
  if (!fs.existsSync(textFilePath)) {
    console.error('File not found:', textFilePath);
    return;
  }
  const text = fs.readFileSync(textFilePath, 'utf-8');
  const lines = text.split('\n').map(l => l.trim());

  console.log(`Total requested templates: ${requested.length}`);
  
  const found: string[] = [];
  const missing: string[] = [];

  for (const name of requested) {
    // try exact match or close match in text
    let matched = false;
    // Normalize quotes for matching
    const normalizedName = name.replace(/[“”"']/g, '').toLowerCase().trim();

    for (const line of lines) {
      const normalizedLine = line.replace(/[“”"']/g, '').toLowerCase().trim();
      if (normalizedLine === normalizedName || (normalizedLine.length > 5 && normalizedName.includes(normalizedLine)) || (normalizedName.length > 5 && normalizedLine.includes(normalizedName))) {
        matched = true;
        break;
      }
    }

    if (matched) {
      found.push(name);
    } else {
      missing.push(name);
    }
  }

  console.log(`Found templates: ${found.length}`);
  console.log(`Missing templates: ${missing.length}`);
  if (missing.length > 0) {
    console.log('Missing names list:', missing);
  }
}

check();
