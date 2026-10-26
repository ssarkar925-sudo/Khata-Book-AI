'use client';

import React from 'react';
import {
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { paiseToRupees } from '@/lib/money';

export function ReportsScreen() {
  const { entries: ledger } = useLedgerStore();
  const { customers, dues } = useCustomerStore();
  const { cards } = useCardStore();
  const { theme, workspaces, activeWorkspaceId } = useSessionStore();
  const isLight = theme === 'light';

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Amount (Rupees)', 'Payment Mode', 'Notes'];
    const rows = ledger.map((entry) => [
      entry.entry_date,
      entry.type,
      paiseToRupees(entry.amount).toFixed(2),
      entry.mode,
      `"${(entry.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RecordBook_Statement_${activeWs?.name || 'Records'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            <span>Financial Statements & Tax Export</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Download your transaction journals and debtor summaries ready for your CA or tax accountant.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all touch-press"
        >
          <Download className="w-4 h-4" />
          <span>Export Full Ledger CSV</span>
        </button>
      </div>

      <div
        className={`rounded-3xl border p-6 space-y-4 ${
          isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900/80 border-white/10'
        }`}
      >
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Summary for Accountant</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-slate-400 block mb-1">Total Logged Transactions</span>
            <span className="font-black text-lg text-slate-900 dark:text-white">{ledger.length}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-slate-400 block mb-1">Active Customers / Parties</span>
            <span className="font-black text-lg text-slate-900 dark:text-white">{customers.length}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-slate-400 block mb-1">Credit Cards Tracked</span>
            <span className="font-black text-lg text-slate-900 dark:text-white">{cards.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
