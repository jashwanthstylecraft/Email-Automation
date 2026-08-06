'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useSearchParams } from 'next/navigation';
import { Edit3, Filter, RefreshCw, Download, Mail, ArrowRight } from 'lucide-react';
import { exportToCsv } from '@/lib/csv-export';

const STATUS_OPTIONS = ['ALL', 'DRAFT', 'SENT', 'REJECTED'];

export default function EditedDraftsPage() {
  const { editedDrafts, fetchEditedDrafts, templates, fetchTemplates, isLoading } = useStore();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [senderFilter, setSenderFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEditedDrafts({ status: statusFilter === 'ALL' ? undefined : statusFilter, sender: senderFilter || undefined });
    fetchTemplates();
  }, [statusFilter, senderFilter]);

  const selected = editedDrafts.find((d: any) => d.id === selectedId);
  const templateName = (id: string | null) => id ? (templates.find(t => t.id === id)?.name || id) : 'None';

  const handleExport = () => {
    exportToCsv('edited-drafts', editedDrafts.map((d: any) => ({
      sender: d.email?.sender,
      subject: d.email?.subject,
      status: d.status,
      editedBy: d.editedBy,
      editedAt: d.editedAt,
      template: templateName(d.email?.matchedTemplateId),
    })));
  };

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-accent-text" />
            Edited Drafts
          </h1>
          <p className="text-text-secondary text-xs mt-1">Every AI draft a staff member has hand-edited, with a full before/after.</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-accent-border bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-lg font-semibold cursor-pointer transition-all">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
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
              {s === 'DRAFT' ? 'Waiting Approval' : s === 'SENT' ? 'Sent' : s === 'REJECTED' ? 'Rejected' : 'All'}
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
            {isLoading && editedDrafts.length === 0 ? (
              <div className="p-8 text-center text-text-muted">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-text" />
                Loading...
              </div>
            ) : editedDrafts.length === 0 ? (
              <div className="p-8 text-center text-text-muted">No edited drafts found.</div>
            ) : (
              editedDrafts.map((d: any) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`p-4 cursor-pointer hover:bg-surface-3 transition-colors border-l-2 ${
                    selectedId === d.id ? 'bg-surface-3 border-accent' : 'border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-text-primary truncate max-w-[65%]">{d.email?.sender}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      d.status === 'SENT' ? 'bg-success-bg border border-success/25 text-success' :
                      d.status === 'REJECTED' ? 'bg-danger-bg border border-danger/25 text-danger' :
                      'bg-warning-bg border border-warning/25 text-warning'
                    }`}>{d.status === 'DRAFT' ? 'WAITING' : d.status}</span>
                  </div>
                  <p className="text-text-secondary truncate mt-1">{d.email?.subject}</p>
                  <p className="text-[9px] text-text-muted mt-1">Edited by {d.editedBy || 'Unknown'} · {new Date(d.editedAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel rounded-xl border border-border bg-surface-2 p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted">
              <Edit3 className="w-10 h-10 text-text-muted mb-2" />
              Select an edited draft to see the full before/after.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent-text" />
                  {selected.email?.subject}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selected.status === 'SENT' ? 'bg-success-bg border border-success/25 text-success' :
                  selected.status === 'REJECTED' ? 'bg-danger-bg border border-danger/25 text-danger' :
                  'bg-warning-bg border border-warning/25 text-warning'
                }`}>{selected.status === 'DRAFT' ? 'Waiting Approval' : selected.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                <div>
                  <span className="text-text-muted uppercase font-semibold">Sender:</span>
                  <p className="text-text-primary mt-1">{selected.email?.sender}</p>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold">AI-Selected Template:</span>
                  <p className="text-accent-text font-bold mt-1">{templateName(selected.email?.matchedTemplateId)}</p>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold">Edited By:</span>
                  <p className="text-text-primary mt-1">{selected.editedBy || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold">Edited At:</span>
                  <p className="text-text-primary mt-1">{new Date(selected.editedAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-text-muted uppercase font-semibold text-[10px] flex items-center gap-1">Original AI Draft</span>
                  <div className="bg-surface-3 border border-border p-3 rounded-lg mt-1 text-text-secondary whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {selected.originalDraftBody || '(no original captured)'}
                  </div>
                </div>
                <div>
                  <span className="text-success uppercase font-semibold text-[10px] flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> Edited Draft (Current)
                  </span>
                  <div className="bg-success-bg border border-success/25 p-3 rounded-lg mt-1 text-success whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {selected.responseBody}
                  </div>
                </div>
              </div>

              {selected.status === 'SENT' && (
                <div>
                  <span className="text-text-muted uppercase font-semibold text-[10px]">Final Sent Response:</span>
                  <div className="bg-success-bg border border-success/25 p-3 rounded-lg mt-1 text-success whitespace-pre-wrap leading-relaxed">
                    {selected.responseBody}
                  </div>
                </div>
              )}

              <div>
                <span className="text-text-muted uppercase font-semibold text-[10px]">Original Customer Email:</span>
                <div className="bg-surface-3 border border-border p-3 rounded-lg mt-1 text-text-secondary whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                  {selected.email?.body}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
