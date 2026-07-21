import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from './prisma';
import { runAIPipeline } from './ai-pipeline';
import { processAutomationRules } from './rules-engine';
import { upsertCustomerForEmail, checkRecentDuplicateReply } from './customer-service';
import { assignEmailRoundRobin } from './assignment-service';

/**
 * Connects to the live IMAP server using environment configurations,
 * fetches all unseen emails, and processes them through the StyleCraft AI engine.
 */
export async function syncLiveIMAPEmail(inboxId: string): Promise<any> {
  const imapUser = process.env.IMAP_USER;
  const imapPassword = process.env.IMAP_PASSWORD;
  const imapHost = process.env.IMAP_HOST;
  const imapPort = parseInt(process.env.IMAP_PORT || '993', 10);

  if (!imapUser || !imapPassword || !imapHost) {
    throw new Error(
      'Live IMAP connection parameters (IMAP_USER, IMAP_PASSWORD, IMAP_HOST) are missing from your .env file.'
    );
  }

  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
  });

  if (!inbox) throw new Error(`Inbox with ID ${inboxId} not found`);

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: {
      user: imapUser,
      pass: imapPassword,
    },
    logger: false,
  });

  console.log(`Connecting to live IMAP server: ${imapHost}:${imapPort}...`);
  await client.connect();
  
  const lock = await client.getMailboxLock('INBOX');
  let syncedCount = 0;
  const emailsSynced: any[] = [];

  try {
    // Search for unseen messages
    const unseenList = await client.search({ seen: false });
    
    if (unseenList && Array.isArray(unseenList)) {
      console.log(`Found ${unseenList.length} unseen messages on the IMAP server.`);

      for (const seq of unseenList) {
        const message = await client.fetchOne(seq, { source: true, uid: true });
        if (!message || !message.source) continue;

        const parsed = await simpleParser(message.source);
        const senderEmail = parsed.from?.value[0]?.address || 'unknown@sender.com';
        const senderName = parsed.from?.value[0]?.name?.trim() || null;
        const subject = parsed.subject || '(No Subject)';
        const body = parsed.text || '';
        const previewText = body.slice(0, 100) + (body.length > 100 ? '...' : '');

        // 1. Gmail category / Precedence filters (Only pull Primary & Updates)
        const gmailLabels = parsed.headers.get('x-gmail-labels');
        const listId = parsed.headers.get('list-id');
        const listUnsubscribe = parsed.headers.get('list-unsubscribe');
        const precedence = parsed.headers.get('precedence');

        let isPromoOrSocial = false;
        if (gmailLabels) {
          const labelsStr = String(gmailLabels).toLowerCase();
          if (
            labelsStr.includes('promo') ||
            labelsStr.includes('social') ||
            labelsStr.includes('forum') ||
            labelsStr.includes('spam') ||
            labelsStr.includes('trash')
          ) {
            isPromoOrSocial = true;
          }
        }

        if (listId || listUnsubscribe || String(precedence).toLowerCase() === 'bulk') {
          isPromoOrSocial = true;
        }

        if (isPromoOrSocial) {
          // Promotional/social/list mail is never a real customer inquiry --
          // discard it outright instead of importing it into the inbox.
          console.log(`Discarded promotional/social/list email from ${senderEmail}: ${subject}`);
          await client.messageFlagsAdd({ seq }, ['\\Seen']);
          continue;
        }

        // 2. Integration Connection Time Constraint (Only emails received from now onward after connected)
        const emailDate = parsed.date ? new Date(parsed.date) : new Date();
        if (emailDate < inbox.createdAt) {
          console.log(`Skipping old email from ${senderEmail} received before connection: ${parsed.date}`);
          await client.messageFlagsAdd({ seq }, ['\\Seen']);
          continue;
        }

        // Check if email already imported to avoid duplicate loops
        const exists = await prisma.email.findFirst({
          where: {
            sender: senderEmail,
            subject: subject,
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000), // check within the last hour
            },
          },
        });

        if (!exists) {
          // 1. Create the Email record
          const newEmail = await prisma.email.create({
            data: {
              sender: senderEmail,
              recipient: inbox.emailAddress,
              subject: subject,
              body: body,
              preview: previewText,
              status: 'UNREAD',
              gmailCategory: 'primary',
              organizationId: inbox.organizationId,
            },
          });

          // 2. Process with AI Pipeline
          console.log(`Running AI classifications for live email ID ${newEmail.id}...`);
          const aiResult = await runAIPipeline(newEmail.body, newEmail.subject, newEmail.sender, inbox.organizationId, senderName);

          // Spam is never surfaced in the inbox -- discard it outright.
          if (aiResult.spam) {
            await prisma.email.delete({ where: { id: newEmail.id } });
            await prisma.auditLog.create({
              data: {
                action: 'SPAM_DISCARDED',
                details: JSON.stringify({ subject, sender: senderEmail }),
              },
            });
            await client.messageFlagsAdd({ seq }, ['\\Seen']);
            continue;
          }

          // Get template name if matched
          const templates = await prisma.template.findMany({ where: { organizationId: inbox.organizationId } });
          const matchedTmplName = aiResult.matchedTemplateId
            ? (templates.find(t => t.id === aiResult.matchedTemplateId)?.name || 'None')
            : 'None';

          // 2b. Group this email under the sender's customer profile.
          await upsertCustomerForEmail(inbox.organizationId, senderEmail, newEmail.id, senderName);

          // 2c. Duplicate-send prevention: same template already sent to
          // this sender within the last 24h -> force manual review.
          const isRecentDuplicate = await checkRecentDuplicateReply(inbox.organizationId, senderEmail, aiResult.matchedTemplateId ?? null);

          // 3. Update Email details in DB with new logging/matching fields
          // If confidence is >= 85%, status is UNREAD. Otherwise WAITING (Manual Review Queue)
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

          // 4b. Round-robin assign to whichever support agent has the fewest open emails right now.
          await assignEmailRoundRobin(inbox.organizationId, processedEmail.id);

          // 5. Create structured audit log record
          const isManualReview = aiResult.aiConfidence < 0.85;
          await prisma.auditLog.create({
            data: {
              action: isManualReview ? 'MANUAL_REVIEW_NEEDED' : 'AUTO_DRAFT_CREATED',
              details: JSON.stringify({
                subject: subject,
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

          // Option to mark message as read in IMAP mailbox:
          await client.messageFlagsAdd({ seq }, ['\\Seen']);

          emailsSynced.push(processedEmail);
          syncedCount++;
        }
      }
    } else {
      console.log('No unseen messages found on the IMAP server.');
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return {
    syncedCount,
    emails: emailsSynced,
  };
}
