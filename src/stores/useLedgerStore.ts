import { create } from 'zustand';
import { LedgerEntry } from '@/types';

interface LedgerState {
  entries: LedgerEntry[];
  isLoading: boolean;

  setEntries: (entries: LedgerEntry[]) => void;
  addEntryOptimistic: (entry: LedgerEntry) => void;
  removeEntryOptimistic: (id: string) => void;
  setIsLoading: (loading: boolean) => void;
  clearLedger: () => void;
}

export const useLedgerStore = create<LedgerState>((set) => ({
  entries: [],
  isLoading: false,

  setEntries: (entries) => set({ entries, isLoading: false }),

  addEntryOptimistic: (entry) =>
    set((state) => ({
      entries: [entry, ...state.entries],
    })),

  removeEntryOptimistic: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    })),

  setIsLoading: (isLoading) => set({ isLoading }),

  clearLedger: () => set({ entries: [], isLoading: false }),
}));
