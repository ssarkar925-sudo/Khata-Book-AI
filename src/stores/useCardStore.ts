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
    id: '00000000-0000-0000-0000-000000000101',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'HDFC Regalia Gold',
    bank: 'HDFC Bank',
    last4: '4892',
    credit_limit: 30000000, // ₹3,00,000.00
    statement_day: 15,
    due_day: 5,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    name: 'SBI Cashback Card',
    bank: 'State Bank of India',
    last4: '1043',
    credit_limit: 15000000, // ₹1,50,000.00
    statement_day: 20,
    due_day: 10,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Helper to deduplicate cards array by ID and normalize legacy IDs to UUIDs
function dedupeCards(cards: Card[]): Card[] {
  const map = new Map<string, Card>();
  for (const c of cards) {
    if (c && c.id) {
      const normalizedId =
        c.id === 'default-card-1'
          ? '00000000-0000-0000-0000-000000000101'
          : c.id === 'default-card-2'
          ? '00000000-0000-0000-0000-000000000102'
          : c.id;
      map.set(normalizedId, { ...c, id: normalizedId });
    }
  }
  return Array.from(map.values());
}

export const useCardStore = create<CardState>((set) => ({
  cards: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CARDS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return dedupeCards(parsed);
          }
        }
      } catch {}
    }
    return DEFAULT_CARDS;
  })(),
  isLoading: false,

  setCards: (cards) => {
    const deduped = dedupeCards(cards);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(deduped));
    }
    set({ cards: deduped });
  },

  addCardOptimistic: (card) =>
    set((state) => {
      // Check if card with this id already exists to prevent duplicate entry
      if (state.cards.some((c) => c.id === card.id)) {
        return state;
      }
      const updated = dedupeCards([...state.cards, card]);
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