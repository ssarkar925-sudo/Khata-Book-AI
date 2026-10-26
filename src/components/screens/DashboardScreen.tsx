'use client';

import React from 'react';
import {
  Wallet,
  CreditCard,
  Users,
  Sparkles,
  Plus,
  Minus,
  ArrowUpRight,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { formatPaise } from '@/lib/money';
import { TabType } from '@/types';

interface DashboardProps {
  onNavigateTab: (tab: TabType) => void;
  onOpenAskAI: () => void;
  onQuickCashIn: () => void;
  onQuickCashOut: () => void;
}

export function DashboardScreen({
  onNavigateTab,
  onOpenAskAI,
  onQuickCashIn,
  onQuickCashOut,
}: DashboardProps) {
  const { entries: ledger } = useLedgerStore();
  const { dues, customers } = useCustomerStore();
  const { cards } = useCardStore();
  const { theme } = useSessionStore();
  const isLight = theme === 'light';

  // Live financial metrics
  const totalReceivables = dues
    .filter((d) => d.status === 'pending' && d.direction === 'you_will_get')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalPayables = dues
    .filter((d) => d.status === 'pending' && d.direction === 'you_will_give')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalCardDues = cards.reduce((sum, card) => {
    const spend = ledger
      .filter((e) => e.card_id === card.id && e.type === 'card_spend')
      .reduce((s, e) => s + Number(e.amount), 0);
    const paid = ledger
      .filter((e) => e.card_id === card.id && e.type === 'bill_payment')
      .reduce((s, e) => s + Number(e.amount), 0);
    return sum + Math.max(0, spend - paid);
  }, 0);

  const totalInflow = ledger
    .filter((e) => e.type === 'cash_in')
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalOutflow = ledger
    .filter((e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment')
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalCash = Math.max(0, totalInflow - totalOutflow);

  const netPosition = totalCash + totalReceivables - (totalPayables + totalCardDues);

  return (
    <div className="space-y-5">
      {/* 1. Linear-Style Net Position Hero */}
      <div
        className={`border rounded-xl p-5 sm:p-6 transition-colors ${
          isLight
            ? 'bg-white border-zinc-200 shadow-2xs'
            : 'bg-[#121215] border-zinc-800/80 shadow-2xs'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                Net Position
              </span>
              <button
                onClick={onOpenAskAI}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium transition-colors"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>Ask AI</span>
              </button>
            </div>

            <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">
              {formatPaise(netPosition)}
            </div>

            <div className="text-[11px] text-zinc-400 font-mono">
              (Cash + Receivables) − (Payables + Card Dues)
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={onQuickCashIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Inflow</span>
            </button>

            <button
              onClick={onQuickCashOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-850 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Outflow</span>
            </button>

            <button
              onClick={() => onNavigateTab('dues')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-850 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors"
            >
              <Users className="w-3.5 h-3.5 opacity-70" />
              <span>Record Due</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid (4 Clean Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Cash & Banks */}
        <div
          onClick={() => onNavigateTab('cash')}
          className={`cursor-pointer rounded-xl border p-4 transition-colors ${
            isLight
              ? 'bg-white border-zinc-200 hover:border-zinc-400'
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500 font-medium">Cash & Banks</span>
            <Wallet className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">
            {formatPaise(totalCash)}
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 inline-flex items-center gap-0.5">
            Manage accounts <ArrowUpRight className="w-2.5 h-2.5" />
          </span>
        </div>

        {/* You Will Get (Receivables) */}
        <div
          onClick={() => onNavigateTab('dues')}
          className={`cursor-pointer rounded-xl border p-4 transition-colors ${
            isLight
              ? 'bg-white border-zinc-200 hover:border-zinc-400'
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500 font-medium">You Will Get</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              Receivable
            </span>
          </div>
          <div className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">
            {formatPaise(totalReceivables)}
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 inline-block">
            From {customers.length} contacts
          </span>
        </div>

        {/* You Will Give (Payables) */}
        <div
          onClick={() => onNavigateTab('dues')}
          className={`cursor-pointer rounded-xl border p-4 transition-colors ${
            isLight
              ? 'bg-white border-zinc-200 hover:border-zinc-400'
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500 font-medium">You Will Give</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
              Payable
            </span>
          </div>
          <div className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">
            {formatPaise(totalPayables)}
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 inline-block">
            Vendors & suppliers
          </span>
        </div>

        {/* Credit Card Dues */}
        <div
          onClick={() => onNavigateTab('cards')}
          className={`cursor-pointer rounded-xl border p-4 transition-colors ${
            isLight
              ? 'bg-white border-zinc-200 hover:border-zinc-400'
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500 font-medium">Card Dues</span>
            <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">
            {formatPaise(totalCardDues)}
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 inline-block">
            {cards.length} active cards
          </span>
        </div>
      </div>

      {/* 3. Recent Transactions Feed */}
      <div
        className={`rounded-xl border p-5 transition-colors ${
          isLight ? 'bg-white border-zinc-200' : 'bg-[#121215] border-zinc-800/80'
        }`}
      >
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/60">
          <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
            Recent Ledger Entries
          </h3>
          <span className="text-xs text-zinc-400 font-mono">{ledger.length} records</span>
        </div>

        {ledger.length === 0 ? (
          <div className="text-center py-10 text-xs text-zinc-400 space-y-2">
            <p>No transactions recorded yet.</p>
            <p className="text-[11px] text-zinc-500">
              Use <span className="font-mono text-zinc-700 dark:text-zinc-300">Inflow</span> or <span className="font-mono text-zinc-700 dark:text-zinc-300">Outflow</span> buttons above to make your first record.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {ledger.slice(0, 8).map((entry) => {
              const isInflow = entry.type === 'cash_in';
              return (
                <div key={entry.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isInflow ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
                      }`}
                    />
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {entry.note || (isInflow ? 'Cash Received' : 'Cash Paid')}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {new Date(entry.entry_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })} • {entry.mode.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`font-mono font-medium tabular-nums ${
                      isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    {isInflow ? '+' : '-'}{formatPaise(entry.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
