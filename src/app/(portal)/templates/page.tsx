'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { 
  Plus, Edit, Trash, ToggleLeft, ToggleRight, Check, AlertTriangle, 
  Terminal, ShieldCheck, HelpCircle, Save, Info, RefreshCw, MessageSquare
} from 'lucide-react';

export default function TemplatesPage() {
  const { 
    templates, fetchTemplates, saveTemplate, deleteTemplate, isLoading 
  } = useStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState('');
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');

  // Simulator states
  const [testSelectedId, setTestSelectedId] = useState('');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<{ matches: boolean; preview: string; keywords: string[] } | null>(null);

  // Learning logs state
  const [learningLogs, setLearningLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchTemplates();
    fetchLearningLogs();
  }, []);

  const fetchLearningLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLearningLogs(data.learningLogs || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setName('');
    setSubject('');
    setBody('');
    setVariables('');
    setActive(true);
    setNotes('');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveTemplate({
      id: editingId || undefined,
      name,
      subject,
      body,
      variables,
      active,
      notes,
    });
    setName('');
    setSubject('');
    setBody('');
    setVariables('');
    setNotes('');
    setActive(true);
    setIsFormOpen(false);
  };

  const handleEdit = (tmpl: any) => {
    setEditingId(tmpl.id);
    setName(tmpl.name);
    setSubject(tmpl.subject);
    setBody(tmpl.body);
    setVariables(tmpl.variables);
    setActive(tmpl.active !== false);
    setNotes(tmpl.notes || '');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template? Any rules referencing it will fail.')) {
      await deleteTemplate(id);
    }
  };

  const handleToggleActive = async (tmpl: any) => {
    await saveTemplate({
      ...tmpl,
      active: !tmpl.active,
    });
  };

  const handleTestTemplate = () => {
    const template = templates.find(t => t.id === testSelectedId);
    if (!template) return;

    const normalizedText = testText.toLowerCase();
    const keywords = (template.variables || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    keywords.push(template.name.toLowerCase());

    const matchedKeywords = keywords.filter(kw => kw.length > 2 && normalizedText.includes(kw));
    const matches = matchedKeywords.length > 0;

    // Simulate interpolation variables
    let preview = template.body;
    preview = preview.replace(/\{\{customer_name\}\}/g, 'John Doe');
    preview = preview.replace(/\{\{ticket_id\}\}/g, '9984AF22');
    preview = preview.replace(/\{\{closing\}\}/g, 'Best regards,\nStyleCraft US Support Team');

    // Dynamic wrap greeting/regards
    const hasGreeting = preview.trim().startsWith('Hi') || preview.trim().startsWith('Hello') || preview.trim().startsWith('Dear') || preview.trim().startsWith('I hope');
    if (!hasGreeting) {
      preview = `Hello John Doe,\n\n` + preview;
    }
    const hasClosing = preview.includes('Regards') || preview.includes('Best regards') || preview.includes('Sincerely') || preview.includes('Thank you') || preview.includes('Thanks');
    if (!hasClosing) {
      preview = preview + `\n\nBest regards,\nStyleCraft US Support Team`;
    }

    setTestResult({
      matches,
      preview,
      keywords: matchedKeywords
    });
  };

  // Get learning/feedback logs for a specific template
  const getTemplateFeedback = (templateId: string) => {
    return learningLogs.filter(log => log.userApprovedTmpl === templateId || log.aiSelectedTmpl === templateId);
  };

  return (
    <div className="space-y-8 pb-12 text-xs">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Reply Templates</h1>
          <p className="text-gray-400 text-xs mt-1">
            Configure approved customer-service replies extracted from your responses document.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-lg text-white transition-all shadow-lg shadow-violet-600/15 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {/* Editor Form */}
      {isFormOpen && (
        <div className="glass-panel p-6 rounded-xl border border-violet-500/20 bg-violet-950/5 space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-violet-400" />
              {editingId ? 'Edit Email Template' : 'Create Custom Email Template'}
            </h3>
            <button 
              onClick={() => setIsFormOpen(false)}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-gray-400 uppercase tracking-wider mb-2">Template Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Password Reset Guide"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-400 uppercase tracking-wider mb-2">Template Subject Line</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Re: Password Reset Request"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-400 uppercase tracking-wider mb-2">Template Status</label>
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white font-semibold outline-none w-full justify-between cursor-pointer"
                >
                  <span>{active ? 'Active (Enabled)' : 'Inactive (Disabled)'}</span>
                  {active ? (
                    <ToggleRight className="w-6 h-6 text-violet-400 animate-pulse" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-400 uppercase tracking-wider mb-2">Template Body</label>
              <textarea
                required
                rows={8}
                placeholder="Hi {{customer_name}},\n\nYou can easily reset your password by going to: https://stylecraftus.com/reset-password.\n\n{{closing}}"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-violet-500 font-sans leading-relaxed text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-400 uppercase tracking-wider mb-2">Keywords / Matching Phrases (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. reset, password, login, credential"
                  value={variables}
                  onChange={(e) => setVariables(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-400 uppercase tracking-wider mb-2">Internal Notes (Administrative)</label>
                <input
                  type="text"
                  placeholder="e.g. For Canadian users only, updated June 2026..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-semibold cursor-pointer shadow-lg shadow-violet-600/15"
              >
                <Save className="w-4 h-4" />
                Save Template
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Simulator Panel & Historical Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Templates List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Active Templates List</h3>
          {isLoading && templates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="glass-panel p-8 text-center text-gray-500 border border-white/5 rounded-xl bg-[#0b0b0f]/60">
              No response templates seeded yet. Upload your response document to bootstrap them automatically.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tmpl) => {
                const feedbackLogs = getTemplateFeedback(tmpl.id);
                return (
                  <div key={tmpl.id} className={`glass-panel p-5 rounded-xl border flex flex-col justify-between bg-[#0b0b0f]/60 transition-all ${
                    tmpl.active !== false ? 'border-white/5' : 'border-white/5 opacity-55'
                  }`}>
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-white text-xs truncate max-w-[70%]">{tmpl.name}</h4>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleToggleActive(tmpl)}
                            className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title={tmpl.active !== false ? 'Disable Template' : 'Enable Template'}
                          >
                            {tmpl.active !== false ? (
                              <ToggleRight className="w-4 h-4 text-violet-400 animate-pulse" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(tmpl)}
                            className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tmpl.id)}
                            className="p-1 hover:bg-white/5 rounded text-red-500/70 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[9px] text-gray-500 uppercase tracking-wider font-mono mt-1.5 truncate">
                        Subject: {tmpl.subject}
                      </p>
                      
                      <div className="bg-black/30 border border-white/5 p-3 rounded-lg mt-3 text-[11px] text-gray-300 line-clamp-3 leading-relaxed font-sans whitespace-pre-wrap">
                        {tmpl.body}
                      </div>

                      {tmpl.notes && (
                        <p className="text-[10px] text-amber-300/80 italic mt-3 flex items-center gap-1 font-mono">
                          <Info className="w-3 h-3 text-amber-300" />
                          Note: {tmpl.notes}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-white/5 pt-3 mt-4 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {(tmpl.variables || '').split(',').map((v) => (
                          <span key={v} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-gray-400 font-mono">
                            {v.trim()}
                          </span>
                        ))}
                      </div>
                      
                      {/* Historical Feedback display */}
                      {feedbackLogs.length > 0 && (
                        <div className="bg-violet-950/10 border border-violet-500/10 p-2 rounded text-[9px] font-mono text-violet-300 space-y-1">
                          <span className="font-bold flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-violet-400" />
                            Historical AI Matching Logs ({feedbackLogs.length})
                          </span>
                          <div className="max-h-16 overflow-y-auto divide-y divide-white/5 pr-1">
                            {feedbackLogs.map((log, idx) => (
                              <div key={idx} className="py-1 flex justify-between gap-2">
                                <span className="truncate">{log.userApprovedTmpl === tmpl.id ? '✓ Correct Match' : '✗ Overridden'}</span>
                                <span className="text-gray-500">{new Date(log.createdAt).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Simulator Tools */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-xl border border-white/5 bg-[#0b0b0f]/60 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-violet-400" />
              Test Template Engine
            </h3>
            <p className="text-gray-500 text-[10px] leading-relaxed">
              Verify matching criteria and preview the auto-wrapped greeting/closing signature.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-semibold">Select Template</label>
                <select
                  value={testSelectedId}
                  onChange={(e) => setTestSelectedId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-violet-500 text-[11px] cursor-pointer"
                >
                  <option value="">-- Choose Template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-semibold">Sample Email Body Text</label>
                <textarea
                  rows={4}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Paste hypothetical customer email text here..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-violet-500 font-sans leading-relaxed text-[11px]"
                />
              </div>

              <button
                onClick={handleTestTemplate}
                disabled={!testSelectedId || !testText.trim()}
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-lg shadow-violet-600/10"
              >
                Simulate Matcher
              </button>
            </div>

            {testResult && (
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Trigger Result:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    testResult.matches ? 'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-600/10 border border-red-500/20 text-red-400'
                  }`}>
                    {testResult.matches ? '✓ Trigger Match' : '✗ No Match'}
                  </span>
                </div>
                {testResult.keywords.length > 0 && (
                  <div>
                    <span className="text-[9px] text-gray-500 block uppercase font-mono">Matched Keywords:</span>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {testResult.keywords.map(kw => (
                        <span key={kw} className="px-1.5 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-violet-400 font-mono text-[9px]">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[9px] text-gray-500 block uppercase font-mono">Simulated Draft Output:</span>
                  <div className="bg-black/30 border border-white/5 p-3 rounded-lg mt-1 text-[11px] text-violet-200 whitespace-pre-wrap leading-relaxed font-sans">
                    {testResult.preview}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
