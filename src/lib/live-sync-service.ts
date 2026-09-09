import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from './prisma';
import { runAIPipelineBatch } from './ai-pipeline';
import { upsertCustomerForEmail, checkRecentDuplicateReply } from './customer-service';

// The connected mailbox is now a real, direct-to-customer support inbox
// (previously a personal Gmail account fed only by two reps forwarding
// contact-form mail -- that arrangement, and its sender allow-list, no
// longer applies).

// A freshly-connected real mailbox can carry a huge historical backlog of
// unseen mail (seen in practice: 280k+ unseen on a live account) -- looping
// through all of it one message at a time would take hours and blow well
// past any serverless function's execution limit. Two independent caps
// keep every sync pass fast and bounded:
//  - SYNC_LOOKBACK_MONTHS: anything older is never looked at, permanently
//    (the IMAP search itself excludes it -- zero cost).
//  - MAX_MESSAGES_PER_SYNC: even within that window, only this many of the
//    newest unseen messages are processed per pass; the rest stay unseen
//    and get picked up on subsequent runs, draining newest-first.
const SYNC_LOOKBACK_MONTHS = 3;
const MAX_MESSAGES_PER_SYNC = 40;

// A real, direct-to-customer mailbox also carries traffic that's never a
// support ticket: staff emailing each other, and automated system/vendor
// senders (bounces, payment-receipt senders, notification relays). Real
// customers essentially never email from the mailbox's own domain, so that
// plus a set of common automated-sender local-part patterns catches the
// bulk of it without needing a hand-maintained sender blocklist. This is a
// heuristic, not exhaustive -- occasional stray marketing mail from a
// human-named address on an unrelated domain can still get through.
const AUTOMATED_SENDER_LOCAL_PARTS = [
  'mailer-daemon', 'postmaster', 'no-reply', 'noreply', 'donotreply', 'do-not-reply',
  'notification', 'notifications', 'bounce', 'bounces', 'mailer', 'outgoing', 'events',
];

// Attachments (images/PDFs/docs) are stored inline as base64 data URIs --
// there's no cloud object storage in this deployment, and the DB is the
// only persistence available. Capped per-file and per-email so one email
// with a handful of large files can't bloat a single row without bound;
// an oversized file is still listed (filename/size) but its content isn't
// stored.
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_ATTACHMENTS_PER_EMAIL = 10;

interface StoredAttachment {
  filename: string;
  contentType: string;
  size: number;
  dataUrl: string | null; // null when skipped for being over MAX_ATTACHMENT_BYTES
}

function extractAttachments(parsed: { attachments?: { filename?: string; contentType: string; size: number; content: Buffer }[] }): StoredAttachment[] {
  const raw = parsed.attachments || [];
  return raw.slice(0, MAX_ATTACHMENTS_PER_EMAIL).map((a) => ({
    filename: a.filename || 'attachment',
    contentType: a.contentType || 'application/octet-stream',
    size: a.size,
    dataUrl: a.size <= MAX_ATTACHMENT_BYTES ? `data:${a.contentType};base64,${a.content.toString('base64')}` : null,
  }));
}

