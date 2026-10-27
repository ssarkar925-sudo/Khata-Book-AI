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
const LEGACY_MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

const DEFAULT_CARDS: Card[] = [];

// Helper to deduplicate cards array by ID and normalize legacy IDs to UUIDs
function dedupeCards(cards: Card[]): Card[] {
  const map = new Map<string, Card>();
  for (const c of cards) {
    if (c && c.id) {
      map.set(c.id, c);
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
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(
              (c) => c && c.workspace_id !== LEGACY_MOCK_WORKSPACE_ID && c.workspace_id !== 'default'
            );
            if (clean.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(clean));
            }
            return dedupeCards(clean);
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