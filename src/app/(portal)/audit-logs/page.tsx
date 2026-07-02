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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="w-5 h-5 text-violet-400" />
            Audit Logs
          </h1>
          <p className="text-gray-400 text-xs mt-1">Every tracked action across the platform: who did what, when, and the before/after.</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:border-violet-500/30 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg font-semibold cursor-pointer transition-all">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-violet-500 text-[11px] cursor-pointer"
        >
          <option value="">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2" />
          <input
            type="text"
            placeholder="Filter by user email..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-white outline-none focus:border-violet-500 text-[11px]"
          />
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 overflow-hidden">
        {isLoading && auditLogsFull.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No matching audit log entries.</div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
            {filtered.map((log: any) => (
              <div
                key={log.id}
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-violet-300 font-mono text-[9px] flex-shrink-0">{log.action}</span>
                    <span className="text-white font-semibold truncate">{log.userEmail || 'System'}</span>
                  </div>
                  <span className="text-[9px] text-gray-500 flex-shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-gray-400 mt-1.5 truncate">{log.details}</p>
                {expandedId === log.id && (log.beforeValue || log.afterValue) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/5">
                    <div>
                      <span className="text-gray-500 uppercase font-semibold text-[9px]">Before:</span>
                      <p className="text-gray-400 mt-1 bg-black/20 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">{log.beforeValue || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase font-semibold text-[9px]">After:</span>
                      <p className="text-emerald-300 mt-1 bg-black/20 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">{log.afterValue || '—'}</p>
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
