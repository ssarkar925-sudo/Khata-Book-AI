import { create } from 'zustand';
import { RecordSheet, SheetRow, SheetColumn } from '@/types';
import { supabase } from '@/lib/supabase';

let saveTimer: any = null;
let cloudTimer: any = null;

function debouncedSaveToLocalStorage(sheets: RecordSheet[]) {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem('rb_saved_sheets', JSON.stringify(sheets));
    } catch {}
  }, 350);
}

function debouncedSyncSheetToCloud(sheet: RecordSheet) {
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    syncSheetToCloud(sheet);
  }, 1200);
}

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
  updateColumn: (sheetId: string, columnId: string, updates: Partial<SheetColumn>) => void;
  deleteColumn: (sheetId: string, columnId: string) => void;
  setCellColor: (sheetId: string, rowId: string, colId: string, color: string | null) => void;
  setFrozenRowCount: (sheetId: string, count: number) => void;
  insertRowAbove: (sheetId: string, referenceRowId: string, rowData?: Record<string, any>) => void;
  insertRowBelow: (sheetId: string, referenceRowId: string, rowData?: Record<string, any>) => void;
  duplicateRow: (sheetId: string, rowId: string) => void;
  setRowHeight: (sheetId: string, height: 'compact' | 'normal' | 'relaxed') => void;
  sortSheetByColumn: (sheetId: string, columnId: string, direction: 'asc' | 'desc') => void;
  setCellFormat: (
    sheetId: string,
    rowId: string,
    colId: string,
    format: { bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right'; textColor?: string | null }
  ) => void;
  insertColumnAt: (sheetId: string, column: SheetColumn, targetIndex: number) => void;
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
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
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
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
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
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
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
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
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
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
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
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  updateColumn: (sheetId, columnId, updates) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const columns = s.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c));
        targetSheet = { ...s, columns };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
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
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  setCellColor: (sheetId, rowId, colId, color) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const colorKey = `_color_${colId}`;
        const rows = s.rows.map((r) => {
          if (r.id !== rowId) return r;
          const updatedData = { ...r.data };
          if (color) {
            updatedData[colorKey] = color;
          } else {
            delete updatedData[colorKey];
          }
          return { ...r, data: updatedData };
        });
        targetSheet = { ...s, rows };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  setFrozenRowCount: (sheetId, count) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        targetSheet = { ...s, frozenRowCount: Math.max(0, count) };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  insertRowAbove: (sheetId, referenceRowId, rowData = {}) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const index = s.rows.findIndex((r) => r.id === referenceRowId);
        const newRow: SheetRow = {
          id: crypto.randomUUID(),
          data: rowData,
          created_at: new Date().toISOString(),
        };
        const rows = [...s.rows];
        if (index === -1) {
          rows.unshift(newRow);
        } else {
          rows.splice(index, 0, newRow);
        }
        targetSheet = { ...s, rows };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  insertRowBelow: (sheetId, referenceRowId, rowData = {}) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const index = s.rows.findIndex((r) => r.id === referenceRowId);
        const newRow: SheetRow = {
          id: crypto.randomUUID(),
          data: rowData,
          created_at: new Date().toISOString(),
        };
        const rows = [...s.rows];
        if (index === -1) {
          rows.push(newRow);
        } else {
          rows.splice(index + 1, 0, newRow);
        }
        targetSheet = { ...s, rows };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  duplicateRow: (sheetId, rowId) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const index = s.rows.findIndex((r) => r.id === rowId);
        if (index === -1) return s;
        const original = s.rows[index];
        const newRow: SheetRow = {
          id: crypto.randomUUID(),
          data: { ...original.data },
          created_at: new Date().toISOString(),
        };
        const rows = [...s.rows];
        rows.splice(index + 1, 0, newRow);
        targetSheet = { ...s, rows };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  setRowHeight: (sheetId, height) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        targetSheet = { ...s, rowHeight: height };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  sortSheetByColumn: (sheetId, columnId, direction) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const sorted = [...s.rows].sort((a, b) => {
          const valA = a.data[columnId] ?? '';
          const valB = b.data[columnId] ?? '';
          const numA = parseFloat(String(valA).replace(/[₹,\s]/g, ''));
          const numB = parseFloat(String(valB).replace(/[₹,\s]/g, ''));
          const isNum = !isNaN(numA) && !isNaN(numB);

          if (isNum) {
            return direction === 'asc' ? numA - numB : numB - numA;
          }
          const strA = String(valA).toLowerCase();
          const strB = String(valB).toLowerCase();
          return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        });
        targetSheet = { ...s, rows: sorted };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  setCellFormat: (sheetId, rowId, colId, format) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const rows = s.rows.map((r) => {
          if (r.id !== rowId) return r;
          const updatedData = { ...r.data };
          if (format.bold !== undefined) {
            if (format.bold) updatedData[`_bold_${colId}`] = true;
            else delete updatedData[`_bold_${colId}`];
          }
          if (format.italic !== undefined) {
            if (format.italic) updatedData[`_italic_${colId}`] = true;
            else delete updatedData[`_italic_${colId}`];
          }
          if (format.align !== undefined) {
            updatedData[`_align_${colId}`] = format.align;
          }
          if (format.textColor !== undefined) {
            if (format.textColor) updatedData[`_textColor_${colId}`] = format.textColor;
            else delete updatedData[`_textColor_${colId}`];
          }
          return { ...r, data: updatedData };
        });
        targetSheet = { ...s, rows };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),

  insertColumnAt: (sheetId, column, targetIndex) =>
    set((state) => {
      let targetSheet: RecordSheet | undefined;
      const updated = state.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const cols = [...s.columns];
        if (targetIndex < 0 || targetIndex >= cols.length) {
          cols.push(column);
        } else {
          cols.splice(targetIndex, 0, column);
        }
        targetSheet = { ...s, columns: cols };
        return targetSheet;
      });
      debouncedSaveToLocalStorage(updated);
      if (targetSheet) debouncedSyncSheetToCloud(targetSheet);
      return { sheets: updated };
    }),
}));
