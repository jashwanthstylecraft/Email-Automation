'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Settings as SettingsIcon, Save, Layers, ShieldAlert, CheckCircle,
  Mail, Users, Plus, ShieldCheck, HelpCircle
} from 'lucide-react';

export default function SettingsPage() {
  const { 
    settings, fetchSettings, saveSettings, user, 
    integrations, fetchIntegrations, saveIntegration
  } = useStore();

  const [systemPrompt, setSystemPrompt] = useState('');
  const [tone, setTone] = useState('Professional');
  const [greeting, setGreeting] = useState('Hello,');
  const [closing, setClosing] = useState('Regards,\nSupport Team');
  const [autoReplyMode, setAutoReplyMode] = useState('DRAFT');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchIntegrations();
  }, []);

  useEffect(() => {
    if (settings) {
      setSystemPrompt(settings.systemPrompt);
      setTone(settings.tone);
      setGreeting(settings.greeting);
      setClosing(settings.closing);
      setAutoReplyMode(settings.autoReplyMode);
      setConfidenceThreshold(settings.confidenceThreshold);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings({
      systemPrompt,
      tone,
      greeting,
      closing,
      autoReplyMode: autoReplyMode as any,
      confidenceThreshold: parseFloat(confidenceThreshold.toString()),
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12 text-xs">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            AI Prompt & Organization Settings
          </h1>
          <p className="text-text-secondary text-xs mt-1">
            Configure system prompts, brand voice constraints, human-in-the-loop review parameters, and API credentials.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle: Prompt configuration */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-xl border border-border space-y-6">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-accent-text" />
              AI Prompt Parameters
            </h3>

            {/* Prompt Textarea */}
            <div>
              <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">
                System Prompt Instructions
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="w-full bg-surface-3 border border-border rounded-lg p-3 text-text-primary outline-none focus:border-accent font-sans leading-relaxed"
                placeholder="Instructions guiding the agent's behavior..."
              />
              <p className="text-[10px] text-text-muted mt-1">
                Provide strict context constraints, guidelines on parsing inquiries, and rules on handling angry tickets.
              </p>
            </div>

            {/* Tone & Greetings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent cursor-pointer"
                >
                  <option value="Professional">Professional</option>
                  <option value="Friendly">Friendly</option>
                  <option value="Formal">Formal</option>
                  <option value="Sales">Sales</option>
                  <option value="Technical">Technical</option>
                  <option value="Support">Support</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Opening Greeting</label>
                <input
                  type="text"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Confidence Threshold</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1.0"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Closing Signature */}
            <div>
              <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Closing Signature</label>
              <textarea
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                rows={3}
                className="w-full bg-surface-3 border border-border rounded-lg p-3 text-text-primary outline-none focus:border-accent font-mono"
              />
            </div>
          </div>
        </div>

        {/* Right Panel: Auto Reply Mode & Inbox Stats */}
        <div className="space-y-6">
          {/* Approval Mode */}
          <div className="glass-panel p-6 rounded-xl border border-border space-y-6">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent-text" />
              Reply Approval Mode
            </h3>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-2 cursor-pointer hover:bg-surface-3 transition-colors">
                <input
                  type="radio"
                  name="autoReplyMode"
                  value="DRAFT"
                  checked={autoReplyMode === 'DRAFT'}
                  onChange={() => setAutoReplyMode('DRAFT')}
                  className="mt-0.5 text-accent focus:ring-accent cursor-pointer"
                />
                <div>
                  <p className="font-semibold text-text-primary">AI Draft → Human Approval</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    Replies are drafted using company knowledge and stored in the review queue. Operators approve or edit drafts before sending.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-2 cursor-pointer hover:bg-surface-3 transition-colors">
                <input
                  type="radio"
                  name="autoReplyMode"
                  value="AUTO"
                  checked={autoReplyMode === 'AUTO'}
                  onChange={() => setAutoReplyMode('AUTO')}
                  className="mt-0.5 text-accent focus:ring-accent cursor-pointer"
                />
                <div>
                  <p className="font-semibold text-text-primary">Fully Automatic</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    AI automatically sends replies without human approval, provided the AI confidence matches the threshold filter.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-2 cursor-pointer hover:bg-surface-3 transition-colors">
                <input
                  type="radio"
                  name="autoReplyMode"
                  value="MANUAL"
                  checked={autoReplyMode === 'MANUAL'}
                  onChange={() => setAutoReplyMode('MANUAL')}
                  className="mt-0.5 text-accent focus:ring-accent cursor-pointer"
                />
                <div>
                  <p className="font-semibold text-text-primary">Manual Only</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    AI drafting is deactivated. Support agents compile and write every response from scratch.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Inbox connection status */}
          <div className="glass-panel p-6 rounded-xl border border-border space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Mail className="w-4 h-4 text-accent-text" />
              Connected Mailbox
            </h3>

            <div className="p-3 bg-success-bg border border-success/25 text-success rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-semibold text-xs">support@stylecraftus.com</p>
                <p className="text-[9px] uppercase font-mono mt-0.5">IMAP/SMTP Connection Active</p>
              </div>
            </div>
          </div>

          {/* Submit/Save Button */}
          <button
            type="submit"
            className="w-full flex justify-center items-center gap-1.5 px-4 py-2.5 bg-accent hover:bg-accent-hover text-xs font-semibold rounded-lg text-white transition-all cursor-pointer shadow-lg shadow-accent/15"
          >
            {isSaved ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Settings Saved Successfully
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Organization Configuration
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
