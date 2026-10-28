'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Table,
  Plus,
  Trash2,
  Download,
  Search,
  FileSpreadsheet,
  Columns,
  CheckCircle2,
  X,
  FileText,
  Upload,
  Palette,
  Settings,
  Calculator,
  Pin,
  PinOff,
  ChevronLeft,
  ChevronRight,
  WrapText,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Paintbrush,
  Calendar,
  Check,
  ListFilter,
  Maximize2,
  Sliders,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Bold,
  Italic,
  Copy,
  Grid,
  ArrowUpDown,
  CornerDownLeft,
  Type,
  Lock,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import { useSheetStore } from '@/stores/useSheetStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { syncEngine } from '@/lib/syncEngine';
import { SheetColumn, SheetColumnType, SheetRow } from '@/types';

const SHEET_COLORS = [
  { id: '#6366F1', name: 'Indigo' },
  { id: '#10B981', name: 'Emerald' },
  { id: '#3B82F6', name: 'Blue' },
  { id: '#F59E0B', name: 'Amber' },
  { id: '#F43F5E', name: 'Rose' },
  { id: '#8B5CF6', name: 'Purple' },
  { id: '#06B6D4', name: 'Cyan' },
  { id: '#64748B', name: 'Slate' },
];

const CELL_HIGHLIGHT_COLORS = [
  { id: 'none', label: 'Clear Fill', bg: 'transparent', border: 'border-slate-300 dark:border-white/20' },
  { id: '#fef08a', label: 'Yellow', bg: '#fef08a' }, // yellow-200
  { id: '#bbf7d0', label: 'Green', bg: '#bbf7d0' }, // green-200
  { id: '#fecdd3', label: 'Red', bg: '#fecdd3' }, // rose-200
  { id: '#bfdbfe', label: 'Blue', bg: '#bfdbfe' }, // blue-200
  { id: '#e9d5ff', label: 'Purple', bg: '#e9d5ff' }, // purple-200
  { id: '#fed7aa', label: 'Orange', bg: '#fed7aa' }, // orange-200
];

const TEXT_COLORS = [
  { id: 'default', label: 'Default Text', color: 'inherit' },
  { id: '#0f172a', label: 'Black', color: '#0f172a' },
  { id: '#2563eb', label: 'Blue', color: '#2563eb' },
  { id: '#16a34a', label: 'Green', color: '#16a34a' },
  { id: '#dc2626', label: 'Red', color: '#dc2626' },
  { id: '#d97706', label: 'Amber', color: '#d97706' },
  { id: '#9333ea', label: 'Purple', color: '#9333ea' },
];

// Helper to convert Excel date serials to clean YYYY-MM-DD
function convertExcelSerialToDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
    return str;
  }
  const num = parseFloat(str);
  if (!isNaN(num) && num > 1000 && num < 65000 && !str.includes('-') && !str.includes('/')) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2099) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return str;
}

