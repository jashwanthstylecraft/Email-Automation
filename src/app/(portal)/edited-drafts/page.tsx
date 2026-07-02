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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-violet-400" />
            Edited Drafts
          </h1>
          <p className="text-gray-400 text-xs mt-1">Every AI draft a staff member has hand-edited, with a full before/after.</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:border-violet-500/30 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg font-semibold cursor-pointer transition-all">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-gray-500" />
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                statusFilter === s ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-gray-400 hover:text-white border border-transparent'
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
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-violet-500 text-[11px]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 overflow-hidden">
          <div className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
            {isLoading && editedDrafts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
                Loading...
              </div>
            ) : editedDrafts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No edited drafts found.</div>
            ) : (
              editedDrafts.map((d: any) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`p-4 cursor-pointer hover:bg-white/5 transition-colors border-l-2 ${
                    selectedId === d.id ? 'bg-white/5 border-violet-500' : 'border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white truncate max-w-[65%]">{d.email?.sender}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      d.status === 'SENT' ? 'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400' :
                      d.status === 'REJECTED' ? 'bg-red-600/10 border border-red-500/20 text-red-400' :
                      'bg-amber-600/10 border border-amber-500/20 text-amber-400'
                    }`}>{d.status === 'DRAFT' ? 'WAITING' : d.status}</span>
                  </div>
                  <p className="text-gray-400 truncate mt-1">{d.email?.subject}</p>
                  <p className="text-[9px] text-gray-500 mt-1">Edited by {d.editedBy || 'Unknown'} · {new Date(d.editedAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Edit3 className="w-10 h-10 text-gray-700 mb-2" />
              Select an edited draft to see the full before/after.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-violet-400" />
                  {selected.email?.subject}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selected.status === 'SENT' ? 'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400' :
                  selected.status === 'REJECTED' ? 'bg-red-600/10 border border-red-500/20 text-red-400' :
                  'bg-amber-600/10 border border-amber-500/20 text-amber-400'
                }`}>{selected.status === 'DRAFT' ? 'Waiting Approval' : selected.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                <div>
                  <span className="text-gray-500 uppercase font-semibold">Sender:</span>
                  <p className="text-white mt-1">{selected.email?.sender}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold">AI-Selected Template:</span>
                  <p className="text-violet-400 font-bold mt-1">{templateName(selected.email?.matchedTemplateId)}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold">Edited By:</span>
                  <p className="text-white mt-1">{selected.editedBy || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold">Edited At:</span>
                  <p className="text-white mt-1">{new Date(selected.editedAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 uppercase font-semibold text-[10px] flex items-center gap-1">Original AI Draft</span>
                  <div className="bg-black/20 border border-white/5 p-3 rounded-lg mt-1 text-gray-400 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {selected.originalDraftBody || '(no original captured)'}
                  </div>
                </div>
                <div>
                  <span className="text-emerald-400 uppercase font-semibold text-[10px] flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> Edited Draft (Current)
                  </span>
                  <div className="bg-emerald-950/10 border border-emerald-500/10 p-3 rounded-lg mt-1 text-emerald-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {selected.responseBody}
                  </div>
                </div>
              </div>

              {selected.status === 'SENT' && (
                <div>
                  <span className="text-gray-500 uppercase font-semibold text-[10px]">Final Sent Response:</span>
                  <div className="bg-emerald-950/5 border border-emerald-500/20 p-3 rounded-lg mt-1 text-emerald-200 whitespace-pre-wrap leading-relaxed">
                    {selected.responseBody}
                  </div>
                </div>
              )}

              <div>
                <span className="text-gray-500 uppercase font-semibold text-[10px]">Original Customer Email:</span>
                <div className="bg-black/20 border border-white/5 p-3 rounded-lg mt-1 text-gray-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
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
