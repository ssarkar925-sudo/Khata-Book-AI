import { create } from 'zustand';
import { NoteItem } from '@/types';

interface NoteState {
  notes: NoteItem[];
  isLoading: boolean;

  setNotes: (notes: NoteItem[]) => void;
  addNoteOptimistic: (note: NoteItem) => void;
  updateNoteOptimistic: (id: string, updates: Partial<NoteItem>) => void;
  deleteNoteOptimistic: (id: string) => void;
  clearNotes: () => void;
}

const STORAGE_KEY_NOTES = 'rb_notes';
const LEGACY_MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

const DEFAULT_NOTES: NoteItem[] = [];

// Helper to deduplicate notes array by ID
function dedupeNotes(notes: NoteItem[]): NoteItem[] {
  const map = new Map<string, NoteItem>();
  for (const n of notes) {
    if (n && n.id) {
      map.set(n.id, n);
    }
  }
  return Array.from(map.values());
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_NOTES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(
              (n: any) => n && n.workspace_id !== LEGACY_MOCK_WORKSPACE_ID && n.workspace_id !== 'default'
            );
            if (clean.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(clean));
            }
            return dedupeNotes(clean);
          }
        }
      } catch {}
    }
    return DEFAULT_NOTES;
  })(),
  isLoading: false,

  setNotes: (notes) => {
    const deduped = dedupeNotes(notes);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(deduped));
    }
    set({ notes: deduped });
  },

  addNoteOptimistic: (note) =>
    set((state) => {
      const exists = state.notes.some((n) => n.id === note.id);
      const updated = exists
        ? state.notes.map((n) => (n.id === note.id ? note : n))
        : [note, ...state.notes];
      const deduped = dedupeNotes(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(deduped));
      }
      return { notes: deduped };
    }),

  updateNoteOptimistic: (id, updates) =>
    set((state) => {
      const updated = state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n));
      const deduped = dedupeNotes(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(deduped));
      }
      return { notes: deduped };
    }),

  deleteNoteOptimistic: (id) =>
    set((state) => {
      const updated = state.notes.filter((n) => n.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updated));
      }
      return { notes: updated };
    }),

  clearNotes: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_NOTES);
    }
    set({ notes: [], isLoading: false });
  },
}));
