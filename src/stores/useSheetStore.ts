import { create } from 'zustand';
import { RecordSheet, SheetRow, SheetColumn } from '@/types';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/useSessionStore';

let saveTimer: any = null;
let cloudTimer: any = null;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

export function convertExcelSerialToDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str) return '';

  // 1. ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 4. DD-MM-YY or DD/MM/YY
  const dmyShortMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShortMatch) {
    const d = dmyShortMatch[1].padStart(2, '0');
    const m = dmyShortMatch[2].padStart(2, '0');
    let y = parseInt(dmyShortMatch[3], 10);
    y = y > 50 ? 1900 + y : 2000 + y;
    return `${y}-${m}-${d}`;
  }

  // 5. Excel serial numbers (e.g. 44561 or 35939)
  const num = parseFloat(str);
  if (!isNaN(num) && num > 1000 && num < 75000 && !str.includes('-') && !str.includes('/') && !str.includes('.')) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime()) && date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 2100) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 6. Handle standard Date string parsing (e.g. ISO timestamp or "15 Aug 1998")
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const isUtc = str.includes('T') || str.includes('Z');
    const y = isUtc ? dt.getUTCFullYear() : dt.getFullYear();
    if (y >= 1900 && y <= 2100) {
      const m = String((isUtc ? dt.getUTCMonth() : dt.getMonth()) + 1).padStart(2, '0');
      const d = String(isUtc ? dt.getUTCDate() : dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return str;
}

export function normalizeSheet(s: any): RecordSheet {
  if (!s || typeof s !== 'object') {
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      workspace_id: '',
      title: 'Untitled Sheet',
      category: 'General',
      color: '#6366F1',
      scope: 'business',
      columns: [],
      rows: [],
      frozenRowCount: 0,
      rowHeight: 'normal',
      showGridlines: true,
    };
  }

  let columns = s.columns;
  if (typeof columns === 'string') {
    try {
      columns = JSON.parse(columns);
    } catch {
      columns = [];
    }
  }
  if (!Array.isArray(columns)) columns = [];

  columns = columns.map((col: any, idx: number) => ({
    id: col?.id || `col-${idx}`,
    name: col?.name || `Column ${idx + 1}`,
    type: col?.type || 'text',
    width: typeof col?.width === 'number' ? col.width : 150,
    isPinned: Boolean(col?.isPinned),
  }));

  let rows = s.rows;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      rows = [];
    }
  }
  if (!Array.isArray(rows)) rows = [];

  // Identify date column IDs to normalize existing dates (e.g. DD/MM/YYYY or serials)
  const dateColIds = new Set<string>(
    columns
      .filter((col: any) => col.type === 'date' || /birth|dob|date|expiry|joining/i.test(col.name || ''))
      .map((col: any) => String(col.id))
  );

  rows = rows.map((row: any, idx: number) => {
    const rawData = (row && typeof row.data === 'object' && row.data !== null) ? { ...row.data } : {};
    if (dateColIds.size > 0) {
      for (const colId of dateColIds) {
        if (rawData[colId] !== undefined && rawData[colId] !== null && rawData[colId] !== '') {
          rawData[colId] = convertExcelSerialToDate(rawData[colId]);
        }
      }
    }
    return {
      id: row?.id || `row-${idx}`,
      data: rawData,
      formats: (row && typeof row.formats === 'object' && row.formats !== null) ? row.formats : {},
    };
  });

  return {
    id: String(s.id || ''),
    workspace_id: String(s.workspace_id || ''),
    title: String(s.title || 'Untitled Sheet'),
    category: String(s.category || 'General'),
    color: String(s.color || '#6366F1'),
    scope: (s.scope === 'personal' || s.scope === 'family') ? s.scope : 'business',
    columns,
    rows,
    frozenRowCount: Number(s.frozenRowCount ?? s.frozen_row_count ?? 0),
    rowHeight: (s.rowHeight === 'compact' || s.rowHeight === 'relaxed' || s.row_height === 'compact' || s.row_height === 'relaxed') ? (s.rowHeight || s.row_height) : 'normal',
    showGridlines: s.showGridlines !== undefined ? Boolean(s.showGridlines) : (s.show_gridlines !== undefined ? Boolean(s.show_gridlines) : true),
    created_at: s.created_at || new Date().toISOString(),
    updated_at: s.updated_at || new Date().toISOString(),
  };
}

function isValidUuid(id?: string | null): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id) && id !== LEGACY_MOCK_WORKSPACE_ID;
}

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
  }, 800);
}

