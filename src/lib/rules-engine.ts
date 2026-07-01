import { prisma } from './prisma';
import { sendOutgoingMail } from './mail-sender';

export interface RuleCondition {
  field: 'category' | 'sentiment' | 'priority' | 'body' | 'subject';
  operator: 'equals' | 'contains' | 'contains_any' | 'not_equals';
  value: string;
}

export interface RuleConditionsGroup {
  logic: 'AND' | 'OR';
  rules: RuleCondition[];
}

export interface RuleAction {
  actionType: 'AUTO_REPLY' | 'REPLY_TEMPLATE' | 'ESCALATE' | 'NONE';
  templateId?: string;
  status?: string; // WAITING, REPLIED, ESCALATED, etc.
  assignee?: string;
}

/**
 * Checks if a single condition matches the email properties.
 */
function evaluateCondition(email: any, condition: RuleCondition): boolean {
  const fieldValue = (email[condition.field] || '').toString().toLowerCase();
  const targetValue = condition.value.toLowerCase();

  switch (condition.operator) {
    case 'equals':
      return fieldValue === targetValue;
    case 'not_equals':
      return fieldValue !== targetValue;
    case 'contains':
      return fieldValue.includes(targetValue);
    case 'contains_any':
      const terms = targetValue.split(',').map((t) => t.trim()).filter(Boolean);
      return terms.some((term) => fieldValue.includes(term));
    default:
      return false;
  }
}

/**
 * Evaluates the complex condition group for an email.
 */
function evaluateRuleConditions(email: any, conditionsJson: string): boolean {
  try {
    const group: RuleConditionsGroup = JSON.parse(conditionsJson);
    if (!group.rules || group.rules.length === 0) return false;

    if (group.logic === 'AND') {
      return group.rules.every((cond) => evaluateCondition(email, cond));
    } else {
      return group.rules.some((cond) => evaluateCondition(email, cond));
    }
  } catch (error) {
    console.error('Failed to parse rule conditions:', error);
    return false;
  }
}

/**
 * Interpolates variables in a template body.
 */
export function interpolateTemplate(
  body: string,
  variables: Record<string, string>
): string {
  let result = body;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Evaluates all active automation rules for an incoming email and applies actions.
 */
export async function processAutomationRules(emailId: string): Promise<any> {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
  });

  if (!email) throw new Error(`Email with ID ${emailId} not found`);

  // Fetch all active rules for the organization, sorted by creation date (order of execution)
  const rules = await prisma.rule.findMany({
    where: {
      organizationId: email.organizationId,
      active: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const settings = await prisma.settings.findUnique({
    where: { organizationId: email.organizationId },
  });

  // Find all rules that match this email
  const matchingRules = [];
  for (const rule of rules) {
    if (evaluateRuleConditions(email, rule.conditions)) {
      matchingRules.push(rule);
    }
  }

  if (matchingRules.length === 0) {
    console.log(`No automation rules matched for email ${emailId}. Placing in manual review queue.`);
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'WAITING' },
    });
    return null;
  }

  if (matchingRules.length > 1) {
    console.log(`Multiple automation rules matched for email ${emailId} (${matchingRules.map(r => r.name).join(', ')}). Sending to Manual Review to avoid conflicts.`);
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'WAITING' },
    });
    await prisma.auditLog.create({
      data: {
        action: 'RULE_CONFLICT',
        details: `Multiple rules matched (${matchingRules.map(r => r.name).join(', ')}). Routed email ${emailId} to Manual Review.`,
      },
    });
    return null;
  }

  const rule = matchingRules[0];
  console.log(`Email ${emailId} matched Rule: "${rule.name}"`);
  
  // Update rule triggers statistics
  await prisma.rule.update({
    where: { id: rule.id },
    data: {
      triggerCount: { increment: 1 },
      lastTriggeredAt: new Date(),
    },
  });

  let action: RuleAction;
  try {
    action = JSON.parse(rule.actions);
  } catch (err) {
    console.error(`Failed to parse actions for rule ${rule.name}`, err);
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'WAITING' },
    });
    return null;
  }

  // Log the event
  await prisma.auditLog.create({
    data: {
      action: 'RULE_TRIGGER',
      details: `Email ${emailId} ("${email.subject}") matched automation rule: "${rule.name}"`,
    },
  });

  // 1. Escalate Action
  if (action.actionType === 'ESCALATE') {
    let assignedUserId: string | null = null;
    if (action.assignee) {
      const user = await prisma.user.findFirst({
        where: { email: action.assignee, organizationId: email.organizationId },
      });
      if (user) assignedUserId = user.id;
    }

    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'ESCALATED',
        priority: 'URGENT',
        assignedUserId,
      },
    });

    // Trigger webhook alert for escalation (e.g. Slack trigger placeholder)
    await notifySlackChannel(`🚨 **Urgent Escalation:** Email from ${email.sender} escalated via rule "${rule.name}". Subject: "${email.subject}"`);

    return { ruleApplied: rule.name, action: 'ESCALATE', email: updatedEmail };
  }

  // 2. Auto Reply or Reply Template Actions
  if (action.actionType === 'AUTO_REPLY' || action.actionType === 'REPLY_TEMPLATE') {
    if (!action.templateId) {
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'WAITING' },
      });
      return null;
    }

    const template = await prisma.template.findUnique({
      where: { id: action.templateId },
    });

    if (!template) {
      console.warn(`Template ID ${action.templateId} not found in database.`);
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'WAITING' },
      });
      return null;
    }

    // Interpolate templates variables
    const customerName = email.sender.split('@')[0].split('.')[0].replace(/^\w/, (c) => c.toUpperCase());
    const variablesMap = {
      customer_name: customerName,
      ticket_id: email.id.slice(0, 8),
      closing: settings?.closing || 'Regards,\nStyleCraft Support Team',
    };

    const replyBody = interpolateTemplate(template.body, variablesMap);

    // Decide status based on Settings and Rule Action
    // If settings specify MANUAL reply only, override automatic sending
    const finalStatus = settings?.autoReplyMode === 'MANUAL' 
      ? 'DRAFT' 
      : (action.actionType === 'AUTO_REPLY' && settings?.autoReplyMode === 'AUTO' ? 'SENT' : 'DRAFT');

    const autoReply = await prisma.autoReply.create({
      data: {
        emailId: email.id,
        status: finalStatus,
        responseBody: replyBody,
        sentAt: finalStatus === 'SENT' ? new Date() : null,
      },
    });

    // Trigger live SMTP email reply if rules dispatch it immediately
    if (finalStatus === 'SENT') {
      try {
        await sendOutgoingMail(email.sender, email.subject, replyBody);
      } catch (sendErr) {
        console.error(`Failed to send live SMTP automated reply for email ${email.id}:`, sendErr);
      }
    }

    // Update email status
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: finalStatus === 'SENT' ? 'REPLIED' : (action.status || 'WAITING'),
      },
    });

    // Update dashboard metrics audit record
    await prisma.auditLog.create({
      data: {
        action: 'RULE_DISPATCH',
        details: `Sent automated draft template "${template.name}" for email ${email.id}.`
      }
    });

    return { 
      ruleApplied: rule.name, 
      action: action.actionType, 
      autoReplyId: autoReply.id, 
      email: updatedEmail 
    };
  }
}

/**
 * Placeholder dispatch for external webhooks.
 */
async function notifySlackChannel(text: string): Promise<void> {
  console.log(`[Slack Webhook Outgoing]: ${text}`);
  // In a real production codebase, this would send an HTTP POST request to a configured integration webhook URL.
}
