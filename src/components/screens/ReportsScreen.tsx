'use client';

import React from 'react';
import {
  FileSpreadsheet,
  Download,
  Receipt,
  Users,
  CreditCard,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { paiseToRupees } from '@/lib/money';

export function ReportsScreen() {
  const { entries: ledger } = useLedgerStore();
  const { customers } = useCustomerStore();
  const { cards } = useCardStore();
  const { workspaces, activeWorkspaceId, theme } = useSessionStore();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span>Reports & Tax Export</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Export structured financial statements ready for audit, CA, or tax filing.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-xs shadow-lg shadow-blue-500/25 transition-all hover-lift touch-press"
        >
          <Download className="w-4 h-4" />
          <span>Export Full Ledger CSV</span>
        </button>
      </div>

      <div
        className={`rounded-3xl border p-6 space-y-5 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Financial Journal Summary</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Card 1 */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent border border-indigo-500/20 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 text-[11px]">
                Total Journal Entries
              </span>
              <Receipt className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {ledger.length}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">Debits & Credits recorded</span>
          </div>

          {/* Card 2 */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-transparent border border-cyan-500/20 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 text-[11px]">
                Parties & Contacts
              </span>
              <Users className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {customers.length}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">Customer & supplier network</span>
          </div>

          {/* Card 3 */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent border border-purple-500/20 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 text-[11px]">
                Tracked Credit Cards
              </span>
              <CreditCard className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {cards.length}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">Active credit limits monitored</span>
          </div>
        </div>
      </div>
    </div>
  );
}
