import { create } from 'zustand';
import { LedgerEntry } from '@/types';

interface LedgerState {
  entries: LedgerEntry[];
  isLoading: boolean;

  setEntries: (entries: LedgerEntry[]) => void;
  addEntryOptimistic: (entry: LedgerEntry) => void;
  updateEntryOptimistic: (id: string, updates: Partial<LedgerEntry>) => void;
  removeEntryOptimistic: (id: string) => void;
  setIsLoading: (loading: boolean) => void;
  clearLedger: () => void;
}

const STORAGE_KEY = 'rb_ledger_entries';
const LEGACY_MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

const DEFAULT_ENTRIES: LedgerEntry[] = [];

// Helper to deduplicate ledger entries by ID and migrate legacy card IDs
function dedupeEntries(entries: LedgerEntry[]): LedgerEntry[] {
  const map = new Map<string, LedgerEntry>();
  for (const e of entries) {
    if (e && e.id) {
      map.set(e.id, e);
    }
  }
  return Array.from(map.values());
}

export const useLedgerStore = create<LedgerState>((set) => ({
  entries: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(
              (e: any) => e && e.workspace_id !== LEGACY_MOCK_WORKSPACE_ID && e.workspace_id !== 'default'
            );
            if (clean.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
            }
            return dedupeEntries(clean);
          }
        }
      } catch {}
    }
    return DEFAULT_ENTRIES;
  })(),
  isLoading: false,

  setEntries: (entries) => {
    const deduped = dedupeEntries(entries);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
    }
    set({ entries: deduped, isLoading: false });
  },

  addEntryOptimistic: (entry) =>
    set((state) => {
      const exists = state.entries.some((e) => e.id === entry.id);
      const updated = exists
        ? state.entries.map((e) => (e.id === entry.id ? entry : e))
        : [entry, ...state.entries];
      const deduped = dedupeEntries(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      }
      return { entries: deduped };
    }),

  updateEntryOptimistic: (id, updates) =>
    set((state) => {
      const updated = state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e));
      const deduped = dedupeEntries(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      }
      return { entries: deduped };
    }),

  removeEntryOptimistic: (id) =>
    set((state) => {
      const updated = state.entries.filter((e) => e.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { entries: updated };
    }),

  setIsLoading: (isLoading) => set({ isLoading }),

  clearLedger: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ entries: [], isLoading: false });
  },
}));
