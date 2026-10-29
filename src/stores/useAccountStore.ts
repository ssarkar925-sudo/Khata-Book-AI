import { create } from 'zustand';
import { CashLocation } from '@/types';

export interface BankAccountItem extends CashLocation {
  gradient?: string;
  iconColor?: string;
}

const DEFAULT_ACCOUNTS: BankAccountItem[] = [];
const LEGACY_MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

function dedupeAccounts(accounts: BankAccountItem[]): BankAccountItem[] {
  const map = new Map<string, BankAccountItem>();
  for (const a of accounts) {
    if (a && a.id) {
      map.set(a.id, a);
    }
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

const STORAGE_KEY = 'rb_accounts';

export const useAccountStore = create<AccountState>((set) => ({
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
    const deduped = dedupeAccounts(accounts);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
    }
    set({ accounts: deduped });
  },

  addAccount: (account) =>
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
    }),

  updateAccount: (id, updates) =>
    set((state) => {
      const updated = state.accounts.map((acc) =>
        acc.id === id ? { ...acc, ...updates } : acc
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { accounts: updated };
    }),

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

  deleteAccount: (id) =>
    set((state) => {
      const updated = state.accounts.filter((acc) => acc.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return { accounts: updated };
    }),

  clearAccounts: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ accounts: DEFAULT_ACCOUNTS, isLoading: false });
  },
}));
