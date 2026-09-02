'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumberFlow from '@number-flow/react';
import { useStore } from '@/lib/store';
import {
  Mail, Send, Clock, AlertTriangle, Sliders, Sparkles, ArrowRight, Activity, Edit3, MessageSquare, ShieldCheck,
  WifiOff, RefreshCw, XCircle, ToggleRight, ToggleLeft, Users, History, ThumbsDown, UserCog
} from 'lucide-react';
import Link from 'next/link';
import {
  EmailsPerDayChart, CategoriesChart, SentimentChart
} from '@/components/dashboard-charts';
import { BentoSection, BentoCard, DEFAULT_GLOW_COLOR } from '@/components/MagicBento';

const POLL_INTERVAL_MS = 15000;

export default function DashboardPage() {
  const router = useRouter();
  const {
    dashboardMetrics, dashboardCharts, recentActivity, recentFailedMatches, recentChanges,
    fetchDashboard, user, isDashboardLoading, isDashboardRefreshing, dashboardError, dashboardUpdatedAt,
    workload, fetchWorkload
  } = useStore();

  const isAdminUser = user?.role === 'Admin';

  useEffect(() => {
    fetchDashboard();
    if (isAdminUser) fetchWorkload();

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true });
        if (isAdminUser) fetchWorkload();
      }
    }, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true });
        if (isAdminUser) fetchWorkload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAdminUser]);

  if (isDashboardLoading || !dashboardMetrics) {
    return (
      <div className="space-y-8 animate-pulse text-xs">
        <div className="h-8 bg-surface-2 rounded-lg w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-panel h-24 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-panel h-80 rounded-xl lg:col-span-2"></div>
          <div className="glass-panel h-80 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Emails Processed',
      value: dashboardMetrics.totalEmails,
      icon: Mail,
      color: 'text-accent-text',
      bg: 'bg-accent-bg border-accent-border',
      href: '/inbox',
    },
    {
      title: 'Drafts Generated',
      value: dashboardMetrics.draftsCreated || 0,
      icon: Edit3,
      color: 'text-accent-text',
      bg: 'bg-accent-bg border-accent-border',
      href: '/inbox?status=DRAFTS',
    },
    {
      title: 'Edited Drafts',
      value: dashboardMetrics.editedDraftsCount || 0,
      icon: Edit3,
      color: 'text-accent-text',
      bg: 'bg-accent-bg border-accent-border',
      href: '/edited-drafts',
    },
    {
      title: 'Replies Sent',
      value: dashboardMetrics.autoRepliesSent,
      icon: Send,
      color: 'text-success',
      bg: 'bg-success-bg border-success/25',
      href: '/inbox?status=REPLIED',
    },
    {
      title: 'Manual Review Count',
      value: dashboardMetrics.pendingEmails,
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning-bg border-warning/25',
      href: '/inbox?status=WAITING',
    },
    {
      title: 'Rejected Drafts',
      value: dashboardMetrics.failedAttempts,
      icon: AlertTriangle,
      color: 'text-danger',
      bg: 'bg-danger-bg border-danger/25',
      href: '/inbox?status=WAITING',
    },
    {
      title: 'Active Rules',
      value: dashboardMetrics.activeRulesCount,
      icon: Sliders,
      color: 'text-accent-text',
      bg: 'bg-accent-bg border-accent-border',
      href: '/rules',
    },
    {
      title: 'Failed Matches',
      value: dashboardMetrics.failedMatchesCount || 0,
      icon: XCircle,
      color: 'text-danger',
      bg: 'bg-danger-bg border-danger/25',
      href: '/failed-matches',
    },
    {
      title: 'Wrong Template Feedback',
      value: dashboardMetrics.wrongTemplateFeedbackCount || 0,
      icon: ThumbsDown,
      color: 'text-warning',
      bg: 'bg-warning-bg border-warning/25',
      href: '/failed-matches',
    },
    {
      title: 'Active Templates',
      value: dashboardMetrics.activeTemplatesCount || 0,
      icon: ToggleRight,
      color: 'text-success',
      bg: 'bg-success-bg border-success/25',
      href: '/templates?active=true',
    },
    {
      title: 'Disabled Templates',
      value: dashboardMetrics.disabledTemplatesCount || 0,
      icon: ToggleLeft,
      color: 'text-text-secondary',
      bg: 'bg-surface-3 border-border',
      href: '/templates?active=false',
    },
    {
      title: 'Customers',
      value: dashboardMetrics.customersCount || 0,
      icon: Users,
      color: 'text-accent-text',
      bg: 'bg-accent-bg border-accent-border',
      href: '/customers',
    },
  ];

  const subMetrics = [
    { name: 'Template Match Accuracy', value: dashboardMetrics.templateMatchAccuracy || '100%', icon: ShieldCheck, href: '/templates' },
    { name: 'User Feedback Count', value: dashboardMetrics.userFeedbackCount || 0, icon: MessageSquare, href: '/failed-matches' },
    { name: 'AI Average Confidence', value: dashboardMetrics.avgConfidence, icon: Sparkles, href: '/inbox' },
    { name: 'Automation Success Rate', value: dashboardMetrics.automationRate, icon: Sliders, href: '/inbox?status=REPLIED' },
    { name: 'Last Matched Keyword', value: dashboardMetrics.lastMatchedKeyword || 'None yet', icon: Sliders, href: '/templates' },
  ];

  const isDataEmpty = dashboardMetrics.totalEmails === 0;

  return (
    <div className="space-y-8 pb-12 text-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            Dashboard Overview
          </h1>
          <p className="text-text-secondary text-xs mt-1">
            Monitor real StyleCraft US email sync and auto-reply dispatcher performance.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-text-muted">
          {isDashboardRefreshing ? (
            <RefreshCw className="w-3 h-3 text-accent-text animate-spin" />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
          )}
          <span>
            {isDashboardRefreshing
              ? 'Updating…'
              : dashboardUpdatedAt
                ? `Live · Updated ${new Date(dashboardUpdatedAt).toLocaleTimeString()}`
                : 'Live'}
          </span>
        </div>
      </div>

      {dashboardError && (
        <div className="glass-panel border border-warning/25 bg-warning-bg rounded-xl p-3 flex items-center gap-3 text-warning">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <p className="text-xs">
            {dashboardError} Showing last synced data — retrying automatically.
          </p>
        </div>
      )}

      {/* Admin-only support agent activity view */}
      {isAdminUser && workload.length > 0 && (
        <div className="glass-panel p-6 rounded-xl border border-border bg-bg">
          <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-4">
            <UserCog className="w-4 h-4 text-accent-text" />
            Support Agent Activity
          </h3>
          <BentoSection className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workload.map((w: any) => (
              <BentoCard
                key={w.userId}
                glowColor={w.isInactiveWithPending ? '239, 68, 68' : DEFAULT_GLOW_COLOR}
                className={`p-4 rounded-xl border space-y-2 ${
                  w.isInactiveWithPending
                    ? 'border-danger/40 bg-danger-bg'
                    : 'border-border bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-text-primary truncate">{w.name}</span>
                  <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    w.isActive
                      ? 'text-success border-success/25 bg-success-bg'
                      : 'text-text-secondary border-border bg-surface-2'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${w.isActive ? 'bg-success' : 'bg-text-muted'}`}></span>
                    {w.isActive ? 'Active' : 'Offline'}
                  </span>
                </div>
                {w.isInactiveWithPending && (
                  <p className="text-[10px] text-danger font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> User inactive / emails pending
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 font-mono text-[10px] pt-1">
                  <div>
                    <p className="text-text-muted uppercase text-[9px]">Open</p>
                    <p className="text-text-primary font-bold"><NumberFlow value={w.openCount} /></p>
                  </div>
                  <div>
                    <p className="text-text-muted uppercase text-[9px]">Replied</p>
                    <p className="text-text-primary font-bold"><NumberFlow value={w.respondedCount} /></p>
                  </div>
                  <div>
                    <p className={`uppercase text-[9px] ${w.overdueCount > 0 ? 'text-danger' : 'text-text-muted'}`}>Overdue</p>
                    <p className={`font-bold ${w.overdueCount > 0 ? 'text-danger' : 'text-text-primary'}`}><NumberFlow value={w.overdueCount} /></p>
                  </div>
                  <div>
                    <p className="text-text-muted uppercase text-[9px]">Assigned</p>
                    <p className="text-text-primary font-bold"><NumberFlow value={w.assignedTotal} /></p>
                  </div>
                  <div>
                    <p className="text-text-muted uppercase text-[9px]">Drafts</p>
                    <p className="text-text-primary font-bold"><NumberFlow value={w.draftsGenerated} /></p>
                  </div>
                  <div>
                    <p className="text-text-muted uppercase text-[9px]">Left</p>
                    <p className="text-text-primary font-bold"><NumberFlow value={w.leftToRespond} /></p>
                  </div>
                </div>
                <p className="text-[9px] text-text-muted pt-1 border-t border-border">
                  Last active: {w.lastSeenAt ? new Date(w.lastSeenAt).toLocaleString() : 'Never'}
                </p>
              </BentoCard>
            ))}
          </BentoSection>
        </div>
      )}

      {/* Primary KPIs */}
      <BentoSection className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <BentoCard
              key={kpi.title}
              as={kpi.href ? Link : 'div'}
              href={kpi.href}
              className={`glass-panel p-4 rounded-xl border border-border flex flex-col justify-between bg-bg ${kpi.href ? 'hover:border-accent-border transition-colors cursor-pointer' : ''}`}
            >
              <div className="flex justify-between items-start">
                <p className="text-[9px] font-semibold text-text-secondary uppercase tracking-wider leading-relaxed">{kpi.title}</p>
                <div className={`p-1.5 rounded-lg border ${kpi.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-bold tracking-tight text-text-primary">
                  <NumberFlow value={kpi.value} />
                </h3>
              </div>
            </BentoCard>
          );
        })}
      </BentoSection>

      {/* Sub-Metrics & Trends */}
      <BentoSection className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {subMetrics.map((sm) => {
          const Icon = sm.icon;
          const percentMatch = typeof sm.value === 'string' ? sm.value.match(/^(\d+)%$/) : null;
          return (
            <BentoCard key={sm.name} as={Link} href={sm.href} className="glass-panel p-4 rounded-xl border border-border hover:border-accent-border transition-colors flex items-center justify-between bg-bg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-surface-2 rounded-lg">
                  <Icon className="w-4 h-4 text-accent-text" />
                </div>
                <div>
                  <p className="text-[10px] text-text-secondary">{sm.name}</p>
                  <p className="text-xs font-semibold text-text-primary mt-0.5">
                    {typeof sm.value === 'number' ? (
                      <NumberFlow value={sm.value} />
                    ) : percentMatch ? (
                      <NumberFlow value={parseInt(percentMatch[1], 10)} suffix="%" />
                    ) : (
                      sm.value
                    )}
                  </p>
                </div>
              </div>
            </BentoCard>
          );
        })}
      </BentoSection>

      {isDataEmpty ? (
        <div className="glass-panel py-20 px-6 text-center border border-border rounded-2xl flex flex-col items-center justify-center bg-bg">
          <div className="p-4 rounded-full bg-accent-bg border border-accent-border mb-4 animate-pulse">
            <Mail className="w-8 h-8 text-accent-text" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">No real data available yet</h3>
          <p className="text-xs text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
            Please configure your IMAP/SMTP server connection on the settings page or upload responses.docx to bootstrap templates.
          </p>
          <div className="mt-6">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-xs font-semibold rounded-lg text-white transition-all shadow-lg shadow-accent/15"
            >
              Go to Settings
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Charts Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-xl border border-border lg:col-span-2 bg-bg">
              <h3 className="text-sm font-semibold text-text-secondary mb-6">Real Emails & Auto replies (Last 7 Days)</h3>
              <EmailsPerDayChart data={dashboardCharts.emailsPerDay} />
            </div>

            <div className="glass-panel p-6 rounded-xl border border-border bg-bg">
              <h3 className="text-sm font-semibold text-text-secondary mb-6">Inquiry Categories</h3>
              <CategoriesChart data={dashboardCharts.categories} />
            </div>
          </div>

          {/* Second Row: Sentiment & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left lists: Keywords, Sentiment, and Most Used Templates */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-xl border border-border bg-bg">
                <h3 className="text-sm font-semibold text-text-secondary mb-6">Customer Sentiment</h3>
                <SentimentChart data={dashboardCharts.sentiment} />
              </div>

              <div className="glass-panel p-6 rounded-xl border border-border bg-bg space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent-text" />
                  Most Used Response Templates
                </h3>
                {(!dashboardMetrics.mostUsedTemplates || dashboardMetrics.mostUsedTemplates.length === 0) ? (
                  <p className="text-text-muted text-[10px] py-4 text-center">No template dispatches logged yet.</p>
                ) : (
                  <div className="space-y-2 font-mono text-[10px]">
                    {dashboardMetrics.mostUsedTemplates.map((item: any) => (
                      <div key={item.name} className="flex justify-between items-center bg-surface-2 p-2.5 rounded border border-border">
                        <span className="text-accent-text font-semibold truncate max-w-[70%]">{item.name}</span>
                        <span className="px-2 py-0.5 rounded bg-success-bg border border-success/25 text-success font-bold">{item.count} sent</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel p-6 rounded-xl border border-border bg-bg space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent-text" />
                  Top Matched Keywords
                </h3>
                {(!dashboardMetrics.topMatchedKeywords || dashboardMetrics.topMatchedKeywords.length === 0) ? (
                  <p className="text-text-muted text-[10px] py-4 text-center">No keyword triggers logged yet.</p>
                ) : (
                  <div className="space-y-2 font-mono text-[10px]">
                    {dashboardMetrics.topMatchedKeywords.map((item: any) => (
                      <div key={item.name} className="flex justify-between items-center bg-surface-2 p-2.5 rounded border border-border">
                        <span className="text-accent-text font-semibold">{item.name}</span>
                        <span className="px-2 py-0.5 rounded bg-accent-bg border border-accent-border text-accent-text font-bold">{item.count} hits</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activities */}
            <div className="glass-panel p-6 rounded-xl border border-border lg:col-span-2 bg-bg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-semibold text-text-secondary">Recent Inbox Activity</h3>
                <Link href="/inbox" className="text-xs text-accent-text hover:text-accent transition-colors">
                  View Entire Inbox →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-text-secondary uppercase tracking-wider font-semibold">
                      <th className="pb-3">Sender</th>
                      <th className="pb-3">Subject</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs text-text-secondary">
                    {recentActivity.map((act) => {
                      const statusColors = {
                        UNREAD: 'bg-accent-bg border-accent-border text-accent-text',
                        WAITING: 'bg-warning-bg border-warning/25 text-warning',
                        REPLIED: 'bg-success-bg border-success/25 text-success',
                        ESCALATED: 'bg-danger-bg border-danger/25 text-danger',
                        SPAM: 'bg-surface-3 border-border text-text-secondary',
                      };
                      return (
                        <tr key={act.id} onClick={() => router.push(`/inbox?emailId=${act.id}`)} className="hover:bg-surface-3 transition-colors cursor-pointer">
                          <td className="py-3 pr-4 truncate font-medium text-text-primary max-w-[120px]">{act.sender}</td>
                          <td className="py-3 pr-4 truncate max-w-[200px]">{act.subject}</td>
                          <td className="py-3 pr-4">{act.category}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${(statusColors as any)[act.status]}`}>
                              {act.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Failed Matches, Top Senders, Recent Changes & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-xl border border-border bg-bg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-danger" />
                  Recent Failed Matches
                </h3>
                <Link href="/failed-matches" className="text-xs text-accent-text hover:text-accent transition-colors">
                  View All →
                </Link>
              </div>
              {(!recentFailedMatches || recentFailedMatches.length === 0) ? (
                <p className="text-text-muted text-[10px] py-4 text-center">No wrong-template feedback logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentFailedMatches.map((f: any) => (
                    <Link key={f.id} href="/failed-matches" className="block bg-surface-2 hover:bg-surface-3 p-2.5 rounded border border-border transition-colors">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-text-primary font-semibold truncate max-w-[70%]">{f.subject}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                          f.status === 'Open' ? 'bg-danger-bg border border-danger/25 text-danger' :
                          f.status === 'Reviewed' ? 'bg-warning-bg border border-warning/25 text-warning' :
                          'bg-success-bg border border-success/25 text-success'
                        }`}>{f.status}</span>
                      </div>
                      <p className="text-[9px] text-text-muted mt-1 truncate">{f.sender}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-6 rounded-xl border border-border bg-bg">
              <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-accent-text" />
                Top Senders
              </h3>
              {(!dashboardMetrics.topSenders || dashboardMetrics.topSenders.length === 0) ? (
                <p className="text-text-muted text-[10px] py-4 text-center">No senders yet.</p>
              ) : (
                <div className="space-y-2 font-mono text-[10px]">
                  {dashboardMetrics.topSenders.map((s: any) => (
                    <Link
                      key={s.sender}
                      href={s.customerId ? `/customers/${s.customerId}` : `/customers?search=${encodeURIComponent(s.sender)}`}
                      className="flex justify-between items-center bg-surface-2 hover:bg-surface-3 p-2.5 rounded border border-border transition-colors"
                    >
                      <span className="text-accent-text font-semibold truncate max-w-[70%]">{s.sender}</span>
                      <span className="px-2 py-0.5 rounded bg-accent-bg border border-accent-border text-accent-text font-bold">{s.count} emails</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-6 rounded-xl border border-border bg-bg">
              <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-accent-text" />
                Recent Changes & Activity
              </h3>
              {(!recentChanges || recentChanges.length === 0) ? (
                <p className="text-text-muted text-[10px] py-4 text-center">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {recentChanges.map((c: any) => {
                    const link =
                      c.entityType === 'email' && c.entityId ? `/inbox?emailId=${c.entityId}` :
                      c.entityType === 'note' ? '/notes' :
                      c.entityType === 'template' || c.entityType === 'keyword' || c.entityType === 'rule' ? '/templates' :
                      '/audit-logs';
                    return (
                      <Link key={c.id} href={link} className="block bg-surface-2 hover:bg-surface-3 p-2.5 rounded border border-border text-[10px] transition-colors">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-text-secondary font-semibold truncate max-w-[75%]">{c.userEmail || 'System'}</span>
                          <span className="text-text-muted text-[9px] flex-shrink-0">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-text-muted mt-1 leading-relaxed truncate">{c.details}</p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
