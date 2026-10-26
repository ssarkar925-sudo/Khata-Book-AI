import { create } from 'zustand';
import { Card } from '@/types';

interface CardState {
  cards: Card[];
  isLoading: boolean;

  setCards: (cards: Card[]) => void;
  addCardOptimistic: (card: Card) => void;
  updateCardOptimistic: (cardId: string, updates: Partial<Card>) => void;
  deleteCardOptimistic: (cardId: string) => void;
  clearCardData: () => void;
}

const STORAGE_KEY_CARDS = 'rb_cards';

const DEFAULT_CARDS: Card[] = [
  {
    id: 'default-card-1',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'HDFC Regalia Gold',
    bank: 'HDFC Bank',
    last4: '4892',
    credit_limit: 30000000, // ₹3,00,000.00
    statement_day: 15,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'default-card-2',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'SBI Cashback Card',
    bank: 'State Bank of India',
    last4: '1043',
    credit_limit: 15000000, // ₹1,50,000.00
    statement_day: 20,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const useCardStore = create<CardState>((set) => ({
  cards: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CARDS);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_CARDS;
  })(),
  isLoading: false,

  setCards: (cards) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(cards));
    }
    set({ cards });
  },

  addCardOptimistic: (card) =>
    set((state) => {
      const updated = [...state.cards, card];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(updated));
      }
      return { cards: updated };
    }),

  updateCardOptimistic: (cardId, updates) =>
    set((state) => {
      const updated = state.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(updated));
      }
      return { cards: updated };
    }),

  deleteCardOptimistic: (cardId) =>
    set((state) => {
      const updated = state.cards.filter((c) => c.id !== cardId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(updated));
      }
      return { cards: updated };
    }),

  clearCardData: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CARDS);
    }
    set({ cards: [], isLoading: false });
  },
}));
