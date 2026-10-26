'use client';

import React from 'react';
import {
  FileSpreadsheet,
  Download,
  Receipt,
  Users,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { paiseToRupees, formatPaise } from '@/lib/money';
import { calculateAllCardsBillingReport } from '@/lib/cardBilling';

export function ReportsScreen() {
  const { entries: ledger } = useLedgerStore();
  const { customers } = useCustomerStore();
  const { cards } = useCardStore();
  const { workspaces, activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const cardBillingReport = calculateAllCardsBillingReport(cards, ledger);

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

  const handleExportCardBillingCSV = () => {
    const headers = [
      'Card Name',
      'Bank',
      'Last 4',
      'Statement Day',
      'Last Statement Date',
      'Payment Due Date',
      'Days Until Due',
      'Payment Status',
      'Billed Due (Rupees)',
      'Unbilled Spends (Rupees)',
      'Advance Paid (Rupees)',
      'Total Outstanding (Rupees)',
      'Credit Limit (Rupees)',
      'Available Limit (Rupees)',
    ];

    const rows = cardBillingReport.cardSummaries.map((s) => [
      `"${s.card.name.replace(/"/g, '""')}"`,
      `"${s.card.bank.replace(/"/g, '""')}"`,
      s.card.last4,
      s.statementDay,
      s.lastStatementDate.toISOString().slice(0, 10),
      s.dueDate.toISOString().slice(0, 10),
      s.daysUntilDue,
      s.status,
      paiseToRupees(s.billedDue).toFixed(2),
      paiseToRupees(s.netUnbilled).toFixed(2),
      paiseToRupees(s.advancePayments).toFixed(2),
      paiseToRupees(s.totalOutstanding).toFixed(2),
      paiseToRupees(s.card.credit_limit).toFixed(2),
      paiseToRupees(s.availableCredit).toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RecordBook_Card_Billing_Report_${new Date().toISOString().slice(0, 10)}.csv`;
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
            Export structured financial statements, credit card billing cycles & audit reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cards.length > 0 && (
            <button
              onClick={handleExportCardBillingCSV}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-white text-xs shadow-md shadow-purple-500/25 transition-all hover-lift touch-press"
            >
              <Download className="w-4 h-4" />
              <span>Export Card Billing CSV</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-xs shadow-lg shadow-blue-500/25 transition-all hover-lift touch-press"
          >
            <Download className="w-4 h-4" />
            <span>Export Full Ledger CSV</span>
          </button>
        </div>
      </div>

      {/* Credit Card Billed & Unbilled Statement Report Section */}
      <div
        className={`rounded-3xl border p-6 space-y-5 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Credit Cards Billed & Unbilled Statement Report
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Systematic statement cutoff & payment due countdown
          </span>
        </div>

        {/* 3 Metric Cards for Card Dues */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
              🔴 Total Billed Due
            </span>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
              {formatPaise(cardBillingReport.totalBilledDue)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Must pay before due date
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
              🟣 Total Unbilled Spends
            </span>
            <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
              {formatPaise(cardBillingReport.totalUnbilledSpends)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Bills next statement cycle
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              🟢 Advance Payments / Credit
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {formatPaise(cardBillingReport.totalAdvancePayments)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Offsets future spends
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              💳 Total Available Limit
            </span>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
              {formatPaise(cardBillingReport.totalAvailableCredit)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              of {formatPaise(cardBillingReport.totalCreditLimit)} limit
            </span>
          </div>
        </div>

        {/* Detailed Table */}
        {cards.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No credit cards tracked yet. Add cards in the Credit Cards tab to generate this statement.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Card Name</th>
                  <th className="py-2.5 px-3">Bill Date</th>
                  <th className="py-2.5 px-3">Payment Due Date</th>
                  <th className="py-2.5 px-3 text-right">🔴 Billed Due</th>
                  <th className="py-2.5 px-3 text-right">🟣 Unbilled</th>
                  <th className="py-2.5 px-3 text-right">🟢 Advance</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {cardBillingReport.cardSummaries.map((summary) => {
                  const card = summary.card;
                  const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <tr key={card.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {card.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {card.bank} •••• {card.last4}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-300">
                        {summary.statementDay}th of month
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {formattedDueDate}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            summary.isOverdue
                              ? 'text-rose-500'
                              : summary.daysUntilDue <= 3
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}
                        >
                          {summary.isOverdue
                            ? `⚠️ Overdue ${Math.abs(summary.daysUntilDue)}d`
                            : summary.daysUntilDue === 0
                            ? '🚨 Today'
                            : `${summary.daysUntilDue}d left`}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatPaise(summary.billedDue)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                        {formatPaise(summary.netUnbilled)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatPaise(summary.advanceCredit)}
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            summary.status === 'overdue'
                              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                              : summary.status === 'urgent'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : summary.status === 'due'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : summary.status === 'advance_credit'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {summary.status === 'overdue' && '⚠️ Overdue'}
                          {summary.status === 'urgent' && '🚨 Due Soon'}
                          {summary.status === 'due' && '📅 Due'}
                          {summary.status === 'unbilled_only' && '🗓️ Unbilled'}
                          {summary.status === 'advance_credit' && '🟢 In Advance'}
                          {summary.status === 'cleared' && '✅ Cleared'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* General Financial Journal Summary */}
      <div
        className={`rounded-3xl border p-6 space-y-5 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">General Ledger Summary</h3>
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