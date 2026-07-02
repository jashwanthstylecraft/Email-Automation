import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOutgoingMail } from '@/lib/mail-sender';
import { parseKeywords, serializeKeywords } from '@/lib/keyword-engine';
import { getCurrentUser, getClientIp } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
      const { runKeywordMatcher } = await import('@/lib/ai-pipeline');
      const match = await runKeywordMatcher(email.body, email.subject, email.organizationId);

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
          const { wrapResponseWithGreetingAndClosing } = await import('@/lib/ai-pipeline');
          let replyBody = wrapResponseWithGreetingAndClosing(template.body, email.sender, greetingText, closingSignature);

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
                responseBody: replyBody
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

    return NextResponse.json({ email, threadContext });
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
    const { action, responseBody, status, assignedUserId } = body;
    const user = await getCurrentUser();
    const ip = getClientIp(request);

    const email = await prisma.email.findUnique({
      where: { id },
      include: { autoReplies: true },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
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
        data: { status: 'REPLIED' },
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
        // Update existing draft
        await prisma.autoReply.update({
          where: { id: draft.id },
          data: { responseBody },
        });
      } else {
        // Create new draft
        await prisma.autoReply.create({
          data: {
            emailId: id,
            status: 'DRAFT',
            responseBody,
          },
        });
      }

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
        data: { status: 'REPLIED' },
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
        data: { status: 'WAITING' }, // Stays in review queue
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
        data: { status },
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

    if (action === 'ASSIGN_TEMPLATE') {
      const { matchedTemplateId, aiConfidence } = body;
      const updated = await prisma.email.update({
        where: { id },
        data: {
          matchedTemplateId,
          aiConfidence: parseFloat(aiConfidence)
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
      const updated = await prisma.email.update({
        where: { id },
        data: { assignedUserId },
      });
      return NextResponse.json({ success: true, email: updated });
    }

    if (action === 'SUBMIT_FEEDBACK') {
      const { feedbackType, feedbackNotes, approvedTemplateId, rejectedTemplateId, newKeyword } = body;

      const updatedEmail = await prisma.email.update({
        where: { id },
        data: {
          userFeedback: feedbackType,
          userFeedbackNotes: feedbackNotes || newKeyword
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
        data: { status: 'ESCALATED' }
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
