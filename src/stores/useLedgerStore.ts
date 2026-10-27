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
    scope: 'business',
    note: 'Consulting fee received from Client Apex Corp',
    category_id: 'cat-sales',
    entry_date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'tx-102',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    type: 'cash_out',
    amount: 420000, // ₹4,200.00
    mode: 'bank',
    scope: 'business',
    note: 'Office High-Speed Internet & Fiber Bill',
    category_id: 'cat-utilities',
    entry_date: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'tx-103',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    type: 'card_spend',
    amount: 345000, // ₹3,450.00
    card_id: '00000000-0000-0000-0000-000000000101',
    mode: 'card',
    scope: 'business',
    note: 'Team Dinner at Mainland China',
    category_id: 'cat-food',
    entry_date: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'tx-104',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    type: 'cash_out',
    amount: 580000, // ₹5,800.00
    mode: 'upi',
    scope: 'family',
    note: 'Monthly Grocery & Dairy Supplies',
    category_id: 'cat-food',
    entry_date: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'tx-105',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    type: 'cash_in',
    amount: 3500000, // ₹35,000.00
    mode: 'bank',
    scope: 'personal',
    note: 'Monthly Salary / Business Drawing Credit',
    category_id: 'cat-sales',
    entry_date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    created_at: new Date().toISOString(),
  },
];

// Helper to deduplicate ledger entries by ID and migrate legacy card IDs
function dedupeEntries(entries: LedgerEntry[]): LedgerEntry[] {
  const map = new Map<string, LedgerEntry>();
  for (const e of entries) {
    if (e && e.id) {
      const normalizedCardId =
        e.card_id === 'default-card-1'
          ? '00000000-0000-0000-0000-000000000101'
          : e.card_id === 'default-card-2'
          ? '00000000-0000-0000-0000-000000000102'
          : e.card_id;
      map.set(e.id, { ...e, card_id: normalizedCardId });
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
          if (Array.isArray(parsed) && parsed.length > 0) {
            return dedupeEntries(parsed);
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
