'use client';

import React from 'react';
import { X, Printer, Download, Building, Calendar, CheckCircle2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatPaise, paiseToRupees } from '@/lib/money';
import { LedgerEntry, Workspace, CashLocation, Customer } from '@/types';
import { getCategoryById } from '@/lib/categories';

interface StatementPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace;
  periodLabel: string;
  startDateStr: string;
  endDateStr: string;
  entries: LedgerEntry[];
  accounts: CashLocation[];
  customers: Customer[];
  totalInflow: number;
  totalOutflow: number;
  netProfit: number;
}

export function StatementPrintModal({
  isOpen,
  onClose,
  workspace,
  periodLabel,
  startDateStr,
  endDateStr,
  entries,
  accounts,
  customers,
  totalInflow,
  totalOutflow,
  netProfit,
}: StatementPrintModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Account', 'Party', 'Mode', 'Amount (Rupees)', 'Notes'];
    const rows = entries.map((entry) => {
      const cat = getCategoryById(entry.category_id);
      const acc = accounts.find((a) => a.id === entry.cash_location_id);
      const cust = customers.find((c) => c.id === entry.customer_id);
      return [
        entry.entry_date,
        entry.type,
        `"${cat.name.replace(/"/g, '""')}"`,
        `"${(acc?.name || 'General').replace(/"/g, '""')}"`,
        `"${(cust?.name || '-').replace(/"/g, '""')}"`,
        entry.mode,
        paiseToRupees(entry.amount).toFixed(2),
        `"${(entry.note || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace?.name || 'Business'}_Statement_${startDateStr}_to_${endDateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fade-in print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-white/10 print:shadow-none print:border-none print:max-h-none print:w-full">
        {/* Modal Controls - Hidden during Print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Official Financial Statement</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ready to print or save as PDF ({entries.length} items)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/25 flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 print:overflow-visible print:p-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10 print:border-black/20">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                  RB
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white print:text-black">
                    {workspace?.name || 'Record Book'}
                  </h1>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 block">
                    Verified Digital Accounts & Ledger Journal
                  </span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold print:border print:border-black/10">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>Period: {periodLabel}</span>
              </div>
              <p className="text-[11px] text-slate-400 print:text-slate-600">
                Date Range: <span className="font-mono font-medium">{startDateStr}</span> to{' '}
                <span className="font-mono font-medium">{endDateStr}</span>
              </p>
              <p className="text-[10px] text-slate-400 print:text-slate-600">
                Generated: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>

          {/* Key Financial Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 print:bg-slate-50 print:border-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 print:text-emerald-800 block">
                Total Inflow (Income)
              </span>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 print:text-black mt-0.5 tabular-nums">
                {formatPaise(totalInflow)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 print:bg-slate-50 print:border-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 print:text-rose-800 block">
                Total Outflow (Expenses)
              </span>
              <div className="text-lg font-black text-rose-600 dark:text-rose-400 print:text-black mt-0.5 tabular-nums">
                {formatPaise(totalOutflow)}
              </div>
            </div>

            <div
              className={`p-3.5 rounded-2xl border print:bg-slate-50 print:border-slate-300 ${
                netProfit >= 0
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block">
                {netProfit >= 0 ? 'Net Profit / Surplus' : 'Net Deficit'}
              </span>
              <div className="text-lg font-black print:text-black mt-0.5 tabular-nums">
                {formatPaise(netProfit)}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 print:border-slate-300 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/5 print:bg-slate-100 text-slate-500 print:text-black font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-white/10 print:border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Category & Details</th>
                  <th className="py-2.5 px-3">Account / Mode</th>
                  <th className="py-2.5 px-3">Party</th>
                  <th className="py-2.5 px-3 text-right">Inflow (+)</th>
                  <th className="py-2.5 px-3 text-right">Outflow (−)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 print:divide-slate-200">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No transactions recorded in this selected period.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const cat = getCategoryById(entry.category_id);
                    const acc = accounts.find((a) => a.id === entry.cash_location_id);
                    const cust = customers.find((c) => c.id === entry.customer_id);
                    const isInflow = entry.type === 'cash_in';

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 print:hover:bg-transparent">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 print:text-black whitespace-nowrap">
                          {entry.entry_date}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-slate-900 dark:text-white print:text-black block">
                            {cat.name}
                          </span>
                          {entry.note && (
                            <span className="text-[10px] text-slate-400 print:text-slate-600 line-clamp-1">
                              {entry.note}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-medium text-slate-700 dark:text-slate-300 print:text-black block">
                            {acc?.name || 'General'}
                          </span>
                          <span className="text-[10px] uppercase font-mono text-slate-400 print:text-slate-600">
                            {entry.mode}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300 print:text-black">
                          {cust?.name || '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-black tabular-nums text-emerald-600 dark:text-emerald-400 print:text-black">
                          {isInflow ? formatPaise(entry.amount) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-black tabular-nums text-rose-600 dark:text-rose-400 print:text-black">
                          {!isInflow ? formatPaise(entry.amount) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-white/5 print:bg-slate-100 font-bold border-t border-slate-200 dark:border-white/10 print:border-slate-300">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[10px] tracking-wider text-slate-500 print:text-black">
                    Period Total:
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 print:text-black tabular-nums">
                    {formatPaise(totalInflow)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400 print:text-black tabular-nums">
                    {formatPaise(totalOutflow)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer & Signature Block */}
          <div className="pt-8 flex items-end justify-between text-xs border-t border-slate-100 dark:border-white/10 print:border-slate-300">
            <div className="text-[10px] text-slate-400 print:text-slate-600 space-y-0.5">
              <p>Generated securely via Record Book (Khata Book AI)</p>
              <p>All values recorded in strict integer Paise (INR)</p>
            </div>
            <div className="text-right">
              <div className="w-36 border-b border-slate-300 dark:border-slate-600 mb-1.5" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Authorized Signatory
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
