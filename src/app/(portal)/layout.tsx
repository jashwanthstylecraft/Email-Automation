'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { CommandMenu } from '@/components/command-menu';
import {
  LayoutGrid, Mail, Sliders, FileText, Settings as SettingsIcon,
  Terminal, LogOut, RefreshCw, Wand2, Activity, StickyNote, History
} from 'lucide-react';
import PillNav from '@/components/PillNav';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { 
    user, fetchSession, logout, syncInbox, isLoading, 
    fetchEmails, fetchDashboard, fetchRules, fetchSettings, 
    fetchDocuments, fetchTemplates, fetchIntegrations, fetchAuditLogs 
  } = useStore();
  
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  useEffect(() => {
    const initPortal = async () => {
      await fetchSession();
      // Pre-fetch critical configurations
      fetchEmails();
      fetchDashboard();
      fetchRules();
      fetchSettings();
      fetchDocuments();
      fetchTemplates();
      fetchIntegrations();
      fetchAuditLogs();
    };
    initPortal();

    // Activity heartbeat -- keeps this agent "active" for round-robin
    // eligibility and the admin inactivity warning as long as the app is open.
    const ping = () => { fetch('/api/auth/heartbeat', { method: 'POST' }).catch(() => {}); };
    ping();
    const heartbeatTimer = setInterval(ping, 60000);
    return () => clearInterval(heartbeatTimer);
  }, []);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0c]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 text-sm">Synchronizing Secure Session...</p>
        </div>
      </div>
    );
  }

  const handleSync = async () => {
    await syncInbox();
  };

  // Note: "Classify" lives as a panel inside Inbox / Mailbox (side-by-side
  // with the email list, per the "equal size on the page" requirement)
  // rather than as its own route, so it isn't a separate nav entry here.
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
    { name: 'Inbox / Mailbox', path: '/inbox', icon: Mail },
    { name: 'Automation Rules', path: '/rules', icon: Sliders },
    { name: 'Templates', path: '/templates', icon: Terminal },
    { name: 'Knowledge Base', path: '/knowledge', icon: FileText },
    { name: 'Internal Notes', path: '/notes', icon: StickyNote },
    { name: 'Automation Logs', path: '/logs', icon: Activity },
    { name: 'Audit Logs', path: '/audit-logs', icon: History },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#08080a] bg-grid-pattern text-white">
      {/* Sidebar Navigation */}
      <aside className="w-40 border-r border-white/5 bg-[#0b0b0f]/80 backdrop-blur-md flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-white/5 gap-2.5 group cursor-pointer flex-shrink-0">
          <div className="p-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:border-violet-500/40 group-hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <Mail className="w-4 h-4 text-violet-400 transition-transform duration-500 group-hover:rotate-12" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-[11px] uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-200 transition-colors group-hover:from-violet-300 group-hover:to-white truncate">
              StyleCraft
            </h1>
            <p className="text-[7px] text-gray-500 uppercase tracking-widest font-bold transition-all group-hover:text-violet-400 truncate">
              Email Automation
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-2.5 min-h-0">
          <PillNav
            items={navItems.map(({ name, path, icon }) => ({ label: name, href: path, icon }))}
            activeHref={pathname}
            baseColor="#7c3aed"
            pillColor="transparent"
            hoveredPillTextColor="#ffffff"
            pillTextColor="#9ca3af"
          />
        </nav>

        {/* User profile / Logout */}
        <div className="p-3 border-t border-white/5 bg-black/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 mr-2">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 bg-[#0b0b0f]/60 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Quick search button */}
            <button
              onClick={() => setIsCommandOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-violet-500/30 bg-white/5 hover:bg-white/10 text-xs text-gray-400 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Search or jump to...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] border border-white/10">Ctrl+K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-violet-500/30 hover:border-violet-500 bg-violet-600/10 hover:bg-violet-600/20 text-xs text-violet-300 font-semibold cursor-pointer transition-all ${
                isLoading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Inbox
            </button>
          </div>
        </header>

        {/* Portal Page Body */}
        <main className="flex-1 overflow-y-auto bg-black/30 p-8">
          {children}
        </main>
      </div>

      {/* Ctrl+K Overlay */}
      <CommandMenu isOpen={isCommandOpen} setIsOpen={setIsCommandOpen} />
    </div>
  );
}
