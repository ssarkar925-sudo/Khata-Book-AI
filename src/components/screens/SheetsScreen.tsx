'use client';

import React, { useState, useRef, useMemo } from 'react';
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
  ChevronDown,
  Paintbrush,
  Calendar,
  Check,
  ListFilter,
  Maximize2,
  Sliders,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSheetStore } from '@/stores/useSheetStore';
import { useSessionStore } from '@/stores/useSessionStore';
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
  { id: 'none', label: 'Clear', bg: 'transparent', border: 'border-slate-300 dark:border-white/20' },
  { id: '#fef08a', label: 'Yellow', bg: '#fef08a' }, // yellow-200
  { id: '#bbf7d0', label: 'Green', bg: '#bbf7d0' }, // green-200
  { id: '#fecdd3', label: 'Red', bg: '#fecdd3' }, // rose-200
  { id: '#bfdbfe', label: 'Blue', bg: '#bfdbfe' }, // blue-200
  { id: '#e9d5ff', label: 'Purple', bg: '#e9d5ff' }, // purple-200
  { id: '#fed7aa', label: 'Orange', bg: '#fed7aa' }, // orange-200
];

// Helper to convert Excel date serials to clean YYYY-MM-DD or DD/MM/YYYY
function convertExcelSerialToDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  // If already in YYYY-MM-DD or DD/MM/YYYY format, keep it
  if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
    return str;
  }
  // Check if it's an Excel serial number (between 1000 and 65000)
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
  } = useSheetStore();

  const { theme } = useSessionStore();
  const isLight = theme === 'light';

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [wrapText, setWrapText] = useState(false);
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>('normal');

  // Currently selected cell for box coloring: { rowId, colId }
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null);

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
  const [colWidth, setColWidth] = useState<number>(160);
  const [colOptionsInput, setColOptionsInput] = useState('');
  const [colIsPinned, setColIsPinned] = useState(false);

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

  const handleCreateSheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;
    createSheet(newSheetTitle.trim(), newSheetCategory, newSheetColor);
    setShowNewSheetModal(false);
    setNewSheetTitle('');
  };

  // Handle File Upload (.xlsx, .xls, .csv) with full Date of Birth conversion
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        // Parse with cellDates to automatically convert Excel date serials
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

        const headerRow = rawJson[0] as string[];
        const detectedColumns: SheetColumn[] = headerRow.map((h, idx) => {
          const name = String(h || `Column ${idx + 1}`).trim();
          const lower = name.toLowerCase();

          // Smarter type detection
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
            lower.includes('verified')
          ) {
            detectedType = 'select';
          }

          return {
            id: `col_${idx}_${Date.now()}`,
            name,
            type: detectedType,
            width: detectedType === 'date' ? 140 : 160,
            isPinned: idx === 0, // Freeze first column by default!
          };
        });

        // Collect unique values for select columns to build dropdown options
        const optionsMap: Record<string, Set<string>> = {};
        detectedColumns.forEach((c) => {
          if (c.type === 'select' || c.type === 'status') {
            optionsMap[c.id] = new Set();
          }
        });

        // Data rows
        const parsedRows: SheetRow[] = [];
        for (let r = 1; r < rawJson.length; r++) {
          const rowVals = rawJson[r];
          if (!rowVals || rowVals.length === 0) continue;
          const rowData: Record<string, any> = {};
          let hasContent = false;

          detectedColumns.forEach((col, idx) => {
            let v = rowVals[idx];
            if (v !== undefined && v !== null && v !== '') {
              hasContent = true;
              // If column is date or has birth/dob in name, convert serial numbers
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

        // Attach detected options to columns
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

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    createSheet(
      pendingImport.title,
      pendingImport.category,
      pendingImport.color,
      pendingImport.columns,
      pendingImport.rows
    );
    setShowImportModal(false);
    setPendingImport(null);
  };

  // Open Column Settings / Edit Column Modal
  const openEditColumn = (col: SheetColumn) => {
    setEditingColId(col.id);
    setColName(col.name);
    setColType(col.type);
    setColWidth(col.width || 160);
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
      width: Math.max(80, colWidth || 160),
      options: options.length > 0 ? options : undefined,
      isPinned: colIsPinned,
    });

    setShowEditColModal(false);
  };

  const handleAddColumn = (e: React.FormEvent) => {
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
      width: Math.max(80, colWidth || 160),
      options: options.length > 0 ? options : undefined,
      isPinned: colIsPinned,
    };
    addColumn(activeSheet.id, newCol);
    setShowNewColModal(false);
    setColName('');
    setColOptionsInput('');
  };

  // 1-Click Quick Add Row for effortless continuation
  const handleQuickAddRow = () => {
    if (!activeSheet) return;
    const blankData: Record<string, any> = {};
    activeSheet.columns.forEach((col) => {
      blankData[col.id] = '';
    });
    addRow(activeSheet.id, blankData);
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
    const currentW = col.width || 160;
    const newW = Math.max(90, Math.min(500, currentW + delta));
    updateColumn(activeSheet.id, colId, { width: newW });
  };

  // Cell Background Color (Selected Box Color)
  const handleApplyCellColor = (colorHex: string) => {
    if (!activeSheet || !selectedCell) return;
    setCellColor(
      activeSheet.id,
      selectedCell.rowId,
      selectedCell.colId,
      colorHex === 'none' ? null : colorHex
    );
  };

  // Scroll Helpers
  const scrollTable = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const offset = direction === 'left' ? -300 : 300;
      tableContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Export to Excel (.xlsx)
  const handleExportXLSX = () => {
    if (!activeSheet) return;
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

  // Export to CSV
  const handleExportCSV = () => {
    if (!activeSheet) return;
    const headers = activeSheet.columns.map((c) => c.name);
    const rows = activeSheet.rows.map((r) =>
      activeSheet.columns.map((c) => `"${(r.data[c.id] || '').toString().replace(/"/g, '""')}"`)
    );

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSheet.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    return (activeSheet?.rows || []).filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return Object.values(r.data).some((val) => String(val).toLowerCase().includes(q));
    });
  }, [activeSheet?.rows, searchQuery]);

  // Column summaries
  const columnSummaries = activeSheet?.columns.map((col) => {
    if (col.type === 'amount' || col.type === 'number') {
      const sum = (activeSheet.rows || []).reduce((acc, r) => {
        const val = parseFloat(String(r.data[col.id] || '0').replace(/[₹,\s]/g, ''));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      return {
        id: col.id,
        type: col.type,
        sum:
          col.type === 'amount'
            ? `₹${sum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            : sum.toLocaleString('en-IN'),
      };
    }
    return { id: col.id, type: col.type, sum: null };
  });

  const densityPadding =
    density === 'compact' ? 'py-1 px-2' : density === 'spacious' ? 'py-3 px-3.5' : 'py-2 px-2.5';

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span>Record Sheets & Excel Grid</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Excel-grade table with freeze columns, dropdown options, cell highlighting & auto-sums.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-md shadow-emerald-500/25 transition-all hover-lift touch-press"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => setShowNewSheetModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-xs shadow-lg shadow-blue-500/25 transition-all hover-lift touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>New Sheet</span>
          </button>
        </div>
      </div>

      {/* Sheet Tabs Strip with Distinct Colors */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-white/10 scrollbar-none">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheet?.id;
          const sheetColor = sheet.color || '#6366F1';

          return (
            <button
              key={sheet.id}
              onClick={() => setActiveSheetId(sheet.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all touch-press ${
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
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
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
          className={`rounded-3xl border p-4 sm:p-5 transition-all ${
            isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
          }`}
        >
          {/* Main Action & Formatting Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-white/5">
            {/* Search Bar */}
            <div className="relative w-full lg:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={`Search ${activeSheet.rows.length} records...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Add Continuation Row */}
              <button
                onClick={handleQuickAddRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover-lift touch-press"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Row</span>
              </button>

              {/* Add Column */}
              <button
                onClick={() => {
                  setColName('');
                  setColType('text');
                  setColWidth(160);
                  setColOptionsInput('');
                  setColIsPinned(false);
                  setShowNewColModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>+ Column</span>
              </button>

              {/* Wrap Text Toggle */}
              <button
                onClick={() => setWrapText(!wrapText)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                  wrapText
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
                title="Toggle Text Wrap / Single-line scroll"
              >
                <WrapText className="w-3.5 h-3.5" />
                <span>{wrapText ? 'Wrap: On' : 'Wrap: Off'}</span>
              </button>

              {/* Density Selector */}
              <div className="flex rounded-xl border border-slate-200 dark:border-white/10 p-0.5 text-[11px] font-bold">
                <button
                  onClick={() => setDensity('compact')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    density === 'compact' ? 'bg-blue-600 text-white' : 'text-slate-500'
                  }`}
                  title="Compact Row Height"
                >
                  Compact
                </button>
                <button
                  onClick={() => setDensity('normal')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    density === 'normal' ? 'bg-blue-600 text-white' : 'text-slate-500'
                  }`}
                  title="Normal Row Height"
                >
                  Normal
                </button>
              </div>

              {/* Horizontal Scroll Helper Arrows */}
              <div className="flex items-center gap-1 border-l border-slate-200 dark:border-white/10 pl-2">
                <button
                  onClick={() => scrollTable('left')}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"
                  title="Scroll Left"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => scrollTable('right')}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"
                  title="Scroll Right"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sheet Settings & Color */}
              <button
                onClick={openEditSheet}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                title="Sheet Color & Title"
              >
                <Palette className="w-3.5 h-3.5 text-blue-500" />
              </button>

              {/* Export XLSX */}
              <button
                onClick={handleExportXLSX}
                className="px-2.5 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-500/10"
                title="Export Excel .xlsx"
              >
                .XLSX
              </button>

              {/* Delete Sheet */}
              {sheets.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`Delete sheet "${activeSheet.title}" and its ${activeSheet.rows.length} rows?`)) {
                      deleteSheet(activeSheet.id);
                    }
                  }}
                  className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10"
                  title="Delete Sheet"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cell Highlight Color Palette (Color Selected Box) */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs">
            <span className="font-bold text-slate-500 flex items-center gap-1.5 text-[11px]">
              <Paintbrush className="w-3.5 h-3.5 text-amber-500" />
              <span>Color in Selected Box:</span>
            </span>

            {selectedCell ? (
              <div className="flex items-center gap-1.5">
                {CELL_HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleApplyCellColor(c.id)}
                    className="w-5 h-5 rounded-md border border-black/20 dark:border-white/20 transition-transform hover:scale-125 shadow-xs"
                    style={{ backgroundColor: c.bg }}
                    title={`Highlight ${c.label}`}
                  />
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                (Click any cell below to highlight it)
              </span>
            )}
          </div>

          {/* SPREADSHEET GRID TABLE CONTAINER */}
          <div
            ref={tableContainerRef}
            className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs relative"
          >
            <table className="w-full text-left text-xs border-collapse">
              {/* Sticky Table Header */}
              <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold uppercase tracking-wider text-[11px] select-none border-b border-slate-300 dark:border-slate-700">
                <tr>
                  {/* Sticky Index Column Header */}
                  <th className="sticky left-0 z-40 bg-slate-200 dark:bg-slate-800 py-2.5 px-2 w-12 text-center text-slate-500 border-r border-slate-300 dark:border-slate-700">
                    #
                  </th>

                  {activeSheet.columns.map((col, idx) => {
                    const isPinned = Boolean(col.isPinned);
                    const colW = col.width || 160;

                    return (
                      <th
                        key={col.id}
                        style={{
                          width: `${colW}px`,
                          minWidth: `${colW}px`,
                          maxWidth: `${colW}px`,
                          left: isPinned ? `${48 + idx * 160}px` : undefined,
                        }}
                        className={`py-2.5 px-3 border-r border-slate-300 dark:border-slate-700 transition-colors ${
                          isPinned
                            ? 'sticky z-40 bg-blue-50 dark:bg-slate-800 border-r-2 border-r-blue-500'
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 truncate">
                            {isPinned && <Pin className="w-3 h-3 text-blue-500 shrink-0" />}
                            <span className="truncate font-black">{col.name}</span>
                          </div>

                          {/* Column Controls Header Menu */}
                          <div className="flex items-center gap-0.5 shrink-0 opacity-70 hover:opacity-100">
                            {/* Width Adjusters */}
                            <button
                              onClick={() => handleAdjustColumnWidth(col.id, -20)}
                              className="px-1 text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              title="Narrow Column"
                            >
                              −
                            </button>
                            <button
                              onClick={() => handleAdjustColumnWidth(col.id, 20)}
                              className="px-1 text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              title="Widen Column"
                            >
                              +
                            </button>

                            {/* Pin / Freeze Toggle */}
                            <button
                              onClick={() => handleToggleFreezeColumn(col.id)}
                              className={`p-1 hover:text-blue-500 ${
                                isPinned ? 'text-blue-500' : 'text-slate-400'
                              }`}
                              title={isPinned ? 'Unfreeze Column' : 'Freeze Column (Stay on left)'}
                            >
                              {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                            </button>

                            {/* Column Settings Modal */}
                            <button
                              onClick={() => openEditColumn(col)}
                              className="p-1 text-slate-400 hover:text-blue-500"
                              title="Column Type & Dropdown Options"
                            >
                              <Settings className="w-3 h-3" />
                            </button>

                            {activeSheet.columns.length > 1 && (
                              <button
                                onClick={() => deleteColumn(activeSheet.id, col.id)}
                                className="p-1 text-slate-400 hover:text-rose-500"
                                title="Delete Column"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-2.5 px-3 w-14 text-center border-slate-300 dark:border-slate-700">Del</th>
                </tr>
              </thead>

              {/* Table Body with Cells */}
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/80">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeSheet.columns.length + 2}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      No records found. Click &quot;+ Add Row&quot; to begin.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, rowIdx) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group"
                    >
                      {/* Sticky Row Index Cell */}
                      <td className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 text-center text-slate-400 font-mono text-[11px] py-2 px-2 border-r border-slate-300 dark:border-slate-700">
                        {rowIdx + 1}
                      </td>

                      {activeSheet.columns.map((col, colIdx) => {
                        const cellVal = row.data[col.id] ?? '';
                        const cellColor = row.data[`_color_${col.id}`];
                        const isPinned = Boolean(col.isPinned);
                        const colW = col.width || 160;
                        const isSelected =
                          selectedCell?.rowId === row.id && selectedCell?.colId === col.id;

                        // Clean display value for date
                        const displayVal =
                          col.type === 'date' ? convertExcelSerialToDate(cellVal) : cellVal;

                        return (
                          <td
                            key={col.id}
                            onClick={() => setSelectedCell({ rowId: row.id, colId: col.id })}
                            style={{
                              width: `${colW}px`,
                              minWidth: `${colW}px`,
                              maxWidth: `${colW}px`,
                              backgroundColor: cellColor || undefined,
                              left: isPinned ? `${48 + colIdx * 160}px` : undefined,
                            }}
                            className={`${densityPadding} border-r border-slate-200 dark:border-slate-700/80 relative transition-colors ${
                              isPinned
                                ? 'sticky z-20 border-r-2 border-r-blue-500 ' +
                                  (cellColor ? '' : isLight ? 'bg-white' : 'bg-slate-900')
                                : ''
                            } ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                          >
                            {/* CASE 1: DROPDOWN MENU (select or status with options) */}
                            {col.type === 'select' || (col.options && col.options.length > 0) ? (
                              <div className="relative">
                                <select
                                  value={displayVal}
                                  onChange={(e) =>
                                    updateCell(activeSheet.id, row.id, col.id, e.target.value)
                                  }
                                  className={`w-full bg-transparent text-xs font-semibold focus:outline-none cursor-pointer ${
                                    wrapText ? '' : 'truncate'
                                  } ${
                                    displayVal === 'Active' || displayVal === 'Verified' || displayVal === 'Paid'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : displayVal === 'Pending' || displayVal === 'Inactive'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  <option value="">-- Select --</option>
                                  {(col.options || [
                                    'Active',
                                    'Pending',
                                    'Completed',
                                    'Male',
                                    'Female',
                                  ]).map((opt) => (
                                    <option key={opt} value={opt} className="text-slate-900 bg-white">
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : col.type === 'date' ? (
                              /* CASE 2: DATE PICKER / FORMATTED DATE */
                              <div className="relative flex items-center">
                                <input
                                  type="date"
                                  value={displayVal}
                                  onChange={(e) =>
                                    updateCell(activeSheet.id, row.id, col.id, e.target.value)
                                  }
                                  className="w-full bg-transparent px-1 py-0.5 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 font-mono text-xs text-slate-800 dark:text-slate-200"
                                />
                              </div>
                            ) : (
                              /* CASE 3: TEXT / AMOUNT / NUMBER FREE EDIT */
                              <input
                                type="text"
                                value={displayVal}
                                onChange={(e) =>
                                  updateCell(activeSheet.id, row.id, col.id, e.target.value)
                                }
                                onKeyDown={(e) => {
                                  // Press Enter on the last row to automatically append a new continuation row
                                  if (e.key === 'Enter' && rowIdx === filteredRows.length - 1) {
                                    handleQuickAddRow();
                                  }
                                }}
                                className={`w-full bg-transparent px-1.5 py-0.5 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors ${
                                  wrapText ? '' : 'truncate'
                                } ${
                                  col.type === 'amount'
                                    ? 'font-bold font-mono text-emerald-600 dark:text-emerald-400'
                                    : col.type === 'status'
                                    ? 'font-bold text-blue-600 dark:text-blue-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Delete Row Button */}
                      <td className="py-1.5 px-3 text-center border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => deleteRow(activeSheet.id, row.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}

                {/* PERMANENT CONTINUATION ROW: Click to effortlessly add another row */}
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
                    + Click here to add next row for continuation (or press Enter in last cell)
                  </td>
                </tr>
              </tbody>

              {/* Summary / Calculation Row */}
              {activeSheet.rows.length > 0 && (
                <tfoot className="sticky bottom-0 z-20 bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs select-none">
                  <tr>
                    <td className="sticky left-0 z-30 bg-slate-200 dark:bg-slate-800 py-2.5 px-2 text-center text-slate-400 font-mono border-r border-slate-300 dark:border-slate-700">
                      <Calculator className="w-3.5 h-3.5 mx-auto text-blue-500" />
                    </td>
                    {activeSheet.columns.map((col, idx) => {
                      const summary = columnSummaries?.find((s) => s.id === col.id);
                      const isPinned = Boolean(col.isPinned);
                      const colW = col.width || 160;

                      return (
                        <td
                          key={col.id}
                          style={{
                            width: `${colW}px`,
                            minWidth: `${colW}px`,
                            maxWidth: `${colW}px`,
                            left: isPinned ? `${48 + idx * 160}px` : undefined,
                          }}
                          className={`py-2 px-3 border-r border-slate-300 dark:border-slate-700 ${
                            isPinned ? 'sticky z-30 bg-slate-200 dark:bg-slate-800 border-r-2 border-r-blue-500' : ''
                          }`}
                        >
                          {summary?.sum ? (
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-mono block">
                                Total:
                              </span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                                {summary.sum}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {activeSheet.rows.length} rows
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Upload / Import Excel Confirmation */}
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
                  <p className="text-[11px] text-slate-400">Dates of birth & columns converted accurately</p>
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

      {/* MODAL 2: Column Settings & Dropdown Options */}
      {(showNewColModal || showEditColModal) && activeSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {showEditColModal ? 'Edit Column Settings' : 'Add Column to Sheet'}
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

            <form onSubmit={showEditColModal ? handleSaveColumnEdit : handleAddColumn} className="space-y-4">
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
                  <option value="date">📅 Date (Date of Birth / Deadline)</option>
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
                    placeholder="e.g. Active, Pending, Completed, Cancelled"
                    value={colOptionsInput}
                    onChange={(e) => setColOptionsInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Users will select from this dropdown list instead of typing
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
                    max={500}
                    value={colWidth}
                    onChange={(e) => setColWidth(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono font-bold"
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
                  {showEditColModal ? 'Save Column' : 'Add Column'}
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
