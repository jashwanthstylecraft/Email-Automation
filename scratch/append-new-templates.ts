// One-shot helper: appends the 9 new category templates to
// scratch/parsed_templates.json (the canonical template source that
// scripts/reseed-templates.ts seeds from). Skips names that already exist.
import fs from 'fs';
import path from 'path';

export const NEW_TEMPLATES = [
  {
    name: 'Order Status / Tracking Request',
    body: 'Thank you for reaching out about your order. I have checked on the status of order [ORDER_NUMBER] for you. Your order has been processed and I have attached a link to your tracking below so you can follow the delivery.\n\nTracking: [TRACKING_LINK]\n\nPlease allow 24-48 hours for the tracking to update after a label is created. If you do not see any movement after that time, let us know and we will be happy to look into it further. Have a great day!',
  },
  {
    name: 'Where Is My Refund',
    body: 'Thank you for reaching out. Your refund has been processed on our end. Please allow 3-5 business days for the transaction to reflect on your original payment method, depending on your bank.\n\nIf you do not see the refund after 5 business days, please reply with your order number [ORDER_NUMBER] and the last 4 digits of the card used, and we will provide the refund transaction reference for your bank. Have a great day!',
  },
  {
    name: 'Wrong Item Received',
    body: 'We are so sorry about that! It looks like you received the wrong item with your order. We will get the correct item shipped out to you right away.\n\nPlease reply with a photo of the item you received and your order number [ORDER_NUMBER] so we can document the mix-up with our warehouse. There is no need to return the incorrect item unless we specifically request it. We apologize for the inconvenience and appreciate your patience. Have a great day!',
  },
  {
    name: 'Warranty Claim Status Follow-Up',
    body: 'Thank you for following up on your warranty claim. We have received your claim and it is currently being processed by our warranty team.\n\nOnce your device arrives at our facility, please allow 7-10 business days for inspection and repair or replacement. You will receive a confirmation email with tracking as soon as your replacement or repaired unit ships. Please make sure your RMA# is included inside or on the package so it can be identified. If you have any other questions in the meantime, we are happy to help. Have a great day!',
  },
  {
    name: 'Product Recommendation / Which Model Should I Buy',
    body: 'Thank you for your interest in our products! The right tool depends on how you plan to use it: clippers are designed for bulk cutting and fading with guards, while trimmers are made for lining, edging, and detail work.\n\nFor an all-around professional clipper we recommend the Instinct or the Ergo series, and for crisp line work the Saber trimmer is our most popular choice. You can compare all models and their features here:\nhttps://stylecraftus.com/collections/all\n\nIf you tell us a little more about how you plan to use the tool (home use or professional, fading, lining, or full cuts), we would be happy to give you a specific recommendation. Have a great day!',
  },
  {
    name: 'Clipper Maintenance & Oiling',
    body: 'Thank you for reaching out. Regular maintenance will keep your clipper running like new. We recommend the following routine:\n\n1. Brush hair and debris off the blade after every use.\n2. Apply 2-3 drops of clipper oil across the blade teeth and one drop on each side rail, then run the clipper for a few seconds so the oil spreads evenly. Do this daily with regular use.\n3. Wipe away excess oil with a clean cloth.\n4. Avoid submerging the clipper or blade in water or spray disinfectant directly into the motor housing.\n\nKeeping the blade oiled prevents heat, pulling, and premature wear. If your blade is still underperforming after a proper cleaning and oiling, let us know and we will be happy to troubleshoot further. Have a great day!',
  },
  {
    name: 'Replacement Parts Purchase',
    body: 'Thank you for reaching out. Replacement blades, cutters, levers, chargers, and other parts for your unit are available directly on our website here:\n\nhttps://stylecraftus.com/collections/replacement-parts\n\nIf you do not see the specific part you need listed, please reply with your model name and the part you are looking for, and we will check availability for you. Have a great day!',
  },
  {
    name: 'Discount Code Not Working',
    body: 'We are sorry you are having trouble applying your discount code at checkout. Please note that discount codes cannot be combined with other promotions, may exclude new releases and pre-order items, and are case sensitive.\n\nPlease try entering the code exactly as it was provided, with no extra spaces, at the checkout discount field. If it still does not apply, reply with a screenshot of the error and the items in your cart, and we will make it right. Have a great day!',
  },
  {
    name: 'General Inquiry Acknowledgment',
    body: 'Thank you for contacting StyleCraft US. We have received your inquiry and a member of our customer service team is reviewing it now. We typically respond within one business day.\n\nIn the meantime, you may find an instant answer in our FAQ at https://stylecraftus.com/pages/faq. We appreciate your patience and will follow up with you shortly. Have a great day!',
  },
];

const file = path.resolve(process.cwd(), 'scratch', 'parsed_templates.json');
const list: { name: string; body: string }[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
const existing = new Set(list.map(t => t.name));
let added = 0;
for (const t of NEW_TEMPLATES) {
  if (!existing.has(t.name)) {
    list.push(t);
    added++;
  }
}
fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
console.log(`Added ${added} new templates. Total now: ${list.length}`);
