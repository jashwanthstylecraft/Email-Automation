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
      <div className="p-8 text-center text-text-muted text-xs">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-text" />
        Loading customer profile...
      </div>
    );
  }

  if (!data || !data.customer) {
    return <div className="p-8 text-center text-text-muted text-xs">Customer not found.</div>;
  }

  const { customer, emails, failedMatches, notes } = data;

  return (
    <div className="space-y-6 pb-12 text-xs">
      <Link href="/customers" className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Customers
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <Users className="w-5 h-5 text-accent-text" />
          {customer.email}
        </h1>
        <p className="text-text-secondary text-xs mt-1">Customer profile & full thread history.</p>
      </div>

      <BentoSection className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Emails', value: customer.totalEmails },
          { label: 'Total Replies Sent', value: customer.totalReplies },
          { label: 'Failed Matches', value: failedMatches.length },
          { label: 'Last Contacted', value: customer.lastEmailAt ? new Date(customer.lastEmailAt).toLocaleDateString() : 'Never' },
        ].map(stat => (
          <BentoCard key={stat.label} className="glass-panel p-4 rounded-xl border border-border bg-surface-2">
            <p className="text-[9px] font-semibold text-text-secondary uppercase tracking-wider">{stat.label}</p>
            <h3 className="text-xl font-bold text-text-primary mt-2">{stat.value}</h3>
          </BentoCard>
        ))}
      </BentoSection>

      <div className="glass-panel rounded-xl border border-border bg-surface-2 p-6">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-accent-text" />
          Full Email History ({emails.length})
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {emails.map((e: any) => (
            <Link key={e.id} href={`/inbox?emailId=${e.id}`} className="block bg-surface-3 hover:bg-surface-3 p-3 rounded-lg border border-border transition-colors">
              <div className="flex justify-between items-center gap-2">
                <span className="text-text-primary font-semibold truncate max-w-[60%]">{e.subject}</span>
                <span className="text-[9px] text-text-muted flex-shrink-0">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-[9px] text-text-secondary">{e.status}</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-[9px] text-text-secondary">{e.category}</span>
                {e.autoReplies?.some((r: any) => r.status === 'SENT') && (
                  <span className="px-1.5 py-0.5 rounded bg-success-bg border border-success/25 text-[9px] text-success">Replied</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {failedMatches.length > 0 && (
        <div className="glass-panel rounded-xl border border-border bg-surface-2 p-6">
          <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-4">
            <XCircle className="w-4 h-4 text-danger" />
            Failed Matches for this Customer
          </h3>
          <div className="space-y-2">
            {failedMatches.map((f: any) => (
              <Link key={f.id} href="/failed-matches" className="block bg-surface-3 hover:bg-surface-3 p-3 rounded-lg border border-border transition-colors">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${f.status === 'Open' ? 'bg-danger-bg border border-danger/25 text-danger' : 'bg-success-bg border border-success/25 text-success'}`}>{f.status}</span>
                <span className="text-text-secondary ml-2">{new Date(f.createdAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="glass-panel rounded-xl border border-border bg-surface-2 p-6">
          <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-4">
            <StickyNote className="w-4 h-4 text-accent-text" />
            Internal Notes
          </h3>
          <div className="space-y-2">
            {notes.map((n: any) => (
              <div key={n.id} className="bg-surface-3 p-3 rounded-lg border border-border">
                <p className="text-text-primary font-semibold">{n.title}</p>
                <p className="text-text-secondary mt-1">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
