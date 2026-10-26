'use client';

import React, { useState } from 'react';
import {
  StickyNote,
  Plus,
  Pin,
  CheckSquare,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { NoteItem } from '@/types';
import { useNoteStore } from '@/stores/useNoteStore';
import { useSessionStore } from '@/stores/useSessionStore';

export function NotesScreen() {
  const { notes, addNoteOptimistic, updateNoteOptimistic, deleteNoteOptimistic } = useNoteStore();
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const [showAddModal, setShowAddModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [checklistInput, setChecklistInput] = useState('');
  const [checklistItems, setChecklistItems] = useState<Array<{ id: string; text: string; is_done: boolean }>>([]);

  const handleAddChecklistItem = () => {
    if (!checklistInput.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: checklistInput.trim(), is_done: false },
    ]);
    setChecklistInput('');
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    const newNote: NoteItem = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      title: noteTitle.trim(),
      body: noteBody.trim() || null,
      color: '#EEF2FF',
      tags: [],
      is_pinned: false,
      checklist_items: checklistItems,
    };

    addNoteOptimistic(newNote);
    setShowAddModal(false);
    setNoteTitle('');
    setNoteBody('');
    setChecklistItems([]);
  };

  const toggleChecklistItem = (noteId: string, itemId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const updatedItems = note.checklist_items.map((item) =>
      item.id === itemId ? { ...item, is_done: !item.is_done } : item
    );

    updateNoteOptimistic(noteId, { checklist_items: updatedItems });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-500" />
            <span>Daily Notes & Checklists</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize daily shop tasks, supplier phone numbers, and tick-box to-do checklists.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 font-semibold text-white text-xs shadow-md shadow-amber-500/20 transition-all touch-press"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400">
            No notes yet. Click <span className="font-bold text-amber-500">+ New Note</span> to write your daily tasks and reminders.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-3xl border p-5 space-y-3 transition-all hover-lift ${
                isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900/80 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{note.title}</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateNoteOptimistic(note.id, { is_pinned: !note.is_pinned })}
                    className={`p-1.5 rounded-lg transition-colors ${
                      note.is_pinned ? 'text-amber-500 bg-amber-500/10' : 'text-slate-400'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteNoteOptimistic(note.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {note.body && (
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {note.body}
                </p>
              )}

              {/* Checklist Items */}
              {note.checklist_items && note.checklist_items.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                  {note.checklist_items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleChecklistItem(note.id, item.id)}
                      className="flex items-center gap-2 text-xs cursor-pointer select-none"
                    >
                      {item.is_done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span
                        className={
                          item.is_done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'
                        }
                      >
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal: Add Note */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Create New Note</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shop Closing Checklist"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Type any instructions or notes..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Checklist items adder */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Checklist To-Dos</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Pay electricity bill"
                    value={checklistInput}
                    onChange={(e) => setChecklistInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200"
                  >
                    Add
                  </button>
                </div>

                {checklistItems.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {checklistItems.map((item) => (
                      <div key={item.id} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
              >
                Save Note
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
