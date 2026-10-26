import { create } from 'zustand';
import { Customer, PeopleDue, DueStatus } from '@/types';

interface CustomerState {
  customers: Customer[];
  dues: PeopleDue[];
  isLoading: boolean;

  setCustomers: (customers: Customer[]) => void;
  setDues: (dues: PeopleDue[]) => void;
  addCustomerOptimistic: (customer: Customer) => void;
  addDueOptimistic: (due: PeopleDue) => void;
  updateDueStatusOptimistic: (dueId: string, status: DueStatus) => void;
  clearCustomerData: () => void;
}

const STORAGE_KEY_CUSTOMERS = 'rb_customers';
const STORAGE_KEY_DUES = 'rb_dues';

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'cust-101',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'Vikram Textiles',
    phone: '9876543210',
    address: 'Shop 12, Main Market',
    type: 'customer',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cust-102',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'Sharma Electronics & Parts',
    phone: '9812345678',
    address: 'Industrial Area Phase 2',
    type: 'supplier',
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_DUES: PeopleDue[] = [
  {
    id: 'due-101',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    customer_id: 'cust-101',
    direction: 'you_will_get',
    amount: 1450000, // ₹14,500.00
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    status: 'pending',
    notes: 'Order #4092 Silk Sarees delivery payment balance',
    created_at: new Date().toISOString(),
  },
  {
    id: 'due-102',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    customer_id: 'cust-102',
    direction: 'you_will_give',
    amount: 620000, // ₹6,200.00
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    status: 'pending',
    notes: 'Batch #88 Invoice components raw material supply',
    created_at: new Date().toISOString(),
  },
];

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_CUSTOMERS;
  })(),
  dues: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_DUES);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_DUES;
  })(),
  isLoading: false,

  setCustomers: (customers) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
    }
    set({ customers });
  },

  setDues: (dues) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(dues));
    }
    set({ dues });
  },

  addCustomerOptimistic: (customer) =>
    set((state) => {
      const updated = [...state.customers, customer];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(updated));
      }
      return { customers: updated };
    }),

  addDueOptimistic: (due) =>
    set((state) => {
      const updated = [due, ...state.dues];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(updated));
      }
      return { dues: updated };
    }),

  updateDueStatusOptimistic: (dueId, status) =>
    set((state) => {
      const updated = state.dues.map((d) => (d.id === dueId ? { ...d, status } : d));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DUES, JSON.stringify(updated));
      }
      return { dues: updated };
    }),

  clearCustomerData: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CUSTOMERS);
      localStorage.removeItem(STORAGE_KEY_DUES);
    }
    set({ customers: [], dues: [], isLoading: false });
  },
}));
