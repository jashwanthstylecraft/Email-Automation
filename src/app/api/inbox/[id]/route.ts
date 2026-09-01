import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOutgoingMail } from '@/lib/mail-sender';
import { parseKeywords, serializeKeywords } from '@/lib/keyword-engine';
import { getCurrentUser, getClientIp, isAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import {
  resolveCustomerName, extractForwardedCustomerName, extractOrderNumberFromText, first100Words,
  wrapResponseWithGreetingAndClosing, getRecentEditFeedbackExamples, generateToneAdjustedReply,
  stripEmailBoilerplate,
} from '@/lib/ai-pipeline';

// Actions that only the assigned agent (or an Admin) may perform -- everyone
// else viewing an assigned email is read-only. SUBMIT_FEEDBACK is included
// since accuracy feedback is "work" on the email, not passive viewing.
const OWNER_ONLY_ACTIONS = new Set([
  'APPROVE', 'EDIT_DRAFT', 'SEND_CUSTOM', 'REJECT', 'REGENERATE', 'RESEND',
  'CHANGE_STATUS', 'ASSIGN_TEMPLATE', 'ARCHIVE', 'SUBMIT_FEEDBACK', 'FILL_TEMPLATE',
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let email = await prisma.email.findUnique({
      where: { id },
      include: {
        autoReplies: {
          orderBy: { createdAt: 'desc' },
        },
        customer: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Dynamic auto-matcher fallback check:
    // If the email doesn't have a template matched and is not replied yet, try to match it against seeded templates.
    if (!email.matchedTemplateId && email.status !== 'REPLIED') {
      const { runKeywordMatcher, stripEmailBoilerplate } = await import('@/lib/ai-pipeline');
      const cleanBody = stripEmailBoilerplate(email.body);
      const match = await runKeywordMatcher(cleanBody, email.subject, email.organizationId);

      if (match.matchedTemplateId) {
        const template = await prisma.template.findUnique({
          where: { id: match.matchedTemplateId }
        });
        if (template) {
          const settings = await prisma.settings.findUnique({
            where: { organizationId: email.organizationId }
          });
          const greetingText = settings?.greeting || 'Hello';
          const closingSignature = settings?.closing || 'Regards,\nStyleCraft US Support Team';
          const { wrapResponseWithGreetingAndClosing, resolveCustomerName, extractOrderNumberFromText } = await import('@/lib/ai-pipeline');
          const customerName = extractForwardedCustomerName(cleanBody) || resolveCustomerName(email.sender, email.customer?.name);
          const orderNumber = extractOrderNumberFromText(`${email.subject} ${cleanBody}`);

          // Template matched -- use it directly, no API call needed.
          const replyBody = wrapResponseWithGreetingAndClosing(template.body, customerName, greetingText, closingSignature, { orderNumber });

          // Update Email matching details in DB
          await prisma.email.update({
            where: { id: email.id },
            data: {
              matchedTemplateId: template.id,
              aiConfidence: match.confidenceScore,
              summary: `Dynamic match: "${template.name}"`,
              aiProvider: 'Keyword Matcher'
            }
          });

          // Check if we should update or create the DRAFT reply text
          const existingDraft = email.autoReplies.find(r => r.status === 'DRAFT');
          if (existingDraft) {
            await prisma.autoReply.update({
              where: { id: existingDraft.id },
              data: { responseBody: replyBody }
            });
          } else {
            await prisma.autoReply.create({
              data: {
                emailId: email.id,
                status: 'DRAFT',
                responseBody: replyBody,
                originalDraftBody: replyBody,
              }
            });
          }

          // Reload the email with the new updates
          const updated = await prisma.email.findUnique({
            where: { id },
            include: {
              autoReplies: { orderBy: { createdAt: 'desc' } },
              customer: true,
            }
          });
          if (updated) {
            email = updated;
          }
        }
      }
    }

    // Assignment / collision-prevention: an email with nobody assigned yet
    // is claimed by whoever opens it first (no round-robin fairness math --
    // just first-come-first-served ownership, enough to stop two agents
    // from working the same email at once). Once assigned, the owner
    // opening it refreshes their "currently viewing" lock. Admins browse
    // without ever seizing ownership -- they only reassign explicitly via
    // the ASSIGN_USER action.
    const currentUser = await getCurrentUser();
    const includeArgs = { autoReplies: { orderBy: { createdAt: 'desc' as const } }, customer: true };
    if (currentUser && !isAdmin(currentUser)) {
      const now = new Date();
      if (!email.assignedUserId) {
        email = await prisma.email.update({
          where: { id: email.id },
          data: { assignedUserId: currentUser.id, assignedAt: now },
          include: includeArgs,
        });
        await prisma.assignmentLog.create({
          data: {
            emailId: email.id,
            assignedToUserId: currentUser.id,
            assignedToName: currentUser.email,
            assignedBy: 'claim_on_open',
            assignmentMethod: 'claim_on_open',
          },
        });
      }
      if (email.assignedUserId === currentUser.id) {
        email = await prisma.email.update({
          where: { id: email.id },
          data: { lockedByUserId: currentUser.id, lockedAt: now },
          include: includeArgs,
        });
      }
    }

    let lockOwnerName: string | null = null;
    const isLockedToOther = !!email.assignedUserId && email.assignedUserId !== currentUser?.id && !isAdmin(currentUser);
    if (isLockedToOther) {
      const owner = await prisma.user.findUnique({ where: { id: email.assignedUserId! } });
      lockOwnerName = owner?.name || owner?.email || null;
    }

    // Thread/customer context: previous emails from the same sender, most recent first.
    const threadContext = await prisma.email.findMany({
      where: {
        organizationId: email.organizationId,
        sender: email.sender,
        id: { not: email.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, subject: true, status: true, matchedTemplateId: true, createdAt: true },
    });

    return NextResponse.json({
      email,
      threadContext,
      lock: { isLockedToOther, ownerName: lockOwnerName },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, responseBody, status, assignedUserId, tone } = body;
    const user = await getCurrentUser();
    const ip = getClientIp(request);

    const email = await prisma.email.findUnique({
      where: { id },
      include: { autoReplies: true, customer: true },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (
      OWNER_ONLY_ACTIONS.has(action) &&
      !isAdmin(user) &&
      email.assignedUserId &&
      email.assignedUserId !== user?.id
    ) {
      return NextResponse.json(
        { error: 'This email is assigned to another support agent and is view-only for you.' },
        { status: 403 }
      );
    }

    if (action === 'APPROVE') {
      // Find the latest draft auto-reply
      const draft = email.autoReplies.find((r) => r.status === 'DRAFT');

      if (!draft) {
        return NextResponse.json({ error: 'No draft auto-reply found' }, { status: 400 });
      }

      await prisma.autoReply.update({
        where: { id: draft.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          approvedBy: user?.email || null,
        },
      });

      await prisma.email.update({
        where: { id },
        data: { status: 'REPLIED', lastActionByUserId: user?.id || null, lastActionAt: new Date() },
      });

      if (email.customerId) {
        await prisma.customer.update({ where: { id: email.customerId }, data: { totalReplies: { increment: 1 } } });
      }

      // Dispatch real email via SMTP
      try {
        await sendOutgoingMail(email.sender, email.subject, draft.responseBody);
      } catch (sendErr) {
        console.error('Failed to send approved SMTP email:', sendErr);
      }

      await logAudit({
        action: 'REPLY_APPROVED',
        user,
        entityType: 'email',
        entityId: email.id,
        afterValue: 'REPLIED',
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} approved and sent the auto-reply draft to ${email.sender}`,
      });

      return NextResponse.json({ success: true, message: 'Reply sent' });
    }

    if (action === 'EDIT_DRAFT') {
      const draft = email.autoReplies.find((r) => r.status === 'DRAFT');
      const before = draft?.responseBody || null;

      if (draft) {
        // Update existing draft. Preserve the true AI-original text (falls
        // back to whatever was there before if this draft predates the
        // originalDraftBody column) so "Edited Drafts" can always show a
        // clean before/after even after multiple rounds of edits.
        await prisma.autoReply.update({
          where: { id: draft.id },
          data: {
            responseBody,
            originalDraftBody: draft.originalDraftBody || before,
            wasEdited: true,
            editedBy: user?.email || null,
            editedAt: new Date(),
          },
        });
      } else {
        // Create new draft (e.g. a manual review case with no AI draft yet)
        await prisma.autoReply.create({
          data: {
            emailId: id,
            status: 'DRAFT',
            responseBody,
            originalDraftBody: null,
            wasEdited: false,
          },
        });
      }

      await prisma.email.update({
        where: { id },
        data: { lastActionByUserId: user?.id || null, lastActionAt: new Date() },
      });

      await logAudit({
        action: 'DRAFT_EDITED',
        user,
        entityType: 'email',
        entityId: email.id,
        beforeValue: before,
        afterValue: responseBody,
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} edited the draft reply for email from ${email.sender}`,
      });

      return NextResponse.json({ success: true, message: 'Draft saved' });
    }

    if (action === 'REGENERATE') {
      if (!tone) {
        return NextResponse.json({ error: 'A tone is required to regenerate a draft' }, { status: 400 });
      }

      const [template, settings] = await Promise.all([
        email.matchedTemplateId
          ? prisma.template.findUnique({ where: { id: email.matchedTemplateId } })
          : Promise.resolve(null),
        prisma.settings.findUnique({ where: { organizationId: email.organizationId } }),
      ]);

      const greetingText = settings?.greeting || 'Hello';
      const closingSignature = settings?.closing || 'Regards,\nStyleCraft US Support Team';
      const cleanBody = stripEmailBoilerplate(email.body);
      const customerName = extractForwardedCustomerName(cleanBody) || resolveCustomerName(email.sender, email.customer?.name);
      const orderNumber = extractOrderNumberFromText(`${email.subject} ${cleanBody}`);

      const feedbackBlock = await getRecentEditFeedbackExamples(email.organizationId);
      const rawReply = await generateToneAdjustedReply(
        email.subject,
        first100Words(cleanBody),
        tone,
        template?.body ?? null,
        feedbackBlock
      );
      const finalBody = wrapResponseWithGreetingAndClosing(rawReply, customerName, greetingText, closingSignature, { orderNumber });

      const draft = email.autoReplies.find((r) => r.status === 'DRAFT');
      const before = draft?.responseBody || null;

      if (draft) {
        await prisma.autoReply.update({
          where: { id: draft.id },
          data: {
            responseBody: finalBody,
            originalDraftBody: finalBody,
            wasEdited: false,
            editedBy: null,
            editedAt: null,
            tone,
          },
        });
      } else {
        await prisma.autoReply.create({
          data: {
            emailId: id,
            status: 'DRAFT',
            responseBody: finalBody,
            originalDraftBody: finalBody,
            tone,
          },
        });
      }

      await prisma.email.update({
        where: { id },
        data: { lastActionByUserId: user?.id || null, lastActionAt: new Date() },
      });

      await logAudit({
        action: 'DRAFT_REGENERATED',
        user,
        entityType: 'email',
        entityId: email.id,
        beforeValue: before,
        afterValue: finalBody,
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} regenerated the draft reply for email from ${email.sender} in a "${tone}" tone`,
      });

      return NextResponse.json({ success: true, message: 'Draft regenerated' });
    }

    if (action === 'SEND_CUSTOM') {
      // Send a custom reply immediately
      await prisma.autoReply.create({
        data: {
          emailId: id,
          status: 'SENT',
          responseBody,
          sentAt: new Date(),
          approvedBy: user?.email || null,
        },
      });

      await prisma.email.update({
        where: { id },
        data: { status: 'REPLIED', lastActionByUserId: user?.id || null, lastActionAt: new Date() },
      });

      if (email.customerId) {
        await prisma.customer.update({ where: { id: email.customerId }, data: { totalReplies: { increment: 1 } } });
      }

      // Dispatch manual response email via SMTP
      try {
        await sendOutgoingMail(email.sender, email.subject, responseBody);
      } catch (sendErr) {
        console.error('Failed to send custom SMTP email:', sendErr);
      }

      await logAudit({
        action: 'CUSTOM_REPLY_SENT',
        user,
        entityType: 'email',
        entityId: email.id,
        afterValue: responseBody,
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} sent a custom manual reply to ${email.sender}`,
      });

      return NextResponse.json({ success: true, message: 'Custom reply sent' });
    }

    if (action === 'RESEND') {
      // Correcting a mistake in an already-sent reply: send the fixed text
      // as a fresh outgoing email and record it as a new SENT row, so the
      // original (wrong) send and the correction both stay in the history
      // rather than the original being silently overwritten.
      if (!responseBody || !responseBody.trim()) {
        return NextResponse.json({ error: 'A corrected reply body is required' }, { status: 400 });
      }

      await prisma.autoReply.create({
        data: {
          emailId: id,
          status: 'SENT',
          responseBody,
          originalDraftBody: responseBody,
          sentAt: new Date(),
          approvedBy: user?.email || null,
        },
      });

      await prisma.email.update({
        where: { id },
        data: { status: 'REPLIED', lastActionByUserId: user?.id || null, lastActionAt: new Date() },
      });

      try {
        await sendOutgoingMail(email.sender, email.subject, responseBody);
      } catch (sendErr) {
        console.error('Failed to send resent SMTP email:', sendErr);
      }

      await logAudit({
        action: 'REPLY_RESENT',
        user,
        entityType: 'email',
        entityId: email.id,
        afterValue: responseBody,
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} resent a corrected reply to ${email.sender}`,
      });

      return NextResponse.json({ success: true, message: 'Corrected reply sent' });
    }

    if (action === 'REJECT') {
      const draft = email.autoReplies.find((r) => r.status === 'DRAFT');
      if (draft) {
        await prisma.autoReply.update({
          where: { id: draft.id },
          data: { status: 'REJECTED' },
        });
      }

      await prisma.email.update({
        where: { id },
        data: { status: 'WAITING', lastActionByUserId: user?.id || null, lastActionAt: new Date() }, // Stays in review queue
      });

      await logAudit({
        action: 'REPLY_REJECTED',
        user,
        entityType: 'email',
        entityId: email.id,
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} rejected the draft auto-reply for ${email.sender}`,
      });

      return NextResponse.json({ success: true, message: 'Draft rejected' });
    }

    if (action === 'CHANGE_STATUS') {
      const updated = await prisma.email.update({
        where: { id },
        data: { status, lastActionByUserId: user?.id || null, lastActionAt: new Date() },
      });

      await logAudit({
        action: 'STATUS_CHANGED',
        user,
        entityType: 'email',
        entityId: email.id,
        beforeValue: email.status,
        afterValue: status,
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} changed email status from ${email.status} to ${status}`,
      });

      return NextResponse.json({ success: true, email: updated });
    }

    if (action === 'FILL_TEMPLATE') {
      // An agent manually picked a template from the dropdown -- a template
      // match never calls the API, so this is a deterministic fill: the
      // real customer name and any order/detail extracted from their email,
      // dropped into the template's own [BRACKET] placeholders. Never
      // returns a body with a raw bracket left in it.
      const { templateId } = body;
      const template = await prisma.template.findUnique({ where: { id: templateId } });
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const settings = await prisma.settings.findUnique({ where: { organizationId: email.organizationId } });
      const greetingText = settings?.greeting || 'Hello';
      const closingSignature = settings?.closing || 'Regards,\nStyleCraft US Support Team';

      const { wrapResponseWithGreetingAndClosing, resolveCustomerName, extractOrderNumberFromText } = await import('@/lib/ai-pipeline');
      const cleanBody = stripEmailBoilerplate(email.body);
      const customerName = extractForwardedCustomerName(cleanBody) || resolveCustomerName(email.sender, email.customer?.name);
      const orderNumber = extractOrderNumberFromText(`${email.subject} ${cleanBody}`);

      const responseBody = wrapResponseWithGreetingAndClosing(template.body, customerName, greetingText, closingSignature, { orderNumber });

      return NextResponse.json({ success: true, responseBody });
    }

    if (action === 'ASSIGN_TEMPLATE') {
      const { matchedTemplateId, aiConfidence } = body;
      const updated = await prisma.email.update({
        where: { id },
        data: {
          matchedTemplateId,
          aiConfidence: parseFloat(aiConfidence),
          lastActionByUserId: user?.id || null,
          lastActionAt: new Date(),
        },
      });

      await logAudit({
        action: 'TEMPLATE_REASSIGNED',
        user,
        entityType: 'email',
        entityId: email.id,
        beforeValue: email.matchedTemplateId,
        afterValue: matchedTemplateId,
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} manually reassigned the template for email from ${email.sender}`,
      });

      return NextResponse.json({ success: true, email: updated });
    }

    if (action === 'ASSIGN_USER') {
      if (!isAdmin(user)) {
        return NextResponse.json({ error: 'Only an admin can reassign an email.' }, { status: 403 });
      }

      const targetUser = await prisma.user.findUnique({ where: { id: assignedUserId } });
      const updated = await prisma.email.update({
        where: { id },
        data: {
          assignedUserId,
          assignedAt: new Date(),
          lockedByUserId: null,
          lockedAt: null,
          lastActionByUserId: user?.id || null,
          lastActionAt: new Date(),
        },
      });

      await prisma.assignmentLog.create({
        data: {
          emailId: id,
          assignedToUserId: assignedUserId,
          assignedToName: targetUser?.name || targetUser?.email || null,
          assignedBy: user?.email || 'admin',
          assignmentMethod: 'manual',
        },
      });

      await logAudit({
        action: 'EMAIL_REASSIGNED',
        user,
        entityType: 'email',
        entityId: email.id,
        beforeValue: email.assignedUserId,
        afterValue: assignedUserId,
        ipAddress: ip,
        details: `${user?.email || 'Admin'} reassigned the email from ${email.sender} to ${targetUser?.email || assignedUserId}`,
      });

      return NextResponse.json({ success: true, email: updated });
    }

    if (action === 'SUBMIT_FEEDBACK') {
      const { feedbackType, feedbackNotes, approvedTemplateId, rejectedTemplateId, newKeyword } = body;

      const updatedEmail = await prisma.email.update({
        where: { id },
        data: {
          userFeedback: feedbackType,
          userFeedbackNotes: feedbackNotes || newKeyword,
          lastActionByUserId: user?.id || null,
          lastActionAt: new Date(),
        }
      });

      const targetTemplateId = approvedTemplateId || email.matchedTemplateId;
      if (newKeyword && targetTemplateId) {
        const template = await prisma.template.findUnique({
          where: { id: targetTemplateId }
        });
        if (template) {
          const structured = parseKeywords(template.keywords);
          const normalized = newKeyword.trim().toLowerCase();
          if (normalized && !structured.primary.includes(normalized)) {
            structured.primary.push(normalized);
            await prisma.template.update({
              where: { id: targetTemplateId },
              data: { keywords: serializeKeywords(structured) }
            });
            await logAudit({
              action: 'KEYWORD_ADDED',
              user,
              entityType: 'keyword',
              entityId: targetTemplateId,
              afterValue: normalized,
              ipAddress: ip,
              details: `${user?.email || 'Unknown user'} added keyword "${normalized}" to template "${template.name}"`,
            });
          }
        }
      }

      if (feedbackType === 'Disable This Rule' && targetTemplateId) {
        await prisma.template.update({
          where: { id: targetTemplateId },
          data: { active: false }
        });
        await logAudit({
          action: 'TEMPLATE_RULE_DISABLED',
          user,
          entityType: 'rule',
          entityId: targetTemplateId,
          beforeValue: 'active',
          afterValue: 'disabled',
          ipAddress: ip,
          details: `${user?.email || 'Unknown user'} disabled the rule for template ${targetTemplateId}`,
        });
      }

      // "Wrong Template" feedback creates a Failed Match record for the
      // dedicated review queue, in addition to the general learning log.
      if (feedbackType === 'Wrong Template' || feedbackType === 'Wrong Template Override') {
        await prisma.failedMatch.create({
          data: {
            emailId: email.id,
            userId: user?.id || null,
            userEmail: user?.email || null,
            aiSelectedTemplateId: email.matchedTemplateId,
            correctedTemplateId: approvedTemplateId || null,
            confidenceScore: email.aiConfidence,
            matchedKeywords: null,
            aiReason: email.summary,
            status: 'Open',
            notes: feedbackNotes || null,
          },
        });
      }

      const draftText = email.autoReplies.find(r => r.status === 'DRAFT')?.responseBody || 'None';
      await prisma.learningLog.create({
        data: {
          emailId: email.id,
          subject: email.subject,
          sender: email.sender,
          emailText: email.body,
          aiSelectedTmpl: email.matchedTemplateId,
          userApprovedTmpl: targetTemplateId,
          rejectedTmpl: rejectedTemplateId || null,
          keywordsAdded: newKeyword || null,
          confidenceScore: email.aiConfidence,
          finalResponse: draftText,
          feedbackClicked: feedbackType
        }
      });

      await logAudit({
        action: 'FEEDBACK_' + feedbackType.toUpperCase().replace(/\s+/g, '_'),
        user,
        entityType: 'email',
        entityId: email.id,
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} clicked "${feedbackType}" on email from ${email.sender}`,
      });

      return NextResponse.json({ success: true, email: updatedEmail });
    }

    if (action === 'ARCHIVE') {
      const updated = await prisma.email.update({
        where: { id },
        data: { status: 'ESCALATED', lastActionByUserId: user?.id || null, lastActionAt: new Date() }
      });

      await logAudit({
        action: 'EMAIL_ARCHIVED',
        user,
        entityType: 'email',
        entityId: email.id,
        beforeValue: email.status,
        afterValue: 'ESCALATED',
        ipAddress: ip,
        details: `${user?.email || 'Unknown user'} archived the email with subject "${email.subject}"`,
      });

      return NextResponse.json({ success: true, email: updated });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const ip = getClientIp(request);

    const email = await prisma.email.findUnique({
      where: { id }
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    await prisma.email.delete({
      where: { id }
    });

    await logAudit({
      action: 'EMAIL_DELETED',
      user,
      entityType: 'email',
      entityId: id,
      beforeValue: `${email.subject} (from ${email.sender})`,
      ipAddress: ip,
      details: `${user?.email || 'Unknown user'} deleted the email with subject "${email.subject}" from "${email.sender}"`,
    });

    return NextResponse.json({ success: true, message: 'Email deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
