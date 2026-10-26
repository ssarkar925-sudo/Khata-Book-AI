import { create } from 'zustand';
import { NoteItem } from '@/types';

interface NoteState {
  notes: NoteItem[];
  isLoading: boolean;

  setNotes: (notes: NoteItem[]) => void;
  addNoteOptimistic: (note: NoteItem) => void;
  updateNoteOptimistic: (id: string, updates: Partial<NoteItem>) => void;
  deleteNoteOptimistic: (id: string) => void;
  clearNotes: () => void;
}

const STORAGE_KEY_NOTES = 'rb_notes';

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note-101',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    title: 'Monthly Financial Closing Checklist',
    body: 'Review all pending supplier invoices, verify GST input tax credit, and reconcile bank statements before the 5th.',
    color: '#FEF3C7',
    tags: ['Accounting', 'Audit', 'Monthly'],
    is_pinned: true,
    checklist_items: [
      { id: 'chk-1', text: 'Reconcile SBI savings statement with cash book', is_done: true },
      { id: 'chk-2', text: 'Clear pending HDFC credit card statement dues', is_done: true },
      { id: 'chk-3', text: 'Follow up on Vikram Textiles unpaid balance (₹14,500)', is_done: false },
      { id: 'chk-4', text: 'Backup encrypted vault credentials to offline drive', is_done: false },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'note-102',
    workspace_id: '00000000-0000-0000-0000-000000000010',
    title: 'Supplier Payment Terms & Bank Details',
    body: 'Sharma Electronics accepts IMPS/NEFT transfers. IFSC: SBIN0001234, Account: 20491823901. Payment cycle: Net 15 days.',
    color: '#CCFBF1',
    tags: ['Vendors', 'Banking'],
    is_pinned: false,
    checklist_items: [],
    created_at: new Date().toISOString(),
  },
];

// Helper to deduplicate notes array by ID
function dedupeNotes(notes: NoteItem[]): NoteItem[] {
  const map = new Map<string, NoteItem>();
  for (const n of notes) {
    if (n && n.id) {
      map.set(n.id, n);
    }
  }
  return Array.from(map.values());
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_NOTES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return dedupeNotes(parsed);
          }
        }
      } catch {}
    }
    return DEFAULT_NOTES;
  })(),
  isLoading: false,

  setNotes: (notes) => {
    const deduped = dedupeNotes(notes);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(deduped));
    }
    set({ notes: deduped });
  },

  addNoteOptimistic: (note) =>
    set((state) => {
      const exists = state.notes.some((n) => n.id === note.id);
      const updated = exists
        ? state.notes.map((n) => (n.id === note.id ? note : n))
        : [note, ...state.notes];
      const deduped = dedupeNotes(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(deduped));
      }
      return { notes: deduped };
    }),

  updateNoteOptimistic: (id, updates) =>
    set((state) => {
      const updated = state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n));
      const deduped = dedupeNotes(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(deduped));
      }
      return { notes: deduped };
    }),

  deleteNoteOptimistic: (id) =>
    set((state) => {
      const updated = state.notes.filter((n) => n.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updated));
      }
      return { notes: updated };
    }),

  clearNotes: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_NOTES);
    }
    set({ notes: [], isLoading: false });
  },
}));
