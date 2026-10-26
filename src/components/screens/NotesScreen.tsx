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
      color: '#ffffff',
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-zinc-500" />
            <span>Daily Notes & Tasks</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Record personal notes, daily reminders, and checklist items.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium text-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Note</span>
        </button>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {notes.length === 0 ? (
          <div className="col-span-full text-center py-12 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-xs text-zinc-400 space-y-1">
            <p>No notes written yet.</p>
            <p className="text-[11px] text-zinc-500">Click &quot;New Note&quot; to keep quick thoughts or daily tasks.</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-xl border p-4 space-y-3 transition-colors ${
                isLight ? 'bg-white border-zinc-200 hover:border-zinc-400' : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-xs text-zinc-900 dark:text-zinc-100 leading-snug">
                  {note.title}
                </h3>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateNoteOptimistic(note.id, { is_pinned: !note.is_pinned })}
                    className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                      note.is_pinned ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
                    }`}
                  >
                    <Pin className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteNoteOptimistic(note.id)}
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {note.body && (
                <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {note.body}
                </p>
              )}

              {/* Checklist */}
              {note.checklist_items && note.checklist_items.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                  {note.checklist_items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleChecklistItem(note.id, item.id)}
                      className="flex items-center gap-2 text-xs cursor-pointer select-none text-zinc-700 dark:text-zinc-300"
                    >
                      {item.is_done ? (
                        <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                      <span className={item.is_done ? 'line-through text-zinc-400' : ''}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Create Note</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Description / Content</label>
                <textarea
                  rows={3}
                  placeholder="Details..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Add Checklist Task</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Call supplier..."
                    value={checklistInput}
                    onChange={(e) => setChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium"
                  >
                    Add
                  </button>
                </div>

                {checklistItems.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {checklistItems.map((item) => (
                      <div key={item.id} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <span>•</span>
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
                  className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors"
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