// Convert 0-based column index to Excel column letter (0 -> A, 1 -> B, 26 -> AA)
function getColumnLetter(colIndex: number): string {
  if (colIndex < 0) return 'A';
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Fast Memoized Cell Input with Zero Lag
const SheetCellInput = React.memo(function SheetCellInput({
  value,
  type,
  isBold,
  isItalic,
  align,
  textColor,
  cellColor,
  wrapText,
  onChange,
  onEnterAtLastRow,
}: {
  value: string;
  type: SheetColumnType;
  isBold: boolean;
  isItalic: boolean;
  align: 'left' | 'center' | 'right';
  textColor?: string;
  cellColor?: string;
  wrapText: boolean;
  onChange: (val: string) => void;
  onEnterAtLastRow?: () => void;
}) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const hasPastelFill = Boolean(cellColor && cellColor !== 'none' && cellColor !== 'transparent');
  const effectiveTextColor = textColor || (hasPastelFill ? '#0f172a' : undefined);

  return (
    <input
      type="text"
      value={localVal}
      onChange={(e) => {
        setLocalVal(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={() => {
        if (localVal !== value) {
          onChange(localVal);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnterAtLastRow) {
          onEnterAtLastRow();
        }
      }}
      style={{
        fontWeight: isBold ? 'bold' : undefined,
        fontStyle: isItalic ? 'italic' : undefined,
        textAlign: align,
        color: effectiveTextColor,
      }}
      className={`w-full bg-transparent px-1.5 py-0.5 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors ${
        wrapText ? '' : 'truncate'
      } ${
        hasPastelFill
          ? 'text-slate-950 font-semibold'
          : type === 'amount'
          ? 'font-bold font-mono text-emerald-600 dark:text-emerald-400'
          : type === 'status'
          ? 'font-bold text-blue-600 dark:text-blue-400'
          : 'text-slate-800 dark:text-slate-200'
      }`}
    />
  );
});

export function SheetsScreen() {
  const {
    sheets,
    activeSheetId,
    setActiveSheetId,
    createSheet,
    updateSheet,
    deleteSheet,
    addRow,
    updateRow,
    updateCell,
    deleteRow,
    addColumn,
    updateColumn,
    deleteColumn,
    setCellColor,
    setFrozenRowCount,
    insertRowAbove,
    insertRowBelow,
    duplicateRow,
    setRowHeight,
    sortSheetByColumn,
    setCellFormat,
    insertColumnAt,
  } = useSheetStore();

  const { theme, activeWorkspaceId } = useSessionStore();
  const isLight = theme === 'light';
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-pull sheets from Supabase on screen mount & workspace switch
  useEffect(() => {
    const wsId = activeWorkspaceId || useSessionStore.getState().activeWorkspaceId;
    if (wsId) {
      syncEngine.pullAll(wsId);
    }
  }, [activeWorkspaceId]);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    const wsId = activeWorkspaceId || useSessionStore.getState().activeWorkspaceId;
    if (wsId) {
      await syncEngine.pullAll(wsId);
    }
    setIsRefreshing(false);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Search & Display Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [wrapText, setWrapText] = useState(false);
  const [showGridlines, setShowGridlines] = useState(true);

  // Selection states
  const [selectedColId, setSelectedColId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null);

  // Formula Bar (fx) State
  const [formulaInput, setFormulaInput] = useState('');
  const [isFormulaEditing, setIsFormulaEditing] = useState(false);

  // Modals
  const [showNewSheetModal, setShowNewSheetModal] = useState(false);
  const [showEditSheetModal, setShowEditSheetModal] = useState(false);
  const [showNewColModal, setShowNewColModal] = useState(false);
  const [showEditColModal, setShowEditColModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // New Sheet Form
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [newSheetCategory, setNewSheetCategory] = useState('Business');
  const [newSheetColor, setNewSheetColor] = useState('#6366F1');

  // Edit Sheet Form
  const [editSheetTitle, setEditSheetTitle] = useState('');
  const [editSheetCategory, setEditSheetCategory] = useState('');
  const [editSheetColor, setEditSheetColor] = useState('');

  // Column Form (Add / Edit)
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colName, setColName] = useState('');
  const [colType, setColType] = useState<SheetColumnType>('text');
  const [colWidth, setColWidth] = useState<number>(180);
  const [colOptionsInput, setColOptionsInput] = useState('');
  const [colIsPinned, setColIsPinned] = useState(false);
  const [colInsertTarget, setColInsertTarget] = useState<'end' | 'left' | 'right'>('end');

  // Excel Import Pending State
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    title: string;
    category: string;
    color: string;
    columns: SheetColumn[];
    rows: SheetRow[];
  } | null>(null);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) || sheets[0];

  // Auto-select first column on load if none selected
  useEffect(() => {
    if (activeSheet && activeSheet.columns.length > 0 && !selectedColId) {
      setSelectedColId(activeSheet.columns[0].id);
    }
  }, [activeSheet, selectedColId]);

  // Ensure scroll position resets to top (Row 1) on sheet change
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
      tableContainerRef.current.scrollLeft = 0;
    }
  }, [activeSheetId]);

  // 1-Click Scroll to Row 1
  const scrollToRow1 = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 1-Click Scroll to Bottom
  const scrollToBottom = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({
        top: tableContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // Selected column object
  const activeCol = useMemo(() => {
    if (!activeSheet || !selectedColId) return null;
    return activeSheet.columns.find((c) => c.id === selectedColId) || activeSheet.columns[0] || null;
  }, [activeSheet, selectedColId]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return (activeSheet?.rows || []).filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return Object.values(r.data).some((val) => String(val).toLowerCase().includes(q));
    });
  }, [activeSheet?.rows, searchQuery]);

  // Selected row object
  const activeRow = useMemo(() => {
    if (!activeSheet || !selectedCell) return null;
    return activeSheet.rows.find((r) => r.id === selectedCell.rowId) || null;
  }, [activeSheet, selectedCell]);

  // Selected cell coordinate info (e.g. A1, B4)
  const cellCoordinate = useMemo(() => {
    if (!activeSheet || !selectedCell) return null;
    const colIdx = activeSheet.columns.findIndex((c) => c.id === selectedCell.colId);
    const rowIdx = filteredRows.findIndex((r) => r.id === selectedCell.rowId);
    if (colIdx === -1 || rowIdx === -1) return null;
    const letter = getColumnLetter(colIdx);
    const num = rowIdx + 1;
    const colObj = activeSheet.columns[colIdx];
    return {
      coordinate: `${letter}${num}`,
      colLetter: letter,
      rowNum: num,
      colName: colObj.name,
      colType: colObj.type,
      colIndex: colIdx,
      rowIndex: rowIdx,
    };
  }, [activeSheet, selectedCell, filteredRows]);

  // Keep formulaInput synced when selectedCell changes
  useEffect(() => {
    if (selectedCell && activeRow) {
      const val = activeRow.data[selectedCell.colId] ?? '';
      setFormulaInput(String(val));
      setIsFormulaEditing(false);
    } else {
      setFormulaInput('');
    }
  }, [selectedCell, activeRow]);

  // Commit Formula Input to Selected Cell
  const handleCommitFormula = () => {
    if (!activeSheet || !selectedCell) return;
    updateCell(activeSheet.id, selectedCell.rowId, selectedCell.colId, formulaInput);
    setIsFormulaEditing(false);
  };

  // Revert Formula Input
  const handleCancelFormula = () => {
    if (!activeSheet || !selectedCell || !activeRow) return;
    const original = activeRow.data[selectedCell.colId] ?? '';
    setFormulaInput(String(original));
    setIsFormulaEditing(false);
  };

  // Precompute cumulative left offsets for pinned columns
  const pinnedColOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentLeft = 48; // width of '#' index column
    activeSheet?.columns.forEach((col) => {
      if (col.isPinned) {
        offsets[col.id] = currentLeft;
        currentLeft += col.width || 180;
      }
    });
    return offsets;
  }, [activeSheet?.columns]);

  // Density / Row Height Configuration
  const rowHeightMode = activeSheet?.rowHeight || 'normal';
  const rowHeightPx = rowHeightMode === 'compact' ? 30 : rowHeightMode === 'relaxed' ? 50 : 38;
  const densityPadding =
    rowHeightMode === 'compact'
      ? 'py-1 px-2.5 text-xs'
      : rowHeightMode === 'relaxed'
      ? 'py-3.5 px-3.5 text-sm'
      : 'py-2 px-3 text-xs';

  const frozenRowCount = activeSheet?.frozenRowCount || 0;

  // Freeze Panes Operations
  const handleToggleFreezeTopRow = () => {
    if (!activeSheet) return;
    const nextCount = frozenRowCount === 1 ? 0 : 1;
    setFrozenRowCount(activeSheet.id, nextCount);
  };

  const handleFreezeUpToSelectedRow = () => {
    if (!activeSheet || !cellCoordinate) return;
    setFrozenRowCount(activeSheet.id, cellCoordinate.rowNum);
  };

  const handleToggleFreezeFirstColumn = () => {
    if (!activeSheet || activeSheet.columns.length === 0) return;
    const firstCol = activeSheet.columns[0];
    updateColumn(activeSheet.id, firstCol.id, { isPinned: !firstCol.isPinned });
  };

  const handleUnfreezeAll = () => {
    if (!activeSheet) return;
    setFrozenRowCount(activeSheet.id, 0);
    activeSheet.columns.forEach((col) => {
      if (col.isPinned) {
        updateColumn(activeSheet.id, col.id, { isPinned: false });
      }
    });
  };

  // Toggle Column Freeze / Pin
  const handleToggleFreezeColumn = (colId: string) => {
    if (!activeSheet) return;
    const col = activeSheet.columns.find((c) => c.id === colId);
    if (!col) return;
    updateColumn(activeSheet.id, colId, { isPinned: !col.isPinned });
  };

  // Column Width +/- Adjuster
  const handleAdjustColumnWidth = (colId: string, delta: number) => {
    if (!activeSheet) return;
    const col = activeSheet.columns.find((c) => c.id === colId);
    if (!col) return;
    const currentW = col.width || 180;
    const newW = Math.max(90, Math.min(600, currentW + delta));
    updateColumn(activeSheet.id, colId, { width: newW });
  };

  // Quick 1-Click Continuation Row
  const handleQuickAddRow = () => {
    if (!activeSheet) return;
    const blankData: Record<string, any> = {};
    activeSheet.columns.forEach((col) => {
      blankData[col.id] = '';
    });
    addRow(activeSheet.id, blankData);
  };

  // Insert Row Above Selected
  const handleInsertRowAbove = () => {
    if (!activeSheet) return;
    const blankData: Record<string, any> = {};
    activeSheet.columns.forEach((col) => {
      blankData[col.id] = '';
    });
    const refId = selectedCell?.rowId || activeSheet.rows[0]?.id || '';
    insertRowAbove(activeSheet.id, refId, blankData);
  };

  // Insert Row Below Selected
  const handleInsertRowBelow = () => {
    if (!activeSheet) return;
    const blankData: Record<string, any> = {};
    activeSheet.columns.forEach((col) => {
      blankData[col.id] = '';
    });
    const refId = selectedCell?.rowId || activeSheet.rows[activeSheet.rows.length - 1]?.id || '';
    insertRowBelow(activeSheet.id, refId, blankData);
  };

  // Duplicate Selected Row
  const handleDuplicateRow = () => {
    if (!activeSheet || !selectedCell) return;
    duplicateRow(activeSheet.id, selectedCell.rowId);
  };

  // Delete Selected Row
  const handleDeleteSelectedRow = () => {
    if (!activeSheet || !selectedCell) return;
    if (confirm(`Delete Row #${(cellCoordinate?.rowNum || '')}?`)) {
      deleteRow(activeSheet.id, selectedCell.rowId);
      setSelectedCell(null);
    }
  };

  // Cell Formatting Helpers
  const currentCellData = activeRow?.data;
  const isCellBold = selectedCell && currentCellData ? Boolean(currentCellData[`_bold_${selectedCell.colId}`]) : false;
  const isCellItalic = selectedCell && currentCellData ? Boolean(currentCellData[`_italic_${selectedCell.colId}`]) : false;
  const cellAlignment = selectedCell && currentCellData ? currentCellData[`_align_${selectedCell.colId}`] || 'left' : 'left';

  const handleToggleBold = () => {
    if (!activeSheet || !selectedCell) return;
    setCellFormat(activeSheet.id, selectedCell.rowId, selectedCell.colId, { bold: !isCellBold });
  };

  const handleToggleItalic = () => {
    if (!activeSheet || !selectedCell) return;
    setCellFormat(activeSheet.id, selectedCell.rowId, selectedCell.colId, { italic: !isCellItalic });
  };

  const handleSetAlignment = (align: 'left' | 'center' | 'right') => {
    if (!activeSheet || !selectedCell) return;
    setCellFormat(activeSheet.id, selectedCell.rowId, selectedCell.colId, { align });
  };

  const handleSetTextColor = (color: string) => {
    if (!activeSheet || !selectedCell) return;
    setCellFormat(activeSheet.id, selectedCell.rowId, selectedCell.colId, {
      textColor: color === 'default' ? null : color,
    });
  };

  const handleApplyCellColor = (colorHex: string) => {
    if (!activeSheet || !selectedCell) return;
    setCellColor(
      activeSheet.id,
      selectedCell.rowId,
      selectedCell.colId,
      colorHex === 'none' ? null : colorHex
    );
  };

  // Column Sort
  const handleSortColumn = (direction: 'asc' | 'desc') => {
    if (!activeSheet || !activeCol) return;
    sortSheetByColumn(activeSheet.id, activeCol.id, direction);
  };

  // Column Insert (Left / Right)
  const openAddColumnModal = (target: 'end' | 'left' | 'right') => {
    setColInsertTarget(target);
    setColName('');
    setColType('text');
    setColWidth(180);
    setColOptionsInput('');
    setColIsPinned(false);
    setShowNewColModal(true);
  };

  const handleAddColumnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSheet || !colName.trim()) return;
    const options = colOptionsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const newCol: SheetColumn = {
      id: `col_${Date.now()}`,
      name: colName.trim(),
      type: colType,
      width: Math.max(90, colWidth || 180),
      options: options.length > 0 ? options : undefined,
      isPinned: colIsPinned,
    };

    if (colInsertTarget === 'end' || !activeCol) {
      addColumn(activeSheet.id, newCol);
    } else {
      const idx = activeSheet.columns.findIndex((c) => c.id === activeCol.id);
      const targetIndex = colInsertTarget === 'left' ? Math.max(0, idx) : idx + 1;
      insertColumnAt(activeSheet.id, newCol, targetIndex);
    }

    setShowNewColModal(false);
    setSelectedColId(newCol.id);
  };

  // Column Edit Modal
  const openEditColumnModal = (col: SheetColumn) => {
    setEditingColId(col.id);
    setColName(col.name);
    setColType(col.type);
    setColWidth(col.width || 180);
    setColOptionsInput(col.options ? col.options.join(', ') : '');
    setColIsPinned(Boolean(col.isPinned));
    setShowEditColModal(true);
  };

  const handleSaveColumnEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSheet || !editingColId || !colName.trim()) return;

    const options = colOptionsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    updateColumn(activeSheet.id, editingColId, {
      name: colName.trim(),
      type: colType,
      width: Math.max(90, colWidth || 180),
      options: options.length > 0 ? options : undefined,
      isPinned: colIsPinned,
    });

    setShowEditColModal(false);
  };

  // Horizontal pan
  const scrollTable = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const offset = direction === 'left' ? -350 : 350;
      tableContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Open Edit Sheet Modal
  const openEditSheet = () => {
    if (!activeSheet) return;
    setEditSheetTitle(activeSheet.title);
    setEditSheetCategory(activeSheet.category || 'General');
    setEditSheetColor(activeSheet.color || '#6366F1');
    setShowEditSheetModal(true);
  };

  const handleUpdateSheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSheet || !editSheetTitle.trim()) return;
    updateSheet(activeSheet.id, {
      title: editSheetTitle.trim(),
      category: editSheetCategory,
      color: editSheetColor,
    });
    setShowEditSheetModal(false);
  };

  const handleCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;
    const newSheet = createSheet(newSheetTitle.trim(), newSheetCategory, newSheetColor);
    try {
      await syncEngine.pushSheet(newSheet);
    } catch (err) {
      console.warn('[Sheets] Cloud push queued for new sheet:', err);
    }
    setShowNewSheetModal(false);
    setNewSheetTitle('');
  };

  // Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const data = evt.target?.result;
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          dateNF: 'yyyy-mm-dd',
        });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];

        if (!rawJson || rawJson.length === 0) {
          alert('The uploaded spreadsheet appears to be empty.');
          return;
        }

        let headerRowIndex = 0;
        let maxCols = 0;
        for (let r = 0; r < Math.min(rawJson.length, 12); r++) {
          const row = rawJson[r] || [];
          const count = row.filter((c: any) => c !== undefined && c !== null && String(c).trim() !== '').length;
          if (count > maxCols) {
            maxCols = count;
            headerRowIndex = r;
          }
        }

        const headerRow = (rawJson[headerRowIndex] || []) as string[];
        const detectedColumns: SheetColumn[] = headerRow.map((h, idx) => {
          const name = String(h || `Column ${idx + 1}`).trim();
          const lower = name.toLowerCase();

          let detectedType: SheetColumnType = 'text';
          if (
            lower.includes('birth') ||
            lower.includes('dob') ||
            lower.includes('date') ||
            lower.includes('expiry') ||
            lower.includes('joining')
          ) {
            detectedType = 'date';
          } else if (
            lower.includes('amount') ||
            lower.includes('price') ||
            lower.includes('cost') ||
            lower.includes('total') ||
            lower.includes('salary') ||
            lower.includes('fee') ||
            lower.includes('₹')
          ) {
            detectedType = 'amount';
          } else if (lower.includes('phone') || lower.includes('mobile')) {
            detectedType = 'phone';
          } else if (
            lower.includes('status') ||
            lower.includes('gender') ||
            lower.includes('mode') ||
            lower.includes('type')
          ) {
            detectedType = 'select';
          }

          const estimatedWidth = Math.max(140, Math.min(320, name.length * 11 + 40));

          return {
            id: `col_${idx}_${Date.now()}`,
            name,
            type: detectedType,
            width: estimatedWidth,
            isPinned: idx === 0,
          };
        });

        const optionsMap: Record<string, Set<string>> = {};
        detectedColumns.forEach((c) => {
          if (c.type === 'select' || c.type === 'status') {
            optionsMap[c.id] = new Set();
          }
        });

        const parsedRows: SheetRow[] = [];
        for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
          const rowVals = rawJson[r];
          if (!rowVals || rowVals.length === 0) continue;
          const rowData: Record<string, any> = {};
          let hasContent = false;

          detectedColumns.forEach((col, idx) => {
            let v = rowVals[idx];
            if (v !== undefined && v !== null && v !== '') {
              hasContent = true;
              if (col.type === 'date' || /birth|dob|date/i.test(col.name)) {
                v = convertExcelSerialToDate(v);
              }
              const strVal = String(v).trim();
              rowData[col.id] = strVal;

              if (optionsMap[col.id] && strVal && strVal.length < 30) {
                optionsMap[col.id].add(strVal);
              }
            } else {
              rowData[col.id] = '';
            }
          });

          if (hasContent) {
            parsedRows.push({
              id: crypto.randomUUID(),
              data: rowData,
              created_at: new Date().toISOString(),
            });
          }
        }

        detectedColumns.forEach((c) => {
          if (optionsMap[c.id] && optionsMap[c.id].size > 0 && optionsMap[c.id].size <= 15) {
            c.options = Array.from(optionsMap[c.id]);
          }
        });

        const baseTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setPendingImport({
          fileName: file.name,
          title: baseTitle || 'Imported Sheet',
          category: 'Uploaded Excel',
          color: '#10B981',
          columns: detectedColumns,
          rows: parsedRows,
        });
        setShowImportModal(true);
      } catch (err) {
        alert('Failed to parse spreadsheet. Please ensure it is a valid .xlsx or .csv file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const newSheet = createSheet(
      pendingImport.title,
      pendingImport.category,
      pendingImport.color,
      pendingImport.columns,
      pendingImport.rows
    );
    try {
      await syncEngine.pushSheet(newSheet);
    } catch (err) {
      console.warn('[Sheets] Cloud push queued for imported sheet:', err);
    }
    setShowImportModal(false);
    setPendingImport(null);
    scrollToRow1();
  };

  // Export to Excel (.xlsx)
  const handleExportXLSX = async () => {
    if (!activeSheet) return;
    const XLSX = await import('xlsx');
    const headers = activeSheet.columns.map((c) => c.name);
    const data = activeSheet.rows.map((r) =>
      activeSheet.columns.map((c) => r.data[c.id] || '')
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeSheet.title.slice(0, 31));
    XLSX.writeFile(
      wb,
      `${activeSheet.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Live Calculations for Active Column / Selection
  const activeColStats = useMemo(() => {
    if (!activeSheet || !activeCol) return null;
    let numericCount = 0;
    let totalSum = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    let nonEmptyCount = 0;

    activeSheet.rows.forEach((r) => {
      const raw = r.data[activeCol.id];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        nonEmptyCount++;
        const num = parseFloat(String(raw).replace(/[₹,\s]/g, ''));
        if (!isNaN(num)) {
          numericCount++;
          totalSum += num;
          if (num < minVal) minVal = num;
          if (num > maxVal) maxVal = num;
        }
      }
    });

    const isAmount = activeCol.type === 'amount';
    const hasNumbers = numericCount > 0;
    const avg = hasNumbers ? totalSum / numericCount : 0;

    return {
      hasNumbers,
      count: nonEmptyCount,
      numericCount,
      sum: isAmount
        ? `₹${totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        : totalSum.toLocaleString('en-IN'),
      avg: isAmount
        ? `₹${avg.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        : avg.toFixed(2),
      min: hasNumbers
        ? isAmount
          ? `₹${minVal.toLocaleString('en-IN')}`
          : String(minVal)
        : null,
      max: hasNumbers
        ? isAmount
          ? `₹${maxVal.toLocaleString('en-IN')}`
          : String(maxVal)
        : null,
    };
  }, [activeSheet?.id, activeCol?.id, activeCol?.type, activeSheet?.rows]);

  return (
    <div className="space-y-3 animate-fade-in pb-16">
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span>Record Sheets & Excel Grid</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Excel-grade spreadsheet: Freeze Panes (fixed rows & columns), Formula bar (fx), full Row/Col operations & formatting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 font-bold text-slate-700 dark:text-slate-200 text-xs shadow-sm transition-all hover-lift touch-press"
            title="Refresh & Pull Latest Cloud Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-md shadow-emerald-500/25 transition-all hover-lift touch-press"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Excel</span>
          </button>

          <button
            onClick={() => setShowNewSheetModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-xs shadow-lg shadow-blue-500/25 transition-all hover-lift touch-press"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Sheet</span>
          </button>
        </div>
      </div>

      {/* Sheet Tabs Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-white/10 scrollbar-none">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheet?.id;
          const sheetColor = sheet.color || '#6366F1';

          return (
            <button
              key={sheet.id}
              onClick={() => {
                setActiveSheetId(sheet.id);
                scrollToRow1();
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all touch-press ${
                isActive
                  ? 'text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor: isActive ? sheetColor : undefined,
                boxShadow: isActive ? `0 4px 14px ${sheetColor}40` : undefined,
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: isActive ? '#FFFFFF' : sheetColor }}
              />
              <span>{sheet.title}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive ? 'bg-black/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
                }`}
              >
                {sheet.rows.length}
              </span>
            </button>
          );
        })}
      </div>

      {activeSheet && (
        <div
          className={`rounded-3xl border shadow-sm transition-all overflow-hidden ${
            isLight ? 'bg-white border-slate-200/90' : 'bg-slate-900/90 border-white/10'
          }`}
        >
          {/* ========================================================
              EXCEL TOP TOOLBARS & FORMULA BAR (FX)
             ======================================================== */}
          <div className="border-b border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-800/50 p-3 space-y-2.5">
            {/* ROW 1: SEARCH & GLOBAL VIEW CONTROLS */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              {/* Left Group: Search, Row 1 Jump, Quick continuation */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-48 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder={`Search ${activeSheet.rows.length} records...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 1-Click Jump to Row 1 */}
                <button
                  onClick={scrollToRow1}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-500/20 transition-colors"
                  title="Jump to Row 1 (Top)"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Row 1</span>
                </button>

                {/* Jump to Bottom */}
                <button
                  onClick={scrollToBottom}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5"
                  title="Jump to Bottom of Sheet"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>

                {/* 1-Click + Row */}
                <button
                  onClick={handleQuickAddRow}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all hover-lift touch-press"
                  title="Add continuation row at bottom"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Row</span>
                </button>

                {/* Add Column */}
                <button
                  onClick={() => openAddColumnModal('end')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                  title="Add new column"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>+ Column</span>
                </button>
              </div>

              {/* Right Group: Display, Gridlines, Wrap, Pan, Export */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Wrap Text */}
                <button
                  onClick={() => setWrapText(!wrapText)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                    wrapText
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  title="Toggle text wrapping"
                >
                  <WrapText className="w-3.5 h-3.5" />
                  <span>{wrapText ? 'Wrap: On' : 'Wrap: Off'}</span>
                </button>

                {/* Gridlines */}
                <button
                  onClick={() => setShowGridlines(!showGridlines)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                    showGridlines
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300'
                      : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-400'
                  }`}
                  title="Toggle Gridlines"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>

                {/* Row Height Mode */}
                <div className="flex rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-0.5 text-[11px] font-bold">
                  <button
                    onClick={() => setRowHeight(activeSheet.id, 'compact')}
                    className={`px-1.5 py-0.5 rounded-lg transition-all ${
                      rowHeightMode === 'compact'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Compact Row Height (28px)"
                  >
                    S
                  </button>
                  <button
                    onClick={() => setRowHeight(activeSheet.id, 'normal')}
                    className={`px-1.5 py-0.5 rounded-lg transition-all ${
                      rowHeightMode === 'normal'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Default Row Height (38px)"
                  >
                    M
                  </button>
                  <button
                    onClick={() => setRowHeight(activeSheet.id, 'relaxed')}
                    className={`px-1.5 py-0.5 rounded-lg transition-all ${
                      rowHeightMode === 'relaxed'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Relaxed Row Height (48px)"
                  >
                    L
                  </button>
                </div>

                {/* Horizontal pan buttons */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => scrollTable('left')}
                    className="p-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    title="Pan Left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => scrollTable('right')}
                    className="p-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    title="Pan Right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sheet Title & Color */}
                <button
                  onClick={openEditSheet}
                  className="p-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  title="Edit Sheet Title & Color"
                >
                  <Palette className="w-3.5 h-3.5 text-blue-500" />
                </button>

                {/* Export .xlsx */}
                <button
                  onClick={handleExportXLSX}
                  className="px-2 py-1 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] hover:bg-emerald-500/10"
                  title="Export Excel .xlsx"
                >
                  .XLSX
                </button>
              </div>
            </div>

            {/* ROW 2: EXCEL FORMULA & CELL ADDRESS BAR (FX) */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/70 dark:border-white/5">
              {/* Name Box (Address: e.g. A1, B4) */}
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 min-w-[70px] justify-center text-xs font-mono font-black text-blue-600 dark:text-blue-400 shadow-xs"
                title={
                  cellCoordinate
                    ? `Cell ${cellCoordinate.coordinate} (${cellCoordinate.colName})`
                    : 'Select a cell in the grid below'
                }
              >
                <span>{cellCoordinate ? cellCoordinate.coordinate : '--'}</span>
              </div>

              {/* fx Icon */}
              <div className="font-serif italic font-bold text-slate-400 dark:text-slate-500 text-sm select-none px-1">
                fx
              </div>

              {/* Formula Bar Input */}
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  placeholder={
                    selectedCell
                      ? `Edit ${cellCoordinate?.coordinate} (${cellCoordinate?.colName})... Press Enter to commit`
                      : 'Click any cell below to view or edit in this Formula Bar'
                  }
                  value={formulaInput}
                  disabled={!selectedCell}
                  onChange={(e) => {
                    setFormulaInput(e.target.value);
                    setIsFormulaEditing(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCommitFormula();
                    } else if (e.key === 'Escape') {
                      handleCancelFormula();
                    }
                  }}
                  className="w-full px-3 py-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />

                {/* Commit / Cancel Buttons when editing formula */}
                {isFormulaEditing && (
                  <div className="absolute right-1.5 flex items-center gap-1">
                    <button
                      onClick={handleCommitFormula}
                      className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white"
                      title="Commit changes (Enter)"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleCancelFormula}
                      className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200"
                      title="Cancel (Esc)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ROW 3: EXCEL TOOLBAR (FREEZE PANES, ROW TOOLS, COL TOOLS, FORMATTING) */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-2 pt-2 border-t border-slate-200/70 dark:border-white/5">
              {/* GROUP 1: FREEZE PANES (FIXED ROWS & COLUMNS) */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 flex-wrap">
                <div className="flex items-center gap-1 text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">
                  <Lock className="w-3 h-3 text-blue-500" />
                  <span>Freeze:</span>
                </div>

                {/* Freeze Top Row */}
                <button
                  onClick={handleToggleFreezeTopRow}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all ${
                    frozenRowCount > 0
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  title="Freeze Top Row (Row 1 sticks when scrolling vertically)"
                >
                  <Pin className="w-3 h-3" />
                  <span>{frozenRowCount > 0 ? `Row 1-${frozenRowCount} Fixed` : 'Top Row'}</span>
                </button>

                {/* Freeze up to Selected Row */}
                {cellCoordinate && cellCoordinate.rowNum > 1 && (
                  <button
                    onClick={handleFreezeUpToSelectedRow}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    title={`Freeze up to current Row #${cellCoordinate.rowNum}`}
                  >
                    <span>To Row {cellCoordinate.rowNum}</span>
                  </button>
                )}

                {/* Freeze First Column */}
                <button
                  onClick={handleToggleFreezeFirstColumn}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all ${
                    activeSheet.columns[0]?.isPinned
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  title="Freeze First Column on the left"
                >
                  <span>Col 1</span>
                </button>

                {/* Unfreeze All */}
                {(frozenRowCount > 0 || activeSheet.columns.some((c) => c.isPinned)) && (
                  <button
                    onClick={handleUnfreezeAll}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                    title="Unfreeze All Rows & Columns"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* GROUP 2: ROW OPERATIONS */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 flex-wrap">
                <div className="flex items-center gap-1 text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">
                  <Table className="w-3 h-3 text-emerald-500" />
                  <span>Row {cellCoordinate ? `#${cellCoordinate.rowNum}` : ''}:</span>
                </div>

                <button
                  onClick={handleInsertRowAbove}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                  title="Insert Blank Row Above Current Selection"
                >
                  + Above
                </button>

                <button
                  onClick={handleInsertRowBelow}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                  title="Insert Blank Row Below Current Selection"
                >
                  + Below
                </button>

                {selectedCell && (
                  <>
                    <button
                      onClick={handleDuplicateRow}
                      className="p-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      title="Duplicate this row"
                    >
                      <Copy className="w-3 h-3" />
                    </button>

                    <button
                      onClick={handleDeleteSelectedRow}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                      title="Delete this row"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>

              {/* GROUP 3: COLUMN OPERATIONS */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 flex-wrap">
                <div className="flex items-center gap-1 text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">
                  <Columns className="w-3 h-3 text-indigo-500" />
                  <span className="truncate max-w-[80px]">
                    {activeCol ? activeCol.name : 'Col'}
                  </span>
                </div>

                {activeCol && (
                  <>
                    {/* Width − / + */}
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1 py-0.5">
                      <button
                        onClick={() => handleAdjustColumnWidth(activeCol.id, -20)}
                        className="px-1 text-slate-600 dark:text-slate-300 hover:text-blue-500 font-bold text-xs"
                        title="Make column narrower"
                      >
                        −
                      </button>
                      <span className="px-1 text-[10px] font-mono text-slate-500">
                        {activeCol.width || 180}
                      </span>
                      <button
                        onClick={() => handleAdjustColumnWidth(activeCol.id, 20)}
                        className="px-1 text-slate-600 dark:text-slate-300 hover:text-blue-500 font-bold text-xs"
                        title="Make column wider"
                      >
                        +
                      </button>
                    </div>

                    {/* Freeze Column Toggle */}
                    <button
                      onClick={() => handleToggleFreezeColumn(activeCol.id)}
                      className={`p-1 rounded-lg border text-[11px] ${
                        activeCol.isPinned
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                      title={activeCol.isPinned ? 'Unfreeze this column' : 'Freeze this column (Left)'}
                    >
                      {activeCol.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    </button>

                    {/* Sort A-Z / Z-A */}
                    <button
                      onClick={() => handleSortColumn('asc')}
                      className="px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                      title="Sort Ascending (A → Z or 0 → 9)"
                    >
                      A-Z
                    </button>
                    <button
                      onClick={() => handleSortColumn('desc')}
                      className="px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                      title="Sort Descending (Z → A or 9 → 0)"
                    >
                      Z-A
                    </button>

                    {/* Column Settings Modal */}
                    <button
                      onClick={() => openEditColumnModal(activeCol)}
                      className="p-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      title="Edit Column Type & Dropdown Options"
                    >
                      <Settings className="w-3 h-3 text-blue-500" />
                    </button>
                  </>
                )}
              </div>

              {/* GROUP 4: CELL FORMATTING (BOLD, ITALIC, ALIGN, COLOR) */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 flex-wrap">
                {/* Bold */}
                <button
                  onClick={handleToggleBold}
                  className={`p-1 rounded-lg border text-xs font-black ${
                    isCellBold
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  title="Bold (Selected cell)"
                >
                  <Bold className="w-3 h-3" />
                </button>

                {/* Italic */}
                <button
                  onClick={handleToggleItalic}
                  className={`p-1 rounded-lg border text-xs font-serif italic ${
                    isCellItalic
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  title="Italic (Selected cell)"
                >
                  <Italic className="w-3 h-3" />
                </button>

                {/* Alignment */}
                <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/10 p-0.5">
                  <button
                    onClick={() => handleSetAlignment('left')}
                    className={`p-0.5 rounded transition-colors ${
                      cellAlignment === 'left'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleSetAlignment('center')}
                    className={`p-0.5 rounded transition-colors ${
                      cellAlignment === 'center'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleSetAlignment('right')}
                    className={`p-0.5 rounded transition-colors ${
                      cellAlignment === 'right'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Align Right"
                  >
                    <AlignRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Fill Color Palette */}
                <div className="flex items-center gap-1">
                  {CELL_HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleApplyCellColor(c.id)}
                      className="w-4 h-4 rounded-md border border-black/20 dark:border-white/20 transition-transform hover:scale-125 shadow-xs"
                      style={{ backgroundColor: c.bg }}
                      title={`Fill Color: ${c.label}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              EXCEL GRID TABLE (FIXED ROWS & FIXED COLUMNS MATRIX)
             ======================================================== */}
          <div
            ref={tableContainerRef}
            className="overflow-x-auto overflow-y-auto max-h-[70vh] relative scrollbar-thin"
          >
            <table className="w-full text-left text-xs border-collapse">
              {/* STICKY TABLE HEADER (Always at top: 0, z-40) */}
              <thead className="sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold uppercase tracking-wider text-[11px] select-none border-b-2 border-slate-300 dark:border-slate-700 shadow-xs h-10">
                <tr>
                  {/* Top-Left Corner Index '#' (Sticky both top: 0 and left: 0, z-50) */}
                  <th className="sticky top-0 left-0 z-50 bg-slate-200 dark:bg-slate-800 py-2.5 px-3 w-12 text-center text-slate-500 border-r border-b-2 border-slate-300 dark:border-slate-700">
                    #
                  </th>

                  {activeSheet.columns.map((col, idx) => {
                    const isPinned = Boolean(col.isPinned);
                    const isSelectedCol = selectedColId === col.id;
                    const colW = col.width || 180;
                    const leftOffset = pinnedColOffsets[col.id];

                    return (
                      <th
                        key={col.id}
                        onClick={() => setSelectedColId(col.id)}
                        style={{
                          width: `${colW}px`,
                          minWidth: `${colW}px`,
                          maxWidth: `${colW}px`,
                          left: isPinned ? `${leftOffset}px` : undefined,
                        }}
                        className={`py-2.5 px-3 border-r border-slate-300 dark:border-slate-700 cursor-pointer transition-colors ${
                          isPinned
                            ? 'sticky top-0 z-45 bg-blue-50/95 dark:bg-slate-800 border-r-2 border-r-blue-500'
                            : isSelectedCol
                            ? 'bg-blue-100/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                        }`}
                        title="Click to select column"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 truncate">
                            {isPinned && <Pin className="w-3 h-3 text-blue-500 shrink-0" />}
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                              {getColumnLetter(idx)}
                            </span>
                            <span className="truncate font-extrabold text-slate-900 dark:text-white">
                              {col.name}
                            </span>
                          </div>

                          <span className="text-[9px] lowercase font-normal opacity-50 shrink-0">
                            {col.type}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-2.5 px-2 w-12 text-center text-slate-400 border-slate-300 dark:border-slate-700">
                    Del
                  </th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody
                className={`divide-y ${
                  showGridlines
                    ? 'divide-slate-200 dark:divide-slate-700/80'
                    : 'divide-transparent'
                }`}
              >
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeSheet.columns.length + 2}
                      className="py-16 text-center text-slate-400 text-xs"
                    >
                      No records found. Click &quot;+ Row&quot; or upload an Excel file.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, rowIdx) => {
                    // Check if this row is frozen at top
                    const isRowFrozen = rowIdx < frozenRowCount;
                    // Sticky top offset for frozen row: 40px (header height) + rowIdx * rowHeightPx
                    const frozenRowTop = 40 + rowIdx * rowHeightPx;
                    const isLastFrozenRow = rowIdx === frozenRowCount - 1;

                    return (
                      <tr
                        key={row.id}
                        style={{ height: `${rowHeightPx}px` }}
                        className={`hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors group ${
                          isRowFrozen
                            ? isLight
                              ? 'bg-blue-50/20'
                              : 'bg-blue-950/20'
                            : ''
                        } ${isLastFrozenRow ? 'border-b-2 border-b-blue-500 shadow-sm' : ''}`}
                      >
                        {/* Index Column Cell */}
                        <td
                          onClick={() => {
                            setSelectedCell({ rowId: row.id, colId: activeSheet.columns[0]?.id || '' });
                            if (activeSheet.columns[0]) setSelectedColId(activeSheet.columns[0].id);
                          }}
                          style={{
                            top: isRowFrozen ? `${frozenRowTop}px` : undefined,
                          }}
                          className={`sticky left-0 ${
                            isRowFrozen ? 'z-35' : 'z-20'
                          } bg-slate-100 dark:bg-slate-800 text-center text-slate-500 font-mono text-[11px] py-2 px-2.5 ${
                            showGridlines
                              ? 'border-r border-slate-300 dark:border-slate-700'
                              : ''
                          } ${isLastFrozenRow ? 'border-b-2 border-b-blue-500' : ''}`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {isRowFrozen && <Pin className="w-2.5 h-2.5 text-blue-500" />}
                            <span>{rowIdx + 1}</span>
                          </div>
                        </td>

                        {/* Data Cells */}
                        {activeSheet.columns.map((col, colIdx) => {
                          const cellVal = row.data[col.id] ?? '';
                          const cellColor = row.data[`_color_${col.id}`];
                          const isBold = Boolean(row.data[`_bold_${col.id}`]);
                          const isItalic = Boolean(row.data[`_italic_${col.id}`]);
                          const align = row.data[`_align_${col.id}`] || 'left';
                          const textColor = row.data[`_textColor_${col.id}`];

                          const isPinned = Boolean(col.isPinned);
                          const isSelectedCol = selectedColId === col.id;
                          const colW = col.width || 180;
                          const leftOffset = pinnedColOffsets[col.id];
                          const isSelectedCell =
                            selectedCell?.rowId === row.id && selectedCell?.colId === col.id;

                          const displayVal =
                            col.type === 'date' ? convertExcelSerialToDate(cellVal) : cellVal;

                          // Cell Sticky Coordinates:
                          // If both row and column are frozen: sticky on both top and left (z-35)
                          // If row frozen only: sticky on top (z-25)
                          // If col pinned only: sticky on left (z-20)
                          const isStickyCell = isRowFrozen || isPinned;
                          const cellZIndex = isRowFrozen && isPinned ? 35 : isRowFrozen ? 25 : isPinned ? 20 : undefined;

                          return (
                            <td
                              key={col.id}
                              onClick={() => {
                                setSelectedCell({ rowId: row.id, colId: col.id });
                                setSelectedColId(col.id);
                              }}
                              style={{
                                width: `${colW}px`,
                                minWidth: `${colW}px`,
                                maxWidth: `${colW}px`,
                                backgroundColor: cellColor || undefined,
                                top: isRowFrozen ? `${frozenRowTop}px` : undefined,
                                left: isPinned ? `${leftOffset}px` : undefined,
                                zIndex: cellZIndex,
                              }}
                              className={`${densityPadding} ${
                                showGridlines
                                  ? 'border-r border-slate-200 dark:border-slate-700/80'
                                  : ''
                              } relative transition-colors ${
                                isStickyCell ? 'sticky ' : ''
                              } ${
                                isPinned
                                  ? 'border-r-2 border-r-blue-500 ' +
                                    (cellColor ? '' : isLight ? 'bg-white' : 'bg-slate-900')
                                  : isRowFrozen && !cellColor
                                  ? isLight
                                    ? 'bg-slate-50'
                                    : 'bg-slate-900'
                                  : isSelectedCol && !cellColor
                                  ? 'bg-blue-50/20 dark:bg-blue-950/10'
                                  : ''
                              } ${isLastFrozenRow ? 'border-b-2 border-b-blue-500' : ''} ${
                                isSelectedCell ? 'ring-2 ring-blue-500 ring-inset' : ''
                              }`}
                            >
                              {/* CASE 1: DROPDOWN MENU */}
                              {col.type === 'select' || (col.options && col.options.length > 0) ? (
                                <div className="relative">
                                  <select
                                    value={displayVal}
                                    onChange={(e) =>
                                      updateCell(activeSheet.id, row.id, col.id, e.target.value)
                                    }
                                    style={{
                                      fontWeight: isBold ? 'bold' : 'normal',
                                      fontStyle: isItalic ? 'italic' : 'normal',
                                      textAlign: align,
                                      color: textColor || (cellColor && cellColor !== 'none' ? '#0f172a' : undefined),
                                    }}
                                    className={`w-full bg-transparent focus:outline-none cursor-pointer ${
                                      wrapText ? '' : 'truncate'
                                    } ${
                                      cellColor && cellColor !== 'none'
                                        ? 'text-slate-950 font-semibold'
                                        : displayVal === 'Active' || displayVal === 'Verified' || displayVal === 'Paid'
                                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                        : displayVal === 'Pending' || displayVal === 'Inactive'
                                        ? 'text-amber-600 dark:text-amber-400 font-bold'
                                        : 'text-slate-800 dark:text-slate-200'
                                    }`}
                                  >
                                    <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                      -- Select --
                                    </option>
                                    {(col.options || [
                                      'Active',
                                      'Pending',
                                      'Completed',
                                      'Male',
                                      'Female',
                                    ]).map((opt) => (
                                      <option key={opt} value={opt} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : col.type === 'date' ? (
                                /* CASE 2: DATE PICKER */
                                <div className="relative flex items-center">
                                  <input
                                    type="date"
                                    value={displayVal}
                                    onChange={(e) =>
                                      updateCell(activeSheet.id, row.id, col.id, e.target.value)
                                    }
                                    style={{
                                      fontWeight: isBold ? 'bold' : 'normal',
                                      fontStyle: isItalic ? 'italic' : 'normal',
                                      textAlign: align,
                                      color: textColor || (cellColor && cellColor !== 'none' ? '#0f172a' : undefined),
                                    }}
                                    className={`w-full bg-transparent px-1 py-0.5 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 font-mono ${
                                      cellColor && cellColor !== 'none'
                                        ? 'text-slate-950 font-semibold'
                                        : 'text-slate-800 dark:text-slate-200'
                                    }`}
                                  />
                                </div>
                              ) : (
                                /* CASE 3: FAST TEXT / AMOUNT / NUMBER CELL */
                                <SheetCellInput
                                  value={String(displayVal ?? '')}
                                  type={col.type}
                                  isBold={isBold}
                                  isItalic={isItalic}
                                  align={align}
                                  textColor={textColor}
                                  cellColor={cellColor}
                                  wrapText={wrapText}
                                  onChange={(val) => updateCell(activeSheet.id, row.id, col.id, val)}
                                  onEnterAtLastRow={
                                    rowIdx === filteredRows.length - 1 ? handleQuickAddRow : undefined
                                  }
                                />
                              )}
                            </td>
                          );
                        })}

                        {/* Delete Row Button */}
                        <td className="py-1 px-2 text-center border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => deleteRow(activeSheet.id, row.id)}
                            className="p-1 rounded-lg text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* CONTINUATION ROW */}
                <tr
                  onClick={handleQuickAddRow}
                  className="cursor-pointer bg-slate-50/70 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors border-t border-dashed border-slate-300 dark:border-slate-700"
                >
                  <td className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 text-center py-2 px-2 border-r border-slate-300 dark:border-slate-700">
                    <Plus className="w-3.5 h-3.5 mx-auto text-blue-500" />
                  </td>
                  <td
                    colSpan={activeSheet.columns.length + 1}
                    className="py-2.5 px-3 text-xs font-bold text-blue-600 dark:text-blue-400"
                  >
                    + Click here to add continuation row (or press Enter in last cell)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ========================================================
              BOTTOM EXCEL STATUS BAR (CALCULATIONS & SHEET METRICS)
             ======================================================== */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-100/90 dark:bg-slate-800/90 border-t border-slate-300 dark:border-slate-700 text-xs select-none">
            {/* Left: Active Selection Metric */}
            <div className="flex items-center gap-2 flex-wrap text-slate-600 dark:text-slate-300 font-medium">
              <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {cellCoordinate ? (
                    <>
                      Cell <strong className="font-mono text-blue-600 dark:text-blue-400">{cellCoordinate.coordinate}</strong> ({cellCoordinate.colName})
                    </>
                  ) : (
                    'Ready'
                  )}
                </span>
              </span>

              <span className="text-slate-400">|</span>

              <span className="text-[11px] font-mono">
                {activeSheet.rows.length} rows, {activeSheet.columns.length} columns
              </span>

              {frozenRowCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold">
                  📌 {frozenRowCount} Row{frozenRowCount > 1 ? 's' : ''} Frozen
                </span>
              )}
            </div>

            {/* Right: Quick Calculations on Active Column */}
            {activeColStats && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[11px] font-mono">
                  COUNT: <strong>{activeColStats.count}</strong>
                </span>

                {activeColStats.hasNumbers && (
                  <>
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[11px] font-mono">
                      SUM: <strong className="text-emerald-600 dark:text-emerald-400">{activeColStats.sum}</strong>
                    </span>

                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[11px] font-mono">
                      AVG: <strong>{activeColStats.avg}</strong>
                    </span>

                    {activeColStats.min && (
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[11px] font-mono">
                        MIN: <strong>{activeColStats.min}</strong>
                      </span>
                    )}

                    {activeColStats.max && (
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[11px] font-mono">
                        MAX: <strong>{activeColStats.max}</strong>
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {sheets.length === 0 && (
        <div
          className={`rounded-3xl border p-12 text-center transition-all ${
            isLight ? 'bg-white border-slate-200/90' : 'bg-slate-900/90 border-white/10'
          }`}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Sheets Created Yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Create custom spreadsheets, financial registers, or import existing .xlsx files directly into your workspace.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleManualSync}
              disabled={isRefreshing}
              className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 font-semibold text-sm transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync From Cloud'}</span>
            </button>
            <button
              onClick={() => setShowNewSheetModal(true)}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Sheet
            </button>
            <label className="cursor-pointer px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 font-semibold text-sm transition-all flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import Excel (.xlsx)
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      )}
      {showImportModal && pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Import Excel Sheet</h3>
                  <p className="text-[11px] text-slate-400">Headers and all data rows verified</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Columns</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{pendingImport.columns.length}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Rows</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{pendingImport.rows.length}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sheet Title</label>
                <input
                  type="text"
                  required
                  value={pendingImport.title}
                  onChange={(e) => setPendingImport({ ...pendingImport, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tab Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {SHEET_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPendingImport({ ...pendingImport, color: c.id })}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        pendingImport.color === c.id ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.id }}
                    >
                      {pendingImport.color === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/25"
              >
                Confirm & Open Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Column Settings & Options */}
      {(showNewColModal || showEditColModal) && activeSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {showEditColModal ? 'Column Settings & Options' : 'Add Column to Sheet'}
              </h3>
              <button
                onClick={() => {
                  setShowNewColModal(false);
                  setShowEditColModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showEditColModal ? handleSaveColumnEdit : handleAddColumnSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Column Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Date of Birth, Gender, Payment Status"
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Data Type
                </label>
                <select
                  value={colType}
                  onChange={(e) => setColType(e.target.value as SheetColumnType)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="text">Text (General Free-form)</option>
                  <option value="date">📅 Date (Date of Birth / Calendar)</option>
                  <option value="select">📋 Dropdown Menu (Choose from Options)</option>
                  <option value="amount">💰 Amount (₹ Auto-sum)</option>
                  <option value="number">🔢 Number (Auto-calculated)</option>
                  <option value="status">🏷️ Status Badge</option>
                  <option value="phone">📞 Phone / Mobile</option>
                </select>
              </div>

              {/* Dropdown Options Input */}
              {(colType === 'select' || colType === 'status') && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Dropdown Menu Options (Comma Separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Active, Pending, Completed, Male, Female"
                    value={colOptionsInput}
                    onChange={(e) => setColOptionsInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Cells in this column will show a clickable dropdown select menu
                  </span>
                </div>
              )}

              {/* Column Width & Freeze */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Width (Pixels)
                  </label>
                  <input
                    type="number"
                    min={90}
                    max={600}
                    value={colWidth}
                    onChange={(e) => setColWidth(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={colIsPinned}
                      onChange={(e) => setColIsPinned(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      📌 Freeze Column
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewColModal(false);
                    setShowEditColModal(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/25"
                >
                  {showEditColModal ? 'Save Settings' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: New Sheet */}
      {showNewSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Create New Sheet</h3>
              <button onClick={() => setShowNewSheetModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSheet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sheet Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Employee Register, Daily Stock, Customer List"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tab Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {SHEET_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewSheetColor(c.id)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        newSheetColor === c.id ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.id }}
                    >
                      {newSheetColor === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={newSheetCategory}
                  onChange={(e) => setNewSheetCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="Business">Business Register</option>
                  <option value="Documents">Documents & IDs</option>
                  <option value="Finance">Finance & Wages</option>
                  <option value="Inventory">Stock & Materials</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSheetModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/25"
                >
                  Create Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Sheet Details & Color */}
      {showEditSheetModal && activeSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Sheet Settings & Color</h3>
              <button onClick={() => setShowEditSheetModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSheet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sheet Title</label>
                <input
                  type="text"
                  required
                  value={editSheetTitle}
                  onChange={(e) => setEditSheetTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tab Color Palette</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {SHEET_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditSheetColor(c.id)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        editSheetColor === c.id ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.id }}
                    >
                      {editSheetColor === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                <input
                  type="text"
                  value={editSheetCategory}
                  onChange={(e) => setEditSheetCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete sheet "${activeSheet.title}"?`)) {
                      deleteSheet(activeSheet.id);
                      try {
                        await syncEngine.deleteSheet(activeSheet.id);
                      } catch {}
                      setShowEditSheetModal(false);
                    }
                  }}
                  className="px-3 py-2.5 rounded-xl border border-rose-500/20 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditSheetModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/25"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
