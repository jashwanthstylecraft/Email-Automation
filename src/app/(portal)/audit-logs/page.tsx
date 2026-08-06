'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { History, Search, RefreshCw, Download } from 'lucide-react';
import { exportToCsv } from '@/lib/csv-export';

export default function AuditLogsPage() {
  const { auditLogsFull, fetchAuditLogsFull, isLoading } = useStore();
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLogsFull({ action: actionFilter || undefined, userId: undefined });
  }, [actionFilter]);

  const filtered = userFilter
    ? auditLogsFull.filter((l: any) => (l.userEmail || '').toLowerCase().includes(userFilter.toLowerCase()))
    : auditLogsFull;

  const uniqueActions = Array.from(new Set(auditLogsFull.map((l: any) => l.action))).sort();

  const handleExport = () => {
    exportToCsv('audit-logs', filtered.map((l: any) => ({
      timestamp: l.createdAt,
      user: l.userEmail || 'System',
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
    })));
  };

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <History className="w-5 h-5 text-accent-text" />
            Audit Logs
          </h1>
          <p className="text-text-secondary text-xs mt-1">Every tracked action across the platform: who did what, when, and the before/after.</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-accent-border bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-lg font-semibold cursor-pointer transition-all">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-text-primary outline-none focus:border-accent text-[11px] cursor-pointer"
        >
          <option value="">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2" />
          <input
            type="text"
            placeholder="Filter by user email..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-surface-2 border border-border rounded-lg pl-8 pr-3 py-1.5 text-text-primary outline-none focus:border-accent text-[11px]"
          />
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border bg-bg overflow-hidden">
        {isLoading && auditLogsFull.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-text" />
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-text-muted">No matching audit log entries.</div>
        ) : (
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {filtered.map((log: any) => (
              <div
                key={log.id}
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="p-4 hover:bg-surface-3 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-accent-bg border border-accent-border text-accent-text font-mono text-[9px] flex-shrink-0">{log.action}</span>
                    <span className="text-text-primary font-semibold truncate">{log.userEmail || 'System'}</span>
                  </div>
                  <span className="text-[9px] text-text-muted flex-shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-text-secondary mt-1.5 truncate">{log.details}</p>
                {expandedId === log.id && (log.beforeValue || log.afterValue) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                    <div>
                      <span className="text-text-muted uppercase font-semibold text-[9px]">Before:</span>
                      <p className="text-text-secondary mt-1 bg-surface-3 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">{log.beforeValue || '—'}</p>
                    </div>
                    <div>
                      <span className="text-text-muted uppercase font-semibold text-[9px]">After:</span>
                      <p className="text-success mt-1 bg-surface-3 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">{log.afterValue || '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
