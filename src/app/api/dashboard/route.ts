import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // 1. Calculate primary metrics
    const totalEmails = await prisma.email.count({ where: { organizationId: orgId } });
    
    const autoRepliesSent = await prisma.email.count({ 
      where: { organizationId: orgId, status: 'REPLIED' } 
    });

    const pendingEmails = await prisma.email.count({ 
      where: { organizationId: orgId, status: 'WAITING' } 
    });

    const failedAttempts = await prisma.autoReply.count({
      where: {
        email: { organizationId: orgId },
        status: 'REJECTED'
      }
    });

    const activeRulesCount = await prisma.rule.count({
      where: {
        organizationId: orgId,
        active: true
      }
    });

    const draftsCreated = await prisma.autoReply.count({
      where: {
        status: 'DRAFT',
        email: { organizationId: orgId }
      }
    });

    // Feedback metrics
    const userFeedbackCount = await prisma.email.count({
      where: {
        organizationId: orgId,
        userFeedback: { not: null }
      }
    });

    const correctFeedback = await prisma.email.count({
      where: {
        organizationId: orgId,
        userFeedback: 'Correct Template'
      }
    });

    const templateMatchAccuracy = userFeedbackCount > 0 
      ? `${Math.round((correctFeedback / userFeedbackCount) * 100)}%` 
      : '100%';

    // Most used templates
    const emailMatches = await prisma.email.groupBy({
      by: ['matchedTemplateId'],
      where: { organizationId: orgId, matchedTemplateId: { not: null } },
      _count: { id: true }
    });
    const templatesList = await prisma.template.findMany({
      where: { organizationId: orgId }
    });
    const mostUsedTemplates = emailMatches.map(m => {
      const tmpl = templatesList.find(t => t.id === m.matchedTemplateId);
      return {
        name: tmpl ? tmpl.name : 'Unknown',
        count: m._count.id
      };
    }).sort((a, b) => b.count - a.count).slice(0, 5);

    // Fetch last matched keyword from recent trigger logs
    const lastTriggerLog = await prisma.auditLog.findFirst({
      where: { action: 'RULE_TRIGGER' },
      orderBy: { createdAt: 'desc' }
    });
    let lastMatchedKeyword = 'None yet';
    if (lastTriggerLog) {
      const match = lastTriggerLog.details.match(/rule: "([^"]+)"/);
      if (match && match[1]) {
        const matchedRule = await prisma.rule.findFirst({
          where: { name: match[1] }
        });
        if (matchedRule) {
          try {
            const conds = JSON.parse(matchedRule.conditions);
            const kws = conds.rules?.map((r: any) => r.value).join(', ');
            lastMatchedKeyword = kws || matchedRule.name;
          } catch (err) {
            lastMatchedKeyword = matchedRule.name;
          }
        } else {
          lastMatchedKeyword = match[1];
        }
      }
    }

    // Fetch last sent template from recent dispatch logs
    const lastDispatchLog = await prisma.auditLog.findFirst({
      where: { action: 'RULE_DISPATCH' },
      orderBy: { createdAt: 'desc' }
    });
    let lastSentTemplate = 'None yet';
    if (lastDispatchLog) {
      const match = lastDispatchLog.details.match(/template "([^"]+)"/);
      if (match && match[1]) {
        lastSentTemplate = match[1];
      }
    }

    // Extract top matched keywords from recent logs
    const recentLogs = await prisma.auditLog.findMany({
      where: { action: 'AUTO_DRAFT_CREATED' },
      take: 100
    });
    const keywordCounts: Record<string, number> = {};
    for (const log of recentLogs) {
      try {
        const data = JSON.parse(log.details);
        const kw = data.matchedKeyword;
        if (kw && kw !== 'None') {
          keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
        }
      } catch (e) {}
    }
    const topMatchedKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Real Average Response Time calculation
    const autoReplies = await prisma.autoReply.findMany({
      where: {
        email: { organizationId: orgId },
        status: 'SENT',
        sentAt: { not: null }
      },
      include: { email: true }
    });

    let avgResponseTime = '0m';
    if (autoReplies.length > 0) {
      let totalMinutes = 0;
      let count = 0;
      for (const reply of autoReplies) {
        if (reply.sentAt) {
          const diffMs = reply.sentAt.getTime() - reply.email.createdAt.getTime();
          totalMinutes += Math.max(0, Math.floor(diffMs / (60 * 1000)));
          count++;
        }
      }
      if (count > 0) {
        avgResponseTime = `${Math.floor(totalMinutes / count)}m`;
      }
    }

    // Real Average AI Confidence
    const aiConfidenceAggregate = await prisma.email.aggregate({
      where: { organizationId: orgId, aiConfidence: { gt: 0 } },
      _avg: { aiConfidence: true }
    });
    const avgConfidence = aiConfidenceAggregate._avg.aiConfidence
      ? parseFloat((aiConfidenceAggregate._avg.aiConfidence * 100).toFixed(1))
      : 0;

    // Real Automation Rate
    const automationRate = totalEmails > 0 
      ? parseFloat(((autoRepliesSent / totalEmails) * 100).toFixed(1)) 
      : 0;

    // 2. Fetch Emails grouped by categories for charts
    const categoryGroup = await prisma.email.groupBy({
      by: ['category'],
      where: { organizationId: orgId },
      _count: { id: true },
    });
    const categoriesChart = categoryGroup.map(g => ({
      name: g.category,
      value: g._count.id
    }));

    // 3. Fetch Emails grouped by sentiment for charts
    const sentimentGroup = await prisma.email.groupBy({
      by: ['sentiment'],
      where: { organizationId: orgId },
      _count: { id: true },
    });
    const sentimentChart = sentimentGroup.map(g => ({
      name: g.sentiment,
      value: g._count.id
    }));

    // 4. Group actual emails by day of the week for the last 7 days
    const emailsPerDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      
      const dayName = startOfDay.toLocaleDateString('en-US', { weekday: 'short' });
      
      const emailsCount = await prisma.email.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: startOfDay, lte: endOfDay }
        }
      });

      const autoRepliesCount = await prisma.autoReply.count({
        where: {
          email: { organizationId: orgId },
          status: 'SENT',
          sentAt: { gte: startOfDay, lte: endOfDay }
        }
      });

      emailsPerDay.push({
        day: dayName,
        emails: emailsCount,
        autoReplies: autoRepliesCount
      });
    }

    // 5. Recent activities
    const recentEmails = await prisma.email.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      metrics: {
        totalEmails,
        autoRepliesSent,
        pendingEmails,
        failedAttempts,
        activeRulesCount,
        draftsCreated,
        userFeedbackCount,
        templateMatchAccuracy,
        mostUsedTemplates,
        lastMatchedKeyword,
        lastSentTemplate,
        avgResponseTime,
        avgConfidence: `${avgConfidence}%`,
        automationRate: `${automationRate}%`,
        topMatchedKeywords,
      },
      charts: {
        emailsPerDay,
        categories: categoriesChart,
        sentiment: sentimentChart,
      },
      recentActivity: recentEmails.map(e => ({
        id: e.id,
        sender: e.sender,
        subject: e.subject,
        status: e.status,
        category: e.category,
        time: e.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
