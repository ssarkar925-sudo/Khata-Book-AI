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

const DEFAULT_ENTRIES: LedgerEntry[] = [
  {
    id: 'tx-101',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    type: 'cash_in',
    amount: 1850000, // ₹18,500.00
    mode: 'upi',
    note: 'Consulting fee received from Client Apex Corp',
    entry_date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'tx-102',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    type: 'cash_out',
    amount: 420000, // ₹4,200.00
    mode: 'bank',
    note: 'Office High-Speed Internet & Fiber Bill',
    entry_date: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'tx-103',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    type: 'card_spend',
    amount: 345000, // ₹3,450.00
    card_id: 'default-card-1',
    mode: 'card',
    note: 'Team Dinner at Mainland China',
    entry_date: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    created_at: new Date().toISOString(),
  },
];

export const useLedgerStore = create<LedgerState>((set) => ({
  entries: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_ENTRIES;
  })(),
  isLoading: false,

  setEntries: (entries) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
    set({ entries, isLoading: false });
  },

  addEntryOptimistic: (entry) =>
    set((state) => {
      const updated = [entry, ...state.entries];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { entries: updated };
    }),

  updateEntryOptimistic: (id, updates) =>
    set((state) => {
      const updated = state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { entries: updated };
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
