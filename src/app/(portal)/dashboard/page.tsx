'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
        <div className="h-8 bg-white/5 rounded-lg w-1/4"></div>
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
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      href: '/inbox',
    },
    {
      title: 'Drafts Generated',
      value: dashboardMetrics.draftsCreated || 0,
      icon: Edit3,
      color: 'text-violet-300',
      bg: 'bg-violet-500/10 border-violet-500/20',
      href: '/inbox?status=DRAFTS',
    },
    {
      title: 'Edited Drafts',
      value: dashboardMetrics.editedDraftsCount || 0,
      icon: Edit3,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      href: '/edited-drafts',
    },
    {
      title: 'Replies Sent',
      value: dashboardMetrics.autoRepliesSent,
      icon: Send,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      href: '/inbox?status=REPLIED',
    },
    {
      title: 'Manual Review Count',
      value: dashboardMetrics.pendingEmails,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      href: '/inbox?status=WAITING',
    },
    {
      title: 'Rejected Drafts',
      value: dashboardMetrics.failedAttempts,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      href: '/inbox?status=WAITING',
    },
    {
      title: 'Active Rules',
      value: dashboardMetrics.activeRulesCount,
      icon: Sliders,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
      href: '/rules',
    },
    {
      title: 'Failed Matches',
      value: dashboardMetrics.failedMatchesCount || 0,
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      href: '/failed-matches',
    },
    {
      title: 'Wrong Template Feedback',
      value: dashboardMetrics.wrongTemplateFeedbackCount || 0,
      icon: ThumbsDown,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      href: '/failed-matches',
    },
    {
      title: 'Active Templates',
      value: dashboardMetrics.activeTemplatesCount || 0,
      icon: ToggleRight,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      href: '/templates?active=true',
    },
    {
      title: 'Disabled Templates',
      value: dashboardMetrics.disabledTemplatesCount || 0,
      icon: ToggleLeft,
      color: 'text-gray-400',
      bg: 'bg-gray-500/10 border-gray-500/20',
      href: '/templates?active=false',
    },
    {
      title: 'Customers',
      value: dashboardMetrics.customersCount || 0,
      icon: Users,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Dashboard Overview
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            Monitor real StyleCraft US email sync and auto-reply dispatcher performance.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          {isDashboardRefreshing ? (
            <RefreshCw className="w-3 h-3 text-violet-400 animate-spin" />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
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
        <div className="glass-panel border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 flex items-center gap-3 text-amber-300">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <p className="text-xs">
            {dashboardError} Showing last synced data — retrying automatically.
          </p>
        </div>
      )}

      {/* Admin-only support agent activity view */}
      {isAdminUser && workload.length > 0 && (
        <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
            <UserCog className="w-4 h-4 text-violet-400" />
            Support Agent Activity
          </h3>
          <BentoSection className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workload.map((w: any) => (
              <BentoCard
                key={w.userId}
                glowColor={w.isInactiveWithPending ? '239, 68, 68' : DEFAULT_GLOW_COLOR}
                className={`p-4 rounded-xl border space-y-2 ${
                  w.isInactiveWithPending
                    ? 'border-red-500/40 bg-red-600/10'
                    : 'border-white/5 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white truncate">{w.name}</span>
                  <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    w.isActive
                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-600/10'
                      : 'text-gray-400 border-white/10 bg-white/5'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${w.isActive ? 'bg-emerald-400' : 'bg-gray-500'}`}></span>
                    {w.isActive ? 'Active' : 'Offline'}
                  </span>
                </div>
                {w.isInactiveWithPending && (
                  <p className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> User inactive / emails pending
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 font-mono text-[10px] pt-1">
                  <div>
                    <p className="text-gray-500 uppercase text-[9px]">Open</p>
                    <p className="text-white font-bold">{w.openCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 uppercase text-[9px]">Replied</p>
                    <p className="text-white font-bold">{w.respondedCount}</p>
                  </div>
                  <div>
                    <p className={`uppercase text-[9px] ${w.overdueCount > 0 ? 'text-red-400' : 'text-gray-500'}`}>Overdue</p>
                    <p className={`font-bold ${w.overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>{w.overdueCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 uppercase text-[9px]">Assigned</p>
                    <p className="text-white font-bold">{w.assignedTotal}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 uppercase text-[9px]">Drafts</p>
                    <p className="text-white font-bold">{w.draftsGenerated}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 uppercase text-[9px]">Left</p>
                    <p className="text-white font-bold">{w.leftToRespond}</p>
                  </div>
                </div>
                <p className="text-[9px] text-gray-500 pt-1 border-t border-white/5">
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
              className={`glass-panel p-4 rounded-xl border border-white/5 flex flex-col justify-between bg-[#0b0b0f]/60 ${kpi.href ? 'hover:border-violet-500/30 transition-colors cursor-pointer' : ''}`}
            >
              <div className="flex justify-between items-start">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-relaxed">{kpi.title}</p>
                <div className={`p-1.5 rounded-lg border ${kpi.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-bold tracking-tight text-white">{kpi.value}</h3>
              </div>
            </BentoCard>
          );
        })}
      </BentoSection>

      {/* Sub-Metrics & Trends */}
      <BentoSection className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {subMetrics.map((sm) => {
          const Icon = sm.icon;
          return (
            <BentoCard key={sm.name} as={Link} href={sm.href} className="glass-panel p-4 rounded-xl border border-white/5 hover:border-violet-500/30 transition-colors flex items-center justify-between bg-[#0b0b0f]/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg">
                  <Icon className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">{sm.name}</p>
                  <p className="text-xs font-semibold text-white mt-0.5">{sm.value}</p>
                </div>
              </div>
            </BentoCard>
          );
        })}
      </BentoSection>

      {isDataEmpty ? (
        <div className="glass-panel py-20 px-6 text-center border border-white/5 rounded-2xl flex flex-col items-center justify-center bg-[#0b0b0f]/60">
          <div className="p-4 rounded-full bg-violet-600/10 border border-violet-500/20 mb-4 animate-pulse">
            <Mail className="w-8 h-8 text-violet-400" />
          </div>
          <h3 className="text-sm font-bold text-gray-200">No real data available yet</h3>
          <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
            Please configure your IMAP/SMTP server connection on the settings page or upload responses.docx to bootstrap templates.
          </p>
          <div className="mt-6">
            <Link 
              href="/settings" 
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-lg text-white transition-all shadow-lg shadow-violet-600/15"
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
            <div className="glass-panel p-6 rounded-xl border border-white/5 lg:col-span-2 bg-[#0b0b0f]/60">
              <h3 className="text-sm font-semibold text-gray-300 mb-6">Real Emails & Auto replies (Last 7 Days)</h3>
              <EmailsPerDayChart data={dashboardCharts.emailsPerDay} />
            </div>

            <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60">
              <h3 className="text-sm font-semibold text-gray-300 mb-6">Inquiry Categories</h3>
              <CategoriesChart data={dashboardCharts.categories} />
            </div>
          </div>

          {/* Second Row: Sentiment & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left lists: Keywords, Sentiment, and Most Used Templates */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60">
                <h3 className="text-sm font-semibold text-gray-300 mb-6">Customer Sentiment</h3>
                <SentimentChart data={dashboardCharts.sentiment} />
              </div>

              <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60 space-y-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" />
                  Most Used Response Templates
                </h3>
                {(!dashboardMetrics.mostUsedTemplates || dashboardMetrics.mostUsedTemplates.length === 0) ? (
                  <p className="text-gray-500 text-[10px] py-4 text-center">No template dispatches logged yet.</p>
                ) : (
                  <div className="space-y-2 font-mono text-[10px]">
                    {dashboardMetrics.mostUsedTemplates.map((item: any) => (
                      <div key={item.name} className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/5">
                        <span className="text-violet-300 font-semibold truncate max-w-[70%]">{item.name}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-bold">{item.count} sent</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60 space-y-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" />
                  Top Matched Keywords
                </h3>
                {(!dashboardMetrics.topMatchedKeywords || dashboardMetrics.topMatchedKeywords.length === 0) ? (
                  <p className="text-gray-500 text-[10px] py-4 text-center">No keyword triggers logged yet.</p>
                ) : (
                  <div className="space-y-2 font-mono text-[10px]">
                    {dashboardMetrics.topMatchedKeywords.map((item: any) => (
                      <div key={item.name} className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/5">
                        <span className="text-violet-300 font-semibold">{item.name}</span>
                        <span className="px-2 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-violet-400 font-bold">{item.count} hits</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activities */}
            <div className="glass-panel p-6 rounded-xl border border-white/5 lg:col-span-2 bg-[#0b0b0f]/60">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-semibold text-gray-300">Recent Inbox Activity</h3>
                <Link href="/inbox" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  View Entire Inbox →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                      <th className="pb-3">Sender</th>
                      <th className="pb-3">Subject</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {recentActivity.map((act) => {
                      const statusColors = {
                        UNREAD: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                        WAITING: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                        REPLIED: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                        ESCALATED: 'bg-red-500/10 border-red-500/20 text-red-400',
                        SPAM: 'bg-gray-500/10 border-gray-500/20 text-gray-400',
                      };
                      return (
                        <tr key={act.id} onClick={() => router.push(`/inbox?emailId=${act.id}`)} className="hover:bg-white/5 transition-colors cursor-pointer">
                          <td className="py-3 pr-4 truncate font-medium text-white max-w-[120px]">{act.sender}</td>
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
            <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  Recent Failed Matches
                </h3>
                <Link href="/failed-matches" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  View All →
                </Link>
              </div>
              {(!recentFailedMatches || recentFailedMatches.length === 0) ? (
                <p className="text-gray-500 text-[10px] py-4 text-center">No wrong-template feedback logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentFailedMatches.map((f: any) => (
                    <Link key={f.id} href="/failed-matches" className="block bg-white/5 hover:bg-white/10 p-2.5 rounded border border-white/5 transition-colors">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-white font-semibold truncate max-w-[70%]">{f.subject}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                          f.status === 'Open' ? 'bg-red-600/10 border border-red-500/20 text-red-400' :
                          f.status === 'Reviewed' ? 'bg-amber-600/10 border border-amber-500/20 text-amber-400' :
                          'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400'
                        }`}>{f.status}</span>
                      </div>
                      <p className="text-[9px] text-gray-500 mt-1 truncate">{f.sender}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-violet-400" />
                Top Senders
              </h3>
              {(!dashboardMetrics.topSenders || dashboardMetrics.topSenders.length === 0) ? (
                <p className="text-gray-500 text-[10px] py-4 text-center">No senders yet.</p>
              ) : (
                <div className="space-y-2 font-mono text-[10px]">
                  {dashboardMetrics.topSenders.map((s: any) => (
                    <Link
                      key={s.sender}
                      href={s.customerId ? `/customers/${s.customerId}` : `/customers?search=${encodeURIComponent(s.sender)}`}
                      className="flex justify-between items-center bg-white/5 hover:bg-white/10 p-2.5 rounded border border-white/5 transition-colors"
                    >
                      <span className="text-violet-300 font-semibold truncate max-w-[70%]">{s.sender}</span>
                      <span className="px-2 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-violet-400 font-bold">{s.count} emails</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-violet-400" />
                Recent Changes & Activity
              </h3>
              {(!recentChanges || recentChanges.length === 0) ? (
                <p className="text-gray-500 text-[10px] py-4 text-center">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {recentChanges.map((c: any) => {
                    const link =
                      c.entityType === 'email' && c.entityId ? `/inbox?emailId=${c.entityId}` :
                      c.entityType === 'note' ? '/notes' :
                      c.entityType === 'template' || c.entityType === 'keyword' || c.entityType === 'rule' ? '/templates' :
                      '/audit-logs';
                    return (
                      <Link key={c.id} href={link} className="block bg-white/5 hover:bg-white/10 p-2.5 rounded border border-white/5 text-[10px] transition-colors">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-300 font-semibold truncate max-w-[75%]">{c.userEmail || 'System'}</span>
                          <span className="text-gray-500 text-[9px] flex-shrink-0">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-gray-500 mt-1 leading-relaxed truncate">{c.details}</p>
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
