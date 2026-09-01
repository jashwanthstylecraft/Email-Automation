'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  Plus, Edit, Trash, ToggleLeft, ToggleRight, Check, AlertTriangle,
  Terminal, ShieldCheck, HelpCircle, Save, Info, RefreshCw, MessageSquare, X, PartyPopper,
  Image as ImageIcon, Upload, FileText, Loader2
} from 'lucide-react';
import { StructuredKeywords, parseKeywords, serializeKeywords, emptyKeywords, matchTemplates, TemplateForScoring, totalKeywordCount } from '@/lib/keyword-engine';
import EmailBodyPreview from '@/components/EmailBodyPreview';

interface TemplateImage {
  id: string;
  dataUrl: string;
}

const KEYWORD_CATEGORIES: { key: keyof StructuredKeywords; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary Keywords', hint: 'Strongest signal — the core phrase(s) for this template' },
  { key: 'secondary', label: 'Secondary Keywords', hint: 'Supporting phrases that add confidence' },
  { key: 'product', label: 'Product Keywords', hint: 'Product/part names this template is about' },
  { key: 'problem', label: 'Problem Keywords', hint: 'Words customers use to describe the issue' },
  { key: 'intent', label: 'Intent Phrases', hint: 'Policy/process language (warranty, return, claim...)' },
  { key: 'negative', label: 'Negative Keywords', hint: 'If present, this template is excluded from matching' },
];

