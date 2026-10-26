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

export const useNoteStore = create<NoteState>((set) => ({
  notes: [],
  isLoading: false,

  setNotes: (notes) => set({ notes }),

  addNoteOptimistic: (note) =>
    set((state) => ({
      notes: [note, ...state.notes],
    })),

  updateNoteOptimistic: (id, updates) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  deleteNoteOptimistic: (id) =>
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
    })),

  clearNotes: () => set({ notes: [], isLoading: false }),
}));
