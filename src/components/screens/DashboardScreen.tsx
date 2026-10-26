'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Users,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
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

  // Calculate live financial metrics
  const totalReceivables = dues
    .filter((d) => d.status === 'pending' && d.direction === 'you_will_get')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalPayables = dues
    .filter((d) => d.status === 'pending' && d.direction === 'you_will_give')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  // Total Card Dues
  const totalCardDues = cards.reduce((sum, card) => {
    const spend = ledger
      .filter((e) => e.card_id === card.id && e.type === 'card_spend')
      .reduce((s, e) => s + Number(e.amount), 0);
    const paid = ledger
      .filter((e) => e.card_id === card.id && e.type === 'bill_payment')
      .reduce((s, e) => s + Number(e.amount), 0);
    return sum + Math.max(0, spend - paid);
  }, 0);

  // Total Liquid Cash from ledger in/out
  const totalInflow = ledger
    .filter((e) => e.type === 'cash_in')
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalOutflow = ledger
    .filter((e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment')
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalCash = Math.max(0, totalInflow - totalOutflow);

  const netPosition = totalCash + totalReceivables - (totalPayables + totalCardDues);

  return (
    <div className="space-y-6">
      {/* 1. Net Position Hero Card */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 border shadow-xl transition-all ${
          isLight
            ? 'bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white border-emerald-700/40'
            : 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white border-emerald-500/20'
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-300">
                Live Net Position
              </span>
              <button
                onClick={onOpenAskAI}
                className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 font-bold border border-emerald-400/40 flex items-center gap-1 transition-all touch-press"
              >
                <Sparkles className="w-3 h-3 text-emerald-300" />
                <span>Ask AI</span>
              </button>
            </div>

            <div className="text-3xl sm:text-5xl font-black tracking-tight text-white flex items-baseline gap-2 tabular-nums">
              <span>{formatPaise(netPosition)}</span>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-300 mt-2 font-medium">
              Formula: (Cash + Receivables) − (Payables + Card Dues)
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
            <button
              onClick={onQuickCashIn}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all touch-press"
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Cash In</span>
            </button>

            <button
              onClick={onQuickCashOut}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-500/25 transition-all touch-press"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              <span>Cash Out</span>
            </button>

            <button
              onClick={() => onNavigateTab('dues')}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shadow-lg shadow-teal-500/25 transition-all touch-press"
            >
              <Users className="w-4 h-4 stroke-[2.5]" />
              <span>Add Due</span>
            </button>

            <button
              onClick={onOpenAskAI}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all touch-press"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash in Hand */}
        <div
          onClick={() => onNavigateTab('cash')}
          className={`group cursor-pointer rounded-2xl border p-4.5 transition-all hover-lift ${
            isLight
              ? 'bg-white hover:border-emerald-500 border-slate-200/90 shadow-xs'
              : 'bg-slate-900/80 border-white/10 hover:border-emerald-500/40 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Cash & Banks</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatPaise(totalCash)}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 inline-block font-semibold">
            Tap to manage bank accounts
          </span>
        </div>

        {/* You Will Get (Receivables) */}
        <div
          onClick={() => onNavigateTab('dues')}
          className={`group cursor-pointer rounded-2xl border p-4.5 transition-all hover-lift ${
            isLight
              ? 'bg-white hover:border-teal-500 border-slate-200/90 shadow-xs'
              : 'bg-slate-900/80 border-white/10 hover:border-teal-500/40 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">You Will Get</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            +{formatPaise(totalReceivables)}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 inline-block">
            From {customers.length} people
          </span>
        </div>

        {/* You Will Give (Payables) */}
        <div
          onClick={() => onNavigateTab('dues')}
          className={`group cursor-pointer rounded-2xl border p-4.5 transition-all hover-lift ${
            isLight
              ? 'bg-white hover:border-rose-500 border-slate-200/90 shadow-xs'
              : 'bg-slate-900/80 border-white/10 hover:border-rose-500/40 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">You Will Give</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
            -{formatPaise(totalPayables)}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 inline-block">
            To suppliers & vendors
          </span>
        </div>

        {/* Credit Card Dues */}
        <div
          onClick={() => onNavigateTab('cards')}
          className={`group cursor-pointer rounded-2xl border p-4.5 transition-all hover-lift ${
            isLight
              ? 'bg-white hover:border-amber-500 border-slate-200/90 shadow-xs'
              : 'bg-slate-900/80 border-white/10 hover:border-amber-500/40 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Card Dues</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
            -{formatPaise(totalCardDues)}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 inline-block">
            Across {cards.length} cards
          </span>
        </div>
      </div>

      {/* 3. Recent Transactions Feed */}
      <div
        className={`rounded-3xl border p-5 sm:p-6 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900/80 border-white/10'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recent Transactions</h3>
          <span className="text-xs text-slate-400">{ledger.length} total entries</span>
        </div>

        {ledger.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No transactions logged yet. Use <span className="font-bold text-emerald-500">Cash In</span> or <span className="font-bold text-emerald-500">Ask AI</span> above to record your first entry.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {ledger.slice(0, 7).map((entry) => {
              const isInflow = entry.type === 'cash_in';
              return (
                <div key={entry.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        isInflow
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isInflow ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {entry.note || (isInflow ? 'Cash Received' : 'Expense / Payment')}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(entry.entry_date).toLocaleDateString()} • {entry.mode.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`font-black text-sm tabular-nums ${
                      isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
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
