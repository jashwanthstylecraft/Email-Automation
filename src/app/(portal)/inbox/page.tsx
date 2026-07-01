'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { 
  Search, Mail, AlertTriangle, ShieldCheck, Flame, Ban, 
  Send, RefreshCw, UserCheck, ShieldQuestion, HelpCircle, Edit3, Trash2, ArrowUpRight, Sparkles, Save, Check, ThumbsUp, ThumbsDown, MessageSquare, ToggleLeft
} from 'lucide-react';

export default function InboxPage() {
  const { 
    emails, selectedEmail, selectEmail, fetchEmails, 
    approveDraft, rejectDraft, saveDraftEdits, sendCustomReply,
    changeEmailStatus, assignEmailUser, isLoading, user,
    templates, fetchTemplates, saveTemplate, deleteEmail, archiveEmail, syncInbox, fetchDashboard
  } = useStore();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [replyText, setReplyText] = useState('');
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [customReply, setCustomReply] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
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

  useEffect(() => {
    fetchEmails({ status: activeFilter, search });
    fetchTemplates();
  }, [activeFilter, search]);

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
  };

  const handleSyncInbox = async () => {
    await syncInbox();
    setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  const handleAssignTemplate = async (templateId: string) => {
    if (!selectedEmail) return;
    const selectedTmpl = templates.find(t => t.id === templateId);
    if (!selectedTmpl) return;

    // 1. Interpolate variables for the selected template
    const customerName = selectedEmail.sender.split('@')[0].split('.')[0].replace(/^\w/, (c) => c.toUpperCase());
    const closing = 'Regards,\nStyleCraft US Support Team';
    let newBody = selectedTmpl.body;
    newBody = newBody.replace(/\{\{customer_name\}\}/g, customerName);
    newBody = newBody.replace(/\{\{ticket_id\}\}/g, selectedEmail.id.slice(0, 8));
    newBody = newBody.replace(/\{\{closing\}\}/g, closing);

    // Dynamic greeting/signature check
    const hasGreeting = newBody.trim().startsWith('Hi') || newBody.trim().startsWith('Hello') || newBody.trim().startsWith('Dear') || newBody.trim().startsWith('I hope');
    if (!hasGreeting) {
      newBody = `Hello ${customerName},\n\n` + newBody;
    }
    const hasClosing = newBody.includes('Regards') || newBody.includes('Best regards') || newBody.includes('Sincerely') || newBody.includes('Thank you') || newBody.includes('Thanks') || newBody.includes('Warranty Team') || newBody.includes('Customer Service');
    if (!hasClosing) {
      newBody = newBody + `\n\n${closing}`;
    }

    // Set local state instantly
    setReplyText(newBody);
    setOverrideTemplateName(selectedTmpl.name);

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

    await fetch(`/api/inbox/${selectedEmail.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUBMIT_FEEDBACK',
        feedbackType: 'Wrong Template Override',
        feedbackNotes: `User manually reassigned email to template ID: ${templateId}`,
        approvedTemplateId: templateId,
        rejectedTemplateId: selectedEmail.matchedTemplateId
      })
    });

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

      alert('Template updated successfully!');
      fetchTemplates();
      await fetchDashboard();
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
      fetchTemplates();
      await fetchEmails({ status: activeFilter, search });
      await fetchDashboard();
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordInput.trim()) return;
    await handleFeedback('Add New Keyword to This Template', newKeywordInput.trim());
    setNewKeywordInput('');
    setShowKeywordForm(false);
  };

  const filterTabs = [
    { label: 'All', value: 'ALL' },
    { label: 'Unread', value: 'UNREAD' },
    { label: 'Manual Review Queue', value: 'WAITING' },
    { label: 'Replied', value: 'REPLIED' },
    { label: 'Escalated', value: 'ESCALATED' },
    { label: 'Spam', value: 'SPAM' },
  ];

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT': return 'bg-red-500/10 border-red-500/30 text-red-400 font-bold';
      case 'HIGH': return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'MEDIUM': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default: return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

  const getSentimentColor = (s: string) => {
    switch (s) {
      case 'ANGRY': return 'text-red-400 font-bold';
      case 'NEGATIVE': return 'text-orange-400';
      case 'POSITIVE': return 'text-emerald-400';
      default: return 'text-gray-400';
    }
  };

  const latestDraft = selectedEmail?.autoReplies?.find((r) => r.status === 'DRAFT');
  const sentReply = selectedEmail?.autoReplies?.find((r) => r.status === 'SENT');

  // Matched template entity lookup (with name and slug fallbacks to prevent title mismatch bugs)
  const matchedTemplateId = selectedEmail?.matchedTemplateId;
  const matchedTemplate = matchedTemplateId 
    ? (templates.find(t => t.id === matchedTemplateId) || 
       templates.find(t => t.name.toLowerCase().trim() === matchedTemplateId.toLowerCase().trim()) ||
       templates.find(t => t.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === matchedTemplateId.replace('template-', '').toLowerCase().replace(/[^a-z0-9]/g, '-')))
    : null;

  const currentlyMatchedTemplateName = overrideTemplateName || (matchedTemplate ? matchedTemplate.name : 'None');

  // Get Top 3 Suggested templates dynamically based on email content text similarity
  const getSuggestions = () => {
    if (!selectedEmail) return [];
    
    const emailText = (selectedEmail.subject + ' ' + selectedEmail.body).toLowerCase();
    const scoredList: { id: string; name: string; score: number; reason: string }[] = [];
    const stopwords = new Set(['and', 'the', 'for', 'with', 'your', 'about', 'this', 'that', 'from', 'have', 'been', 'will', 'are', 'not', 'but', 'out']);

    for (const t of templates) {
      if (t.active === false) continue;
      
      let score = 0;
      let matchedKeyword = '';

      // Collect keywords from tags and title
      const keywords: string[] = [];
      if (t.variables) {
        keywords.push(...t.variables.split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
      }
      keywords.push(t.name.toLowerCase().trim());

      for (const kw of keywords) {
        if (kw.length < 3) continue;

        // 1. Verbatim match
        if (emailText.includes(kw)) {
          const currentScore = kw.length * 10;
          if (currentScore > score) {
            score = currentScore;
            matchedKeyword = kw;
          }
        } else {
          // 2. Multi-word overlap check
          const words = kw.split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));
          if (words.length > 0) {
            let matchedWordsCount = 0;
            for (const w of words) {
              if (emailText.includes(w)) {
                matchedWordsCount++;
              }
            }
            if (matchedWordsCount === words.length) {
              const currentScore = kw.length * 5;
              if (currentScore > score) {
                score = currentScore;
                matchedKeyword = kw;
              }
            } else if (matchedWordsCount > 0) {
              const currentScore = matchedWordsCount * 3;
              if (currentScore > score) {
                score = currentScore;
                matchedKeyword = words.filter(w => emailText.includes(w)).join(' ');
              }
            }
          }
        }
      }

      scoredList.push({
        id: t.id,
        name: t.name,
        score,
        reason: matchedKeyword ? `Matched terms: "${matchedKeyword}"` : 'General context relevance.'
      });
    }

    // Sort by score descending
    scoredList.sort((a, b) => b.score - a.score);

    // Map top 3 to suggestions with confidence ranges
    return scoredList.slice(0, 3).map((item, idx) => {
      let confidence = 15;
      if (item.score > 50) confidence = 88 - idx * 6;
      else if (item.score > 20) confidence = 68 - idx * 12;
      else if (item.score > 0) confidence = 48 - idx * 18;
      else confidence = 18 - idx * 5;

      return {
        id: item.id,
        name: item.name,
        confidence: Math.max(5, confidence),
        reason: item.reason
      };
    });
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] w-full gap-6 text-xs">
      {/* Left panel: list of emails */}
      <div className="w-1/3 flex flex-col glass-panel rounded-xl overflow-hidden border border-white/5 bg-[#0b0b0f]/60">
        {/* Sync Controls Header */}
        <div className="p-4 border-b border-white/5 bg-[#121217]/30 flex justify-between items-center gap-3">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Inbox Queue</h3>
            <p className="text-[9px] text-gray-500 mt-0.5">Last synced: <span className="text-violet-400 font-medium font-mono">{lastSyncedAt}</span></p>
          </div>
          <button
            onClick={handleSyncInbox}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-[10px] text-white rounded-lg font-bold cursor-pointer transition-colors shadow-lg shadow-violet-950/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Inbox Now
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/5 relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-7 top-7" />
          <input
            type="text"
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-violet-500 transition-colors"
            placeholder="Search sender, subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters Tabs */}
        <div className="flex border-b border-white/5 overflow-x-auto scrollbar-none px-2 py-1.5 gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                activeFilter === tab.value
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Email list container */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {isLoading && emails.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
              Syncing inboxes...
            </div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No real data available yet.
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                onClick={() => selectEmail(email)}
                className={`p-4 cursor-pointer hover:bg-white/5 transition-colors border-l-2 ${
                  selectedEmail?.id === email.id
                    ? 'bg-white/5 border-violet-500'
                    : 'border-transparent'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-white truncate max-w-[50%]">{email.sender}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this email permanently?')) {
                          deleteEmail(email.id);
                        }
                      }}
                      className="p-1 hover:bg-white/10 rounded text-red-400 hover:text-red-300 transition-colors cursor-pointer"
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
                      className="p-1 hover:bg-white/10 rounded text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                      title="Archive Email"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[9px] text-gray-500 whitespace-nowrap">
                      {new Date(email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-300 truncate mt-1">{email.subject}</h4>
                <p className="text-[11px] text-gray-500 truncate mt-1">{email.preview}</p>
                
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  <span className={`px-2 py-0.5 rounded border text-[9px] uppercase tracking-wider font-mono ${getPriorityBadge(email.priority)}`}>
                    {email.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-gray-400">
                    {email.category}
                  </span>
                  {email.aiConfidence > 0 && (
                    <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[9px] text-violet-300 font-mono">
                      {Math.round(email.aiConfidence * 100)}% Match
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: email contents and drafting workstation */}
      <div className="flex-1 flex flex-col justify-between glass-panel rounded-xl border border-white/5 bg-[#0b0b0f]/60 overflow-y-auto">
        {!selectedEmail ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Mail className="w-12 h-12 text-gray-700 mb-2 animate-pulse" />
            <p>Select an email from the queue list to open review workstation.</p>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-6 flex-1">
              
              {/* Detailed AI Response Draft Specs */}
              <div className="glass-panel p-4 rounded-xl border border-white/5 bg-[#121217]/50 space-y-3">
                <div className="flex items-center gap-2 text-violet-400 font-bold border-b border-white/5 pb-2">
                  <Sparkles className="w-4 h-4 text-violet-400 animate-spin-slow" />
                  <h3>AI Response Draft (Auto Generated) — Chosen: "{currentlyMatchedTemplateName}"</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono text-[10px]">
                  <div>
                    <span className="text-gray-500 uppercase font-semibold">Chosen Template:</span>
                    <p className="text-emerald-400 font-bold mt-1 truncate">{currentlyMatchedTemplateName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase font-semibold">Selected Template:</span>
                    <p className="text-emerald-400 font-bold mt-1 truncate">{currentlyMatchedTemplateName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase font-semibold">Match Confidence:</span>
                    <p className="text-white font-bold mt-1">{Math.round(selectedEmail.aiConfidence * 100)}%</p>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase font-semibold">Status Flag:</span>
                    <p className="text-violet-300 font-bold mt-1 uppercase">
                      {selectedEmail.status === 'REPLIED' ? 'Sent' : 
                       selectedEmail.status === 'UNREAD' && selectedEmail.aiConfidence >= 0.85 ? 'Draft' : 
                       selectedEmail.aiConfidence >= 0.60 ? 'Needs Review' : 'Manual Review'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 uppercase font-semibold">AI Selection Reason:</span>
                    <p className="text-gray-300 mt-1 italic leading-relaxed">{selectedEmail.summary || 'Keyword match criteria triggered fallback draft.'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase font-semibold">Matched Keywords:</span>
                    <p className="text-violet-300 font-semibold mt-1 truncate">
                      {matchedTemplate?.variables || 'None'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top 3 Suggestions Panel */}
              <div className="glass-panel p-4 rounded-xl border border-white/5 bg-[#121217]/50 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Suggested Response Templates & Manual Dropdown Override</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {getSuggestions().map((tmpl) => (
                    <div key={tmpl.id} className="p-3 bg-white/5 border border-white/5 rounded-lg flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-white truncate max-w-[80%]">{tmpl.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-[9px] text-violet-300 font-bold">{tmpl.confidence}%</span>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{tmpl.reason}</p>
                      </div>
                      <button
                        onClick={() => handleAssignTemplate(tmpl.id)}
                        className="w-full text-center py-1 bg-violet-600 hover:bg-violet-500 text-[10px] text-white rounded font-semibold cursor-pointer transition-colors"
                      >
                        Assign Response
                      </button>
                    </div>
                  ))}

                  {/* Manual Dropdown Selector Card */}
                  <div 
                    className="p-3 bg-violet-950/10 border border-violet-500/20 rounded-lg flex flex-col justify-between space-y-2 relative"
                    onMouseLeave={() => setIsDropdownOpen(false)}
                  >
                    <div>
                      <span className="font-bold text-violet-300 block">Manual Override</span>
                      <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">Type to filter and assign any active template.</p>
                    </div>
                    
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchTmplQuery}
                        onChange={(e) => {
                          setSearchTmplQuery(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        className="bg-black/40 border border-white/10 rounded px-2.5 py-1 text-gray-200 outline-none focus:border-violet-500 text-[10px] w-full pr-6"
                      />
                      <button 
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="absolute right-2 top-1.5 text-gray-400 hover:text-white text-[9px] cursor-pointer"
                      >
                        ▼
                      </button>
                      
                      {isDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#0f0f15] border border-white/10 rounded-lg shadow-xl divide-y divide-white/5 scrollbar-thin">
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
                                className={`w-full text-left px-2.5 py-1.5 hover:bg-violet-600/25 text-[9px] transition-colors truncate cursor-pointer block ${t.active === false ? 'text-gray-500 italic' : 'text-gray-300 hover:text-white'}`}
                                title={t.active === false ? `${t.name} (Disabled/Manual Only)` : t.name}
                              >
                                {t.name} {t.active === false ? ' (disabled)' : ''}
                              </button>
                            ))
                          }
                          {templates.filter(t => t.name.toLowerCase().includes(searchTmplQuery.toLowerCase())).length === 0 && (
                            <p className="p-2 text-center text-gray-500 text-[9px]">No matching templates</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback Actions Section */}
              <div className="glass-panel p-4 rounded-xl border border-white/5 bg-[#121217]/50 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Match Accuracy Feedback (AI Learning Layer)</h4>
                  {selectedEmail.userFeedback && (
                    <span className="px-2 py-0.5 rounded bg-emerald-600/10 border border-emerald-500/20 text-[9px] text-emerald-400 font-mono font-bold">
                      Saved: {selectedEmail.userFeedback}
                    </span>
                  )}
                </div>

                {feedbackSubmitted && (
                  <div className="p-2.5 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    {feedbackMsg}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleFeedback('Correct Template')}
                    disabled={!!selectedEmail.userFeedback}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback 
                        ? 'border-white/5 bg-white/5 text-gray-600 cursor-not-allowed opacity-50' 
                        : 'border-white/10 hover:border-emerald-500 bg-white/5 hover:bg-emerald-600/10 text-gray-300 hover:text-emerald-400 cursor-pointer'
                    }`}
                  >
                    <ThumbsUp className="w-3 h-3" /> Correct Template
                  </button>
                  <button
                    onClick={() => {
                      setFlaggedWrong(true);
                      handleFeedback('Wrong Template');
                    }}
                    disabled={!!selectedEmail.userFeedback}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback 
                        ? 'border-white/5 bg-white/5 text-gray-600 cursor-not-allowed opacity-50' 
                        : 'border-white/10 hover:border-red-500 bg-white/5 hover:bg-red-600/10 text-gray-300 hover:text-red-400 cursor-pointer'
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
                    disabled={!!selectedEmail.userFeedback}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback 
                        ? 'border-white/5 bg-white/5 text-gray-600 cursor-not-allowed opacity-50' 
                        : 'border-white/10 hover:border-amber-500 bg-white/5 hover:bg-amber-600/10 text-gray-300 hover:text-amber-400 cursor-pointer'
                    }`}
                  >
                    <ShieldQuestion className="w-3 h-3" /> Better Template Exists
                  </button>
                  <button
                    onClick={() => setShowKeywordForm(!showKeywordForm)}
                    disabled={!!selectedEmail.userFeedback}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback 
                        ? 'border-white/5 bg-white/5 text-gray-600 cursor-not-allowed opacity-50' 
                        : 'border-white/10 hover:border-cyan-500 bg-white/5 hover:bg-cyan-600/10 text-gray-300 hover:text-cyan-400 cursor-pointer'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" /> Add Keyword
                  </button>
                  <button
                    onClick={() => handleFeedback('Disable This Rule')}
                    disabled={!!selectedEmail.userFeedback}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-semibold transition-all ${
                      selectedEmail.userFeedback 
                        ? 'border-white/5 bg-white/5 text-gray-600 cursor-not-allowed opacity-50' 
                        : 'border-white/10 hover:border-red-500 bg-white/5 hover:bg-red-600/15 text-gray-300 hover:text-red-400 cursor-pointer'
                    }`}
                  >
                    <ToggleLeft className="w-3 h-3" /> Disable Template Rule
                  </button>
                </div>

                {flaggedWrong && (
                  <p className="text-[10px] text-red-400 font-semibold mt-2 animate-pulse flex items-center gap-1">
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
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-violet-500 flex-1 text-[11px]"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-semibold cursor-pointer"
                    >
                      Save Keyword
                    </button>
                  </form>
                )}
              </div>

              {/* Email Content Box */}
              <div>
                <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-t-xl text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  Original Message Body
                </div>
                <div className="bg-black/20 border border-t-0 border-white/10 p-5 rounded-b-xl text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {selectedEmail.body}
                </div>
              </div>

              {/* AI Draft Section */}
              {(latestDraft || replyText) && !isCustomMode && (
                <div>
                  <div className="px-3 py-1.5 bg-violet-600/10 border border-violet-500/20 rounded-t-xl text-[10px] font-semibold text-violet-300 uppercase tracking-wider flex justify-between items-center">
                    <span className="flex items-center gap-1.5 truncate max-w-[80%]">
                      <ShieldCheck className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                      AI Response Draft (Auto Generated) — Chosen: "{currentlyMatchedTemplateName}"
                    </span>
                    <div className="flex gap-3">
                      {isEditingDraft ? (
                        <>
                          <button onClick={handleSaveDraft} className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer">
                            Save Edits
                          </button>
                          {selectedEmail.matchedTemplateId && (
                            <button onClick={handleSaveTemplateUpdate} className="text-xs text-violet-300 hover:text-violet-200 font-semibold flex items-center gap-1 cursor-pointer">
                              <Save className="w-3 h-3" /> Update Response Template
                            </button>
                          )}
                          <button onClick={() => { setReplyText(latestDraft.responseBody); setIsEditingDraft(false); }} className="text-xs text-gray-400 hover:text-white font-semibold cursor-pointer">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setIsEditingDraft(true)} className="text-xs text-violet-300 hover:text-violet-200 font-semibold flex items-center gap-0.5 cursor-pointer">
                          <Edit3 className="w-3 h-3" /> Edit Draft
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-violet-950/5 border border-t-0 border-violet-500/20 rounded-b-xl overflow-hidden">
                    {isEditingDraft ? (
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={8}
                        className="w-full bg-black/40 border-0 p-5 text-xs text-white outline-none focus:ring-0 resize-none font-sans leading-relaxed"
                      />
                    ) : (
                      <div className="p-5 text-xs text-violet-200 whitespace-pre-wrap leading-relaxed font-sans">
                        {replyText}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Custom manual reply console */}
              {isCustomMode && (
                <div>
                  <div className="px-3 py-1.5 bg-cyan-600/10 border border-cyan-500/20 rounded-t-xl text-[10px] font-semibold text-cyan-300 uppercase tracking-wider flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      Compose Custom Response
                    </span>
                    <button onClick={() => setIsCustomMode(false)} className="text-xs text-gray-400 hover:text-white font-semibold cursor-pointer">
                      Cancel
                    </button>
                  </div>
                  <div className="bg-black/20 border border-t-0 border-cyan-500/20 rounded-b-xl overflow-hidden p-4 space-y-3">
                    <textarea
                      value={customReply}
                      onChange={(e) => setCustomReply(e.target.value)}
                      rows={6}
                      placeholder="Type your response here..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white outline-none focus:border-cyan-500 resize-none font-sans leading-relaxed"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSendCustom}
                        disabled={!customReply.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-xs rounded-lg font-semibold text-white transition-all disabled:opacity-50 cursor-pointer"
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
                  <div className="px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/20 rounded-t-xl text-[10px] font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Auto-Reply Sent Successfully
                  </div>
                  <div className="bg-emerald-950/5 border border-t-0 border-emerald-500/20 p-5 rounded-b-xl text-xs text-emerald-200 whitespace-pre-wrap leading-relaxed">
                    {sentReply.responseBody}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center gap-4 flex-shrink-0">
              <div className="flex gap-2">
                {!sentReply && !isCustomMode && (
                  <button
                    onClick={() => setIsCustomMode(true)}
                    className="px-4 py-2 border border-white/10 hover:border-violet-500/30 bg-white/5 hover:bg-white/10 text-xs rounded-lg font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
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
                  className="flex items-center gap-1.5 px-3 py-2 border border-red-500/20 hover:border-red-500 bg-red-600/5 hover:bg-red-600/15 text-xs rounded-lg font-semibold text-red-300 transition-all cursor-pointer"
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
                  className="flex items-center gap-1.5 px-3 py-2 border border-violet-500/20 hover:border-violet-500 bg-violet-600/5 hover:bg-violet-600/15 text-xs rounded-lg font-semibold text-violet-300 transition-all cursor-pointer"
                  title="Archive Email to Escalated"
                >
                  <Save className="w-3.5 h-3.5" />
                  Archive Email
                </button>
              </div>

              <div className="flex gap-2">
                {latestDraft && !sentReply && !isCustomMode && (
                  <>
                    <button
                      onClick={handleReject}
                      className="flex items-center gap-1.5 px-4 py-2 border border-red-500/20 hover:border-red-500 bg-red-600/10 hover:bg-red-600/20 text-xs rounded-lg font-semibold text-red-300 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Discard Draft
                    </button>
                    <button
                      onClick={handleApprove}
                      className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-xs rounded-lg font-semibold text-white shadow-lg shadow-violet-600/20 hover:shadow-violet-600/35 transition-all cursor-pointer"
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
    </div>
  );
}
