'use client';

import React, { useState } from 'react';
import {
  X,
  StickyNote,
  Pin,
  Edit3,
  Trash2,
  CheckSquare,
  Square,
  Calendar,
  Copy,
  Check,
  Tag,
} from 'lucide-react';
import { NoteItem } from '@/types';
import { syncEngine } from '@/lib/syncEngine';

interface NoteDetailModalProps {
  note: NoteItem | null;
  onClose: () => void;
  onEdit: (note: NoteItem) => void;
  onDelete: (noteId: string) => void;
}

export function NoteDetailModal({
  note,
  onClose,
  onEdit,
  onDelete,
}: NoteDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!note) return null;

  const colorThemes: Record<string, { bg: string; border: string; headerBg: string; text: string }> = {
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-500/20',
      headerBg: 'bg-amber-500 text-white',
      text: 'text-amber-900 dark:text-amber-100',
    },
    teal: {
      bg: 'bg-teal-50 dark:bg-teal-950/40',
      border: 'border-teal-200 dark:border-teal-500/20',
      headerBg: 'bg-teal-500 text-white',
      text: 'text-teal-900 dark:text-teal-100',
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-200 dark:border-indigo-500/20',
      headerBg: 'bg-indigo-500 text-white',
      text: 'text-indigo-900 dark:text-indigo-100',
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-500/20',
      headerBg: 'bg-rose-500 text-white',
      text: 'text-rose-900 dark:text-rose-100',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      border: 'border-purple-200 dark:border-purple-500/20',
      headerBg: 'bg-purple-500 text-white',
      text: 'text-purple-900 dark:text-purple-100',
    },
  };

  const themeStyle = colorThemes[note.color || 'amber'] || colorThemes.amber;

  const handleCopyNote = () => {
    let textToCopy = `${note.title || 'Untitled Note'}\n\n`;
    if (note.body) textToCopy += `${note.body}\n\n`;
    if (note.checklist_items && note.checklist_items.length > 0) {
      textToCopy += 'Checklist:\n';
      note.checklist_items.forEach((item) => {
        textToCopy += `[${item.is_done ? 'x' : ' '}] ${item.text}\n`;
      });
    }

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleChecklistItem = (itemId: string) => {
    const updated = (note.checklist_items || []).map((item) =>
      item.id === itemId ? { ...item, is_done: !item.is_done } : item
    );
    syncEngine.updateNote(note.id, { checklist_items: updated });
  };

  const formattedDate = note.created_at
    ? new Date(note.created_at).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className={`w-full max-w-lg rounded-3xl border ${themeStyle.border} ${themeStyle.bg} shadow-2xl max-h-[90vh] flex flex-col overflow-hidden transition-all`}
      >
        {/* Header Bar */}
        <div className="p-5 pb-3 border-b border-black/5 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${themeStyle.headerBg} shadow-sm`}>
              <StickyNote className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 block">
                Sticky Note View
              </span>
              <span className="text-xs font-semibold opacity-75">
                {note.checklist_items && note.checklist_items.length > 0
                  ? `${note.checklist_items.filter((i) => i.is_done).length}/${
                      note.checklist_items.length
                    } Tasks Completed`
                  : 'Plain Note'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Copy Button */}
            <button
              onClick={handleCopyNote}
              title="Copy Note Text"
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Pin Toggle */}
            <button
              onClick={() => syncEngine.updateNote(note.id, { is_pinned: !note.is_pinned })}
              title={note.is_pinned ? 'Unpin Note' : 'Pin Note to Top'}
              className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                note.is_pinned
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <Pin className={`w-4 h-4 ${note.is_pinned ? 'fill-current' : ''}`} />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Note Title */}
          <div>
            <h2 className={`text-lg font-black leading-snug tracking-tight ${themeStyle.text}`}>
              {note.title || (
                <span className="italic opacity-60">Untitled Note</span>
              )}
            </h2>

            {formattedDate && (
              <div className="flex items-center gap-1.5 text-[11px] opacity-60 mt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Created {formattedDate}</span>
              </div>
            )}
          </div>

          {/* Note Body */}
          {note.body && (
            <div className="pt-2">
              <p
                className={`text-sm opacity-90 whitespace-pre-wrap leading-relaxed select-text ${themeStyle.text}`}
              >
                {note.body}
              </p>
            </div>
          )}

          {/* Checklist Items */}
          {note.checklist_items && note.checklist_items.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-black/5 dark:border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 block">
                Tasks & Checklist
              </span>
              <div className="space-y-2">
                {note.checklist_items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleChecklistItem(item.id)}
                    className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="pt-0.5 shrink-0">
                      {item.is_done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 opacity-50" />
                      )}
                    </div>
                    <span
                      className={`text-xs leading-normal select-none ${
                        item.is_done
                          ? 'line-through opacity-50'
                          : 'font-medium opacity-90'
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {note.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/5 dark:bg-white/10 opacity-75"
                >
                  <Tag className="w-3 h-3" />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions: Edit & Delete */}
        <div className="p-4 bg-white/40 dark:bg-black/20 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          {showDeleteConfirm ? (
            <div className="w-full flex items-center justify-between gap-2 p-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <span className="font-bold">Delete this note permanently?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 font-bold text-slate-700 dark:text-slate-300"
                >
                  No, Keep
                </button>
                <button
                  onClick={() => {
                    onDelete(note.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-white shadow-xs"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold text-xs transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Note</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onEdit(note);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 font-bold text-white text-xs shadow-md shadow-amber-500/25 transition-all hover-lift"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Note</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}