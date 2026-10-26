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

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  dues: [],
  isLoading: false,

  setCustomers: (customers) => set({ customers }),
  setDues: (dues) => set({ dues }),

  addCustomerOptimistic: (customer) =>
    set((state) => ({
      customers: [...state.customers, customer],
    })),

  addDueOptimistic: (due) =>
    set((state) => ({
      dues: [due, ...state.dues],
    })),

  updateDueStatusOptimistic: (dueId, status) =>
    set((state) => ({
      dues: state.dues.map((d) => (d.id === dueId ? { ...d, status } : d)),
    })),

  clearCustomerData: () => set({ customers: [], dues: [], isLoading: false }),
}));
