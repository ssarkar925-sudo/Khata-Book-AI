import { create } from 'zustand';
import { CashLocation } from '@/types';

export interface BankAccountItem extends CashLocation {
  gradient?: string;
  iconColor?: string;
}

const DEFAULT_ACCOUNTS: BankAccountItem[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'Physical Cash Drawer',
    balance: 1500000, // ₹15,000.00
    is_default: true,
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    iconColor: 'bg-amber-500 text-white',
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'SBI Savings Account',
    balance: 4500000, // ₹45,000.00
    is_default: false,
    gradient: 'from-blue-600/20 via-cyan-500/10 to-transparent',
    iconColor: 'bg-blue-600 text-white',
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'HDFC Business Current',
    balance: 8200000, // ₹82,000.00
    is_default: false,
    gradient: 'from-indigo-600/20 via-purple-500/10 to-transparent',
    iconColor: 'bg-indigo-600 text-white',
  },
];

interface AccountState {
  accounts: BankAccountItem[];
  isLoading: boolean;

  setAccounts: (accounts: BankAccountItem[]) => void;
  addAccount: (account: BankAccountItem) => void;
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
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_ACCOUNTS;
  })(),
  isLoading: false,

  setAccounts: (accounts) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    }
    set({ accounts });
  },

  addAccount: (account) =>
    set((state) => {
      const updated = [...state.accounts, account];
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
