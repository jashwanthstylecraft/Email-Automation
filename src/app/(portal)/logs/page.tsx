'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Activity, Clock, Cpu, Sliders, AlertTriangle, ShieldCheck, Mail, Sparkles, UserCheck } from 'lucide-react';

export default function LogsPage() {
  const { auditLogs, fetchAuditLogs, isLoading } = useStore();

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'RULE_TRIGGER':
      case 'AUTO_DRAFT_CREATED':
        return <Cpu className="w-4 h-4 text-success" />;
      case 'RULE_CONFLICT':
      case 'MANUAL_REVIEW_NEEDED':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'KNOWLEDGE_UPLOAD':
      case 'KNOWLEDGE_ANALYSIS':
        return <ShieldCheck className="w-4 h-4 text-accent-text" />;
      default:
        return <Activity className="w-4 h-4 text-accent-text" />;
    }
  };

  const getActionBg = (action: string) => {
    switch (action) {
      case 'RULE_TRIGGER':
      case 'AUTO_DRAFT_CREATED':
        return 'bg-success-bg border-success/25';
      case 'RULE_CONFLICT':
      case 'MANUAL_REVIEW_NEEDED':
        return 'bg-warning-bg border-warning/25';
      case 'KNOWLEDGE_UPLOAD':
      case 'KNOWLEDGE_ANALYSIS':
        return 'bg-accent-bg border-accent-border';
      default:
        return 'bg-accent-bg border-accent-border';
    }
  };

  const renderLogDetails = (log: any) => {
    try {
      if (log.details && log.details.startsWith('{') && log.details.endsWith('}')) {
        const data = JSON.parse(log.details);
        return (
          <div className="mt-2 bg-bg p-3 rounded-lg border border-border grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] leading-relaxed text-text-secondary font-sans">
            <div>
              <p className="truncate"><span className="text-text-muted">Subject:</span> <strong className="text-text-primary">{data.subject}</strong></p>
              <p className="mt-1 truncate"><span className="text-text-muted">Sender:</span> <strong className="text-text-secondary font-mono">{data.sender}</strong></p>
              {data.matchedKeyword && <p className="mt-1"><span className="text-text-muted">Matched Keywords:</span> <strong className="text-accent-text font-mono">{data.matchedKeyword}</strong></p>}
            </div>
            <div>
              <p><span className="text-text-muted">Category:</span> <strong className="text-accent-text font-semibold">{data.category}</strong></p>
              <p className="mt-1"><span className="text-text-muted">Matched Template:</span> <strong className="text-success font-semibold">{data.matchedTemplate}</strong></p>
              {data.errorMessage && <p className="mt-1 text-danger"><span className="text-text-muted">Error:</span> {data.errorMessage}</p>}
            </div>
            <div className="md:border-l md:border-border md:pl-4 space-y-1.5">
              <div className="flex gap-4">
                <span>Confidence: <strong className="text-accent-text">{(data.confidenceScore * 100).toFixed(0)}%</strong></span>
                <span>AI: <strong className="text-accent-text">{data.aiProvider}</strong></span>
              </div>
              <div className="flex gap-2 text-[8px] uppercase font-mono font-bold flex-wrap">
                <span className={`px-1.5 py-0.5 rounded ${data.draftCreated ? 'bg-accent-bg text-accent-text border border-accent-border' : 'bg-surface-3 text-text-muted'}`}>Draft: {data.draftCreated ? 'YES' : 'NO'}</span>
                <span className={`px-1.5 py-0.5 rounded ${data.autoSend ? 'bg-success-bg text-success border border-success/25' : 'bg-surface-3 text-text-muted'}`}>Auto-Send: {data.autoSend ? 'YES' : 'NO'}</span>
                <span className={`px-1.5 py-0.5 rounded ${data.manualReview ? 'bg-warning-bg text-warning border border-warning/25' : 'bg-surface-3 text-text-muted'}`}>Review: {data.manualReview ? 'YES' : 'NO'}</span>
              </div>
              {data.userFeedback && (
                <p className="text-[9px] text-success mt-1 font-mono">
                  Feedback: "{data.userFeedback}"
                </p>
              )}
            </div>
          </div>
        );
      }
    } catch (err) {
      // Fail safely to standard rendering
    }
    return <p className="text-xs text-text-primary leading-relaxed mt-1">{log.details}</p>;
  };

  return (
    <div className="space-y-8 pb-12 text-xs">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          Automation Audit Logs
        </h1>
        <p className="text-text-secondary text-xs mt-1">
          Monitor real-time StyleCraft US email sync processing details, RAG intent matching triggers, and confidence scores.
        </p>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-border bg-surface-2">
        <h3 className="text-sm font-semibold text-text-secondary mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent-text animate-pulse" />
          Recent Platform Activity Timeline
        </h3>

        {isLoading && auditLogs.length === 0 ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-3 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="py-16 text-center text-text-muted flex flex-col items-center justify-center">
            <Sliders className="w-12 h-12 text-text-muted mb-3 animate-pulse" />
            <h3 className="text-sm font-semibold text-text-secondary">No real data available yet.</h3>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Connect an integration inbox or trigger email sync to record automation events here.
            </p>
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {auditLogs.map((log, logIdx) => (
                <li key={log.id}>
                  <div className="relative pb-8">
                    {logIdx !== auditLogs.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-border" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3 items-start">
                      <div>
                        <span className={`h-8 w-8 rounded-lg border flex items-center justify-center ${getActionBg(log.action)}`}>
                          {getActionIcon(log.action)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-1.5 flex flex-col md:flex-row justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-accent-text uppercase tracking-wider mr-2 text-[9px] font-mono border border-accent-border px-1.5 py-0.5 rounded bg-accent-bg">
                            {log.action}
                          </span>
                          {renderLogDetails(log)}
                        </div>
                        <div className="text-right text-[9px] whitespace-nowrap text-text-muted font-mono pt-1">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