async function syncSheetToCloud(sheet: RecordSheet) {
  try {
    const sessionState = typeof useSessionStore !== 'undefined' ? useSessionStore.getState() : null;
    const activeWs = sessionState?.activeWorkspaceId;

    const wsId = isValidUuid(sheet.workspace_id)
      ? sheet.workspace_id
      : (isValidUuid(activeWs) ? activeWs : null);

    if (!wsId) {
      console.warn('[SheetStore] Sheet waiting for active workspace UUID to sync:', sheet.title);
      return;
    }

    const payload = {
      id: sheet.id,
      workspace_id: wsId,
      title: sheet.title || 'Untitled Sheet',
      category: sheet.category || 'General',
      color: sheet.color || '#6366F1',
      scope: (sheet as any).scope || 'business',
      columns: Array.isArray(sheet.columns) ? sheet.columns : [],
      rows: Array.isArray(sheet.rows) ? sheet.rows : [],
      frozen_row_count: Number((sheet as any).frozen_row_count ?? (sheet as any).frozenRowCount ?? 0),
      row_height: (sheet as any).row_height || (sheet as any).rowHeight || 'normal',
      show_gridlines: (sheet as any).show_gridlines !== undefined ? Boolean((sheet as any).show_gridlines) : true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('sheets').upsert(payload);
    if (error) {
      console.error('[SheetStore] Cloud sync failed for sheet:', error.message, error);
      if (sessionState?.setSyncStatus) {
        sessionState.setSyncStatus('error');
        sessionState.setLastSyncError(error.message);
      }
    } else {
      console.log('[SheetStore] Sheet successfully synced to cloud:', sheet.title, 'for workspace:', wsId);
      if (sessionState?.setSyncStatus) {
        sessionState.setSyncStatus('synced');
        sessionState.setLastSyncTime(new Date().toISOString());
        sessionState.setLastSyncError(null);
      }
    }
  } catch (err: any) {
    console.error('[SheetStore] Exception syncing sheet to cloud:', err);
  }
}

async function deleteSheetFromCloud(sheetId: string) {
  try {
    const { error } = await supabase.from('sheets').delete().eq('id', sheetId);
    if (error) {
      console.error('[SheetStore] Failed to delete sheet from cloud:', error.message);
    } else {
      console.log('[SheetStore] Sheet deleted from cloud:', sheetId);
    }
  } catch (err) {
    console.error('[SheetStore] Exception deleting sheet from cloud:', err);
  }
}

interface SheetState {
  sheets: RecordSheet[];
  activeSheetId: string | null;

  setSheets: (sheets: RecordSheet[]) => void;
  setActiveSheetId: (id: string) => void;
  syncPendingLocalSheets: (workspaceId: string) => void;
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

const DEFAULT_SHEETS: RecordSheet[] = [];

export const useSheetStore = create<SheetState>((set) => ({
  sheets: (() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('rb_saved_sheets');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const clean = parsed
              .filter(
                (s: any) =>
                  s &&
                  s.workspace_id !== LEGACY_MOCK_WORKSPACE_ID &&
                  s.id !== 'sheet-pan-register' &&
                  s.id !== 'sheet-utility-bills'
              )
              .map(normalizeSheet);
            return clean;
          }
        }
      } catch {}
    }
    return DEFAULT_SHEETS;
  })(),
  activeSheetId: null,

  setSheets: (cloudSheets) => {
    set((state) => {
      const sheetsMap = new Map<string, RecordSheet>();
      // First insert cloud sheets, properly normalized & safeguarding local rows/cols
      if (Array.isArray(cloudSheets)) {
        for (const raw of cloudSheets) {
          if (raw && raw.id) {
            const existing = state.sheets.find((s) => s.id === raw.id);
            const rawCols = Array.isArray(raw.columns) ? raw.columns : [];
            const rawRows = Array.isArray(raw.rows) ? raw.rows : [];

            // If local sheet already has columns/rows and cloud record came back empty/null, preserve local!
            const cols = (rawCols.length > 0) ? rawCols : (existing?.columns || []);
            const rows = (rawRows.length > 0) ? rawRows : (existing?.rows || []);

            const normalized = normalizeSheet({
              ...raw,
              columns: cols,
              rows: rows,
            });
            sheetsMap.set(normalized.id, normalized);
          }
        }
      }
      // Preserve any local sheets not yet in cloud
      for (const s of state.sheets) {
        if (s && s.id && !sheetsMap.has(s.id)) {
          sheetsMap.set(s.id, normalizeSheet(s));
        }
      }
      const merged = Array.from(sheetsMap.values());
      debouncedSaveToLocalStorage(merged);
      return {
        sheets: merged,
        activeSheetId: state.activeSheetId && sheetsMap.has(state.activeSheetId)
          ? state.activeSheetId
          : (merged[0]?.id || null),
      };
    });
  },

  setActiveSheetId: (activeSheetId) => set({ activeSheetId }),

  syncPendingLocalSheets: (workspaceId: string) => {
    if (!workspaceId || workspaceId === LEGACY_MOCK_WORKSPACE_ID) return;
    if (!isValidUuid(workspaceId)) return;

    set((state) => {
      let changed = false;
      const updated = state.sheets.map((s) => {
        const norm = normalizeSheet(s);
        if (!norm.workspace_id || norm.workspace_id === 'default' || norm.workspace_id === LEGACY_MOCK_WORKSPACE_ID) {
          changed = true;
          const repaired = { ...norm, workspace_id: workspaceId };
          syncSheetToCloud(repaired);
          return repaired;
        }
        return norm;
      });
      if (!changed) return state; // Avoid re-render if nothing changed
      debouncedSaveToLocalStorage(updated);
      return { sheets: updated };
    });
  },

  createSheet: (title, category = 'General', color = '#6366F1', columns, rows = []) => {
    const activeWs = typeof useSessionStore !== 'undefined' ? useSessionStore.getState().activeWorkspaceId : '';
    const newSheet: RecordSheet = {
      id: crypto.randomUUID(),
      workspace_id: activeWs || '',
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
        activeSheetId: state.activeSheetId === id ? updated[0]?.id || null : state.activeSheetId,
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
        const targetCol = s.columns.find((c) => c.id === colId);
        const isDateCol = targetCol?.type === 'date' || (targetCol?.name && /birth|dob|date|expiry|joining/i.test(targetCol.name));
        const valToSave = isDateCol ? convertExcelSerialToDate(value) : value;
        const rows = s.rows.map((r) =>
          r.id === rowId ? { ...r, data: { ...r.data, [colId]: valToSave } } : r
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
