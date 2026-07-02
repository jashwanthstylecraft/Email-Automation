'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { CommandMenu } from '@/components/command-menu';
import {
  LayoutGrid, Mail, Sliders, FileText, Settings as SettingsIcon,
  Terminal, LogOut, RefreshCw, Wand2, Activity, StickyNote, XCircle
} from 'lucide-react';
import Link from 'next/link';

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

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
    { name: 'Inbox Queue', path: '/inbox', icon: Mail },
    { name: 'Failed Matches', path: '/failed-matches', icon: XCircle },
    { name: 'Automation Rules', path: '/rules', icon: Sliders },
    { name: 'Reply Templates', path: '/templates', icon: Terminal },
    { name: 'Automation Logs', path: '/logs', icon: Activity },
    { name: 'Knowledge Base', path: '/knowledge', icon: FileText },
    { name: 'Internal Notes', path: '/notes', icon: StickyNote },
    { name: 'AI Prompt Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#08080a] bg-grid-pattern text-white">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-[#0b0b0f]/80 backdrop-blur-md flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="h-20 flex items-center px-6 border-b border-white/5 gap-3 group cursor-pointer">
            <div className="p-2 bg-violet-500/10 border border-violet-500/20 rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:border-violet-500/40 group-hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              <Mail className="w-5 h-5 text-violet-400 transition-transform duration-500 group-hover:rotate-12" />
            </div>
            <div>
              <h1 className="font-extrabold text-xs uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-200 transition-colors group-hover:from-violet-300 group-hover:to-white">
                StyleCraft
              </h1>
              <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold transition-all group-hover:text-violet-400">
                Email Automation
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-violet-600/10 border border-violet-500/20 text-white font-medium shadow-inner'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-violet-500' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile / Logout */}
        <div className="p-4 border-t border-white/5 bg-black/20">
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
