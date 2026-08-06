'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  Search, Terminal, Mail, Settings, LayoutGrid, FileText,
  HelpCircle, Sliders, LogOut, ArrowRight, ShieldCheck
} from 'lucide-react';

interface CommandMenuProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function CommandMenu({ isOpen, setIsOpen }: CommandMenuProps) {
  const router = useRouter();
  const { emails, selectEmail, syncInbox } = useStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const filteredEmails = search
    ? emails.filter(
        (e) =>
          e.subject.toLowerCase().includes(search.toLowerCase()) ||
          e.sender.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 4)
    : [];

  const navigate = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const handleSelectEmail = (email: any) => {
    selectEmail(email);
    navigate('/inbox');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-bg/60 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden glass-panel rounded-xl shadow-2xl border border-border glow-primary">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-surface-2">
          <Search className="w-5 h-5 text-text-secondary mr-3" />
          <input
            type="text"
            className="w-full bg-transparent text-text-primary border-0 outline-none placeholder-text-secondary text-sm focus:ring-0"
            placeholder="Type a command or search emails... (Ctrl+K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <button
            className="px-1.5 py-0.5 text-xs text-text-secondary border border-border-strong rounded bg-surface-2"
            onClick={() => setIsOpen(false)}
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-2">
          {/* Email Search Results */}
          {search && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Matching Emails
              </div>
              {filteredEmails.length === 0 ? (
                <div className="px-3 py-3 text-xs text-text-secondary text-center">
                  No emails match your query
                </div>
              ) : (
                filteredEmails.map((email) => (
                  <button
                    key={email.id}
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
                    onClick={() => handleSelectEmail(email)}
                  >
                    <div className="flex items-center min-w-0 mr-4">
                      <Mail className="w-4 h-4 text-accent-text mr-2 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">{email.subject}</p>
                        <p className="text-xs text-text-secondary truncate">{email.sender}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-text-muted" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Navigation Commands */}
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              Navigation
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                className="flex items-center px-3 py-2 text-left rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
                onClick={() => navigate('/dashboard')}
              >
                <LayoutGrid className="w-4 h-4 text-accent-text mr-2" />
                Dashboard
              </button>
              <button
                className="flex items-center px-3 py-2 text-left rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
                onClick={() => navigate('/inbox')}
              >
                <Mail className="w-4 h-4 text-accent-text mr-2" />
                Inbox
              </button>
              <button
                className="flex items-center px-3 py-2 text-left rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
                onClick={() => navigate('/rules')}
              >
                <Sliders className="w-4 h-4 text-success mr-2" />
                Automation Rules
              </button>
              <button
                className="flex items-center px-3 py-2 text-left rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
                onClick={() => navigate('/knowledge')}
              >
                <FileText className="w-4 h-4 text-warning mr-2" />
                Knowledge Base
              </button>
              <button
                className="flex items-center px-3 py-2 text-left rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
                onClick={() => navigate('/templates')}
              >
                <Terminal className="w-4 h-4 text-accent-text mr-2" />
                Reply Templates
              </button>
              <button
                className="flex items-center px-3 py-2 text-left rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
                onClick={() => navigate('/settings')}
              >
                <Settings className="w-4 h-4 text-accent-text mr-2" />
                AI Prompt Settings
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              Quick Actions
            </div>
            <button
              className="w-full flex items-center px-3 py-2 text-left rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
              onClick={async () => {
                setIsOpen(false);
                await syncInbox();
              }}
            >
              <ShieldCheck className="w-4 h-4 text-success mr-2" />
              Sync Inbox & Run AI Pipeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
