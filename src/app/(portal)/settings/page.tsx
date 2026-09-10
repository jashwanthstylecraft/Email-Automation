'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Settings as SettingsIcon, Save, Layers, ShieldAlert, CheckCircle,
  Mail, Users, Plus, ShieldCheck, HelpCircle, Briefcase, Trash2, PenLine
} from 'lucide-react';

export default function SettingsPage() {
  const {
    settings, fetchSettings, saveSettings, user,
    integrations, fetchIntegrations, saveIntegration,
    b2bSenders, fetchB2BSenders, addB2BSender, deleteB2BSender,
    updateSignature, connectedInbox,
  } = useStore();

  const [systemPrompt, setSystemPrompt] = useState('');
  const [tone, setTone] = useState('Professional');
  const [greeting, setGreeting] = useState('Hello,');
  const [closing, setClosing] = useState('Regards,\nSupport Team');
  const [autoReplyMode, setAutoReplyMode] = useState('DRAFT');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);
  const [templateSheetUrl, setTemplateSheetUrl] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const [newB2BSender, setNewB2BSender] = useState('');
  const [b2bError, setB2bError] = useState('');
  const [b2bFilter, setB2bFilter] = useState('');
  const [signature, setSignature] = useState('');
  const [isSignatureSaved, setIsSignatureSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchIntegrations();
    fetchB2BSenders();
  }, []);

  useEffect(() => {
    setSignature(user?.signature || '');
  }, [user?.signature]);

  const handleAddB2BSender = async () => {
    if (!newB2BSender.trim()) return;
    setB2bError('');
    const success = await addB2BSender(newB2BSender.trim());
    if (success) {
      setNewB2BSender('');
    } else {
      setB2bError('Could not add that sender/domain -- it may already be on the list.');
    }
  };

  const handleSaveSignature = async () => {
    const success = await updateSignature(signature);
    if (success) {
      setIsSignatureSaved(true);
      setTimeout(() => setIsSignatureSaved(false), 2000);
    }
  };

  useEffect(() => {
    if (settings) {
      setSystemPrompt(settings.systemPrompt);
      setTone(settings.tone);
      setGreeting(settings.greeting);
      setClosing(settings.closing);
      setAutoReplyMode(settings.autoReplyMode);
      setConfidenceThreshold(settings.confidenceThreshold);
      setTemplateSheetUrl(settings.templateSheetUrl || '');
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
      templateSheetUrl: templateSheetUrl.trim() || null,
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

            {/* Template Spreadsheet URL -- the sheet the Templates page's "Sync from Spreadsheet" button pulls from */}
            <div>
              <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Template Spreadsheet URL</label>
              <input
                type="text"
                value={templateSheetUrl}
                onChange={(e) => setTemplateSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent font-mono"
              />
              <p className="text-[10px] text-text-muted mt-1">
                The Google Sheet templates/keywords are synced from (Templates page → Sync from Spreadsheet). Share it as "Anyone with the link" (Viewer) so the server can read it.
              </p>
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

            {connectedInbox ? (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                connectedInbox.status === 'CONNECTED'
                  ? 'bg-success-bg border border-success/25 text-success'
                  : 'bg-danger-bg border border-danger/25 text-danger'
              }`}>
                {connectedInbox.status === 'CONNECTED' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-xs">{connectedInbox.emailAddress}</p>
                  <p className="text-[9px] uppercase font-mono mt-0.5">
                    {connectedInbox.provider} · {connectedInbox.status === 'CONNECTED' ? 'IMAP/SMTP Connection Active' : connectedInbox.status}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-surface-3 border border-border text-text-muted rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <p className="text-xs">No mailbox connected for this organization yet.</p>
              </div>
            )}
          </div>

          {/* Per-user reply signature -- overrides the org-wide Closing
              Signature above for replies YOU send; falls back to it when left blank. */}
          <div className="glass-panel p-6 rounded-xl border border-border space-y-3">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <PenLine className="w-4 h-4 text-accent-text" />
              My Signature
            </h3>
            <p className="text-[10px] text-text-secondary">
              Used instead of the org-wide closing signature on replies you personally send. Leave blank to use the org default.
            </p>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={3}
              placeholder={closing || 'Regards,\nSupport Team'}
              className="w-full bg-surface-3 border border-border rounded-lg p-3 text-text-primary outline-none focus:border-accent font-mono"
            />
            <button
              type="button"
              onClick={handleSaveSignature}
              className="w-full flex justify-center items-center gap-1.5 px-3 py-2 bg-surface-3 hover:bg-surface-2 border border-border-strong text-xs font-semibold rounded-lg text-text-primary transition-all cursor-pointer"
            >
              {isSignatureSaved ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Signature Saved
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save My Signature
                </>
              )}
            </button>
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

      {/* B2B Sender List -- admin-managed allow-list that drives the B2C/B2B
          classification (Email.businessType), replacing the old keyword heuristic. */}
      <div className="glass-panel p-6 rounded-xl border border-border space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-accent-text" />
            B2B Sender List
          </h3>
          <p className="text-[10px] text-text-secondary mt-1">
            Emails from any address or domain on this list are classified B2B (visible via the B2B filter in the inbox). Everything else is B2C.
          </p>
        </div>

        <div className="flex gap-2 max-w-lg">
          <input
            type="text"
            value={newB2BSender}
            onChange={(e) => { setNewB2BSender(e.target.value); setB2bError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddB2BSender(); } }}
            placeholder="buyer@wholesale.com or wholesale.com"
            className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={handleAddB2BSender}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-xs font-semibold rounded-lg text-white transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
        {b2bError && <p className="text-[10px] text-danger">{b2bError}</p>}

        {b2bSenders.length > 0 && (
          <div className="flex items-center justify-between max-w-lg">
            <input
              type="text"
              value={b2bFilter}
              onChange={(e) => setB2bFilter(e.target.value)}
              placeholder="Filter senders..."
              className="w-48 bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-text-primary outline-none focus:border-accent text-[11px]"
            />
            <span className="text-[10px] text-text-muted">{b2bSenders.length} total</span>
          </div>
        )}

        <div className="space-y-1.5 max-w-lg max-h-96 overflow-y-auto pr-1">
          {b2bSenders.length === 0 ? (
            <p className="text-[10px] text-text-muted py-2">No B2B senders added yet -- all mail currently classifies as B2C.</p>
          ) : (
            b2bSenders
              .filter((s: any) => s.value.toLowerCase().includes(b2bFilter.trim().toLowerCase()))
              .map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border">
                  <span className="text-text-secondary font-mono truncate">{s.value}</span>
                  <button
                    type="button"
                    onClick={() => deleteB2BSender(s.id)}
                    className="text-text-muted hover:text-danger transition-colors cursor-pointer flex-shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
