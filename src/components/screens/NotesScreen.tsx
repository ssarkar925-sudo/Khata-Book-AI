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
  Edit3,
  Calendar,
  Eye,
  Check,
  AlertTriangle,
  Search,
  Share2,
  Files,
  ListChecks,
} from 'lucide-react';
import { NoteItem } from '@/types';
import { useNoteStore } from '@/stores/useNoteStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { syncEngine } from '@/lib/syncEngine';
import { NoteDetailModal } from '@/components/modals/NoteDetailModal';
import { ViewToggle, ViewMode } from '@/components/common/ViewToggle';
import { SortDropdown, SortOption } from '@/components/common/SortDropdown';
import { CardMoveButtons } from '@/components/common/CardMoveButtons';
import { useCardOrder } from '@/lib/useCardOrder';

export function NotesScreen() {
  const { notes: allNotes } = useNoteStore();
  const notes = allNotes.filter((n) => !n.tags || !n.tags.includes('__system_cloud_snapshot__'));
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  // Category / Tag / Color filter: 'all' | 'pinned' | 'checklist' | color id
  const [noteFilter, setNoteFilter] = useState<string>('all');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('rb_view_notes') as ViewMode) || 'grid';
    }
    return 'grid';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_view_notes', mode);
    }
  };

  const NOTE_SORT_OPTIONS: SortOption[] = [
    { value: 'custom', label: 'Custom Order (Arrange)', shortLabel: 'Arrange' },
    { value: 'updated_desc', label: 'Last Updated (Newest)', shortLabel: 'Updated' },
    { value: 'created_desc', label: 'Date Created (Newest)', shortLabel: 'Newest' },
    { value: 'title_asc', label: 'Title (A to Z)', shortLabel: 'A-Z' },
    { value: 'title_desc', label: 'Title (Z to A)', shortLabel: 'Z-A' },
    { value: 'pinned_first', label: 'Pinned First', shortLabel: 'Pinned' },
  ];

  const [noteSort, setNoteSortState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rb_sort_notes') || 'updated_desc';
    }
    return 'updated_desc';
  });

  const setNoteSort = (sort: string) => {
    setNoteSortState(sort);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_sort_notes', sort);
    }
  };

  // Popup Viewing Modal
  const [viewingNote, setViewingNote] = useState<NoteItem | null>(null);

  // Delete confirmation modal state
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Add Note Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [checklistInput, setChecklistInput] = useState('');
  const [checklistItems, setChecklistItems] = useState<Array<{ id: string; text: string; is_done: boolean }>>([]);
  const [selectedColor, setSelectedColor] = useState('amber');

  // Edit Note Modal State
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editChecklistInput, setEditChecklistInput] = useState('');
  const [editChecklistItems, setEditChecklistItems] = useState<Array<{ id: string; text: string; is_done: boolean }>>([]);
  const [editColor, setEditColor] = useState('amber');

  const colorOptions = [
    {
      id: 'amber',
      name: 'Amber',
      bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-100',
      dot: 'bg-amber-400',
    },
    {
      id: 'teal',
      name: 'Teal',
      bg: 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-500/20 text-teal-900 dark:text-teal-100',
      dot: 'bg-teal-400',
    },
    {
      id: 'indigo',
      name: 'Indigo',
      bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-500/20 text-indigo-900 dark:text-indigo-100',
      dot: 'bg-indigo-400',
    },
    {
      id: 'rose',
      name: 'Rose',
      bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/20 text-rose-900 dark:text-rose-100',
      dot: 'bg-rose-400',
    },
    {
      id: 'purple',
      name: 'Purple',
      bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-500/20 text-purple-900 dark:text-purple-100',
      dot: 'bg-purple-400',
    },
  ];

  // Helper to generate a smart fallback title if user leaves title empty
  const getSmartTitle = (title: string, body: string, items: Array<{ text: string }>) => {
    if (title && title.trim()) return title.trim();
    if (body && body.trim()) {
      const firstLine = body.trim().split('\n')[0].trim();
      return firstLine.length > 35 ? firstLine.slice(0, 35) + '...' : firstLine;
    }
    if (items && items.length > 0) {
      return `Checklist: ${items[0].text}`;
    }
    return 'Untitled Note';
  };

  // Add checklist item in Add modal
  const handleAddChecklistItem = () => {
    if (!checklistInput.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: checklistInput.trim(), is_done: false },
    ]);
    setChecklistInput('');
  };

  // Remove checklist item in Add modal
  const handleRemoveAddChecklistItem = (id: string) => {
    setChecklistItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Save new note (Title is completely OPTIONAL)
  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();

    // Verify at least title, body, or checklist items are provided
    if (!noteTitle.trim() && !noteBody.trim() && checklistItems.length === 0) {
      return;
    }

    const finalTitle = getSmartTitle(noteTitle, noteBody, checklistItems);

    const newNote: NoteItem = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      title: finalTitle,
      body: noteBody.trim() || null,
      color: selectedColor,
      tags: [],
      is_pinned: false,
      checklist_items: checklistItems,
      created_at: new Date().toISOString(),
    };

    syncEngine.pushNote(newNote);
    setShowAddModal(false);
    setNoteTitle('');
    setNoteBody('');
    setChecklistItems([]);
    setSelectedColor('amber');
  };

  // Open Edit Modal pre-populated with note details
  const handleOpenEdit = (note: NoteItem) => {
    setEditingNote(note);
    setEditTitle(note.title || '');
    setEditBody(note.body || '');
    setEditChecklistItems(note.checklist_items || []);
    setEditChecklistInput('');
    setEditColor(note.color || 'amber');
  };

  // Add checklist item in Edit modal
  const handleAddEditChecklistItem = () => {
    if (!editChecklistInput.trim()) return;
    setEditChecklistItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: editChecklistInput.trim(), is_done: false },
    ]);
    setEditChecklistInput('');
  };

  // Remove checklist item in Edit modal
  const handleRemoveEditChecklistItem = (id: string) => {
    setEditChecklistItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Save changes to note (Title is completely OPTIONAL)
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;

    const finalTitle = getSmartTitle(editTitle, editBody, editChecklistItems);

    const updates: Partial<NoteItem> = {
      title: finalTitle,
      body: editBody.trim() || null,
      color: editColor,
      checklist_items: editChecklistItems,
      updated_at: new Date().toISOString(),
    };

    syncEngine.updateNote(editingNote.id, updates);

    // If viewing this note in popup, refresh the view
    if (viewingNote && viewingNote.id === editingNote.id) {
      setViewingNote({ ...viewingNote, ...updates });
    }

    setEditingNote(null);
  };

  // Delete note handler
  const handleDeleteNote = (id: string) => {
    syncEngine.deleteNote(id);
    if (viewingNote && viewingNote.id === id) {
      setViewingNote(null);
    }
    setNoteToDelete(null);
  };

  // Toggle checklist item done state
  const toggleChecklistItem = (e: React.MouseEvent, noteId: string, itemId: string) => {
    e.stopPropagation(); // Prevent opening modal
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const updatedItems = (note.checklist_items || []).map((item) =>
      item.id === itemId ? { ...item, is_done: !item.is_done } : item
    );

    syncEngine.updateNote(noteId, { checklist_items: updatedItems });

    if (viewingNote && viewingNote.id === noteId) {
      setViewingNote({ ...viewingNote, checklist_items: updatedItems });
    }
  };

  // Duplicate note handler
  const handleDuplicateNote = (note: NoteItem) => {
    const duplicatedNote: NoteItem = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      title: note.title ? `${note.title} (Copy)` : 'Untitled Note (Copy)',
      body: note.body,
      color: note.color,
      tags: note.tags ? [...note.tags] : [],
      is_pinned: false,
      checklist_items: (note.checklist_items || []).map((item) => ({
        id: crypto.randomUUID(),
        text: item.text,
        is_done: false, // reset tasks for fresh list
      })),
      created_at: new Date().toISOString(),
    };
    syncEngine.pushNote(duplicatedNote);
  };

  // 1-Tap WhatsApp Share note handler
  const handleShareWhatsAppNote = (e: React.MouseEvent, note: NoteItem) => {
    e.stopPropagation();
    let message = `📝 *${note.title || 'Untitled Note'}*\n`;
    if (note.body) {
      message += `\n${note.body}\n`;
    }
    if (note.checklist_items && note.checklist_items.length > 0) {
      message += `\n*Tasks & Checklist:*\n`;
      note.checklist_items.forEach((item) => {
        message += `${item.is_done ? '✅' : '⬜'} ${item.text}\n`;
      });
    }
    message += `\n_Shared from Record Book_`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Filter notes by category filter & search query, then sort pinned first
  const filteredNotes = notes
    .filter((n) => {
      // Category / quick filter
      if (noteFilter === 'pinned' && !n.is_pinned) return false;
      if (noteFilter === 'checklist' && (!n.checklist_items || n.checklist_items.length === 0)) return false;
      if (['amber', 'teal', 'indigo', 'rose', 'purple'].includes(noteFilter) && n.color !== noteFilter) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = (n.title || '').toLowerCase().includes(q);
      const matchBody = (n.body || '').toLowerCase().includes(q);
      const matchChecklist = (n.checklist_items || []).some((item) =>
        item.text.toLowerCase().includes(q)
      );
      return matchTitle || matchBody || matchChecklist;
    })
    .sort((a, b) => {
      if (a.is_pinned === b.is_pinned) {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      return a.is_pinned ? -1 : 1;
    });

  // Strict deduplication by ID to prevent duplicate React keys
  const dedupedFilteredNotes = Array.from(
    new Map(filteredNotes.map((n) => [n.id, n])).values()
  );

  const { moveItem, applyCustomOrder, isCustomOrder, getCardDragProps } = useCardOrder(
    'notes',
    notes,
    noteSort,
    setNoteSort
  );

  const sortedNotes = React.useMemo(() => {
    if (noteSort === 'custom') {
      return applyCustomOrder(dedupedFilteredNotes);
    }
    return [...dedupedFilteredNotes].sort((a, b) => {
      if (noteSort === 'pinned_first') {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
      }
      if (noteSort === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (noteSort === 'title_desc') {
        return (b.title || '').localeCompare(a.title || '');
      }
      if (noteSort === 'created_desc') {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      }
      // default: updated_desc
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [dedupedFilteredNotes, noteSort, applyCustomOrder]);

  // Active viewing note synced with reactive store
  const activeViewingNote = viewingNote
    ? notes.find((n) => n.id === viewingNote.id) || viewingNote
    : null;

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
            Capture quick thoughts, shop reminders, to-do lists & save without mandatory titles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 w-36 sm:w-48"
            />
          </div>

          <button
            onClick={() => {
              setNoteTitle('');
              setNoteBody('');
              setChecklistItems([]);
              setSelectedColor('amber');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 font-bold text-white text-xs shadow-lg shadow-amber-500/25 transition-all hover-lift touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Color Palette */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setNoteFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              noteFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            All ({notes.length})
          </button>
          <button
            onClick={() => setNoteFilter('pinned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              noteFilter === 'pinned'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            <Pin className="w-3 h-3 fill-current" />
            <span>Pinned ({notes.filter((n) => n.is_pinned).length})</span>
          </button>
          <button
            onClick={() => setNoteFilter('checklist')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              noteFilter === 'checklist'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            <ListChecks className="w-3 h-3" />
            <span>Checklists ({notes.filter((n) => n.checklist_items && n.checklist_items.length > 0).length})</span>
          </button>
        </div>

        {/* Color Palette Filters & View Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Colors:</span>
            {colorOptions.map((c) => {
              const isSelected = noteFilter === c.id;
              const count = notes.filter((n) => n.color === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setNoteFilter(isSelected ? 'all' : c.id)}
                  title={`Filter ${c.name} notes (${count})`}
                  className={`w-5 h-5 rounded-full ${c.dot} transition-transform flex items-center justify-center ${
                    isSelected
                      ? 'scale-125 ring-2 ring-slate-900 dark:ring-white ring-offset-1 dark:ring-offset-slate-950'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full shadow-xs" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <SortDropdown
              value={noteSort}
              onChange={setNoteSort}
              options={NOTE_SORT_OPTIONS}
            />
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* Notes: Grid vs List View */}
      {viewMode === 'grid' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dedupedFilteredNotes.length === 0 ? (
          <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <StickyNote className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              {searchQuery ? 'No notes matched your search.' : 'No notes written yet.'}
            </p>
            <p className="text-[11px]">
              Click &quot;New Note&quot; to quickly type thoughts, checklists, or supplier details.
            </p>
          </div>
        ) : (
          sortedNotes.map((note, idx) => {
            const matchedColor = colorOptions.find((c) => c.id === note.color) || colorOptions[0];
            const checklistCount = note.checklist_items ? note.checklist_items.length : 0;
            const completedCount = note.checklist_items
              ? note.checklist_items.filter((i) => i.is_done).length
              : 0;

            const drag = getCardDragProps(note.id);
            return (
              <div
                key={note.id}
                draggable={drag.draggable}
                onDragStart={drag.onDragStart}
                onDragOver={drag.onDragOver}
                onDragLeave={drag.onDragLeave}
                onDrop={drag.onDrop}
                onDragEnd={drag.onDragEnd}
                onClick={() => setViewingNote(note)}
                className={`group rounded-3xl border p-5 space-y-3 transition-all hover-lift cursor-pointer relative overflow-hidden flex flex-col justify-between ${matchedColor.bg} ${drag.dragClasses}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm leading-snug tracking-tight">
                      {note.title || <span className="italic opacity-60">Untitled Note</span>}
                    </h3>

                    {/* Actions: WhatsApp Share, Duplicate, Pin, Edit, Delete */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CardMoveButtons
                        onMoveUp={() => moveItem(note.id, 'up', sortedNotes)}
                        onMoveDown={() => moveItem(note.id, 'down', sortedNotes)}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < sortedNotes.length - 1}
                        isLight={isLight}
                      />
                      {/* 1-Tap WhatsApp Share */}
                      <button
                        onClick={(e) => handleShareWhatsAppNote(e, note)}
                        title="Share via WhatsApp"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Duplicate Note */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateNote(note);
                        }}
                        title="Duplicate Note (Clone)"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Files className="w-3.5 h-3.5" />
                      </button>

                      {/* Pin Button */}
                      <button
                        onClick={() =>
                          syncEngine.updateNote(note.id, { is_pinned: !note.is_pinned })
                        }
                        title={note.is_pinned ? 'Unpin' : 'Pin to top'}
                        className={`p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                          note.is_pinned
                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                        }`}
                      >
                        <Pin className={`w-3.5 h-3.5 ${note.is_pinned ? 'fill-current' : ''}`} />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEdit(note)}
                        title="Edit Note"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setNoteToDelete(note.id)}
                        title="Delete Note"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  {note.body && (
                    <p className="text-xs opacity-85 whitespace-pre-wrap leading-relaxed mt-2 line-clamp-4">
                      {note.body}
                    </p>
                  )}

                  {/* Checklist Preview & Mini Progress Bar */}
                  {note.checklist_items && note.checklist_items.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-black/5 dark:border-white/10 mt-3">
                      {/* Mini Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-semibold opacity-70">
                          <span>Task Progress</span>
                          <span>
                            {completedCount}/{checklistCount} ({checklistCount > 0 ? Math.round((completedCount / checklistCount) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{
                              width: `${checklistCount > 0 ? (completedCount / checklistCount) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {note.checklist_items.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            onClick={(e) => toggleChecklistItem(e, note.id, item.id)}
                            className="flex items-center gap-2 text-xs cursor-pointer select-none"
                          >
                            {item.is_done ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 opacity-50 shrink-0" />
                            )}
                            <span
                              className={`truncate ${
                                item.is_done ? 'line-through opacity-50' : 'font-medium'
                              }`}
                            >
                              {item.text}
                            </span>
                          </div>
                        ))}

                        {note.checklist_items.length > 3 && (
                          <span className="text-[10px] opacity-60 font-semibold block pt-0.5">
                            +{note.checklist_items.length - 3} more items...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer with Timestamp and Tap hint */}
                <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[10px] opacity-60">
                  <div className="flex items-center gap-1 font-medium">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {note.created_at
                        ? new Date(note.created_at).toLocaleDateString()
                        : 'Today'}
                    </span>
                  </div>

                  <span className="font-semibold flex items-center gap-1 group-hover:opacity-100 transition-opacity">
                    <Eye className="w-3 h-3" />
                    <span>View Note &gt;</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      ) : (
        /* Notes List View */
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
          {dedupedFilteredNotes.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              {searchQuery ? 'No notes matched your search.' : 'No notes written yet.'}
            </div>
          ) : (
            sortedNotes.map((note, listIdx) => {
              const matchedColor = colorOptions.find((c) => c.id === note.color) || colorOptions[0];
              const checklistCount = note.checklist_items ? note.checklist_items.length : 0;
              const completedCount = note.checklist_items
                ? note.checklist_items.filter((i) => i.is_done).length
                : 0;

              return (
                <div
                  key={note.id}
                  onClick={() => setViewingNote(note)}
                  className="p-4 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-3.5 h-3.5 rounded-full ${matchedColor.dot} shrink-0`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                          {note.title || <span className="italic opacity-60">Untitled Note</span>}
                        </h4>
                        {note.is_pinned && (
                          <span className="p-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Pin className="w-3 h-3 fill-current" />
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                            note.scope === 'personal'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : note.scope === 'family'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {note.scope ? (note.scope === 'business' ? '🏢 Biz' : note.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                        </span>
                      </div>
                      {note.body && (
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {note.body}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {checklistCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          ✓ {completedCount}/{checklistCount}
                        </span>
                      )}
                      <span className="text-[11px] font-mono">
                        {note.created_at ? new Date(note.created_at).toLocaleDateString() : 'Today'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <CardMoveButtons
                        onMoveUp={() => moveItem(note.id, 'up', sortedNotes)}
                        onMoveDown={() => moveItem(note.id, 'down', sortedNotes)}
                        canMoveUp={listIdx > 0}
                        canMoveDown={listIdx < sortedNotes.length - 1}
                        isLight={isLight}
                      />
                      <button
                        type="button"
                        onClick={() => syncEngine.updateNote(note.id, { is_pinned: !note.is_pinned })}
                        title={note.is_pinned ? 'Unpin' : 'Pin'}
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                      >
                        <Pin className={`w-3.5 h-3.5 ${note.is_pinned ? 'fill-current text-amber-500' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleShareWhatsAppNote(e, note)}
                        title="Share via WhatsApp"
                        className="p-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateNote(note);
                        }}
                        title="Duplicate Note"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        <Files className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(note);
                        }}
                        title="Edit Note"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteToDelete(note.id);
                        }}
                        title="Delete Note"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* POPUP VIEW MODAL */}
      <NoteDetailModal
        note={activeViewingNote}
        onClose={() => setViewingNote(null)}
        onEdit={(note) => handleOpenEdit(note)}
        onDelete={(id) => handleDeleteNote(id)}
        onDuplicate={(note) => handleDuplicateNote(note)}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Note?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                This note will be permanently removed from your Record Book workspace.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNote(noteToDelete)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/25"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NOTE (Title is OPTIONAL - saves without title) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-500" />
                <span>New Sticky Note</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Color Theme Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Color Theme
                </label>
                <div className="flex gap-2.5">
                  {colorOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.dot} flex items-center justify-center transition-transform ${
                        selectedColor === c.id
                          ? 'scale-125 ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Title (OPTIONAL) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Note Title
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    Optional (Can leave blank)
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Monthly Supplier Checklist (Optional)"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Description / Body */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Description / Content
                </label>
                <textarea
                  rows={4}
                  placeholder="Type your notes, reminders, or details here..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Checklist Items */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Checklist Tasks (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Call vendor, order paper roll..."
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
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>

                {checklistItems.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 max-h-36 overflow-y-auto">
                    {checklistItems.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>{item.text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAddChecklistItem(item.id)}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!noteTitle.trim() && !noteBody.trim() && checklistItems.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-amber-500/25"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT NOTE (Title is OPTIONAL) */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <span>Edit Sticky Note</span>
              </h3>
              <button
                onClick={() => setEditingNote(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Color Theme Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Color Theme
                </label>
                <div className="flex gap-2.5">
                  {colorOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.dot} flex items-center justify-center transition-transform ${
                        editColor === c.id
                          ? 'scale-125 ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Title (OPTIONAL) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Note Title
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    Optional (Can leave blank)
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Note title (Optional)"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Description / Body */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Description / Content
                </label>
                <textarea
                  rows={4}
                  placeholder="Note details..."
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Checklist Items */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Checklist Tasks
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add task item..."
                    value={editChecklistInput}
                    onChange={(e) => setEditChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEditChecklistItem();
                      }
                    }}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddEditChecklistItem}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>

                {editChecklistItems.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 max-h-36 overflow-y-auto">
                    {editChecklistItems.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span className={item.is_done ? 'line-through opacity-50' : ''}>
                            {item.text}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEditChecklistItem(item.id)}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim() && !editBody.trim() && editChecklistItems.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-amber-500/25"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
