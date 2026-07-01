import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOutgoingMail } from '@/lib/mail-sender';

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
              autoReplies: { orderBy: { createdAt: 'desc' } }
            }
          });
          if (updated) {
            email = updated;
          }
        }
      }
    }

    return NextResponse.json({ email });
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
        },
      });

      await prisma.email.update({
        where: { id },
        data: { status: 'REPLIED' },
      });

      // Dispatch real email via SMTP
      try {
        await sendOutgoingMail(email.sender, email.subject, draft.responseBody);
      } catch (sendErr) {
        console.error('Failed to send approved SMTP email:', sendErr);
      }

      // Audit Log
      await prisma.auditLog.create({
        data: {
          action: 'REPLY_APPROVED',
          details: `Auto-reply draft approved and sent to ${email.sender}`,
        },
      });

      return NextResponse.json({ success: true, message: 'Reply sent' });
    }

    if (action === 'EDIT_DRAFT') {
      const draft = email.autoReplies.find((r) => r.status === 'DRAFT');

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
        },
      });

      await prisma.email.update({
        where: { id },
        data: { status: 'REPLIED' },
      });

      // Dispatch manual response email via SMTP
      try {
        await sendOutgoingMail(email.sender, email.subject, responseBody);
      } catch (sendErr) {
        console.error('Failed to send custom SMTP email:', sendErr);
      }

      await prisma.auditLog.create({
        data: {
          action: 'CUSTOM_REPLY_SENT',
          details: `Custom manual response sent to ${email.sender}`,
        },
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

      await prisma.auditLog.create({
        data: {
          action: 'REPLY_REJECTED',
          details: `Draft auto-reply for ${email.sender} rejected by operator`,
        },
      });

      return NextResponse.json({ success: true, message: 'Draft rejected' });
    }

    if (action === 'CHANGE_STATUS') {
      const updated = await prisma.email.update({
        where: { id },
        data: { status },
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
          const currentVars = template.variables ? template.variables.split(',').map(v => v.trim()) : [];
          if (!currentVars.map(v => v.toLowerCase()).includes(newKeyword.trim().toLowerCase())) {
            currentVars.push(newKeyword.trim());
            await prisma.template.update({
              where: { id: targetTemplateId },
              data: { variables: currentVars.join(', ') }
            });
          }
        }
      }

      if (feedbackType === 'Disable This Rule' && targetTemplateId) {
        await prisma.template.update({
          where: { id: targetTemplateId },
          data: { active: false }
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

      await prisma.auditLog.create({
        data: {
          action: 'USER_FEEDBACK_SUBMITTED',
          details: `User submitted feedback "${feedbackType}" for email ${email.id}. Recorded to AI Learning Log.`
        }
      });

      return NextResponse.json({ success: true, email: updatedEmail });
    }

    if (action === 'ARCHIVE') {
      const updated = await prisma.email.update({
        where: { id },
        data: { status: 'ESCALATED' }
      });

      await prisma.auditLog.create({
        data: {
          action: 'EMAIL_ARCHIVED',
          details: `Email with subject "${email.subject}" archived by operator.`
        }
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

    const email = await prisma.email.findUnique({
      where: { id }
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    await prisma.email.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        action: 'EMAIL_DELETED',
        details: `Email with subject "${email.subject}" from "${email.sender}" deleted.`
      }
    });

    return NextResponse.json({ success: true, message: 'Email deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
