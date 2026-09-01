'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  Search, Mail, AlertTriangle, ShieldCheck, Flame,
  Send, RefreshCw, UserCheck, ShieldQuestion, HelpCircle, Edit3, Trash2, ArrowUpRight, Sparkles, Save, Check, ThumbsUp, ThumbsDown, MessageSquare, ToggleLeft, Tag, Inbox as InboxIcon, CircleDot, CheckCheck, PartyPopper, FileEdit, Archive, StickyNote, Briefcase
} from 'lucide-react';
import { parseKeywords, matchTemplates, TemplateForScoring, totalKeywordCount, extractKeywordsForTemplate, serializeKeywords } from '@/lib/keyword-engine';
import { BentoSection, BentoCard } from '@/components/MagicBento';

export default function InboxPage() {
  const {
    emails, selectedEmail, selectEmail, fetchEmails,
    approveDraft, rejectDraft, saveDraftEdits, regenerateDraft, sendCustomReply, resendReply,
    changeEmailStatus, assignEmailUser, isLoading, user, settings,
    templates, fetchTemplates, saveTemplate, deleteEmail, archiveEmail, syncInbox, fetchDashboard,
    dashboardCharts, saveNote, workload, fetchWorkload
  } = useStore();

  const TONE_OPTIONS = ['Professional', 'Friendly', 'Formal', 'Sales', 'Technical', 'Support', 'Brand Voice'];
  const [selectedTone, setSelectedTone] = useState('Professional');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('status') || 'INBOX');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeBusinessType, setActiveBusinessType] = useState('ALL');
  const [replyText, setReplyText] = useState('');
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [customReply, setCustomReply] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendText, setResendText] = useState('');
  const [isSendingResend, setIsSendingResend] = useState(false);
  const [overrideTemplateName, setOverrideTemplateName] = useState<string | null>(null);

  // Searchable Dropdown override states
  const [searchTmplQuery, setSearchTmplQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Feedback states
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [showKeywordForm, setShowKeywordForm] = useState(false);
  const [flaggedWrong, setFlaggedWrong] = useState(false);

  // Sync timestamp state
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('Never');

  // Send confirmation toast
  const [sendToast, setSendToast] = useState<string | null>(null);
  const showSendToast = (message: string) => {
    setSendToast(message);
    setTimeout(() => setSendToast(null), 3000);
  };

  // Customer thread context (previous emails from the same sender)
  const [threadContext, setThreadContext] = useState<any[]>([]);
  // Collision-prevention lock: set when this email is assigned to a
  // different support agent, making it view-only for the current user.
  const [lockInfo, setLockInfo] = useState<{ isLockedToOther: boolean; ownerName: string | null }>({ isLockedToOther: false, ownerName: null });
  useEffect(() => {
    if (!selectedEmail) {
      setThreadContext([]);
      setLockInfo({ isLockedToOther: false, ownerName: null });
      return;
    }
    fetch(`/api/inbox/${selectedEmail.id}`)
      .then(res => res.json())
      .then(data => {
        setThreadContext(data.threadContext || []);
        setLockInfo(data.lock || { isLockedToOther: false, ownerName: null });
      })
      .catch(() => {
        setThreadContext([]);
        setLockInfo({ isLockedToOther: false, ownerName: null });
      });
  }, [selectedEmail?.id]);
  const isReadOnly = lockInfo.isLockedToOther;

  // Internal Notes attached to this specific email -- staff-only, never
  // sent to the customer, shown between the message body and the AI draft.
  const [emailNotes, setEmailNotes] = useState<any[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const loadEmailNotes = async (emailId: string) => {
    if (!user) return;
    const params = new URLSearchParams({ orgId: user.organizationId, emailId });
    const res = await fetch(`/api/notes?${params}`);
    const data = await res.json();
    setEmailNotes(data.notes || []);
  };

  useEffect(() => {
    if (!selectedEmail) {
      setEmailNotes([]);
      return;
    }
    loadEmailNotes(selectedEmail.id);
  }, [selectedEmail?.id]);

  const handleAddEmailNote = async () => {
    if (!selectedEmail || !newNoteText.trim()) return;
    await saveNote({ title: newNoteText.trim().slice(0, 60), noteBody: newNoteText.trim(), relatedEmailId: selectedEmail.id });
    setNewNoteText('');
    await loadEmailNotes(selectedEmail.id);
  };

  const handleSaveNoteEdit = async (noteId: string) => {
    if (!editingNoteText.trim()) return;
    await saveNote({ id: noteId, title: editingNoteText.trim().slice(0, 60), noteBody: editingNoteText.trim() });
    setEditingNoteId(null);
    setEditingNoteText('');
    if (selectedEmail) await loadEmailNotes(selectedEmail.id);
  };

  // Edit history for this email's draft (audit log entries)
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [showEditHistory, setShowEditHistory] = useState(false);
  useEffect(() => {
    if (!selectedEmail) {
      setEditHistory([]);
      return;
    }
    fetch(`/api/logs?entityType=email&action=DRAFT_EDITED`)
      .then(res => res.json())
      .then(data => setEditHistory((data.logs || []).filter((l: any) => l.entityId === selectedEmail.id)))
      .catch(() => setEditHistory([]));
  }, [selectedEmail?.id]);

  useEffect(() => {
    fetchEmails({ status: activeFilter, search, category: activeCategory, businessType: activeBusinessType });
    fetchTemplates();
  }, [activeFilter, search, activeCategory, activeBusinessType]);

  // Keep the inbox genuinely live: actively poll the real mailbox (not just
  // re-read our own DB) every 30s, so new mail shows up without waiting on
  // Vercel's once-a-day cron or someone clicking "Sync Inbox" by hand.
  // syncInbox() hits IMAP, pulls in anything new, then internally calls
  // fetchEmails() which reuses the last explicit filters -- so the current
  // tab/search/category view is preserved automatically. Skipped while
  // actively editing/composing a reply -- fetchEmails() returns fresh
  // object references for every email, and the effect below that resets
  // replyText/isEditingDraft depends on the whole selectedEmail object, so
  // polling during an in-progress edit would silently wipe out unsaved
  // changes.
  const pollGuardRef = useRef({ isEditingDraft, isCustomMode });
  useEffect(() => {
    pollGuardRef.current = { isEditingDraft, isCustomMode };
  }, [isEditingDraft, isCustomMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      const g = pollGuardRef.current;
      if (g.isEditingDraft || g.isCustomMode) return;
      syncInbox();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Category counts and per-agent workload lanes for the Classify panel
  // (independent of the current Mailbox filter)
  useEffect(() => {
    fetchDashboard({ silent: true });
    fetchWorkload();
  }, []);

  // Classify panel: broad search across sender, subject, matched template
  // name, assigned agent, status, and matched keywords -- separate from the
  // Mailbox list's sender/subject-only search box.
  const [classifyQuery, setClassifyQuery] = useState('');
  const classifyResults = (() => {
    const q = classifyQuery.trim().toLowerCase();
    if (!q) return [];
    return emails.filter((e) => {
      const tmpl = templates.find(t => t.id === e.matchedTemplateId);
      const agent = workload.find((w: any) => w.userId === e.assignedUserId);
      const keywordBlob = tmpl ? JSON.stringify(parseKeywords(tmpl.keywords)).toLowerCase() : '';
      return (
        e.sender.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.status.toLowerCase().includes(q) ||
        (tmpl?.name.toLowerCase().includes(q)) ||
        (agent?.name.toLowerCase().includes(q)) ||
        (agent?.email.toLowerCase().includes(q)) ||
        keywordBlob.includes(q)
      );
    }).slice(0, 30);
  })();

  // Deep-link support: /inbox?emailId=... (e.g. from a customer profile) auto-selects that email once loaded
  useEffect(() => {
    const emailId = searchParams.get('emailId');
    if (!emailId || emails.length === 0) return;
    const target = emails.find(e => e.id === emailId);
    if (target) selectEmail(target);
  }, [searchParams, emails]);

  useEffect(() => {
    if (selectedEmail) {
      const draft = selectedEmail.autoReplies?.find((r) => r.status === 'DRAFT');
      setReplyText(draft?.responseBody || '');
      setIsEditingDraft(false);
      setCustomReply('');
      setIsCustomMode(false);
      setFeedbackSubmitted(false);
      setFeedbackMsg('');
      setNewKeywordInput('');
      setShowKeywordForm(false);
      setOverrideTemplateName(null);
      setFlaggedWrong(false);
      setIsResending(false);
      setResendText('');

      // Initialize searchable dropdown query text
      const matchedTmpl = templates.find(t => t.id === selectedEmail.matchedTemplateId);
      setSearchTmplQuery(matchedTmpl ? matchedTmpl.name : '');
    } else {
      setSearchTmplQuery('');
    }
  }, [selectedEmail, templates]);

  const handleApprove = async () => {
    if (!selectedEmail) return;
    await approveDraft(selectedEmail.id);
    showSendToast(`Reply sent to ${selectedEmail.sender}`);
  };

  const handleReject = async () => {
    if (!selectedEmail) return;
    await rejectDraft(selectedEmail.id);
  };

  const handleSaveDraft = async () => {
    if (!selectedEmail) return;
    await saveDraftEdits(selectedEmail.id, replyText);
    setIsEditingDraft(false);
  };

  const handleSendCustom = async () => {
    if (!selectedEmail) return;
    await sendCustomReply(selectedEmail.id, customReply);
    setCustomReply('');
    setIsCustomMode(false);
    showSendToast(`Reply sent to ${selectedEmail.sender}`);
  };

  const handleResend = async () => {
    if (!selectedEmail || !resendText.trim()) return;
    setIsSendingResend(true);
    const success = await resendReply(selectedEmail.id, resendText);
    setIsSendingResend(false);
    if (success) {
      setIsResending(false);
      setResendText('');
      showSendToast(`Corrected reply sent to ${selectedEmail.sender}`);
    }
  };

  const handleSyncInbox = async () => {
    const result = await syncInbox();
    setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    if (result.success) {
      showSendToast(
        result.syncedCount
          ? `Sync complete — ${result.syncedCount} new email${result.syncedCount === 1 ? '' : 's'} analyzed`
          : 'Sync complete — no new emails'
      );
    } else {
      showSendToast(`Sync failed: ${result.error || 'unknown error'}`);
    }
  };

  const interpolateTemplateBody = (tmpl: any, email: typeof selectedEmail) => {
    if (!email) return tmpl.body;
    const customerName = email.sender.split('@')[0].split('.')[0].replace(/^\w/, (c: string) => c.toUpperCase());
    const closing = 'Regards,\nStyleCraft US Support Team';
    let newBody = tmpl.body;
    newBody = newBody.replace(/\{\{customer_name\}\}/g, customerName);
    newBody = newBody.replace(/\{\{ticket_id\}\}/g, email.id.slice(0, 8));
    newBody = newBody.replace(/\{\{closing\}\}/g, closing);

    const hasGreeting = newBody.trim().startsWith('Hi') || newBody.trim().startsWith('Hello') || newBody.trim().startsWith('Dear') || newBody.trim().startsWith('I hope');
    if (!hasGreeting) {
      newBody = `Hello ${customerName},\n\n` + newBody;
    }
    const hasClosing = newBody.includes('Regards') || newBody.includes('Best regards') || newBody.includes('Sincerely') || newBody.includes('Thank you') || newBody.includes('Thanks') || newBody.includes('Warranty Team') || newBody.includes('Customer Service');
    if (!hasClosing) {
      newBody = newBody + `\n\n${closing}`;
    }
    return newBody;
  };

  const handleAssignTemplate = async (templateId: string) => {
    if (!selectedEmail) return;
    const selectedTmpl = templates.find(t => t.id === templateId);
    if (!selectedTmpl) return;

    // Ask the server to fill this template in for this specific email --
    // real customer name plus any order/product/part detail AI (or a
    // deterministic fallback) can pull from the customer's own message,
    // instead of leaving raw [NAME]/[ORDER_NUMBER]-style placeholders.
    setOverrideTemplateName(selectedTmpl.name);
    let newBody = interpolateTemplateBody(selectedTmpl, selectedEmail);
    try {
      const fillRes = await fetch(`/api/inbox/${selectedEmail.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FILL_TEMPLATE', templateId }),
      });
      const fillData = await fillRes.json();
      if (fillData.success && fillData.responseBody) {
        newBody = fillData.responseBody;
      }
    } catch (err) {
      console.error('FILL_TEMPLATE failed, using local interpolation:', err);
    }
    setReplyText(newBody);

    // 2. Perform database edits sequentially to prevent race conditions
    await fetch(`/api/inbox/${selectedEmail.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'EDIT_DRAFT', responseBody: newBody }),
    });

    await fetch(`/api/inbox/${selectedEmail.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ASSIGN_TEMPLATE',
        matchedTemplateId: templateId,
        aiConfidence: 1.0
      })
    });

    // NOTE: selecting a template here (dropdown or suggestion card) must
    // NEVER auto-submit match-accuracy feedback -- that only happens when
    // an agent manually clicks a feedback button (Correct/Wrong/etc. below).

    // 3. Sync list once
    await fetchEmails({ status: activeFilter, search });
    await fetchDashboard();
  };

  const handleSaveTemplateUpdate = async () => {
    if (!selectedEmail || !selectedEmail.matchedTemplateId) return;
    const matchedTmpl = templates.find(t => t.id === selectedEmail.matchedTemplateId);
    if (!matchedTmpl) return;

    if (confirm(`Do you want to permanently update the "${matchedTmpl.name}" response template with these edits? Future AI drafts will use this new text.`)) {
      await saveTemplate({
        ...matchedTmpl,
        body: replyText
      });
      
      // Submit learning log feedback
      await fetch(`/api/inbox/${selectedEmail.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_FEEDBACK',
          feedbackType: 'Save Edited Draft as Template Update',
          feedbackNotes: 'User edited reply text and saved back to database templates.'
        })
      });

      showSendToast('Template updated with your edits');
      fetchTemplates();
      await fetchDashboard();
    }
  };

  // No template matched this email, so the draft was AI-generated from
  // scratch (see src/lib/ai-pipeline.ts -- aiProvider starts with "OpenAI").
  // Offer to promote that reply into a reusable template so future emails
  // like it get matched for free next time instead of costing another call.
  const handleSaveAsNewTemplate = async () => {
    if (!selectedEmail || selectedEmail.matchedTemplateId) return;

    const defaultName = selectedEmail.subject?.slice(0, 60) || 'New Template';
    const name = window.prompt('Save this AI-generated reply as a new template. Template name:', defaultName);
    if (!name || !name.trim()) return;

    const trimmedName = name.trim();
    const structuredKeywords = extractKeywordsForTemplate(trimmedName, replyText);

    await saveTemplate({
      name: trimmedName,
      subject: `Regarding your StyleCraft inquiry: ${trimmedName}`,
      body: replyText,
      variables: 'customer_name,closing',
      keywords: serializeKeywords(structuredKeywords),
      active: true,
      notes: `Created from an AI-generated reply on ${new Date().toISOString().slice(0, 10)}.`,
    });

    await fetch(`/api/inbox/${selectedEmail.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUBMIT_FEEDBACK',
        feedbackType: 'Saved AI Reply as New Template',
        feedbackNotes: `Created new template "${trimmedName}" from an AI-generated draft.`,
      }),
    });

    showSendToast(`Saved as new template: "${trimmedName}"`);
    await fetchTemplates();
    await fetchDashboard();
  };

  const handleResetToTemplate = () => {
    if (!selectedEmail || !selectedEmail.matchedTemplateId) return;
    const matchedTmpl = templates.find(t => t.id === selectedEmail.matchedTemplateId);
    if (!matchedTmpl) return;
    if (confirm('Discard your edits and reset the draft back to the original template text?')) {
      setReplyText(interpolateTemplateBody(matchedTmpl, selectedEmail));
    }
  };

  // Feedback Actions
  const handleFeedback = async (feedbackType: string, notes?: string) => {
    if (!selectedEmail) return;

    const res = await fetch(`/api/inbox/${selectedEmail.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUBMIT_FEEDBACK',
        feedbackType,
        feedbackNotes: notes || '',
        newKeyword: notes && feedbackType === 'Add New Keyword to This Template' ? notes : undefined
      })
    });

    if (res.ok) {
      setFeedbackSubmitted(true);
      setFeedbackMsg(`Feedback "${feedbackType}" submitted! Match logs updated successfully.`);
      showSendToast(feedbackType === 'Add New Keyword to This Template' ? 'Keyword added to template' : `Feedback recorded: ${feedbackType}`);
      fetchTemplates();
      await fetchEmails({ status: activeFilter, search });
      await fetchDashboard();
    } else {
      showSendToast('Failed to submit feedback — please try again');
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordInput.trim()) return;
    await handleFeedback('Add New Keyword to This Template', newKeywordInput.trim());
    setNewKeywordInput('');
    setShowKeywordForm(false);
  };

  // Spam and Updates (promotional/social) are deliberately excluded --
  // the sync pipeline never stores them, so there's no tab for them here.
  // "Inbox" (the default) shows only active/upcoming mail that still needs
  // action; handled and archived mail lives in the Sent / Deleted tabs.
  const filterTabs = [
    { label: 'Inbox', value: 'INBOX', icon: InboxIcon },
    { label: 'All', value: 'ALL', icon: Mail },
    { label: 'Primary', value: 'PRIMARY', icon: CircleDot },
    { label: 'Drafts', value: 'DRAFTS', icon: FileEdit },
    { label: 'Sent', value: 'REPLIED', icon: CheckCheck },
    { label: 'Manual Review', value: 'WAITING', icon: ShieldQuestion },
    { label: 'Deleted / Archived', value: 'ESCALATED', icon: Archive },
  ];

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT': return 'bg-danger-bg border-danger/25 text-danger font-bold';
      case 'HIGH': return 'bg-accent-bg border-accent-border text-accent-text';
      case 'MEDIUM': return 'bg-accent-bg border-accent-border text-accent-text';
      default: return 'bg-surface-3 border-border-strong text-text-secondary';
    }
  };

  // A sender qualifies as a "Priority Sender" once they've emailed in 3+
  // times -- one step above the existing "N emails from sender" pill (which
  // already appears at totalEmails > 1), so the two badges don't overlap.
  const FREQUENT_SENDER_THRESHOLD = 3;
  const isPrioritySender = (email: any) => (email.customer?.totalEmails ?? 0) >= FREQUENT_SENDER_THRESHOLD;

  // Straight newest-first order by received date/time. Does not touch
  // fetching, filtering, or the underlying data.
  const sortedEmails = useMemo(() => {
    return [...emails].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [emails]);

  const getSentimentColor = (s: string) => {
    switch (s) {
      case 'ANGRY': return 'text-danger font-bold';
      case 'NEGATIVE': return 'text-accent-text';
      case 'POSITIVE': return 'text-success';
      default: return 'text-text-secondary';
    }
  };

  const latestDraft = selectedEmail?.autoReplies?.find((r) => r.status === 'DRAFT');
  const sentReply = selectedEmail?.autoReplies?.find((r) => r.status === 'SENT');

  // Tone is per-email, not global: default to whatever this draft was last
  // generated with, falling back to the org-wide Settings.tone, whenever a
  // different email is opened.
  useEffect(() => {
    setSelectedTone(latestDraft?.tone || settings?.tone || 'Professional');
  }, [selectedEmail?.id]);

  const handleRegenerateDraft = async () => {
    if (!selectedEmail) return;
    setIsRegenerating(true);
    await regenerateDraft(selectedEmail.id, selectedTone);
    setIsRegenerating(false);
  };

  // Matched template entity lookup (with name and slug fallbacks to prevent title mismatch bugs)
  const matchedTemplateId = selectedEmail?.matchedTemplateId;
  const matchedTemplate = matchedTemplateId 
    ? (templates.find(t => t.id === matchedTemplateId) || 
       templates.find(t => t.name.toLowerCase().trim() === matchedTemplateId.toLowerCase().trim()) ||
       templates.find(t => t.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === matchedTemplateId.replace('template-', '').toLowerCase().replace(/[^a-z0-9]/g, '-')))
    : null;

  const currentlyMatchedTemplateName = overrideTemplateName || (matchedTemplate ? matchedTemplate.name : 'None');

  // The specific keywords that actually fired for THIS email, not just the
  // template's whole keyword set — recomputed client-side from the same
  // structured keywords used server-side, since that per-match detail
  // isn't persisted on the Email record itself.
  const matchedTemplateKeywords = (() => {
    if (!matchedTemplate || !selectedEmail) return [];
    const scored = matchTemplates(
      [{ id: matchedTemplate.id, name: matchedTemplate.name, active: matchedTemplate.active, keywords: parseKeywords(matchedTemplate.keywords) }],
      selectedEmail.subject,
      selectedEmail.body
    );
    return scored.matchedTemplateId ? scored.matchedTerms : [];
  })();

  // Get Top 3 Suggested templates using the same structured scoring engine
  // that decides real incoming-email matches, so this panel honestly
  // reflects what the automated pipeline would actually choose.
  const getSuggestions = () => {
    if (!selectedEmail) return [];

    const scoringInputs: TemplateForScoring[] = templates.map(t => ({
      id: t.id,
      name: t.name,
      active: t.active,
      keywords: parseKeywords(t.keywords),
    }));

    const result = matchTemplates(scoringInputs, selectedEmail.subject, selectedEmail.body);
    return result.suggestions.map(s => ({
      id: s.templateId,
      name: s.name,
      confidence: Math.round(s.confidence * 100),
      reason: s.score > 0 ? 'See matched keywords above.' : 'No strong keyword signal — general context only.',
    }));
  };

  const categoryList = (dashboardCharts?.categories || []).slice().sort((a: any, b: any) => b.value - a.value);
  const totalCategorized = categoryList.reduce((sum: number, c: any) => sum + c.value, 0);

  return (
    <div className="flex h-[calc(100vh-10rem)] w-full gap-3 text-xs">
      {/* Left half of the page: Mailbox + Classify + Inbox Queue, sized down to fit */}
      <div className="w-1/2 flex-shrink-0 flex gap-3 min-w-0">
      {/* Mailbox folders (regular mail-client sections) */}
      <div className="w-24 flex-shrink-0 flex flex-col glass-panel rounded-xl overflow-hidden border border-border bg-bg">
        <div className="p-4 border-b border-border bg-surface-2">
          <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider flex items-center gap-1.5">
            <InboxIcon className="w-3.5 h-3.5 text-accent-text" />
            Mailbox
          </h3>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                title={tab.label}
                className={`w-full flex items-center gap-1 px-1.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeFilter === tab.value
                    ? 'bg-accent/20 text-accent-text border border-accent-border'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent'
                }`}
              >
                <Icon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate text-[10px]">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Classify panel */}
      <div className="w-52 flex-shrink-0 flex flex-col glass-panel rounded-xl overflow-hidden border border-border bg-bg">
        <div className="p-4 border-b border-border bg-surface-2 space-y-3">
          <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-accent-text" />
            Classify
          </h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2" />
            <input
              type="text"
              value={classifyQuery}
              onChange={(e) => setClassifyQuery(e.target.value)}
              placeholder="Search sender, subject, template, agent, status..."
              className="w-full bg-bg border border-border rounded-lg pl-7 pr-2.5 py-1.5 text-[10px] text-text-primary outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {classifyQuery.trim() ? (
            <div className="p-2 space-y-1.5">
              <p className="text-[9px] text-text-muted uppercase font-semibold px-1">{classifyResults.length} match{classifyResults.length === 1 ? '' : 'es'}</p>
              {classifyResults.map((e) => (
                <button
                  key={e.id}
                  onClick={() => selectEmail(e)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    selectedEmail?.id === e.id
                      ? 'bg-accent/20 border-accent-border'
                      : 'bg-surface-2 border-border hover:bg-surface-3'
                  }`}
                >
                  <p className="text-text-primary font-semibold truncate">{e.subject}</p>
                  <p className="text-[9px] text-text-muted truncate mt-0.5">{e.sender}</p>
                  <p className="text-[9px] text-accent-text mt-0.5">{e.status}</p>
                </button>
              ))}
              {classifyResults.length === 0 && (
                <p className="text-center text-text-muted text-[10px] py-4 px-2 leading-relaxed">No matches for "{classifyQuery}".</p>
              )}
            </div>
          ) : (
            <>
              {/* Support agent lanes: admins see all three, agents see only their own row */}
              {workload.length > 0 && (
                <BentoSection className="p-2 space-y-1.5 border-b border-border">
                  <p className="text-[9px] text-text-muted uppercase font-semibold px-1 pb-1">Support Lanes</p>
                  {workload.map((w: any) => (
                    <BentoCard
                      key={w.userId}
                      glowColor={w.isInactiveWithPending ? '239, 68, 68' : undefined}
                      particleCount={4}
                      className={`p-2.5 rounded-lg border ${w.isInactiveWithPending ? 'border-danger/25 bg-danger-bg' : 'border-border bg-surface-2'}`}
                    >
                      <div className="flex justify-between items-center gap-1">
                        <span className="text-text-primary font-bold truncate">{w.name}</span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.isActive ? 'bg-success' : 'bg-text-muted'}`} title={w.isActive ? 'Active' : 'Offline'}></span>
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 font-mono text-[9px] text-text-secondary">
                        <span>Assigned {w.assignedTotal}</span>
                        <span>Replied {w.respondedCount}</span>
                        <span>Left {w.leftToRespond}</span>
                        <span className={w.overdueCount > 0 ? 'text-danger font-bold' : ''}>Overdue {w.overdueCount}</span>
                      </div>
                      {w.isInactiveWithPending && (
                        <p className="text-[9px] text-danger font-bold mt-1">⚠ Inactive / pending</p>
                      )}
                    </BentoCard>
                  ))}
                </BentoSection>
              )}

              {/* Category classification */}
              <div className="p-2 space-y-1">
                <button
                  onClick={() => setActiveCategory('ALL')}
                  className={`w-full flex items-center justify-between gap-1 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    activeCategory === 'ALL'
                      ? 'bg-accent/20 text-accent-text border border-accent-border'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent'
                  }`}
                >
                  <span className="truncate">All Categories</span>
                  <span className="text-[9px] font-mono text-text-muted flex-shrink-0">{totalCategorized}</span>
                </button>

                {categoryList.map((cat: any) => (
                  <button
                    key={cat.name}
                    onClick={() => setActiveCategory(cat.name)}
                    title={cat.name}
                    className={`w-full flex items-center justify-between gap-1 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      activeCategory === cat.name
                        ? 'bg-accent/20 text-accent-text border border-accent-border'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-[9px] font-mono text-text-muted flex-shrink-0">{cat.value}</span>
                  </button>
                ))}

                {categoryList.length === 0 && (
                  <p className="text-center text-text-muted text-[10px] py-4 px-2 leading-relaxed">No categorized emails yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inbox Queue: fills remaining space within the left half */}
      <div className="flex-1 min-w-0 flex flex-col glass-panel rounded-xl overflow-hidden border border-border bg-bg">
        {/* Sync Controls Header */}
        <div className="p-4 border-b border-border bg-surface-2 flex justify-between items-center gap-3">
          <div>
            <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider flex items-center gap-2">
              Inbox Queue
              {activeCategory !== 'ALL' && (
                <button
                  onClick={() => setActiveCategory('ALL')}
                  className="normal-case font-semibold px-2 py-0.5 rounded-full bg-accent/20 border border-accent-border text-accent-text text-[9px] flex items-center gap-1 cursor-pointer hover:bg-accent/30"
                  title="Clear category filter"
                >
                  {activeCategory} <span className="text-accent-text">×</span>
                </button>
              )}
            </h3>
            <p className="text-[9px] text-text-muted mt-0.5">Last synced: <span className="text-accent-text font-medium font-mono">{lastSyncedAt}</span></p>
          </div>
          <button
            onClick={handleSyncInbox}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:bg-accent-hover text-[10px] text-white rounded-lg font-bold cursor-pointer transition-colors shadow-lg shadow-accent/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Inbox Now
          </button>
        </div>

        {/* B2C / B2B filter -- one inbox, filtered by customer type rather than separate tabs */}
        <div className="px-4 py-2 border-b border-border bg-surface-1 flex items-center gap-2">
          <span className="text-[9px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> Customer Type
          </span>
          <div className="flex gap-1">
            {['ALL', 'B2C', 'B2B'].map((bt) => (
              <button
                key={bt}
                onClick={() => setActiveBusinessType(bt)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer transition-colors ${
                  activeBusinessType === bt
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 border border-border text-text-secondary hover:text-text-primary hover:bg-surface-3'
                }`}
              >
                {bt === 'ALL' ? 'All' : bt}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border relative">
          <Search className="w-4 h-4 text-text-muted absolute left-7 top-7" />
          <input
            type="text"
            className="w-full bg-bg border border-border rounded-lg pl-10 pr-4 py-2 text-xs text-text-primary outline-none focus:border-accent transition-colors"
            placeholder="Search sender, subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Email list container */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {isLoading && emails.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-text" />
              Syncing inboxes...
            </div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              No real data available yet.
            </div>
          ) : (
            sortedEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => selectEmail(email)}
                className={`p-4 cursor-pointer hover:bg-surface-3 transition-colors border-l-2 ${
                  selectedEmail?.id === email.id
                    ? 'bg-surface-2 border-accent'
                    : 'border-transparent'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="truncate max-w-[50%]">
                    <span className="font-bold text-text-primary block truncate" title={email.sender}>
                      {email.sender.split('@')[0].split('.')[0].replace(/^\w/, c => c.toUpperCase())}
                    </span>
                    <span className="text-[9px] text-text-muted block truncate">{email.sender}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this email permanently?')) {
                          deleteEmail(email.id);
                        }
                      }}
                      className="p-1 hover:bg-surface-3 rounded text-danger hover:text-danger transition-colors cursor-pointer"
                      title="Delete Email"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Archive this email?')) {
                          archiveEmail(email.id);
                        }
                      }}
                      className="p-1 hover:bg-surface-3 rounded text-accent-text hover:text-accent-text transition-colors cursor-pointer"
                      title="Archive Email"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[9px] text-text-muted whitespace-nowrap" title={new Date(email.createdAt).toLocaleString()}>
                      {new Date(email.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}, {new Date(email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <h4 className="font-semibold text-text-secondary truncate mt-1">{email.subject}</h4>
                <p className="text-[11px] text-text-muted truncate mt-1">{email.preview}</p>
                
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {email.status === 'REPLIED' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-success-bg border border-success/25 text-[9px] uppercase tracking-wider font-mono font-bold text-success" title="A reply has already been sent for this email">
                      <CheckCheck className="w-3 h-3" /> Sent
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded border text-[9px] uppercase tracking-wider font-mono ${getPriorityBadge(email.priority)}`}>
                    {email.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[9px] text-text-secondary">
                    {email.category}
                  </span>
                  {isPrioritySender(email) && (
                    <span className="px-2 py-0.5 rounded bg-warning-bg border border-warning/25 text-[9px] text-warning font-mono font-bold" title="This sender has emailed 3+ times -- respond promptly">
                      PRIORITY SENDER
                    </span>
                  )}
                  {email.customer && email.customer.totalEmails > 1 && (
                    <span className="px-2 py-0.5 rounded bg-accent-bg border border-accent-border text-[9px] text-accent-text font-mono" title="Total emails received from this sender">
                      {email.customer.totalEmails} emails from sender
                    </span>
                  )}
                  {email.aiConfidence > 0 && (
                    <span className="px-2 py-0.5 rounded bg-accent-bg border border-accent-border text-[9px] text-accent-text font-mono">
                      {Math.round(email.aiConfidence * 100)}% Match
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>

      {/* Right half of the page: email contents and drafting workstation (mail editor) */}
      <div className="w-1/2 flex-shrink-0 flex flex-col justify-between glass-panel rounded-xl border border-border bg-bg overflow-y-auto">
        {!selectedEmail ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
            <Mail className="w-12 h-12 text-text-muted mb-2 animate-pulse" />
            <p>Select an email from the queue list to open review workstation.</p>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-6 flex-1">

              {isReadOnly && (
                <div className="p-3 bg-danger-bg border border-danger/25 rounded-xl flex items-center gap-2 text-danger">
                  <UserCheck className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[11px] font-semibold">
                    Currently being handled by {lockInfo.ownerName || 'another support agent'}. You can view this email but cannot edit the draft, submit feedback, or send a reply.
                  </span>
                </div>
              )}

              {/* Customer Profile Panel */}
              {(selectedEmail.customer || threadContext.length > 0) && (
                <div className="glass-panel p-4 rounded-xl border border-border bg-surface-2 space-y-3">
                  <div className="flex items-center gap-2 text-accent-text font-bold border-b border-border pb-2">
                    <UserCheck className="w-4 h-4" />
                    Customer Profile — {selectedEmail.sender}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[10px]">
                    <div>
                      <span className="text-text-muted uppercase font-semibold">Total Emails:</span>
                      <p className="text-text-primary font-bold mt-1">{selectedEmail.customer?.totalEmails ?? threadContext.length + 1}</p>
                    </div>
                    <div>
                      <span className="text-text-muted uppercase font-semibold">Total Replies Sent:</span>
                      <p className="text-text-primary font-bold mt-1">{selectedEmail.customer?.totalReplies ?? 0}</p>
                    </div>
                    <div>
                      <span className="text-text-muted uppercase font-semibold">Last Contacted:</span>
                      <p className="text-text-primary font-bold mt-1">{selectedEmail.customer?.lastEmailAt ? new Date(selectedEmail.customer.lastEmailAt).toLocaleDateString() : 'First contact'}</p>
                    </div>
                    <div>
                      <span className="text-text-muted uppercase font-semibold">Thread Count:</span>
                      <p className="text-text-primary font-bold mt-1">{threadContext.length}</p>
                    </div>
                  </div>
                  {threadContext.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-text-muted uppercase font-semibold text-[9px]">Previous Emails from this Sender:</span>
                      <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
                        {threadContext.map((t: any) => (
                          <div key={t.id} className="flex justify-between items-center bg-surface-2 p-2 rounded text-[10px]">
                            <span className="text-text-secondary truncate max-w-[70%]">{t.subject}</span>
                            <span className="text-text-muted text-[9px] flex-shrink-0">{new Date(t.createdAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Detailed AI Response Draft Specs */}
              <div className="glass-panel p-4 rounded-xl border border-border bg-surface-2 space-y-3">
                <div className="flex items-center gap-2 text-accent-text font-bold border-b border-border pb-2">
                  <Sparkles className="w-4 h-4 text-accent-text animate-spin-slow" />
                  <h3>AI Response Draft (Auto Generated) — Chosen: "{currentlyMatchedTemplateName}"</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono text-[10px]">
                  <div>
                    <span className="text-text-muted uppercase font-semibold">Chosen Template:</span>
                    <p className="text-success font-bold mt-1 truncate">{currentlyMatchedTemplateName}</p>
                  </div>
                  <div>
                    <span className="text-text-muted uppercase font-semibold">Selected Template:</span>
                    <p className="text-success font-bold mt-1 truncate">{currentlyMatchedTemplateName}</p>
                  </div>
                  <div>
                    <span className="text-text-muted uppercase font-semibold">Match Confidence:</span>
                    <p className="text-text-primary font-bold mt-1">{Math.round(selectedEmail.aiConfidence * 100)}%</p>
                  </div>
                  <div>
                    <span className="text-text-muted uppercase font-semibold">Status Flag:</span>
                    <p className="text-accent-text font-bold mt-1 uppercase">
                      {selectedEmail.status === 'REPLIED' ? 'Sent' :
                       selectedEmail.status === 'UNREAD' && selectedEmail.aiConfidence >= 0.85 ? 'Draft' :
                       selectedEmail.aiConfidence >= 0.60 ? 'Needs Review' : 'Manual Review'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-muted uppercase font-semibold">AI Selection Reason:</span>
                    <p className="text-text-secondary mt-1 italic leading-relaxed">{selectedEmail.summary || 'Keyword match criteria triggered fallback draft.'}</p>
                  </div>
                  <div>
                    <span className="text-text-muted uppercase font-semibold">Matched Keywords:</span>
                    <p className="text-accent-text font-semibold mt-1 truncate">
                      {matchedTemplateKeywords.length > 0 ? matchedTemplateKeywords.join(', ') : matchedTemplate ? 'Matched via AI semantic analysis, not keywords' : 'None'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top 3 Suggestions Panel */}
              <div className="glass-panel p-4 rounded-xl border border-border bg-surface-2 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Suggested Response Templates & Manual Dropdown Override</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {getSuggestions().map((tmpl) => (
                    <div key={tmpl.id} className="p-3 bg-surface-2 border border-border rounded-lg flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-text-primary truncate max-w-[80%]">{tmpl.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-accent-bg border border-accent-border text-[9px] text-accent-text font-bold">{tmpl.confidence}%</span>
                        </div>
                        <p className="text-[9px] text-text-muted mt-1 line-clamp-2 leading-relaxed">{tmpl.reason}</p>
                      </div>
                      <button
                        onClick={() => handleAssignTemplate(tmpl.id)}
                        disabled={isReadOnly}
                        className="w-full text-center py-1 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-[10px] text-white rounded font-semibold cursor-pointer transition-colors"
                      >
                        Assign Response
                      </button>
                    </div>
                  ))}

                  {/* Manual Dropdown Selector Card */}
                  <div
                    className="p-3 bg-accent-bg border border-accent-border rounded-lg flex flex-col justify-between space-y-2 relative"
                    onMouseLeave={() => setIsDropdownOpen(false)}
                  >
                    <div>
                      <span className="font-bold text-accent-text block">Manual Override</span>
                      <p className="text-[9px] text-text-muted mt-1 leading-relaxed">Type to filter and assign any active template.</p>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchTmplQuery}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          setSearchTmplQuery(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        className="bg-bg border border-border rounded px-2.5 py-1 text-text-secondary outline-none focus:border-accent text-[10px] w-full pr-6 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="absolute right-2 top-1.5 text-text-secondary hover:text-text-primary text-[9px] cursor-pointer"
                      >
                        ▼
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-surface-3 border border-border rounded-lg shadow-xl divide-y divide-border scrollbar-thin">
                          {templates
                            .filter(t => t.name.toLowerCase().includes(searchTmplQuery.toLowerCase()))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  handleAssignTemplate(t.id);
                                  setSearchTmplQuery(t.name);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 hover:bg-accent/25 text-[9px] transition-colors truncate cursor-pointer block ${t.active === false ? 'text-text-muted italic' : 'text-text-secondary hover:text-text-primary'}`}
                                title={t.active === false ? `${t.name} (Disabled/Manual Only)` : t.name}
                              >
                                {t.name} {t.active === false ? ' (disabled)' : ''}
                              </button>
                            ))
                          }
                          {templates.filter(t => t.name.toLowerCase().includes(searchTmplQuery.toLowerCase())).length === 0 && (
                            <p className="p-2 text-center text-text-muted text-[9px]">No matching templates</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback Actions Section */}
              <div className="glass-panel p-4 rounded-xl border border-border bg-surface-2 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Match Accuracy Feedback (AI Learning Layer)</h4>
                  {selectedEmail.userFeedback && (
                    <span className="px-2 py-0.5 rounded bg-success-bg border border-success/25 text-[9px] text-success font-mono font-bold">
                      Saved: {selectedEmail.userFeedback}
                    </span>
                  )}
                </div>

                {feedbackSubmitted && (
                  <div className="p-2.5 bg-success-bg border border-success/25 rounded-lg text-[10px] text-success flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    {feedbackMsg}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleFeedback('Correct Template')}
                    disabled={!!selectedEmail.userFeedback || isReadOnly}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback
                        ? 'border-border bg-surface-2 text-text-muted cursor-not-allowed opacity-50'
                        : 'border-border hover:border-success bg-surface-2 hover:bg-success-bg text-text-secondary hover:text-success cursor-pointer'
                    }`}
                  >
                    <ThumbsUp className="w-3 h-3" /> Correct Template
                  </button>
                  <button
                    onClick={() => {
                      setFlaggedWrong(true);
                      handleFeedback('Wrong Template');
                    }}
                    disabled={!!selectedEmail.userFeedback || isReadOnly}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback
                        ? 'border-border bg-surface-2 text-text-muted cursor-not-allowed opacity-50'
                        : 'border-border hover:border-danger bg-surface-2 hover:bg-danger-bg text-text-secondary hover:text-danger cursor-pointer'
                    }`}
                  >
                    <ThumbsDown className="w-3 h-3" /> Wrong Template
                  </button>
                  <button
                    onClick={() => {
                      handleFeedback('Better Template Exists');
                      // Focus the search dropdown by default
                      const inputEl = document.querySelector('input[placeholder="Search templates..."]') as HTMLInputElement;
                      if (inputEl) inputEl.focus();
                    }}
                    disabled={!!selectedEmail.userFeedback || isReadOnly}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback
                        ? 'border-border bg-surface-2 text-text-muted cursor-not-allowed opacity-50'
                        : 'border-border hover:border-warning bg-surface-2 hover:bg-warning-bg text-text-secondary hover:text-warning cursor-pointer'
                    }`}
                  >
                    <ShieldQuestion className="w-3 h-3" /> Better Template Exists
                  </button>
                  <button
                    onClick={() => setShowKeywordForm(!showKeywordForm)}
                    disabled={!!selectedEmail.userFeedback || isReadOnly}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback
                        ? 'border-border bg-surface-2 text-text-muted cursor-not-allowed opacity-50'
                        : 'border-border hover:border-accent bg-surface-2 hover:bg-accent-bg text-text-secondary hover:text-accent-text cursor-pointer'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" /> Add Keyword
                  </button>
                  <button
                    onClick={() => handleFeedback('Disable This Rule')}
                    disabled={!!selectedEmail.userFeedback || isReadOnly}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback
                        ? 'border-border bg-surface-2 text-text-muted cursor-not-allowed opacity-50'
                        : 'border-border hover:border-danger bg-surface-2 hover:bg-danger/15 text-text-secondary hover:text-danger cursor-pointer'
                    }`}
                  >
                    <ToggleLeft className="w-3 h-3" /> Disable Template Rule
                  </button>
                </div>

                {flaggedWrong && (
                  <p className="text-[10px] text-danger font-semibold mt-2 animate-pulse flex items-center gap-1">
                    <span>⚠️ Wrong template flagged. Please type to search and select the correct template in the "Manual Override" dropdown above to save correction.</span>
                  </p>
                )}

                {showKeywordForm && (
                  <form onSubmit={handleAddKeyword} className="flex gap-2 items-center mt-3">
                    <input
                      type="text"
                      value={newKeywordInput}
                      onChange={(e) => setNewKeywordInput(e.target.value)}
                      placeholder="Enter new trigger keyword (e.g. 'warranty tag')..."
                      className="bg-bg border border-border rounded-lg px-3 py-1.5 text-text-primary outline-none focus:border-accent flex-1 text-[11px]"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold cursor-pointer"
                    >
                      Save Keyword
                    </button>
                  </form>
                )}
              </div>

              {/* Email Content Box (Customer Email) */}
              <div>
                <div className="px-3 py-1.5 bg-surface-2 border border-border rounded-t-xl text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-text-secondary" />
                  Original Message Body
                </div>
                <div className="bg-bg border border-t-0 border-border p-5 rounded-b-xl text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {selectedEmail.body}
                </div>
              </div>

              {/* Internal Notes (staff-only -- never sent to the customer) -- sits between the Customer Email above and the AI Response Draft below */}
              <div>
                <div className="px-3 py-1.5 bg-accent-bg border border-accent-border rounded-t-xl text-[10px] font-semibold text-accent-text uppercase tracking-wider flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-accent-text" />
                  Internal Notes (Staff Only — Never Sent to Customer)
                </div>
                <div className="bg-accent-bg border border-t-0 border-accent-border rounded-b-xl p-4 space-y-3">
                  {emailNotes.length === 0 && (
                    <p className="text-[10px] text-text-muted text-center py-2">No internal notes on this email yet.</p>
                  )}
                  {emailNotes.map((note: any) => (
                    <div key={note.id} className="bg-surface-2 border border-border rounded-lg p-3 text-[11px]">
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            rows={3}
                            className="w-full bg-bg border border-border rounded-lg p-2 text-text-primary outline-none focus:border-accent resize-none text-[11px]"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }} className="text-[10px] text-text-secondary hover:text-text-primary font-semibold cursor-pointer">Cancel</button>
                            <button onClick={() => handleSaveNoteEdit(note.id)} className="text-[10px] text-accent-text hover:text-accent-text font-semibold cursor-pointer">Save</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-text-secondary whitespace-pre-wrap leading-relaxed">{note.body}</p>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                            <span className="text-text-muted text-[9px]">
                              {note.createdByName || 'Unknown'} · {new Date(note.updatedAt || note.createdAt).toLocaleString()}
                            </span>
                            <button
                              onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.body); }}
                              className="text-[9px] text-accent-text hover:text-accent-text font-semibold cursor-pointer flex items-center gap-0.5"
                            >
                              <Edit3 className="w-2.5 h-2.5" /> Edit
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 items-start pt-1">
                    <textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      rows={2}
                      placeholder="Add an internal note about this email (visible only to staff)..."
                      className="flex-1 bg-bg border border-border rounded-lg p-2.5 text-text-primary outline-none focus:border-accent resize-none text-[11px]"
                    />
                    <button
                      onClick={handleAddEmailNote}
                      disabled={!newNoteText.trim()}
                      className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] rounded-lg font-semibold cursor-pointer transition-colors flex-shrink-0"
                    >
                      Add Note
                    </button>
                  </div>
                </div>
              </div>

              {/* Per-Email Tone Selector -- changes this email's draft only, never the org-wide Settings.tone */}
              {(latestDraft || replyText) && !isCustomMode && !sentReply && !isReadOnly && (
                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-surface-2 border border-border rounded-lg flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Tone</span>
                    <select
                      value={selectedTone}
                      onChange={(e) => setSelectedTone(e.target.value)}
                      className="bg-surface-3 border border-border-strong rounded-md px-2 py-1 text-xs text-text-primary cursor-pointer focus:outline-none focus:border-accent"
                    >
                      {TONE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {latestDraft?.tone && (
                      <span className="text-[10px] text-text-muted">Last generated: {latestDraft.tone}</span>
                    )}
                  </div>
                  <button
                    onClick={handleRegenerateDraft}
                    disabled={isRegenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-xs text-white rounded-lg font-semibold cursor-pointer transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                    {isRegenerating ? 'Regenerating...' : 'Regenerate Draft'}
                  </button>
                </div>
              )}

              {/* AI Draft Section */}
              {(latestDraft || replyText) && !isCustomMode && (
                <div>
                  {selectedEmail.summary?.includes('Similar reply already sent') && (
                    <div className="mb-2 p-2.5 bg-warning-bg border border-warning/25 rounded-lg flex items-center gap-2 text-warning">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-[11px] font-semibold">⚠️ Similar reply already sent to this customer within the last 24 hours — review carefully before sending again.</span>
                    </div>
                  )}
                  <div className="px-3 py-1.5 bg-accent-bg border border-accent-border rounded-t-xl text-[10px] font-semibold text-accent-text uppercase tracking-wider flex justify-between items-center flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 truncate max-w-[60%]">
                      <ShieldCheck className="w-3.5 h-3.5 text-accent-text animate-pulse" />
                      AI Response Draft (Auto Generated) — Chosen: "{currentlyMatchedTemplateName}"
                      {latestDraft?.wasEdited && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-accent-bg border border-accent-border text-accent-text text-[9px] normal-case font-bold">Edited Draft</span>
                      )}
                    </span>
                    <div className="flex gap-3 items-center">
                      {editHistory.length > 0 && (
                        <button onClick={() => setShowEditHistory(!showEditHistory)} className="text-[10px] text-text-secondary hover:text-text-primary font-semibold cursor-pointer normal-case">
                          {showEditHistory ? 'Hide' : 'Show'} Edit History ({editHistory.length})
                        </button>
                      )}
                      {isEditingDraft ? (
                        <>
                          <button onClick={handleSaveDraft} className="text-xs text-success hover:text-success font-semibold cursor-pointer">
                            Save Edits
                          </button>
                          {selectedEmail.matchedTemplateId ? (
                            <>
                              <button onClick={handleSaveTemplateUpdate} className="text-xs text-accent-text hover:text-accent-text font-semibold flex items-center gap-1 cursor-pointer">
                                <Save className="w-3 h-3" /> Update Response Template
                              </button>
                              <button onClick={handleResetToTemplate} className="text-xs text-warning hover:text-warning font-semibold cursor-pointer">
                                Reset to Template
                              </button>
                            </>
                          ) : (
                            <button onClick={handleSaveAsNewTemplate} className="text-xs text-success hover:text-success font-semibold flex items-center gap-1 cursor-pointer">
                              <Save className="w-3 h-3" /> Save as New Template
                            </button>
                          )}
                          <button onClick={() => { setReplyText(latestDraft.responseBody); setIsEditingDraft(false); }} className="text-xs text-text-secondary hover:text-text-primary font-semibold cursor-pointer">
                            Cancel
                          </button>
                        </>
                      ) : !isReadOnly ? (
                        <button onClick={() => setIsEditingDraft(true)} className="text-xs text-accent-text hover:text-accent-text font-semibold flex items-center gap-0.5 cursor-pointer">
                          <Edit3 className="w-3 h-3" /> Edit Draft
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="bg-accent-bg border border-t-0 border-accent-border rounded-b-xl overflow-hidden">
                    {isEditingDraft ? (
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={8}
                        className="w-full bg-bg border-0 p-5 text-xs text-text-primary outline-none focus:ring-0 resize-none font-sans leading-relaxed"
                      />
                    ) : (
                      <div className="p-5 text-xs text-accent-text whitespace-pre-wrap leading-relaxed font-sans">
                        {replyText}
                      </div>
                    )}
                    {showEditHistory && editHistory.length > 0 && (
                      <div className="border-t border-accent-border p-4 space-y-2 bg-bg">
                        <p className="text-[9px] text-text-muted uppercase font-semibold tracking-wider">Edit History</p>
                        {editHistory.map((h: any) => (
                          <div key={h.id} className="text-[10px] bg-surface-2 p-2.5 rounded border border-border">
                            <div className="flex justify-between">
                              <span className="text-text-primary font-semibold">{h.userEmail || 'Unknown'}</span>
                              <span className="text-text-muted">{new Date(h.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                              <p className="text-text-muted bg-bg p-1.5 rounded max-h-16 overflow-y-auto whitespace-pre-wrap">{h.beforeValue}</p>
                              <p className="text-success bg-bg p-1.5 rounded max-h-16 overflow-y-auto whitespace-pre-wrap">{h.afterValue}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Custom manual reply console */}
              {isCustomMode && (
                <div>
                  <div className="px-3 py-1.5 bg-accent-bg border border-accent-border rounded-t-xl text-[10px] font-semibold text-accent-text uppercase tracking-wider flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-accent-text" />
                      Compose Custom Response
                    </span>
                    <button onClick={() => setIsCustomMode(false)} className="text-xs text-text-secondary hover:text-text-primary font-semibold cursor-pointer">
                      Cancel
                    </button>
                  </div>
                  <div className="bg-bg border border-t-0 border-accent-border rounded-b-xl overflow-hidden p-4 space-y-3">
                    <textarea
                      value={customReply}
                      onChange={(e) => setCustomReply(e.target.value)}
                      rows={6}
                      placeholder="Type your response here..."
                      className="w-full bg-bg border border-border rounded-lg p-3 text-xs text-text-primary outline-none focus:border-accent resize-none font-sans leading-relaxed"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSendCustom}
                        disabled={!customReply.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-xs rounded-lg font-semibold text-white transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send Custom Reply
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sent reply history */}
              {sentReply && (
                <div>
                  <div className="px-3 py-1.5 bg-success-bg border border-success/25 rounded-t-xl text-[10px] font-semibold text-success uppercase tracking-wider flex justify-between items-center flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-success" />
                      Auto-Reply Sent Successfully
                    </span>
                    {!isResending && !isReadOnly && (
                      <button
                        onClick={() => { setResendText(sentReply.responseBody); setIsResending(true); }}
                        className="flex items-center gap-1 text-[10px] text-success hover:text-success font-semibold cursor-pointer normal-case"
                      >
                        <RefreshCw className="w-3 h-3" /> Wrong? Resend Corrected Reply
                      </button>
                    )}
                  </div>
                  <div className="bg-success-bg border border-t-0 border-success/25 rounded-b-xl overflow-hidden">
                    {isResending ? (
                      <div className="p-4 space-y-3">
                        <textarea
                          value={resendText}
                          onChange={(e) => setResendText(e.target.value)}
                          rows={8}
                          autoFocus
                          className="w-full bg-surface-2 border border-border-strong rounded-lg p-3 text-xs text-text-primary focus:outline-none focus:border-accent resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setIsResending(false); setResendText(''); }}
                            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleResend}
                            disabled={isSendingResend || !resendText.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-xs text-white rounded-lg font-semibold cursor-pointer transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {isSendingResend ? 'Sending...' : 'Send Corrected Reply'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="p-5 text-xs text-success whitespace-pre-wrap leading-relaxed">
                        {sentReply.responseBody}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="p-6 border-t border-border bg-bg flex justify-between items-center gap-4 flex-shrink-0">
              <div className="flex gap-2">
                {!sentReply && !isCustomMode && !isReadOnly && (
                  <button
                    onClick={() => setIsCustomMode(true)}
                    className="px-4 py-2 border border-border hover:border-accent-border bg-surface-2 hover:bg-surface-3 text-xs rounded-lg font-semibold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                  >
                    Write Manual Reply
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this email permanently?')) {
                      deleteEmail(selectedEmail.id);
                    }
                  }}
                  disabled={isReadOnly}
                  className="flex items-center gap-1.5 px-3 py-2 border border-danger/25 hover:border-danger bg-danger-bg hover:bg-danger/15 text-xs rounded-lg font-semibold text-danger transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Delete Email Permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Email
                </button>
                <button
                  onClick={() => {
                    if (confirm('Archive this email?')) {
                      archiveEmail(selectedEmail.id);
                    }
                  }}
                  disabled={isReadOnly}
                  className="flex items-center gap-1.5 px-3 py-2 border border-accent-border hover:border-accent bg-accent-bg hover:bg-accent/15 text-xs rounded-lg font-semibold text-accent-text transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Archive Email to Escalated"
                >
                  <Save className="w-3.5 h-3.5" />
                  Archive Email
                </button>
              </div>

              <div className="flex gap-2">
                {latestDraft && !sentReply && !isCustomMode && !isReadOnly && (
                  <>
                    <button
                      onClick={handleReject}
                      className="flex items-center gap-1.5 px-4 py-2 border border-danger/25 hover:border-danger bg-danger-bg hover:bg-danger/20 text-xs rounded-lg font-semibold text-danger transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Discard Draft
                    </button>
                    <button
                      onClick={handleApprove}
                      className="flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-xs rounded-lg font-semibold text-white shadow-lg shadow-accent/20 hover:shadow-accent/35 transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Approve & Send
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Animated send confirmation toast */}
      <AnimatePresence>
        {sendToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-success text-text-primary shadow-2xl shadow-success/40 border border-success/25"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
            >
              <PartyPopper className="w-4 h-4" />
            </motion.span>
            <span className="text-xs font-semibold">{sendToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
