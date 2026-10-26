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
  const [selectedColor, setSelectedColor] = useState('amber');

  const colorOptions = [
    { id: 'amber', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-100', dot: 'bg-amber-400' },
    { id: 'teal', bg: 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-500/20 text-teal-900 dark:text-teal-100', dot: 'bg-teal-400' },
    { id: 'indigo', bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-500/20 text-indigo-900 dark:text-indigo-100', dot: 'bg-indigo-400' },
    { id: 'rose', bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/20 text-rose-900 dark:text-rose-100', dot: 'bg-rose-400' },
    { id: 'purple', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-500/20 text-purple-900 dark:text-purple-100', dot: 'bg-purple-400' },
  ];

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
      color: selectedColor,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25">
              <StickyNote className="w-5 h-5" />
            </div>
            <span>Daily Notes & Checklists</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Capture quick thoughts, shop reminders, to-do checklists, and important notes.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 font-bold text-white text-xs shadow-lg shadow-amber-500/25 transition-all hover-lift touch-press"
        >
          <Plus className="w-4 h-4" />
          <span>New Sticky Note</span>
        </button>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <StickyNote className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">No notes written yet.</p>
            <p className="text-[11px]">Click &quot;New Sticky Note&quot; to keep quick tasks or daily reminders.</p>
          </div>
        ) : (
          notes.map((note) => {
            const matchedColor = colorOptions.find((c) => c.id === note.color) || colorOptions[0];

            return (
              <div
                key={note.id}
                className={`rounded-3xl border p-5 space-y-3 transition-all hover-lift ${matchedColor.bg}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm leading-snug">
                    {note.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateNoteOptimistic(note.id, { is_pinned: !note.is_pinned })}
                      className={`p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                        note.is_pinned ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteNoteOptimistic(note.id)}
                      className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {note.body && (
                  <p className="text-xs opacity-85 whitespace-pre-wrap leading-relaxed">
                    {note.body}
                  </p>
                )}

                {/* Checklist */}
                {note.checklist_items && note.checklist_items.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-black/5 dark:border-white/10">
                    {note.checklist_items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleChecklistItem(note.id, item.id)}
                        className="flex items-center gap-2 text-xs cursor-pointer select-none"
                      >
                        {item.is_done ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 opacity-50" />
                        )}
                        <span className={item.is_done ? 'line-through opacity-50' : 'font-medium'}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add Note */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Create Sticky Note</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Color Theme</label>
                <div className="flex gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.dot} flex items-center justify-center transition-transform ${
                        selectedColor === c.id ? 'scale-125 ring-2 ring-indigo-500 shadow-md' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description / Content</label>
                <textarea
                  rows={3}
                  placeholder="Details..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Add Checklist Task</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Call supplier, buy paper roll..."
                    value={checklistInput}
                    onChange={(e) => setChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>

                {checklistItems.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {checklistItems.map((item) => (
                      <div key={item.id} className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/25"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
