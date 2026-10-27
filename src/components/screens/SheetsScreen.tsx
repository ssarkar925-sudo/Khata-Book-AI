'use client';

import React, { useState, useRef } from 'react';
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
  ArrowUpDown,
  Filter,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSheetStore } from '@/stores/useSheetStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { SheetColumn, SheetColumnType, SheetRow } from '@/types';

const SHEET_COLORS = [
  { id: '#6366F1', name: 'Indigo', bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-500' },
  { id: '#10B981', name: 'Emerald', bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-500' },
  { id: '#3B82F6', name: 'Blue', bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
  { id: '#F59E0B', name: 'Amber', bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-500' },
  { id: '#F43F5E', name: 'Rose', bg: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-500' },
  { id: '#8B5CF6', name: 'Purple', bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
  { id: '#06B6D4', name: 'Cyan', bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-500' },
  { id: '#64748B', name: 'Slate', bg: 'bg-slate-500', border: 'border-slate-500', text: 'text-slate-500' },
];

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
    deleteColumn,
  } = useSheetStore();

  const { theme } = useSessionStore();
  const isLight = theme === 'light';

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showNewSheetModal, setShowNewSheetModal] = useState(false);
  const [showEditSheetModal, setShowEditSheetModal] = useState(false);
  const [showNewColModal, setShowNewColModal] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // New Sheet Form
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [newSheetCategory, setNewSheetCategory] = useState('Business');
  const [newSheetColor, setNewSheetColor] = useState('#6366F1');

  // Edit Sheet Form
  const [editSheetTitle, setEditSheetTitle] = useState('');
  const [editSheetCategory, setEditSheetCategory] = useState('');
  const [editSheetColor, setEditSheetColor] = useState('');

  // New Column Form
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<SheetColumnType>('text');

  // New Row State
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});

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

  // Handle New Sheet Creation
  const handleCreateSheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;
    createSheet(newSheetTitle.trim(), newSheetCategory, newSheetColor);
    setShowNewSheetModal(false);
    setNewSheetTitle('');
  };

  // Handle File Upload (.xlsx, .xls, .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!rawJson || rawJson.length === 0) {
          alert('The uploaded spreadsheet appears to be empty.');
          return;
        }

        // Header row
        const headerRow = rawJson[0] as string[];
        const detectedColumns: SheetColumn[] = headerRow.map((h, idx) => {
          const colName = String(h || `Column ${idx + 1}`).trim();
          // Detect type from sample of first 10 rows
          let isNumeric = true;
          let isDate = true;
          let sampleCount = 0;

          for (let r = 1; r < Math.min(rawJson.length, 10); r++) {
            const val = rawJson[r]?.[idx];
            if (val !== undefined && val !== null && val !== '') {
              sampleCount++;
              if (isNaN(Number(val))) isNumeric = false;
              if (isNaN(Date.parse(String(val)))) isDate = false;
            }
          }

          let detectedType: SheetColumnType = 'text';
          if (sampleCount > 0) {
            const lowerName = colName.toLowerCase();
            if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('rate') || lowerName.includes('fee') || lowerName.includes('cost') || lowerName.includes('total') || lowerName.includes('₹')) {
              detectedType = 'amount';
            } else if (lowerName.includes('phone') || lowerName.includes('mobile')) {
              detectedType = 'phone';
            } else if (lowerName.includes('date')) {
              detectedType = 'date';
            } else if (lowerName.includes('status')) {
              detectedType = 'status';
            } else if (isNumeric) {
              detectedType = 'number';
            }
          }

          return {
            id: `col_${idx}_${Date.now()}`,
            name: colName,
            type: detectedType,
          };
        });

        // Data rows
        const parsedRows: SheetRow[] = [];
        for (let r = 1; r < rawJson.length; r++) {
          const rowVals = rawJson[r];
          if (!rowVals || rowVals.length === 0) continue;
          const rowData: Record<string, any> = {};
          let hasContent = false;

          detectedColumns.forEach((col, idx) => {
            const v = rowVals[idx];
            if (v !== undefined && v !== null && v !== '') {
              hasContent = true;
              rowData[col.id] = String(v).trim();
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
        alert('Failed to parse spreadsheet. Please ensure it is a valid .xlsx, .xls, or .csv file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Confirm Import
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

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSheet || !newColName.trim()) return;
    const col: SheetColumn = {
      id: `col_${Date.now()}`,
      name: newColName.trim(),
      type: newColType,
    };
    addColumn(activeSheet.id, col);
    setShowNewColModal(false);
    setNewColName('');
  };

  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSheet) return;
    addRow(activeSheet.id, newRowData);
    setShowAddRowModal(false);
    setNewRowData({});
  };

  // Export to Excel (.xlsx) using SheetJS
  const handleExportXLSX = () => {
    if (!activeSheet) return;
    const headers = activeSheet.columns.map((c) => c.name);
    const data = activeSheet.rows.map((r) =>
      activeSheet.columns.map((c) => r.data[c.id] || '')
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeSheet.title.slice(0, 31));
    XLSX.writeFile(wb, `${activeSheet.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

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

  // Filter rows based on search query
  const filteredRows = (activeSheet?.rows || []).filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(r.data).some((val) => String(val).toLowerCase().includes(q));
  });

  // Calculate summary totals for columns
  const columnSummaries = activeSheet?.columns.map((col) => {
    if (col.type === 'amount' || col.type === 'number') {
      const sum = (activeSheet.rows || []).reduce((acc, r) => {
        const val = parseFloat(String(r.data[col.id] || '0').replace(/[₹,\s]/g, ''));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      return {
        id: col.id,
        type: col.type,
        sum: col.type === 'amount' ? `₹${sum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : sum.toLocaleString('en-IN'),
      };
    }
    return { id: col.id, type: col.type, sum: null };
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Hidden File Input for Excel / CSV */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span>Record Sheets & Excel Books</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Excel-grade grid registers. Upload .xlsx files, customize tab colors & auto-calculate sums.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Upload Excel Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-md shadow-emerald-500/25 transition-all hover-lift touch-press"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Excel (.xlsx)</span>
          </button>

          {/* New Sheet Button */}
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

      {/* Active Sheet Workspace */}
      {activeSheet && (
        <div
          className={`rounded-3xl border p-5 sm:p-6 transition-all ${
            isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
          }`}
        >
          {/* Action Toolbar above table */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={`Search ${activeSheet.rows.length} rows...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Add Row Button */}
              <button
                onClick={() => {
                  setNewRowData({});
                  setShowAddRowModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover-lift"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>

              {/* Add Column Button */}
              <button
                onClick={() => setShowNewColModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Add Column</span>
              </button>

              {/* Edit Sheet / Color Tab Button */}
              <button
                onClick={openEditSheet}
                title="Edit Sheet Title & Color"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Palette className="w-3.5 h-3.5 text-blue-500" />
                <span>Color & Info</span>
              </button>

              {/* Export to Excel (.xlsx) */}
              <button
                onClick={handleExportXLSX}
                title="Download as Excel .xlsx"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>.XLSX</span>
              </button>

              {/* Export to CSV */}
              <button
                onClick={handleExportCSV}
                title="Export Sheet to CSV"
                className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Delete Sheet */}
              {sheets.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`Delete sheet "${activeSheet.title}" and its ${activeSheet.rows.length} rows?`)) {
                      deleteSheet(activeSheet.id);
                    }
                  }}
                  title="Delete Sheet"
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] select-none">
                <tr>
                  <th className="py-3 px-3 w-12 text-center text-slate-400">#</th>
                  {activeSheet.columns.map((col) => (
                    <th key={col.id} className="py-3 px-3 min-w-[140px]">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span>{col.name}</span>
                          <span className="text-[9px] lowercase font-normal opacity-60">({col.type})</span>
                        </span>
                        {activeSheet.columns.length > 1 && (
                          <button
                            onClick={() => deleteColumn(activeSheet.id, col.id)}
                            title="Delete Column"
                            className="opacity-40 hover:opacity-100 text-rose-500 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 w-16 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeSheet.columns.length + 2}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      No records found. Click &quot;Add Row&quot; or upload an Excel file.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {activeSheet.columns.map((col) => {
                        const val = row.data[col.id] || '';
                        return (
                          <td key={col.id} className="py-1.5 px-3">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) =>
                                updateCell(activeSheet.id, row.id, col.id, e.target.value)
                              }
                              className={`w-full bg-transparent px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors ${
                                col.type === 'amount'
                                  ? 'font-bold font-mono text-emerald-600 dark:text-emerald-400'
                                  : col.type === 'status'
                                  ? 'font-semibold text-blue-600 dark:text-blue-400'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            />
                          </td>
                        );
                      })}

                      <td className="py-1.5 px-3 text-right">
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
              </tbody>

              {/* Summary / Calculation Row */}
              {activeSheet.rows.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-white/10 text-xs">
                  <tr>
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">
                      <Calculator className="w-3.5 h-3.5 mx-auto text-blue-500" />
                    </td>
                    {activeSheet.columns.map((col) => {
                      const summary = columnSummaries?.find((s) => s.id === col.id);
                      return (
                        <td key={col.id} className="py-3 px-3">
                          {summary?.sum ? (
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-mono block">
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
                    <td className="py-3 px-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Modal: Upload / Import Excel Confirmation */}
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
                  <p className="text-[11px] text-slate-400">Source: {pendingImport.fileName}</p>
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Tab Color</label>
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
                Confirm & Import Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Sheet */}
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
                  placeholder="e.g. GST Invoices, Worker Wages, Daily Stock"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tab Color Palette</label>
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
                  <option value="Finance">Personal Finance</option>
                  <option value="Bills">Bills & Utilities</option>
                  <option value="Inventory">Inventory & Stock</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSheetModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/25"
                >
                  Create Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Sheet Details & Color */}
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

      {/* Modal: Add Column */}
      {showNewColModal && activeSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Column to Sheet</h3>
              <button onClick={() => setShowNewColModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddColumn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Column Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GST Number, Quantity, Unit Price"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Data Type</label>
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value as SheetColumnType)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="text">Text (General)</option>
                  <option value="number">Number (Auto-calculated)</option>
                  <option value="amount">Amount / Money (₹ Auto-sum)</option>
                  <option value="date">Date</option>
                  <option value="status">Status Badge</option>
                  <option value="phone">Phone / Mobile</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewColModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/25"
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Row */}
      {showAddRowModal && activeSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Record Row</h3>
              <button onClick={() => setShowAddRowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRow} className="space-y-4">
              {activeSheet.columns.map((col) => (
                <div key={col.id}>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {col.name} ({col.type})
                  </label>
                  <input
                    type="text"
                    placeholder={`Enter ${col.name}...`}
                    value={newRowData[col.id] || ''}
                    onChange={(e) => setNewRowData({ ...newRowData, [col.id]: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/25"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
