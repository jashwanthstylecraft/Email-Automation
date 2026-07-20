'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Users, ArrowLeft, Mail, XCircle, StickyNote, RefreshCw } from 'lucide-react';
import { BentoSection, BentoCard } from '@/components/MagicBento';

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<{ customer: any; emails: any[]; failedMatches: any[]; notes: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/customers/${id}`)
      .then(res => res.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 text-xs">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
        Loading customer profile...
      </div>
    );
  }

  if (!data || !data.customer) {
    return <div className="p-8 text-center text-gray-500 text-xs">Customer not found.</div>;
  }

  const { customer, emails, failedMatches, notes } = data;

  return (
    <div className="space-y-6 pb-12 text-xs">
      <Link href="/customers" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Customers
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          {customer.email}
        </h1>
        <p className="text-gray-400 text-xs mt-1">Customer profile & full thread history.</p>
      </div>

      <BentoSection className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Emails', value: customer.totalEmails },
          { label: 'Total Replies Sent', value: customer.totalReplies },
          { label: 'Failed Matches', value: failedMatches.length },
          { label: 'Last Contacted', value: customer.lastEmailAt ? new Date(customer.lastEmailAt).toLocaleDateString() : 'Never' },
        ].map(stat => (
          <BentoCard key={stat.label} className="glass-panel p-4 rounded-xl border border-white/5 bg-[#0b0b0f]/60">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
            <h3 className="text-xl font-bold text-white mt-2">{stat.value}</h3>
          </BentoCard>
        ))}
      </BentoSection>

      <div className="glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 p-6">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-violet-400" />
          Full Email History ({emails.length})
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {emails.map((e: any) => (
            <Link key={e.id} href={`/inbox?emailId=${e.id}`} className="block bg-white/5 hover:bg-white/10 p-3 rounded-lg border border-white/5 transition-colors">
              <div className="flex justify-between items-center gap-2">
                <span className="text-white font-semibold truncate max-w-[60%]">{e.subject}</span>
                <span className="text-[9px] text-gray-500 flex-shrink-0">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-gray-400">{e.status}</span>
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-gray-400">{e.category}</span>
                {e.autoReplies?.some((r: any) => r.status === 'SENT') && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600/10 border border-emerald-500/20 text-[9px] text-emerald-400">Replied</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {failedMatches.length > 0 && (
        <div className="glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 p-6">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
            <XCircle className="w-4 h-4 text-red-400" />
            Failed Matches for this Customer
          </h3>
          <div className="space-y-2">
            {failedMatches.map((f: any) => (
              <Link key={f.id} href="/failed-matches" className="block bg-white/5 hover:bg-white/10 p-3 rounded-lg border border-white/5 transition-colors">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${f.status === 'Open' ? 'bg-red-600/10 border border-red-500/20 text-red-400' : 'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400'}`}>{f.status}</span>
                <span className="text-gray-400 ml-2">{new Date(f.createdAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 p-6">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
            <StickyNote className="w-4 h-4 text-cyan-400" />
            Internal Notes
          </h3>
          <div className="space-y-2">
            {notes.map((n: any) => (
              <div key={n.id} className="bg-white/5 p-3 rounded-lg border border-white/5">
                <p className="text-white font-semibold">{n.title}</p>
                <p className="text-gray-400 mt-1">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
