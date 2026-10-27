import { create } from 'zustand';
import { RecordSheet, SheetRow, SheetColumn } from '@/types';
import { supabase } from '@/lib/supabase';

function syncSheetToCloud(sheet: RecordSheet) {
  try {
    supabase.from('sheets').upsert({
      id: sheet.id,
      workspace_id: sheet.workspace_id || '00000000-0000-0000-0000-000000000010',
      title: sheet.title,
      category: sheet.category,
      color: sheet.color,
      columns: sheet.columns,
      rows: sheet.rows,
      updated_at: new Date().toISOString(),
    }).then();
  } catch {}
}

function deleteSheetFromCloud(sheetId: string) {
  try {
    supabase.from('sheets').delete().eq('id', sheetId).then();
  } catch {}
}

interface SheetState {
  sheets: RecordSheet[];
  activeSheetId: string | null;

  setSheets: (sheets: RecordSheet[]) => void;
  setActiveSheetId: (id: string) => void;
  createSheet: (
    title: string,
    category?: string,
    color?: string,
    columns?: SheetColumn[],
    rows?: SheetRow[]
  ) => RecordSheet;
  updateSheet: (id: string, updates: Partial<RecordSheet>) => void;
  deleteSheet: (id: string) => void;
  addRow: (sheetId: string, rowData: Record<string, any>) => void;
  updateRow: (sheetId: string, rowId: string, rowData: Record<string, any>) => void;
  updateCell: (sheetId: string, rowId: string, colId: string, value: any) => void;
  deleteRow: (sheetId: string, rowId: string) => void;
  addColumn: (sheetId: string, column: SheetColumn) => void;
  deleteColumn: (sheetId: string, columnId: string) => void;
}

const DEFAULT_SHEETS: RecordSheet[] = [
  {
    id: 'sheet-pan-register',
    workspace_id: 'default',
    title: 'PAN & Aadhaar Register',
    category: 'Documents',
    color: '#3B82F6',
    columns: [
      { id: 'col_name', name: 'Person Name', type: 'text' },
      { id: 'col_pan', name: 'PAN Number', type: 'text' },
      { id: 'col_aadhaar', name: 'Aadhaar (Last 4)', type: 'number' },
      { id: 'col_phone', name: 'Phone', type: 'phone' },
      { id: 'col_status', name: 'Verification Status', type: 'status' },
      { id: 'col_remarks', name: 'Remarks', type: 'text' },
    ],
    rows: [
      {
        id: 'row-1',
        data: {
          col_name: 'Rajesh Sharma',
          col_pan: 'ABCDE1234F',
          col_aadhaar: '8942',
          col_phone: '9876543210',
          col_status: 'Verified',
          col_remarks: 'Primary Proprietor',
        },
      },
      {
        id: 'row-2',
        data: {
          col_name: 'Pooja Verma',
          col_pan: 'PQRST5678K',
          col_aadhaar: '5412',
          col_phone: '9812345678',
          col_status: 'Verified',
          col_remarks: 'Partner',
        },
      },
    ],
  },
  {
    id: 'sheet-utility-bills',
    workspace_id: 'default',
    title: 'Monthly Utility & Bills',
    category: 'Bills',
    color: '#10B981',
    columns: [
      { id: 'col_bill', name: 'Bill Name / Service', type: 'text' },
      { id: 'col_consumer', name: 'Consumer / Account ID', type: 'text' },
      { id: 'col_duedate', name: 'Due Date', type: 'date' },
      { id: 'col_amount', name: 'Approx Amount (₹)', type: 'amount' },
      { id: 'col_status', name: 'Payment Status', type: 'status' },
    ],
    rows: [
      {
        id: 'row-u1',
        data: {
          col_bill: 'WBSEDCL Electricity',
          col_consumer: '1092837465',
          col_duedate: '2026-11-05',
          col_amount: '2450',
          col_status: 'Pending',
        },
      },
      {
        id: 'row-u2',
        data: {
          col_bill: 'Airtel Fiber Broadband',
          col_consumer: '033-2894102',
          col_duedate: '2026-11-12',
          col_amount: '999',
          col_status: 'Paid',
        },
      },
    ],
  },
];

export const useSheetStore = create<SheetState>((set) => ({
  sheets: (() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('rb_saved_sheets');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return DEFAULT_SHEETS;
  })(),
  activeSheetId: DEFAULT_SHEETS[0].id,

  setSheets: (sheets) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_saved_sheets', JSON.stringify(sheets));
    }
    set({ sheets });
  },

  setActiveSheetId: (activeSheetId) => set({ activeSheetId }),

  createSheet: (title, category = 'General', color = '#6366F1', columns, rows = []) => {
    const newSheet: RecordSheet = {
      id: crypto.randomUUID(),
      workspace_id: 'default',
      title: title.trim() || 'Untitled Sheet',
      category,
      color,
      columns: columns || [
        { id: crypto.randomUUID(), name: 'Item / Name', type: 'text' },
        { id: crypto.randomUUID(), name: 'Details', type: 'text' },
        { id: crypto.randomUUID(), name: 'Amount (₹)', type: 'amount' },
        { id: crypto.randomUUID(), name: 'Status', type: 'status' },
      ],
      rows,
      created_at: new Date().toISOString(),
    };

    set((state) => {
      const updated = [newSheet, ...state.sheets];
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      syncSheetToCloud(newSheet);
      return { sheets: updated, activeSheetId: newSheet.id };
    });

    return newSheet;
  },

  updateSheet: (id, updates) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== id) return s;
        targetSheet = { ...s, ...updates, updated_at: new Date().toISOString() };
        return targetSheet;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      if (targetSheet) syncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  deleteSheet: (id) =>
    set((state) => {
      const updated = state.sheets.filter((s) => s.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      deleteSheetFromCloud(id);
      return {
        sheets: updated,
        activeSheetId: updated[0]?.id || null,
      };
    }),

  addRow: (sheetId, rowData) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const newRow: SheetRow = {
          id: crypto.randomUUID(),
          data: rowData,
          created_at: new Date().toISOString(),
        };
        targetSheet = { ...s, rows: [newRow, ...s.rows] };
        return targetSheet;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      if (targetSheet) syncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  updateRow: (sheetId, rowId, rowData) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const rows = s.rows.map((r) => (r.id === rowId ? { ...r, data: { ...r.data, ...rowData } } : r));
        targetSheet = { ...s, rows };
        return targetSheet;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      if (targetSheet) syncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  updateCell: (sheetId, rowId, colId, value) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const rows = s.rows.map((r) =>
          r.id === rowId ? { ...r, data: { ...r.data, [colId]: value } } : r
        );
        targetSheet = { ...s, rows };
        return targetSheet;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      if (targetSheet) syncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  deleteRow: (sheetId, rowId) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        targetSheet = { ...s, rows: s.rows.filter((r) => r.id !== rowId) };
        return targetSheet;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      if (targetSheet) syncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  addColumn: (sheetId, column) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        targetSheet = { ...s, columns: [...s.columns, column] };
        return targetSheet;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      if (targetSheet) syncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  deleteColumn: (sheetId, columnId) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        targetSheet = { ...s, columns: s.columns.filter((c) => c.id !== columnId) };
        return targetSheet;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rb_saved_sheets', JSON.stringify(updated));
      }
      if (targetSheet) syncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),
}));
