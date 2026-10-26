import { create } from 'zustand';
import { Card } from '@/types';

interface CardState {
  cards: Card[];
  isLoading: boolean;

  setCards: (cards: Card[]) => void;
  addCardOptimistic: (card: Card) => void;
  updateCardOptimistic: (cardId: string, updates: Partial<Card>) => void;
  clearCardData: () => void;
}

export const useCardStore = create<CardState>((set) => ({
  cards: [],
  isLoading: false,

  setCards: (cards) => set({ cards }),

  addCardOptimistic: (card) =>
    set((state) => ({
      cards: [...state.cards, card],
    })),

  updateCardOptimistic: (cardId, updates) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c)),
    })),

  clearCardData: () => set({ cards: [], isLoading: false }),
}));
