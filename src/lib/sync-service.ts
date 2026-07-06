import { prisma } from './prisma';
import { runAIPipeline } from './ai-pipeline';
import { upsertCustomerForEmail, checkRecentDuplicateReply } from './customer-service';
import { assignEmailRoundRobin } from './assignment-service';

const MOCK_INCOMING_TEMPLATES = [
  {
    sender: 'david.miller@yahoo.com',
    subject: 'Warranty status check',
    body: 'Hi, my hair clipper is over 1 year old and the warranty is expired, can you help me repair it?',
  },
  {
    sender: 'lisa.customer@gmail.com',
    subject: 'Switch not working on clipper',
    body: 'Hello, my clipper switch is not working and won\'t turn on. Is there an easy fix for this?',
  },
  {
    sender: 'spammer_deal@deals-today.net',
    subject: '!!! AMAZING OFFERS ON VIAGRA AND CRYPTO INVESTMENTS !!!',
    body: 'Get replica luxury items for 90% off! Turn $100 into $10,000 using our patented crypto arbitrage software. Join now at spamdeals-phishing.com!',
  },
  {
    sender: 'robert.barber@corporation.com',
    subject: 'Clipper blade gets hot',
    body: 'Hi StyleCraft, my clipper blade gets hot after using it for a couple of minutes. It is overheating a lot. How do I fix it?',
  },
  {
    sender: 'helen.return@gmail.com',
    subject: 'Need return authorization',
    body: 'I would like to return my purchase for a refund. Can you send me the return authorization instructions?',
  },
  {
    sender: 'route.insurance@gmail.com',
    subject: 'Lost package Route insurance',
    body: 'My shipment is delivered but not received. I think it is a lost package. I paid for Route insurance, how can I file a claim?',
  },
  {
    sender: 'frustrated-client@gmail.com',
    subject: 'Xcell dryer blowing cold',
    body: 'My Xcell dryer is blowing cold air. The dryer is not hot anymore. What is the cold air fix?',
  },
  {
    sender: 'influencer.collab@instagram.com',
    subject: 'Influencer collab opportunity',
    body: 'Hello StyleCraft support, I am an influencer and want to do a collab or affiliate program with your brand. Let me know if you are interested!',
  },
  {
    sender: 'distributor.inquiry@wholesale.com',
    subject: 'Wholesale distributor request',
    body: 'I would like to become a wholesale dealer and distributor for StyleCraft products. Can you send me the distributor application?',
  }
];

/**
 * Emulates the arrival of a new email into an inbox, runs the AI processing pipeline,
 * and executes any matching automation rules.
 */
export async function syncNewMockEmail(inboxId: string): Promise<any> {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
  });

  if (!inbox) throw new Error(`Inbox with ID ${inboxId} not found`);

  // Pick a random template
  const template = MOCK_INCOMING_TEMPLATES[Math.floor(Math.random() * MOCK_INCOMING_TEMPLATES.length)];

  // Randomize sender slightly to prevent unique constraint or duplicate rules unless intended
  const randomSuffix = Math.floor(Math.random() * 1000);
  const senderParts = template.sender.split('@');
  const senderEmail = `${senderParts[0]}+${randomSuffix}@${senderParts[1]}`;

  const previewText = template.body.slice(0, 100) + (template.body.length > 100 ? '...' : '');

  // 1. Create the Email record in the DB (default status UNREAD)
  const newEmail = await prisma.email.create({
    data: {
      sender: senderEmail,
      recipient: inbox.emailAddress,
      subject: template.subject,
      body: template.body,
      preview: previewText,
      status: 'UNREAD',
      organizationId: inbox.organizationId,
    },
  });

  // 2. Run AI processing pipeline
  console.log(`Processing new email ${newEmail.id} with AI...`);
  const aiResult = await runAIPipeline(newEmail.body, newEmail.subject, newEmail.sender, inbox.organizationId);

  // Spam is never surfaced in the inbox -- discard it outright rather than
  // storing it with a SPAM status the UI has to filter around.
  if (aiResult.spam) {
    await prisma.email.delete({ where: { id: newEmail.id } });
    await prisma.auditLog.create({
      data: {
        action: 'SPAM_DISCARDED',
        details: JSON.stringify({ subject: template.subject, sender: senderEmail }),
      },
    });
    return { email: null, skipped: true, reason: 'spam' };
  }

  // Get templates list to resolve matched template name
  const templates = await prisma.template.findMany({ where: { organizationId: inbox.organizationId } });
  const matchedTmplName = aiResult.matchedTemplateId
    ? (templates.find(t => t.id === aiResult.matchedTemplateId)?.name || 'None')
    : 'None';

  // 2b. Group this email under the sender's customer profile.
  await upsertCustomerForEmail(inbox.organizationId, senderEmail, newEmail.id);

  // 2c. Duplicate-send prevention: if this exact template was already sent
  // to this sender within the last 24h, force manual review instead of
  // silently auto-sending the same canned response again.
  const isRecentDuplicate = await checkRecentDuplicateReply(inbox.organizationId, senderEmail, aiResult.matchedTemplateId ?? null);

  // 3. Update the Email record with AI classifications
  const finalStatus = isRecentDuplicate
    ? 'WAITING'
    : (aiResult.aiConfidence >= 0.85 ? 'UNREAD' : 'WAITING');

  const processedEmail = await prisma.email.update({
    where: { id: newEmail.id },
    data: {
      language: aiResult.language,
      category: aiResult.category,
      sentiment: aiResult.sentiment,
      urgency: aiResult.urgency,
      priority: aiResult.priority,
      aiConfidence: aiResult.aiConfidence,
      spam: false,
      duplicate: aiResult.duplicate,
      summary: isRecentDuplicate
        ? `⚠️ Similar reply already sent to this customer within 24h. ${aiResult.summary || ''}`.trim()
        : (aiResult.summary || 'None'),
      matchedTemplateId: aiResult.matchedTemplateId,
      aiProvider: aiResult.aiProvider,
      status: finalStatus,
    },
  });

  // 4. Save generated AI reply draft
  const hasDraft = !!aiResult.draftReply;
  if (hasDraft) {
    await prisma.autoReply.create({
      data: {
        emailId: processedEmail.id,
        status: 'DRAFT',
        responseBody: aiResult.draftReply!,
        originalDraftBody: aiResult.draftReply!,
      },
    });
  }

  // 4b. Round-robin assign to whichever active support agent has the fewest open emails right now.
  await assignEmailRoundRobin(inbox.organizationId, processedEmail.id);

  // 5. Create structured audit log record
  const isManualReview = aiResult.aiConfidence < 0.85;
  await prisma.auditLog.create({
    data: {
      action: isManualReview ? 'MANUAL_REVIEW_NEEDED' : 'AUTO_DRAFT_CREATED',
      details: JSON.stringify({
        subject: template.subject,
        sender: senderEmail,
        category: aiResult.category,
        matchedKeyword: aiResult.summary || 'None',
        matchedTemplate: matchedTmplName,
        confidenceScore: aiResult.aiConfidence,
        draftCreated: hasDraft,
        autoSend: false,
        manualReview: isManualReview,
        aiProvider: aiResult.aiProvider || 'None',
      }),
    },
  });

  // Re-fetch email to get latest status after sync
  const finalEmail = await prisma.email.findUnique({
    where: { id: processedEmail.id },
    include: { autoReplies: true },
  });

  return {
    email: finalEmail,
    aiAnalysis: aiResult,
    ruleApplied: 'Applied template routing rules',
  };
}
