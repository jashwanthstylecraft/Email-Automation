'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  FileText, Plus, Trash2, HelpCircle, Check, ArrowRight, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';

export default function KnowledgePage() {
  const {
    documents, fetchDocuments, uploadDocument, deleteDocument, analyzeReferenceFile, user
  } = useStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [fileType, setFileType] = useState('Markdown');

  // Test RAG Search states
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    await uploadDocument({
      title,
      content,
      fileType,
    });

    setTitle('');
    setContent('');
    setIsFormOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document? It will be removed from AI context.')) {
      await deleteDocument(id);
    }
  };

  const handleAnalyze = async (documentId?: string) => {
    setIsAnalyzing(true);
    setAnalysisMessage('Analyzing responses reference file...');
    try {
      const res = await analyzeReferenceFile(documentId);
      if (res && res.success) {
        setAnalysisMessage(`Successfully imported ${res.templatesCount} templates and generated ${res.rulesCount} automation rules!`);
        setTimeout(() => setAnalysisMessage(''), 8000);
      } else {
        setAnalysisMessage('Analysis failed. Please check backend logs.');
      }
    } catch (err: any) {
      setAnalysisMessage(`Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim() || !user) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/knowledge?orgId=${user.organizationId}&query=${encodeURIComponent(testQuery)}`);
      const data = await res.json();
      setTestResults(data.documents || []); // local mock/db fallbacks
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            Knowledge Base
          </h1>
          <p className="text-text-secondary text-xs mt-1">
            Manage reference files, customer-service guidelines, and auto-reply rules extraction.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-xs font-semibold text-white transition-all cursor-pointer shadow-lg shadow-accent/10"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Document
        </button>
      </div>

      {analysisMessage && (
        <div className="p-4 bg-accent-bg border border-accent-border text-accent-text rounded-xl text-xs flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-accent-text animate-pulse" />
          <p className="font-medium">{analysisMessage}</p>
        </div>
      )}

      {/* Manual Upload Form */}
      {isFormOpen && (
        <div className="glass-panel p-6 rounded-xl border border-border bg-surface-2 space-y-4">
          <h3 className="text-sm font-semibold text-text-secondary">Add Reference Document</h3>
          <form onSubmit={handleUpload} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. StyleCraft Billing FAQs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Format Type</label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent cursor-pointer"
                >
                  <option value="Markdown">Markdown (.md)</option>
                  <option value="Plain Text">Plain Text (.txt)</option>
                  <option value="Docx">Word Document (.docx)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Content Details</label>
              <textarea
                required
                rows={6}
                placeholder="Paste document content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-surface-3 border border-border rounded-lg p-3 text-text-primary outline-none focus:border-accent font-sans leading-relaxed resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-accent hover:bg-accent-hover rounded-lg text-white font-semibold shadow-lg shadow-accent/10 cursor-pointer"
              >
                Upload & Ingest Document
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid: Document List & Test RAG Tool */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Document List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-text-secondary">Ingested Materials ({documents.length})</h3>

          {documents.length === 0 ? (
            <div className="glass-panel py-16 rounded-xl text-center border border-border flex flex-col items-center justify-center text-text-muted space-y-4 bg-surface-2">
              <FileText className="w-12 h-12 text-text-muted animate-pulse" />
              <div>
                <h3 className="text-sm font-semibold text-text-secondary">No real data available yet.</h3>
                <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
                  Upload your responses.docx file to analyze and extract templates/rules automatically.
                </p>
              </div>
              <button
                onClick={() => handleAnalyze()}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-xs font-semibold text-white rounded-lg transition-all shadow-lg shadow-accent/15 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Extracting Rules...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Analyze & Bootstrap Rules from responses.docx
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="glass-panel p-5 rounded-xl border border-border flex justify-between items-start gap-4 bg-surface-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-surface-3 rounded-lg text-accent-text border border-border flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-text-primary truncate">{doc.title}</h4>
                      <p className="text-[10px] text-text-secondary mt-1 font-mono uppercase">
                        {doc.fileType} • {(doc.fileSize / 1024).toFixed(2)} KB
                      </p>
                      <p className="text-[11px] text-text-secondary mt-2 line-clamp-2 leading-relaxed bg-surface-3 p-2.5 rounded border border-border font-mono text-[10px]">
                        {doc.content.slice(0, 200)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAnalyze(doc.id)}
                      disabled={isAnalyzing}
                      className="px-2.5 py-1.5 bg-accent hover:bg-accent-hover rounded text-[10px] text-white font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow disabled:opacity-50"
                      title="Analyze & Extract Rules"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Analyze & Extract Rules
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 hover:bg-surface-3 rounded text-text-secondary hover:text-danger transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: RAG Simulator Test Tool */}
        <div className="glass-panel p-6 rounded-xl border border-border h-fit space-y-6 bg-surface-2">
          <div>
            <h3 className="text-sm font-semibold text-text-secondary">RAG Context Search Simulator</h3>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
              Verify exactly what documentation context the AI agent fetches based on customer queries.
            </p>
          </div>

          <form onSubmit={handleTestSearch} className="space-y-4 text-xs">
            <div>
              <label className="block text-text-secondary mb-1.5 font-medium">Test Search Query</label>
              <input
                type="text"
                required
                placeholder="e.g. Warranty expired, missing spare cutters"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full flex justify-center items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-white font-semibold cursor-pointer disabled:opacity-50 shadow"
            >
              {isSearching ? 'Testing Search...' : 'Simulate RAG Retrieval'}
              {!isSearching && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>

          {/* Search Result Snippets */}
          {testResults.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-border">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Retrieval Hits</p>
              {testResults.map((res, index) => (
                <div key={index} className="bg-surface-3 border border-border p-3 rounded-lg space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-semibold text-accent-text">{res.documentTitle}</span>
                    <span className="text-text-muted font-mono">Score: {res.score?.toFixed(2) || '0.90'}</span>
                  </div>
                  <p className="text-text-secondary leading-relaxed font-sans italic">
                    "{res.chunk || res.content?.slice(0, 150)}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {testQuery && testResults.length === 0 && !isSearching && (
            <div className="text-center text-xs text-text-muted py-4">
              No matching snippets retrieved. Try general keywords like "warranty" or "refund".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
