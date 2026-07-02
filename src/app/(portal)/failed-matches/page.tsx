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
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-400" />
          Failed Matches
        </h1>
        <p className="text-gray-400 text-xs mt-1">Emails where a staff member flagged the AI-selected template as wrong.</p>
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
              {s}
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
            {isLoading && failedMatches.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
                Loading...
              </div>
            ) : failedMatches.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No failed matches found.</div>
            ) : (
              failedMatches.map((f: any) => (
                <div
                  key={f.id}
                  onClick={() => { setSelectedId(f.id); setReviewNotes(f.notes || ''); }}
                  className={`p-4 cursor-pointer hover:bg-white/5 transition-colors border-l-2 ${
                    selectedId === f.id ? 'bg-white/5 border-violet-500' : 'border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white truncate max-w-[65%]">{f.email?.sender}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      f.status === 'Open' ? 'bg-red-600/10 border border-red-500/20 text-red-400' :
                      f.status === 'Reviewed' ? 'bg-amber-600/10 border border-amber-500/20 text-amber-400' :
                      'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400'
                    }`}>{f.status}</span>
                  </div>
                  <p className="text-gray-400 truncate mt-1">{f.email?.subject}</p>
                  <p className="text-[9px] text-gray-500 mt-1">{new Date(f.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <ShieldQuestion className="w-10 h-10 text-gray-700 mb-2" />
              Select a failed match to see full details.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-violet-400" />
                  {selected.email?.subject}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selected.status === 'Open' ? 'bg-red-600/10 border border-red-500/20 text-red-400' :
                  selected.status === 'Reviewed' ? 'bg-amber-600/10 border border-amber-500/20 text-amber-400' :
                  'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400'
                }`}>{selected.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                <div>
                  <span className="text-gray-500 uppercase font-semibold">Sender:</span>
                  <p className="text-white mt-1">{selected.email?.sender}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold">Flagged By:</span>
                  <p className="text-white mt-1">{selected.userEmail || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold">AI-Selected Template:</span>
                  <p className="text-red-400 font-bold mt-1">{templateName(selected.aiSelectedTemplateId)}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold">Corrected Template:</span>
                  <p className="text-emerald-400 font-bold mt-1">{templateName(selected.correctedTemplateId)}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold">Match Confidence:</span>
                  <p className="text-white mt-1">{Math.round((selected.confidenceScore || 0) * 100)}%</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold">Flagged At:</span>
                  <p className="text-white mt-1">{new Date(selected.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <span className="text-gray-500 uppercase font-semibold text-[10px]">AI Selection Reason:</span>
                <p className="text-gray-300 italic mt-1 bg-black/20 border border-white/5 p-3 rounded-lg">{selected.aiReason || 'None recorded.'}</p>
              </div>

              <div>
                <span className="text-gray-500 uppercase font-semibold text-[10px]">Original Customer Email:</span>
                <div className="bg-black/20 border border-white/5 p-3 rounded-lg mt-1 text-gray-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {selected.email?.body}
                </div>
              </div>

              <div>
                <label className="block text-gray-500 uppercase font-semibold text-[10px] mb-1">Internal Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-violet-500 text-[11px]"
                  placeholder="Add notes about this review..."
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button onClick={() => handleUpdateStatus('Open')} className="px-3 py-1.5 border border-red-500/20 hover:border-red-500 bg-red-600/5 hover:bg-red-600/15 text-red-300 rounded-lg font-semibold cursor-pointer transition-all">Mark Open</button>
                <button onClick={() => handleUpdateStatus('Reviewed')} className="px-3 py-1.5 border border-amber-500/20 hover:border-amber-500 bg-amber-600/5 hover:bg-amber-600/15 text-amber-300 rounded-lg font-semibold cursor-pointer transition-all">Mark Reviewed</button>
                <button onClick={() => handleUpdateStatus('Resolved')} className="px-3 py-1.5 border border-emerald-500/20 hover:border-emerald-500 bg-emerald-600/5 hover:bg-emerald-600/15 text-emerald-300 rounded-lg font-semibold cursor-pointer transition-all">Mark Resolved</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