// Strips a leading "Re:"/"Fwd:"/"Fw:" (repeated, case-insensitive) so
// "Order #123", "Re: Order #123", and "Re: Re: Fwd: Order #123" all
// compare equal -- used to detect a message that's really a continuation
// of an already-open thread rather than a brand new conversation.
function normalizeSubjectForThreading(subject: string): string {
  let s = subject.trim();
  while (/^(re|fwd|fw)\s*:\s*/i.test(s)) {
    s = s.replace(/^(re|fwd|fw)\s*:\s*/i, '').trim();
  }
  return s.toLowerCase();
}

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

  const internalDomain = imapUser.split('@')[1]?.toLowerCase() || null;

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
    // Search for unseen messages, bounded to the last SYNC_LOOKBACK_MONTHS --
    // a real mailbox can carry a huge unseen backlog, and anything older
    // than this is never worth surfacing as a "new" support request anyway.
    const lookbackCutoff = new Date();
    lookbackCutoff.setMonth(lookbackCutoff.getMonth() - SYNC_LOOKBACK_MONTHS);
    const unseenInWindow = await client.search({ seen: false, since: lookbackCutoff });

    if (unseenInWindow && Array.isArray(unseenInWindow)) {
      // Sequence numbers increase with mailbox position, i.e. newest last --
      // sort descending and cap so each pass processes the newest handful
      // first; anything past the cap stays unseen and is picked up (still
      // newest-first) on the next sync run instead of all at once.
      const unseenList = [...unseenInWindow].sort((a, b) => b - a).slice(0, MAX_MESSAGES_PER_SYNC);
      console.log(`Found ${unseenInWindow.length} unseen message(s) within the last ${SYNC_LOOKBACK_MONTHS} month(s); processing the newest ${unseenList.length} this pass.`);

      // Pass 1: fetch/parse/filter every unseen message and create its Email
      // row (unchanged from before), but don't classify yet -- collect them
      // so every email that needs a fresh AI reply (no template match) can
      // be sent to OpenAI in ONE batched call instead of one call each.
      const pending: { seq: number; newEmail: Awaited<ReturnType<typeof prisma.email.create>>; senderEmail: string; senderName: string | null; subject: string }[] = [];

      for (const seq of unseenList) {
        const message = await client.fetchOne(seq, { source: true, uid: true, internalDate: true });
        if (!message || !message.source) continue;

        const parsed = await simpleParser(message.source);
        const senderEmail = parsed.from?.value[0]?.address || 'unknown@sender.com';
        const senderName = parsed.from?.value[0]?.name?.trim() || null;
        const subject = parsed.subject || '(No Subject)';
        const body = parsed.text || '';
        const previewText = body.slice(0, 100) + (body.length > 100 ? '...' : '');
        const messageId = parsed.messageId || null;
        const ccAddresses = parsed.cc
          ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap((c) => c.value.map((v) => v.address)).filter(Boolean).join(', ')
          : null;
        const attachmentsJson = JSON.stringify(extractAttachments(parsed));

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

        // 1b. Internal staff / automated system & vendor senders -- see the
        // AUTOMATED_SENDER_LOCAL_PARTS comment above. Neither is ever a
        // genuine customer support request, but rather than silently
        // discarding them (nothing to review if the heuristic is wrong),
        // they're imported tagged businessType 'INTERNAL' -- filtered out of
        // the default B2C/B2B/ALL views, but still visible under their own
        // "Internal" tab. Skips AI classification entirely below since
        // there's nothing to classify.
        const senderLower = senderEmail.toLowerCase();
        const senderDomain = senderLower.split('@')[1] || '';
        const senderLocalPart = senderLower.split('@')[0] || '';
        const isInternalOrAutomated =
          (internalDomain && senderDomain === internalDomain) ||
          AUTOMATED_SENDER_LOCAL_PARTS.some((p) => senderLocalPart === p || senderLocalPart.startsWith(`${p}-`) || senderLocalPart.startsWith(`${p}.`));

        // 2. Integration Connection Time Constraint (Only emails received from now onward after connected)
        // Prefer the IMAP server's own INTERNALDATE (when the message actually
        // landed in this mailbox) over the message's own Date: header --
        // that header is written by the sender's mail client, so a few
        // minutes of clock skew on their end shows up as a mismatch against
        // what the real mailbox (e.g. Gmail's own web UI) displays, which
        // uses the server-received time.
        const emailDate = message.internalDate
          ? new Date(message.internalDate)
          : (parsed.date ? new Date(parsed.date) : new Date());
        if (emailDate < inbox.createdAt) {
          console.log(`Skipping old email from ${senderEmail} received before connection: ${parsed.date}`);
          await client.messageFlagsAdd({ seq }, ['\\Seen']);
          continue;
        }

        // Check if this exact message was already imported (e.g. a repeated
        // sync pass before IMAP's \Seen flag propagated). Keyed on the
        // message's own globally-unique Message-ID, NOT sender+subject+time --
        // that older heuristic silently discarded a customer's genuine
        // follow-up reply whenever it reused the same subject line within an
        // hour (e.g. any "Re: <original subject>"), which is extremely common
        // and was actively losing real customer messages. A message without
        // a Message-ID (rare, but technically legal) falls back to a short
        // 2-minute sender+subject window, tight enough to catch an accidental
        // re-fetch of the same message without blocking a real follow-up.
        const exists = messageId
          ? await prisma.email.findFirst({ where: { organizationId: inbox.organizationId, externalId: messageId } })
          : await prisma.email.findFirst({
              where: {
                sender: senderEmail,
                subject: subject,
                createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
              },
            });

        if (!exists) {
          // Same sender still emailing about the same subject (any amount of
          // Re:/Fwd: nesting) while the last message on it is still
          // unresolved -- e.g. an automated notification getting re-sent, or
          // a customer following up before anyone answered. Refresh the
          // existing row to this newer content instead of spawning a
          // separate item that would otherwise get its own independent
          // AI-drafted reply for what's really the same open conversation.
          let threadMatch: { id: string } | null = null;
          if (!isInternalOrAutomated) {
            const openFromSameSender = await prisma.email.findMany({
              where: {
                organizationId: inbox.organizationId,
                sender: senderEmail,
                status: { in: ['UNREAD', 'WAITING'] },
              },
              select: { id: true, subject: true },
            });
            const normalizedNew = normalizeSubjectForThreading(subject);
            threadMatch = openFromSameSender.find((c) => normalizeSubjectForThreading(c.subject) === normalizedNew) || null;
          }

          let newEmail;
          if (threadMatch) {
            await prisma.autoReply.deleteMany({ where: { emailId: threadMatch.id, status: 'DRAFT' } });
            newEmail = await prisma.email.update({
              where: { id: threadMatch.id },
              data: {
                externalId: messageId,
                subject,
                body,
                preview: previewText,
                cc: ccAddresses,
                attachments: attachmentsJson,
                createdAt: emailDate,
                isRead: false,
              },
            });
            console.log(`Consolidated into existing open thread from ${senderEmail}: ${subject}`);
          } else {
            newEmail = await prisma.email.create({
              data: {
                externalId: messageId,
                sender: senderEmail,
                recipient: inbox.emailAddress,
                cc: ccAddresses,
                subject: subject,
                body: body,
                preview: previewText,
                attachments: attachmentsJson,
                status: isInternalOrAutomated ? 'WAITING' : 'UNREAD',
                businessType: isInternalOrAutomated ? 'INTERNAL' : undefined,
                gmailCategory: 'primary',
                organizationId: inbox.organizationId,
                createdAt: emailDate,
              },
            });
          }

          if (isInternalOrAutomated) {
            console.log(`Tagged internal/automated sender ${senderEmail} as INTERNAL: ${subject}`);
            await client.messageFlagsAdd({ seq }, ['\\Seen']);
            emailsSynced.push(newEmail);
            syncedCount++;
          } else {
            pending.push({ seq, newEmail, senderEmail, senderName, subject });
          }
        }
      }

      // Pass 2: classify + template-match every pending email (all free),
      // batching whichever ones matched no template into a single OpenAI call.
      if (pending.length > 0) {
        console.log(`Running AI classification for ${pending.length} live email(s)...`);
        const aiResults = await runAIPipelineBatch(
          pending.map(p => ({
            body: p.newEmail.body,
            subject: p.newEmail.subject,
            sender: p.newEmail.sender,
            organizationId: inbox.organizationId,
            parsedSenderName: p.senderName,
          }))
        );

        // Pass 3: same per-email side effects as before, using each email's
        // corresponding (already-computed) aiResult.
        for (let i = 0; i < pending.length; i++) {
          const { seq, newEmail, senderEmail, senderName, subject } = pending[i];
          const aiResult = aiResults[i];

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

          // Group this email under the sender's customer profile.
          await upsertCustomerForEmail(inbox.organizationId, senderEmail, newEmail.id, senderName);

          // Duplicate-send prevention: same template already sent to this
          // sender within the last 24h -> force manual review.
          const isRecentDuplicate = await checkRecentDuplicateReply(inbox.organizationId, senderEmail, aiResult.matchedTemplateId ?? null);

          // Update Email details in DB with new logging/matching fields.
          // If confidence is >= 85%, status is UNREAD. Otherwise WAITING (Manual Review Queue)
          const finalStatus = isRecentDuplicate
            ? 'WAITING'
            : (aiResult.aiConfidence >= 0.85 ? 'UNREAD' : 'WAITING');

          const processedEmail = await prisma.email.update({
            where: { id: newEmail.id },
            data: {
              language: aiResult.language,
              category: aiResult.category,
              businessType: aiResult.businessType,
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

          // Save generated reply draft
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

          // Emails arrive unassigned -- claimed by whichever agent opens
          // them first (see GET handler in api/inbox/[id]/route.ts), not
          // auto-assigned here.

          // Create structured audit log record
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
      console.log(`No unseen messages found within the last ${SYNC_LOOKBACK_MONTHS} month(s).`);
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
