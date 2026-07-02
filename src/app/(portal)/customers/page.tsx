'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useSearchParams } from 'next/navigation';
import { Users, Search, RefreshCw, Download, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { exportToCsv } from '@/lib/csv-export';

export default function CustomersPage() {
  const { customers, fetchCustomers, isLoading } = useStore();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  useEffect(() => {
    fetchCustomers(search || undefined);
  }, [search]);

  const handleExport = () => {
    exportToCsv('customers', customers.map((c: any) => ({
      email: c.email,
      totalEmails: c.totalEmails,
      totalReplies: c.totalReplies,
      lastEmailAt: c.lastEmailAt,
    })));
  };

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Customers
          </h1>
          <p className="text-gray-400 text-xs mt-1">Every sender grouped into a customer profile, with full email/reply history.</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:border-violet-500/30 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg font-semibold cursor-pointer transition-all">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Search by email address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-violet-500"
        />
      </div>

      <div className="glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 overflow-hidden">
        {isLoading && customers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
            Loading...
          </div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No customers found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                <th className="p-4">Email Address</th>
                <th className="p-4">Total Emails</th>
                <th className="p-4">Total Replies</th>
                <th className="p-4">Last Contacted</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {customers.map((c: any) => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-semibold text-white">{c.email}</td>
                  <td className="p-4 text-gray-300 font-mono">{c.totalEmails}</td>
                  <td className="p-4 text-gray-300 font-mono">{c.totalReplies}</td>
                  <td className="p-4 text-gray-400">{c.lastEmailAt ? new Date(c.lastEmailAt).toLocaleDateString() : '—'}</td>
                  <td className="p-4">
                    <Link href={`/customers/${c.id}`} className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors">
                      View Profile <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
