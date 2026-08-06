'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { XCircle, Filter, RefreshCw, Mail, ShieldQuestion } from 'lucide-react';

const STATUS_OPTIONS = ['ALL', 'Open', 'Reviewed', 'Resolved'];

export default function FailedMatchesPage() {
  const { failedMatches, fetchFailedMatches, updateFailedMatch, templates, fetchTemplates, isLoading } = useStore();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [senderFilter, setSenderFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchFailedMatches({ status: statusFilter === 'ALL' ? undefined : statusFilter, sender: senderFilter || undefined });
    fetchTemplates();
  }, [statusFilter, senderFilter]);

  const selected = failedMatches.find((f: any) => f.id === selectedId);

  const templateName = (id: string | null) => {
    if (!id) return 'None';
    return templates.find(t => t.id === id)?.name || id;
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedId) return;
    await updateFailedMatch(selectedId, { status, notes: reviewNotes });
  };

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <XCircle className="w-5 h-5 text-danger" />
          Failed Matches
        </h1>
        <p className="text-text-secondary text-xs mt-1">Emails where a staff member flagged the AI-selected template as wrong.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                statusFilter === s ? 'bg-accent-bg text-accent-text border border-accent-border' : 'text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Filter by sender email..."
          value={senderFilter}
          onChange={(e) => setSenderFilter(e.target.value)}
          className="bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-text-primary outline-none focus:border-accent text-[11px]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 glass-panel rounded-xl border border-border bg-surface-2 overflow-hidden">
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {isLoading && failedMatches.length === 0 ? (
              <div className="p-8 text-center text-text-muted">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-text" />
                Loading...
              </div>
            ) : failedMatches.length === 0 ? (
              <div className="p-8 text-center text-text-muted">No failed matches found.</div>
            ) : (
              failedMatches.map((f: any) => (
                <div
                  key={f.id}
                  onClick={() => { setSelectedId(f.id); setReviewNotes(f.notes || ''); }}
                  className={`p-4 cursor-pointer hover:bg-surface-3 transition-colors border-l-2 ${
                    selectedId === f.id ? 'bg-surface-3 border-accent' : 'border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-text-primary truncate max-w-[65%]">{f.email?.sender}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      f.status === 'Open' ? 'bg-danger-bg border border-danger/25 text-danger' :
                      f.status === 'Reviewed' ? 'bg-warning-bg border border-warning/25 text-warning' :
                      'bg-success-bg border border-success/25 text-success'
                    }`}>{f.status}</span>
                  </div>
                  <p className="text-text-secondary truncate mt-1">{f.email?.subject}</p>
                  <p className="text-[9px] text-text-muted mt-1">{new Date(f.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel rounded-xl border border-border bg-surface-2 p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted">
              <ShieldQuestion className="w-10 h-10 text-text-muted mb-2" />
              Select a failed match to see full details.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent-text" />
                  {selected.email?.subject}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selected.status === 'Open' ? 'bg-danger-bg border border-danger/25 text-danger' :
                  selected.status === 'Reviewed' ? 'bg-warning-bg border border-warning/25 text-warning' :
                  'bg-success-bg border border-success/25 text-success'
                }`}>{selected.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                <div>
                  <span className="text-text-muted uppercase font-semibold">Sender:</span>
                  <p className="text-text-primary mt-1">{selected.email?.sender}</p>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold">Flagged By:</span>
                  <p className="text-text-primary mt-1">{selected.userEmail || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold">AI-Selected Template:</span>
                  <p className="text-danger font-bold mt-1">{templateName(selected.aiSelectedTemplateId)}</p>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold">Corrected Template:</span>
                  <p className="text-success font-bold mt-1">{templateName(selected.correctedTemplateId)}</p>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold">Match Confidence:</span>
                  <p className="text-text-primary mt-1">{Math.round((selected.confidenceScore || 0) * 100)}%</p>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold">Flagged At:</span>
                  <p className="text-text-primary mt-1">{new Date(selected.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <span className="text-text-muted uppercase font-semibold text-[10px]">AI Selection Reason:</span>
                <p className="text-text-secondary italic mt-1 bg-surface-3 border border-border p-3 rounded-lg">{selected.aiReason || 'None recorded.'}</p>
              </div>

              <div>
                <span className="text-text-muted uppercase font-semibold text-[10px]">Original Customer Email:</span>
                <div className="bg-surface-3 border border-border p-3 rounded-lg mt-1 text-text-secondary whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {selected.email?.body}
                </div>
              </div>

              <div>
                <label className="block text-text-muted uppercase font-semibold text-[10px] mb-1">Internal Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-surface-3 border border-border rounded-lg p-2.5 text-text-primary outline-none focus:border-accent text-[11px]"
                  placeholder="Add notes about this review..."
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <button onClick={() => handleUpdateStatus('Open')} className="px-3 py-1.5 border border-danger/25 hover:border-danger bg-danger-bg hover:bg-danger/15 text-danger rounded-lg font-semibold cursor-pointer transition-all">Mark Open</button>
                <button onClick={() => handleUpdateStatus('Reviewed')} className="px-3 py-1.5 border border-warning/25 hover:border-warning bg-warning-bg hover:bg-warning/15 text-warning rounded-lg font-semibold cursor-pointer transition-all">Mark Reviewed</button>
                <button onClick={() => handleUpdateStatus('Resolved')} className="px-3 py-1.5 border border-success/25 hover:border-success bg-success-bg hover:bg-success/15 text-success rounded-lg font-semibold cursor-pointer transition-all">Mark Resolved</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
