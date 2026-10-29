import { create } from 'zustand';
import { CashLocation } from '@/types';

export interface BankAccountItem extends CashLocation {
  gradient?: string;
  iconColor?: string;
}

const STORAGE_KEY = 'rb_accounts';
const STORAGE_KEY_ACCOUNT_REMARKS = 'rb_account_remarks';
const LEGACY_MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

const DEFAULT_ACCOUNTS: BankAccountItem[] = [];

// Helper to retrieve persistent account remarks
function getStoredAccountRemarks(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ACCOUNT_REMARKS);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Helper to save a single account remark to persistent storage
function persistAccountRemark(accountId: string, remark?: string | null) {
  if (typeof window === 'undefined' || !accountId) return;
  try {
    const map = getStoredAccountRemarks();
    if (remark && remark.trim()) {
      map[accountId] = remark.trim();
    } else if (remark === null || remark === '') {
      delete map[accountId];
    }
    localStorage.setItem(STORAGE_KEY_ACCOUNT_REMARKS, JSON.stringify(map));
  } catch {}
}

function dedupeAccounts(accounts: BankAccountItem[]): BankAccountItem[] {
  const map = new Map<string, BankAccountItem>();
  const remarksMap = getStoredAccountRemarks();

  for (const a of accounts) {
    if (a && a.id) {
      const existing = map.get(a.id);
      const note = a.notes || remarksMap[a.id] || existing?.notes || null;
      if (note) remarksMap[a.id] = note;

      map.set(a.id, {
        ...existing,
        ...a,
        notes: note,
      });
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNT_REMARKS, JSON.stringify(remarksMap));
    } catch {}
  }
  return Array.from(map.values());
}

interface AccountState {
  accounts: BankAccountItem[];
  isLoading: boolean;

  setAccounts: (accounts: BankAccountItem[]) => void;
  addAccount: (account: BankAccountItem) => void;
  updateAccount: (id: string, updates: Partial<BankAccountItem>) => void;
  updateAccountBalance: (id: string, newBalance: number) => void;
  deleteAccount: (id: string) => void;
  clearAccounts: () => void;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(
              (a) => a && a.workspace_id !== LEGACY_MOCK_WORKSPACE_ID && a.workspace_id !== 'default'
            );
            const deduped = dedupeAccounts(clean);
            if (deduped.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
            }
            return deduped;
          }
        }
      } catch {}
    }
    return DEFAULT_ACCOUNTS;
  })(),
  isLoading: false,

  setAccounts: (accounts) => {
    const current = get().accounts;
    const currentMap = new Map<string, BankAccountItem>(current.map((a) => [a.id, a]));
    const remarksMap = getStoredAccountRemarks();

    const merged = accounts.map((a) => {
      const existing = currentMap.get(a.id);
      const note =
        a.notes !== undefined && a.notes !== null
          ? a.notes
          : (remarksMap[a.id] || existing?.notes || null);
      if (note) remarksMap[a.id] = note;

      return {
        ...existing,
        ...a,
        notes: note,
      };
    });

    const deduped = dedupeAccounts(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      localStorage.setItem(STORAGE_KEY_ACCOUNT_REMARKS, JSON.stringify(remarksMap));
    }
    set({ accounts: deduped });
  },

  addAccount: (account) => {
    if (account.notes) {
      persistAccountRemark(account.id, account.notes);
    }
    set((state) => {
      // Deduplicate: If an account with this id already exists, update it or ignore
      if (state.accounts.some((a) => a.id === account.id)) {
        const updated = state.accounts.map((a) => (a.id === account.id ? { ...a, ...account } : a));
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
        return { accounts: updated };
      }
      const updated = dedupeAccounts([...state.accounts, account]);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { accounts: updated };
    });
  },

  updateAccount: (id, updates) => {
    if (updates.notes !== undefined) {
      persistAccountRemark(id, updates.notes);
    }
    set((state) => {
      const updated = state.accounts.map((acc) =>
        acc.id === id ? { ...acc, ...updates } : acc
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { accounts: updated };
    });
  },

  updateAccountBalance: (id, newBalance) =>
    set((state) => {
      const updated = state.accounts.map((acc) =>
        acc.id === id ? { ...acc, balance: newBalance } : acc
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { accounts: updated };
    }),

  deleteAccount: (id) => {
    persistAccountRemark(id, null);
    set((state) => {
      const updated = state.accounts.filter((acc) => acc.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { accounts: updated };
    });
  },

  clearAccounts: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ accounts: DEFAULT_ACCOUNTS, isLoading: false });
  },
}));
