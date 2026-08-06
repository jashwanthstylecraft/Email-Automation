'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { StickyNote, Plus, Pin, Trash2, Edit3, Search, Save, Mail } from 'lucide-react';
import Link from 'next/link';

export default function NotesPage() {
  const { notes, fetchNotes, saveNote, deleteNote, templates, fetchTemplates, user } = useStore();
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [relatedTemplateId, setRelatedTemplateId] = useState('');

  useEffect(() => {
    fetchNotes({ search: search || undefined });
    fetchTemplates();
  }, [search]);

  const handleCreateNew = () => {
    setEditingId(null);
    setTitle('');
    setNoteBody('');
    setRelatedTemplateId('');
    setIsFormOpen(true);
  };

  const handleEdit = (note: any) => {
    setEditingId(note.id);
    setTitle(note.title);
    setNoteBody(note.body);
    setRelatedTemplateId(note.relatedTemplateId || '');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveNote({
      id: editingId || undefined,
      title,
      noteBody,
      relatedTemplateId: relatedTemplateId || null,
    });
    setIsFormOpen(false);
  };

  const handleTogglePin = async (note: any) => {
    await saveNote({ id: note.id, title: note.title, noteBody: note.body, isPinned: !note.isPinned });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this internal note? This cannot be undone.')) {
      await deleteNote(id);
    }
  };

  const templateName = (id: string | null) => id ? templates.find(t => t.id === id)?.name : null;

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-accent-text" />
            Internal Notes
          </h1>
          <p className="text-text-secondary text-xs mt-1">Staff-only notes, feedback, and matching tips. Never sent to customers.</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-xs font-semibold rounded-lg text-white transition-all shadow-lg shadow-accent/15 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-3 border border-border rounded-lg pl-10 pr-4 py-2 text-xs text-text-primary outline-none focus:border-accent"
        />
      </div>

      {isFormOpen && (
        <form onSubmit={handleSave} className="glass-panel p-6 rounded-xl border border-accent-border bg-accent-bg space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">{editingId ? 'Edit Note' : 'New Internal Note'}</h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-text-secondary hover:text-text-primary cursor-pointer">Cancel</button>
          </div>
          <input
            type="text"
            required
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
          <textarea
            required
            rows={5}
            placeholder="Note body..."
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            className="w-full bg-surface-3 border border-border rounded-lg p-3 text-text-primary outline-none focus:border-accent leading-relaxed"
          />
          <select
            value={relatedTemplateId}
            onChange={(e) => setRelatedTemplateId(e.target.value)}
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent cursor-pointer"
          >
            <option value="">No related template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="flex justify-end">
            <button type="submit" className="flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold cursor-pointer shadow-lg shadow-accent/15">
              <Save className="w-4 h-4" />
              Save Note
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <div className="glass-panel p-8 text-center text-text-muted border border-border rounded-xl bg-surface-2 col-span-full">
            No internal notes yet.
          </div>
        ) : (
          notes.map((note: any) => (
            <div key={note.id} className={`glass-panel p-5 rounded-xl border bg-surface-2 flex flex-col justify-between ${note.isPinned ? 'border-accent-border' : 'border-border'}`}>
              <div>
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-bold text-text-primary truncate max-w-[70%] flex items-center gap-1.5">
                    {note.isPinned && <Pin className="w-3 h-3 text-accent-text flex-shrink-0" />}
                    {note.title}
                  </h4>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => handleTogglePin(note)} className="p-1 hover:bg-surface-3 rounded text-text-secondary hover:text-accent-text cursor-pointer" title={note.isPinned ? 'Unpin' : 'Pin'}>
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleEdit(note)} className="p-1 hover:bg-surface-3 rounded text-text-secondary hover:text-text-primary cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(note.id)} className="p-1 hover:bg-surface-3 rounded text-danger/70 hover:text-danger cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {templateName(note.relatedTemplateId) && (
                  <p className="text-[9px] text-accent-text uppercase tracking-wider font-mono mt-1.5">
                    Related: {templateName(note.relatedTemplateId)}
                  </p>
                )}
                {note.relatedEmail && (
                  <Link
                    href={`/inbox?emailId=${note.relatedEmail.id}`}
                    className="inline-flex items-center gap-1 text-[9px] text-accent-text hover:text-accent uppercase tracking-wider font-mono mt-1.5"
                  >
                    <Mail className="w-2.5 h-2.5" /> {note.relatedEmail.subject}
                  </Link>
                )}
                <p className="text-[11px] text-text-secondary mt-3 leading-relaxed whitespace-pre-wrap line-clamp-4">{note.body}</p>
              </div>
              <div className="border-t border-border pt-3 mt-4 text-[9px] text-text-muted font-mono">
                By {note.createdByName || 'Unknown'} · {new Date(note.createdAt).toLocaleDateString()}
                {note.updatedByName && note.updatedByName !== note.createdByName && (
                  <> · edited by {note.updatedByName}</>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
