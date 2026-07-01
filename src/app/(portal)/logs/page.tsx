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
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'RULE_CONFLICT':
      case 'MANUAL_REVIEW_NEEDED':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'KNOWLEDGE_UPLOAD':
      case 'KNOWLEDGE_ANALYSIS':
        return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      default:
        return <Activity className="w-4 h-4 text-violet-400" />;
    }
  };

  const getActionBg = (action: string) => {
    switch (action) {
      case 'RULE_TRIGGER':
      case 'AUTO_DRAFT_CREATED':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'RULE_CONFLICT':
      case 'MANUAL_REVIEW_NEEDED':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'KNOWLEDGE_UPLOAD':
      case 'KNOWLEDGE_ANALYSIS':
        return 'bg-blue-500/10 border-blue-500/20';
      default:
        return 'bg-violet-500/10 border-violet-500/20';
    }
  };

  const renderLogDetails = (log: any) => {
    try {
      if (log.details && log.details.startsWith('{') && log.details.endsWith('}')) {
        const data = JSON.parse(log.details);
        return (
          <div className="mt-2 bg-black/30 p-3 rounded-lg border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] leading-relaxed text-gray-400 font-sans">
            <div>
              <p className="truncate"><span className="text-gray-500">Subject:</span> <strong className="text-gray-200">{data.subject}</strong></p>
              <p className="mt-1 truncate"><span className="text-gray-500">Sender:</span> <strong className="text-gray-300 font-mono">{data.sender}</strong></p>
              {data.matchedKeyword && <p className="mt-1"><span className="text-gray-500">Matched Keywords:</span> <strong className="text-violet-300 font-mono">{data.matchedKeyword}</strong></p>}
            </div>
            <div>
              <p><span className="text-gray-500">Category:</span> <strong className="text-violet-300 font-semibold">{data.category}</strong></p>
              <p className="mt-1"><span className="text-gray-500">Matched Template:</span> <strong className="text-emerald-400 font-semibold">{data.matchedTemplate}</strong></p>
              {data.errorMessage && <p className="mt-1 text-red-400"><span className="text-gray-500">Error:</span> {data.errorMessage}</p>}
            </div>
            <div className="md:border-l md:border-white/5 md:pl-4 space-y-1.5">
              <div className="flex gap-4">
                <span>Confidence: <strong className="text-violet-400">{(data.confidenceScore * 100).toFixed(0)}%</strong></span>
                <span>AI: <strong className="text-violet-400">{data.aiProvider}</strong></span>
              </div>
              <div className="flex gap-2 text-[8px] uppercase font-mono font-bold flex-wrap">
                <span className={`px-1.5 py-0.5 rounded ${data.draftCreated ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'bg-white/5 text-gray-600'}`}>Draft: {data.draftCreated ? 'YES' : 'NO'}</span>
                <span className={`px-1.5 py-0.5 rounded ${data.autoSend ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-600'}`}>Auto-Send: {data.autoSend ? 'YES' : 'NO'}</span>
                <span className={`px-1.5 py-0.5 rounded ${data.manualReview ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-gray-600'}`}>Review: {data.manualReview ? 'YES' : 'NO'}</span>
              </div>
              {data.userFeedback && (
                <p className="text-[9px] text-emerald-400 mt-1 font-mono">
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
    return <p className="text-xs text-white leading-relaxed mt-1">{log.details}</p>;
  };

  return (
    <div className="space-y-8 pb-12 text-xs">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          Automation Audit Logs
        </h1>
        <p className="text-gray-400 text-xs mt-1">
          Monitor real-time StyleCraft US email sync processing details, RAG intent matching triggers, and confidence scores.
        </p>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60">
        <h3 className="text-sm font-semibold text-gray-300 mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-400 animate-pulse" />
          Recent Platform Activity Timeline
        </h3>

        {isLoading && auditLogs.length === 0 ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
            <Sliders className="w-12 h-12 text-gray-700 mb-3 animate-pulse" />
            <h3 className="text-sm font-semibold text-gray-400">No real data available yet.</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
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
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-white/5" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3 items-start">
                      <div>
                        <span className={`h-8 w-8 rounded-lg border flex items-center justify-center ${getActionBg(log.action)}`}>
                          {getActionIcon(log.action)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-1.5 flex flex-col md:flex-row justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-violet-400 uppercase tracking-wider mr-2 text-[9px] font-mono border border-violet-500/20 px-1.5 py-0.5 rounded bg-violet-500/5">
                            {log.action}
                          </span>
                          {renderLogDetails(log)}
                        </div>
                        <div className="text-right text-[9px] whitespace-nowrap text-gray-500 font-mono pt-1">
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
