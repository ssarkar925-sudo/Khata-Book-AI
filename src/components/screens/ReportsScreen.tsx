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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-zinc-500" />
            <span>Reports & Tax Export</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Export structured financial statements ready for audit, CA, or tax filing.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV Statement</span>
        </button>
      </div>

      <div
        className={`rounded-xl border p-5 space-y-4 ${
          isLight ? 'bg-white border-zinc-200' : 'bg-[#121215] border-zinc-800/80'
        }`}
      >
        <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
          Financial Journal Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
            <span className="text-[11px] text-zinc-400 font-mono block mb-1">Total Journal Entries</span>
            <span className="font-semibold text-base font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {ledger.length}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
            <span className="text-[11px] text-zinc-400 font-mono block mb-1">Parties & Contacts</span>
            <span className="font-semibold text-base font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {customers.length}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
            <span className="text-[11px] text-zinc-400 font-mono block mb-1">Tracked Credit Cards</span>
            <span className="font-semibold text-base font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {cards.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
