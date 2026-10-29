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
const STORAGE_KEY_CARD_REMARKS = 'rb_card_remarks';
const LEGACY_MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

const DEFAULT_CARDS: Card[] = [];

// Helper to retrieve persistent card remarks
function getStoredCardRemarks(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CARD_REMARKS);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Helper to save a single card remark to persistent storage
function persistCardRemark(cardId: string, remark?: string | null) {
  if (typeof window === 'undefined' || !cardId) return;
  try {
    const map = getStoredCardRemarks();
    if (remark && remark.trim()) {
      map[cardId] = remark.trim();
    } else if (remark === null || remark === '') {
      delete map[cardId];
    }
    localStorage.setItem(STORAGE_KEY_CARD_REMARKS, JSON.stringify(map));
  } catch {}
}

// Helper to deduplicate cards array by ID, preserve local remarks, and normalize legacy IDs
function dedupeCards(cards: Card[]): Card[] {
  const map = new Map<string, Card>();
  const remarksMap = getStoredCardRemarks();

  for (const c of cards) {
    if (c && c.id) {
      const existing = map.get(c.id);
      const note = c.notes || remarksMap[c.id] || existing?.notes || null;
      if (note) remarksMap[c.id] = note;

      map.set(c.id, {
        ...existing,
        ...c,
        notes: note,
        variant: c.variant || existing?.variant,
        network: c.network || existing?.network || 'visa',
      });
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CARD_REMARKS, JSON.stringify(remarksMap));
    } catch {}
  }
  return Array.from(map.values());
}

export const useCardStore = create<CardState>((set, get) => ({
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
    const current = get().cards;
    const currentMap = new Map<string, Card>(current.map((c) => [c.id, c]));
    const remarksMap = getStoredCardRemarks();

    const merged = cards.map((c) => {
      const existing = currentMap.get(c.id);
      const note =
        c.notes !== undefined && c.notes !== null
          ? c.notes
          : (remarksMap[c.id] || existing?.notes || null);
      if (note) remarksMap[c.id] = note;

      return {
        ...existing,
        ...c,
        notes: note,
        variant: c.variant || existing?.variant,
        network: c.network || existing?.network || 'visa',
      };
    });

    const deduped = dedupeCards(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(deduped));
      localStorage.setItem(STORAGE_KEY_CARD_REMARKS, JSON.stringify(remarksMap));
    }
    set({ cards: deduped });
  },

  addCardOptimistic: (card) => {
    if (card.notes) {
      persistCardRemark(card.id, card.notes);
    }
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
    });
  },

  updateCardOptimistic: (cardId, updates) => {
    if (updates.notes !== undefined) {
      persistCardRemark(cardId, updates.notes);
    }
    set((state) => {
      const updated = state.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(updated));
      }
      return { cards: updated };
    });
  },

  deleteCardOptimistic: (cardId) => {
    persistCardRemark(cardId, null);
    set((state) => {
      const updated = state.cards.filter((c) => c.id !== cardId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(updated));
      }
      return { cards: updated };
    });
  },

  clearCardData: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CARDS);
    }
    set({ cards: [], isLoading: false });
  },
}));