export default function TemplatesPage() {
  const {
    templates, fetchTemplates, saveTemplate, deleteTemplate, isLoading, user
  } = useStore();
  const isAdmin = user?.role === 'Admin';
  const searchParams = useSearchParams();
  const activeQueryFilter = searchParams.get('active'); // "true" | "false" | null

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState('');
  const [keywordsState, setKeywordsState] = useState<StructuredKeywords>(emptyKeywords());
  const [keywordInputs, setKeywordInputs] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [images, setImages] = useState<TemplateImage[]>([]);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isParsingDocx, setIsParsingDocx] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  // Simulator states
  const [testSelectedId, setTestSelectedId] = useState('');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<{ matches: boolean; preview: string; previewImages: TemplateImage[]; keywords: string[]; confidence: number; suggestions: { name: string; confidence: number }[] } | null>(null);

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

  const handleDocxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setDocxError(null);
    setIsParsingDocx(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/templates/parse-docx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: reader.result }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setDocxError(data.error || 'Failed to read this document.');
          return;
        }
        setEditingId(null);
        setName(file.name.replace(/\.docx$/i, ''));
        setSubject(data.subject || '');
        setBody(data.body || '');
        setVariables('');
        setKeywordsState(emptyKeywords());
        setKeywordInputs({});
        setActive(true);
        setNotes('');
        setImages(data.images || []);
        setIsFormOpen(true);
      } catch {
        setDocxError('Failed to read this document.');
      } finally {
        setIsParsingDocx(false);
      }
    };
    reader.onerror = () => {
      setDocxError('Failed to read this document.');
      setIsParsingDocx(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setName('');
    setSubject('');
    setBody('');
    setVariables('');
    setKeywordsState(emptyKeywords());
    setKeywordInputs({});
    setActive(true);
    setNotes('');
    setImages([]);
    setDocxError(null);
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
      keywords: serializeKeywords(keywordsState),
      images: JSON.stringify(images),
      active,
      notes,
    });
    setSaveToast(editingId ? 'Template updated' : 'Template created');
    setTimeout(() => setSaveToast(null), 2500);
    setName('');
    setSubject('');
    setBody('');
    setVariables('');
    setKeywordsState(emptyKeywords());
    setNotes('');
    setActive(true);
    setImages([]);
    setIsFormOpen(false);
  };

  const handleEdit = (tmpl: any) => {
    setEditingId(tmpl.id);
    setName(tmpl.name);
    setSubject(tmpl.subject);
    setBody(tmpl.body);
    setVariables(tmpl.variables);
    setKeywordsState(parseKeywords(tmpl.keywords));
    setKeywordInputs({});
    setActive(tmpl.active !== false);
    setNotes(tmpl.notes || '');
    try {
      const parsed = JSON.parse(tmpl.images || '[]');
      setImages(Array.isArray(parsed) ? parsed : []);
    } catch {
      setImages([]);
    }
    setIsFormOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const id = Math.random().toString(36).slice(2, 10);
      setImages((prev) => [...prev, { id, dataUrl }]);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // allow re-selecting the same file later
  };

  const handleInsertImageToken = (img: TemplateImage) => {
    const token = `{{image_${img.id}}}`;
    const textarea = bodyTextareaRef.current;
    if (!textarea) {
      setBody((prev) => prev + token);
      return;
    }
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    // Restore focus and cursor position after the inserted token.
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    // Also strip any now-orphaned token from the body so it doesn't send as
    // literal "{{image_xxx}}" text once the image is gone.
    setBody((prev) => prev.replace(new RegExp(`\\{\\{image_${id}\\}\\}`, 'g'), ''));
  };

  const addKeywordToCategory = (category: keyof StructuredKeywords) => {
    const value = (keywordInputs[category] || '').trim().toLowerCase();
    if (!value) return;
    setKeywordsState(prev => ({
      ...prev,
      [category]: prev[category].includes(value) ? prev[category] : [...prev[category], value],
    }));
    setKeywordInputs(prev => ({ ...prev, [category]: '' }));
  };

  const removeKeywordFromCategory = (category: keyof StructuredKeywords, value: string) => {
    setKeywordsState(prev => ({ ...prev, [category]: prev[category].filter(k => k !== value) }));
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

    // Run the SAME structured scoring engine used for real incoming emails,
    // across ALL templates, so this simulator honestly reflects what would
    // actually happen (including whether a different template would win).
    const scoringInputs: TemplateForScoring[] = templates.map(t => ({
      id: t.id,
      name: t.name,
      active: t.active,
      keywords: parseKeywords(t.keywords),
    }));
    const result = matchTemplates(scoringInputs, '', testText);
    const matches = result.matchedTemplateId === template.id;

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

    let previewImages: TemplateImage[] = [];
    try {
      const parsed = JSON.parse(template.images || '[]');
      previewImages = Array.isArray(parsed) ? parsed : [];
    } catch {
      previewImages = [];
    }

    setTestResult({
      matches,
      preview,
      previewImages,
      keywords: matches ? result.matchedTerms : [],
      confidence: matches ? result.confidenceScore : 0,
      suggestions: result.suggestions.map(s => ({ name: s.name, confidence: s.confidence })),
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
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Reply Templates</h1>
          <p className="text-text-secondary text-xs mt-1">
            Configure approved customer-service replies extracted from your responses document.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-1.5 px-4 py-2 bg-surface-2 border border-border hover:border-accent-border text-xs font-semibold rounded-lg text-text-secondary hover:text-text-primary transition-all cursor-pointer ${isParsingDocx ? 'opacity-60 pointer-events-none' : ''}`}>
            {isParsingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {isParsingDocx ? 'Reading Document...' : 'Upload Template (.docx)'}
            <input type="file" accept=".docx" onChange={handleDocxUpload} disabled={isParsingDocx} className="hidden" />
          </label>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-xs font-semibold rounded-lg text-white transition-all shadow-lg shadow-accent/15 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      </div>

      {docxError && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-danger-bg border border-danger/25 rounded-lg text-danger text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {docxError}
          <button onClick={() => setDocxError(null)} className="ml-auto text-danger hover:text-danger cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editor Form */}
      {isFormOpen && (
        <div className="glass-panel p-6 rounded-xl border border-accent-border bg-accent-bg space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent-text" />
              {editingId ? 'Edit Email Template' : 'Create Custom Email Template'}
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Template Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Password Reset Guide"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Template Subject Line</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Re: Password Reset Request"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Template Status</label>
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface-3 border border-border rounded-lg text-text-primary font-semibold outline-none w-full justify-between cursor-pointer"
                >
                  <span>{active ? 'Active (Enabled)' : 'Inactive (Disabled)'}</span>
                  {active ? (
                    <ToggleRight className="w-6 h-6 text-accent-text animate-pulse" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-text-muted" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Template Body</label>
              <textarea
                ref={bodyTextareaRef}
                required
                rows={8}
                placeholder="Hi {{customer_name}},\n\nYou can easily reset your password by going to: https://stylecraftus.com/reset-password.\n\n{{closing}}"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-surface-3 border border-border rounded-lg p-3 text-text-primary outline-none focus:border-accent font-sans leading-relaxed text-xs"
              />
            </div>

            <div className="border border-border rounded-lg p-3 bg-surface-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-semibold text-text-secondary uppercase tracking-wider">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Images
                </label>
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-accent cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Image
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              {images.length === 0 ? (
                <p className="text-[9px] text-text-muted">
                  Upload an image, then click "Insert" to place it in the body at your cursor as a {'{{image_...}}'} token.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="bg-surface-2 border border-border rounded-lg p-2 space-y-1.5">
                      <img src={img.dataUrl} alt="" className="w-full h-16 object-cover rounded" />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleInsertImageToken(img)}
                          className="flex-1 text-[9px] font-semibold px-1.5 py-1 rounded bg-accent-bg border border-accent-border text-accent-text hover:bg-accent hover:text-white transition-colors cursor-pointer"
                        >
                          Insert
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.id)}
                          className="text-[9px] font-semibold px-1.5 py-1 rounded bg-danger-bg border border-danger/25 text-danger hover:bg-danger hover:text-white transition-colors cursor-pointer"
                          title="Remove image"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Interpolation Variables (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. customer_name, closing"
                  value={variables}
                  onChange={(e) => setVariables(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Internal Notes (Administrative)</label>
                <input
                  type="text"
                  placeholder="e.g. For Canadian users only, updated June 2026..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Structured keyword editor */}
            <div className="border-t border-border pt-4 space-y-4">
              <label className="block font-semibold text-text-secondary uppercase tracking-wider">Matching Keywords</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {KEYWORD_CATEGORIES.map(({ key, label, hint }) => (
                  <div key={key} className="bg-surface-3 border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-text-secondary uppercase">{label}</span>
                      <span className="text-[9px] text-text-muted">{keywordsState[key].length}</span>
                    </div>
                    <p className="text-[9px] text-text-muted mb-2 leading-relaxed">{hint}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2 min-h-[20px]">
                      {keywordsState[key].map((kw) => (
                        <span
                          key={kw}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono ${
                            key === 'negative'
                              ? 'bg-danger-bg border border-danger/25 text-danger'
                              : 'bg-accent-bg border border-accent-border text-accent-text'
                          }`}
                        >
                          {kw}
                          <button
                            type="button"
                            onClick={() => removeKeywordFromCategory(key, kw)}
                            className="hover:text-text-primary cursor-pointer"
                            title="Remove keyword"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={keywordInputs[key] || ''}
                        onChange={(e) => setKeywordInputs(prev => ({ ...prev, [key]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addKeywordToCategory(key);
                          }
                        }}
                        placeholder="Add new keyword..."
                        className="flex-1 bg-surface-3 border border-border rounded px-2 py-1 text-[10px] text-text-primary outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => addKeywordToCategory(key)}
                        className="px-2 py-1 bg-accent hover:bg-accent-hover text-white rounded text-[10px] font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold cursor-pointer shadow-lg shadow-accent/15"
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">
              {activeQueryFilter === 'true' ? 'Active Templates' : activeQueryFilter === 'false' ? 'Disabled Templates' : 'All Templates'}
            </h3>
            {activeQueryFilter && (
              <a href="/templates" className="text-[10px] text-accent-text hover:text-accent-text transition-colors">Clear filter ×</a>
            )}
          </div>
          {isLoading && templates.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-text" />
              Loading templates...
            </div>
          ) : templates.filter(t => activeQueryFilter === null || String(t.active !== false) === activeQueryFilter).length === 0 ? (
            <div className="glass-panel p-8 text-center text-text-muted border border-border rounded-xl bg-bg">
              No response templates seeded yet. Upload your response document to bootstrap them automatically.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.filter(t => activeQueryFilter === null || String(t.active !== false) === activeQueryFilter).map((tmpl) => {
                const feedbackLogs = getTemplateFeedback(tmpl.id);
                return (
                  <div key={tmpl.id} className={`glass-panel p-5 rounded-xl border flex flex-col justify-between bg-bg transition-all ${
                    tmpl.active !== false ? 'border-border' : 'border-border opacity-55'
                  }`}>
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-text-primary text-xs truncate max-w-[70%]">{tmpl.name}</h4>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleToggleActive(tmpl)}
                            className="p-1 hover:bg-surface-3 rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                            title={tmpl.active !== false ? 'Disable Template' : 'Enable Template'}
                          >
                            {tmpl.active !== false ? (
                              <ToggleRight className="w-4 h-4 text-accent-text animate-pulse" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-text-muted" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(tmpl)}
                            className="p-1 hover:bg-surface-3 rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(tmpl.id)}
                              className="p-1 hover:bg-surface-3 rounded text-danger/70 hover:text-danger transition-colors cursor-pointer"
                              title="Delete Template (Admin only)"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-[9px] text-text-muted uppercase tracking-wider font-mono mt-1.5 truncate">
                        Subject: {tmpl.subject}
                      </p>

                      <div className="bg-surface-3 border border-border p-3 rounded-lg mt-3 text-[11px] text-text-secondary line-clamp-3 leading-relaxed font-sans whitespace-pre-wrap">
                        {tmpl.body}
                      </div>

                      {tmpl.notes && (
                        <p className="text-[10px] text-warning/80 italic mt-3 flex items-center gap-1 font-mono">
                          <Info className="w-3 h-3 text-warning" />
                          Note: {tmpl.notes}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-border pt-3 mt-4 space-y-2">
                      {(() => {
                        const kw = parseKeywords(tmpl.keywords);
                        const preview = [...kw.primary, ...kw.product, ...kw.problem, ...kw.intent].slice(0, 6);
                        const total = totalKeywordCount(kw);
                        return total > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {preview.map((v) => (
                              <span key={v} className="px-1.5 py-0.5 rounded bg-accent-bg border border-accent-border text-[9px] text-accent-text font-mono">
                                {v}
                              </span>
                            ))}
                            {total > preview.length && (
                              <span className="text-[9px] text-text-muted">+{total - preview.length} more</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[9px] text-warning/80 italic">No distinguishing keywords configured yet — click Edit to add some.</p>
                        );
                      })()}

                      {/* Historical Feedback display */}
                      {feedbackLogs.length > 0 && (
                        <div className="bg-accent-bg border border-accent-border p-2 rounded text-[9px] font-mono text-accent-text space-y-1">
                          <span className="font-bold flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-accent-text" />
                            Historical AI Matching Logs ({feedbackLogs.length})
                          </span>
                          <div className="max-h-16 overflow-y-auto divide-y divide-border pr-1">
                            {feedbackLogs.map((log, idx) => (
                              <div key={idx} className="py-1 flex justify-between gap-2">
                                <span className="truncate">{log.userApprovedTmpl === tmpl.id ? '✓ Correct Match' : '✗ Overridden'}</span>
                                <span className="text-text-muted">{new Date(log.createdAt).toLocaleDateString()}</span>
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
          <div className="glass-panel p-6 rounded-xl border border-border bg-bg space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent-text" />
              Test Template Engine
            </h3>
            <p className="text-text-muted text-[10px] leading-relaxed">
              Verify matching criteria and preview the auto-wrapped greeting/closing signature.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-text-secondary uppercase tracking-wider mb-1 font-semibold">Select Template</label>
                <select
                  value={testSelectedId}
                  onChange={(e) => setTestSelectedId(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-text-primary outline-none focus:border-accent text-[11px] cursor-pointer"
                >
                  <option value="">-- Choose Template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-text-secondary uppercase tracking-wider mb-1 font-semibold">Sample Email Body Text</label>
                <textarea
                  rows={4}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Paste hypothetical customer email text here..."
                  className="w-full bg-surface-3 border border-border rounded-lg p-2.5 text-text-primary outline-none focus:border-accent font-sans leading-relaxed text-[11px]"
                />
              </div>

              <button
                onClick={handleTestTemplate}
                disabled={!testSelectedId || !testText.trim()}
                className="w-full py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-lg shadow-accent/10"
              >
                Simulate Matcher
              </button>
            </div>

            {testResult && (
              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-text-secondary uppercase">Trigger Result:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    testResult.matches ? 'bg-success-bg border border-success/25 text-success' : 'bg-danger-bg border border-danger/25 text-danger'
                  }`}>
                    {testResult.matches ? `✓ Trigger Match (${Math.round(testResult.confidence * 100)}%)` : '✗ No Match — a different/no template would be chosen'}
                  </span>
                </div>
                {testResult.keywords.length > 0 && (
                  <div>
                    <span className="text-[9px] text-text-muted block uppercase font-mono">Matched Keywords:</span>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {testResult.keywords.map(kw => (
                        <span key={kw} className="px-1.5 py-0.5 rounded bg-accent-bg border border-accent-border text-accent-text font-mono text-[9px]">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {testResult.suggestions.length > 0 && (
                  <div>
                    <span className="text-[9px] text-text-muted block uppercase font-mono">Top Suggested Templates:</span>
                    <div className="space-y-1 mt-1">
                      {testResult.suggestions.map(s => (
                        <div key={s.name} className="flex justify-between text-[10px] text-text-secondary">
                          <span className="truncate max-w-[70%]">{s.name}</span>
                          <span className="text-text-muted font-mono">{Math.round(s.confidence * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[9px] text-text-muted block uppercase font-mono">Simulated Draft Output:</span>
                  <EmailBodyPreview
                    body={testResult.preview}
                    images={testResult.previewImages}
                    className="bg-surface-3 border border-border p-3 rounded-lg mt-1 text-[11px] text-accent-text whitespace-pre-wrap leading-relaxed font-sans"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {saveToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-success text-text-primary shadow-2xl shadow-success/40 border border-success/25"
          >
            <PartyPopper className="w-4 h-4" />
            <span className="text-xs font-semibold">{saveToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
