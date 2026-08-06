'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { CommandMenu } from '@/components/command-menu';
import { ThemeToggle } from '@/components/ThemeToggle';
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
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-text-secondary text-sm">Synchronizing Secure Session...</p>
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
    <div className="flex h-screen w-screen overflow-hidden bg-bg bg-grid-pattern text-text-primary">
      {/* Sidebar Navigation */}
      <aside className="w-40 border-r border-border bg-surface-1/80 backdrop-blur-md flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-border gap-2.5 group cursor-pointer flex-shrink-0">
          <div className="p-1.5 bg-accent-bg border border-accent-border rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:border-accent/40 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <Mail className="w-4 h-4 text-accent-text transition-transform duration-500 group-hover:rotate-12" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-[11px] uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-accent-text to-text-secondary transition-colors group-hover:from-accent-text group-hover:to-text-primary truncate">
              StyleCraft
            </h1>
            <p className="text-[7px] text-text-muted uppercase tracking-widest font-bold transition-all group-hover:text-accent-text truncate">
              Email Automation
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-2.5 min-h-0">
          <PillNav
            items={navItems.map(({ name, path, icon }) => ({ label: name, href: path, icon }))}
            activeHref={pathname}
            baseColor="var(--accent)"
            pillColor="transparent"
            hoveredPillTextColor="#ffffff"
            pillTextColor="var(--text-secondary)"
          />
        </nav>

        {/* User profile / Logout */}
        <div className="p-3 border-t border-border bg-surface-1 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 mr-2">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[11px] text-text-muted truncate">{user.email}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="p-2 text-text-secondary hover:text-danger rounded-lg hover:bg-surface-3 transition-colors"
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
        <header className="h-16 border-b border-border bg-surface-1/60 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Quick search button */}
            <button
              onClick={() => setIsCommandOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-border hover:border-accent-border bg-surface-2 hover:bg-surface-3 text-xs text-text-secondary flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Search or jump to...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-[9px] border border-border">Ctrl+K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent-border hover:border-accent bg-accent-bg hover:bg-accent/20 text-xs text-accent-text font-semibold cursor-pointer transition-all ${
                isLoading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Inbox
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Portal Page Body */}
        <main className="flex-1 overflow-y-auto bg-bg p-8">
          {children}
        </main>
      </div>

      {/* Ctrl+K Overlay */}
      <CommandMenu isOpen={isCommandOpen} setIsOpen={setIsCommandOpen} />
    </div>
  );
}
