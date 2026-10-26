'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { useSheetStore } from '@/stores/useSheetStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { SheetColumn, SheetColumnType } from '@/types';

export function SheetsScreen() {
  const {
    sheets,
    activeSheetId,
    setActiveSheetId,
    createSheet,
    deleteSheet,
    addRow,
    updateRow,
    deleteRow,
    addColumn,
    deleteColumn,
  } = useSheetStore();

  const { theme } = useSessionStore();
  const isLight = theme === 'light';

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewSheetModal, setShowNewSheetModal] = useState(false);
  const [showNewColModal, setShowNewColModal] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);

  // New Sheet Form
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [newSheetCategory, setNewSheetCategory] = useState('Documents');

  // New Column Form
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<SheetColumnType>('text');

  // New Row State
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});

  const activeSheet = sheets.find((s) => s.id === activeSheetId) || sheets[0];

  const handleCreateSheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;
    createSheet(newSheetTitle.trim(), newSheetCategory);
    setShowNewSheetModal(false);
    setNewSheetTitle('');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span>Sheets & Document Registers</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Custom spreadsheet registers for PAN cards, Aadhaar records, bills, and custom registers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewSheetModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-xs shadow-lg shadow-blue-500/25 transition-all hover-lift touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>New Sheet</span>
          </button>
        </div>
      </div>

      {/* Sheet Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-white/10">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheet?.id;
          return (
            <button
              key={sheet.id}
              onClick={() => setActiveSheetId(sheet.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all touch-press ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{sheet.title}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                {sheet.rows.length}
              </span>
            </button>
          );
        })}
      </div>

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
                  placeholder="Search in this sheet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
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

              <button
                onClick={() => setShowNewColModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Add Column</span>
              </button>

              <button
                onClick={handleExportCSV}
                title="Export Sheet to CSV / Excel"
                className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>

              {sheets.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`Delete sheet "${activeSheet.title}"?`)) {
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
                        <span>{col.name}</span>
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
                      className="py-10 text-center text-slate-400 text-xs"
                    >
                      No records found. Click &quot;Add Row&quot; above to add entries to this sheet.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {activeSheet.columns.map((col) => {
                        const val = row.data[col.id] || '';
                        return (
                          <td key={col.id} className="py-2.5 px-3">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) =>
                                updateRow(activeSheet.id, row.id, { [col.id]: e.target.value })
                              }
                              className={`w-full bg-transparent px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors ${
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

                      <td className="py-2.5 px-3 text-right">
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
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Sheet */}
      {showNewSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
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
                  placeholder="e.g. GST Invoices, Customer List, Vehicle Maintenance"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={newSheetCategory}
                  onChange={(e) => setNewSheetCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="Documents">Documents & IDs</option>
                  <option value="Finance">Personal Finance</option>
                  <option value="Bills">Bills & Utilities</option>
                  <option value="Business">Business Register</option>
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

      {/* Modal: Add Column */}
      {showNewColModal && activeSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
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
                  placeholder="e.g. GST Number, City, Remarks"
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
                  <option value="number">Number</option>
                  <option value="amount">Amount / Money (₹)</option>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
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
