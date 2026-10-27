import { create } from 'zustand';
import { Customer, PeopleDue, DueStatus } from '@/types';

interface CustomerState {
  customers: Customer[];
  dues: PeopleDue[];
  isLoading: boolean;

  setCustomers: (customers: Customer[]) => void;
  setDues: (dues: PeopleDue[]) => void;
  addCustomerOptimistic: (customer: Customer) => void;
  updateCustomerOptimistic: (id: string, updates: Partial<Customer>) => void;
  deleteCustomerOptimistic: (id: string) => void;
  addDueOptimistic: (due: PeopleDue) => void;
  updateDueOptimistic: (id: string, updates: Partial<PeopleDue>) => void;
  deleteDueOptimistic: (id: string) => void;
  updateDueStatusOptimistic: (dueId: string, status: DueStatus) => void;
  partialSettleDueOptimistic: (dueId: string, paidAmountPaise: number) => void;
  clearCustomerData: () => void;
}

const STORAGE_KEY_CUSTOMERS = 'rb_customers';
const STORAGE_KEY_DUES = 'rb_dues';
const LEGACY_MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

const DEFAULT_CUSTOMERS: Customer[] = [];
const DEFAULT_DUES: PeopleDue[] = [];

// Helper to deduplicate items by ID
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(
              (c: any) => c && c.workspace_id !== LEGACY_MOCK_WORKSPACE_ID && c.workspace_id !== 'default'
            );
            if (clean.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(clean));
            }
            return dedupeById(clean);
          }
        }
      } catch {}
    }
    return DEFAULT_CUSTOMERS;
  })(),
  dues: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_DUES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(
              (d: any) => d && d.workspace_id !== LEGACY_MOCK_WORKSPACE_ID && d.workspace_id !== 'default'
            );
            if (clean.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(clean));
            }
            return dedupeById(clean);
          }
        }
      } catch {}
    }
    return DEFAULT_DUES;
  })(),
  isLoading: false,

  setCustomers: (customers) => {
    const deduped = dedupeById(customers);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(deduped));
    }
    set({ customers: deduped });
  },

  setDues: (dues) => {
    const deduped = dedupeById(dues);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(deduped));
    }
    set({ dues: deduped });
  },

  addCustomerOptimistic: (customer) =>
    set((state) => {
      const exists = state.customers.some((c) => c.id === customer.id);
      const updated = exists
        ? state.customers.map((c) => (c.id === customer.id ? customer : c))
        : [...state.customers, customer];
      const deduped = dedupeById(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(deduped));
      }
      return { customers: deduped };
    }),

  updateCustomerOptimistic: (id, updates) =>
    set((state) => {
      const updated = state.customers.map((c) => (c.id === id ? { ...c, ...updates } : c));
      const deduped = dedupeById(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(deduped));
      }
      return { customers: deduped };
    }),

  deleteCustomerOptimistic: (id) =>
    set((state) => {
      const updated = state.customers.filter((c) => c.id !== id);
      const updatedDues = state.dues.filter((d) => d.customer_id !== id);
      const deduped = dedupeById(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(deduped));
        localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(updatedDues));
      }
      return { customers: deduped, dues: updatedDues };
    }),

  addDueOptimistic: (due) =>
    set((state) => {
      const exists = state.dues.some((d) => d.id === due.id);
      const updated = exists
        ? state.dues.map((d) => (d.id === due.id ? due : d))
        : [due, ...state.dues];
      const deduped = dedupeById(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(deduped));
      }
      return { dues: deduped };
    }),

  updateDueStatusOptimistic: (dueId, status) =>
    set((state) => {
      const updated = state.dues.map((d) => (d.id === dueId ? { ...d, status } : d));
      const deduped = dedupeById(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(deduped));
      }
      return { dues: deduped };
    }),

  updateDueOptimistic: (id, updates) =>
    set((state) => {
      const updated = state.dues.map((d) => (d.id === id ? { ...d, ...updates } : d));
      const deduped = dedupeById(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(deduped));
      }
      return { dues: deduped };
    }),

  deleteDueOptimistic: (id) =>
    set((state) => {
      const updated = state.dues.filter((d) => d.id !== id);
      const deduped = dedupeById(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(deduped));
      }
      return { dues: deduped };
    }),

  partialSettleDueOptimistic: (dueId, paidAmountPaise) =>
    set((state) => {
      const updated = state.dues.map((d) => {
        if (d.id !== dueId) return d;
        if (paidAmountPaise >= d.amount) {
          return { ...d, status: 'settled' as DueStatus };
        }
        return { ...d, amount: d.amount - paidAmountPaise };
      });
      const deduped = dedupeById(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(deduped));
      }
      return { dues: deduped };
    }),

  clearCustomerData: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CUSTOMERS);
      localStorage.removeItem(STORAGE_KEY_DUES);
    }
    set({ customers: [], dues: [], isLoading: false });
  },
}));
