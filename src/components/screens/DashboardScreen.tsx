'use client';

import React, { useState } from 'react';
import {
  Wallet,
  CreditCard,
  Users,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Camera,
  Mic,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { formatPaise } from '@/lib/money';
import { TabType, LedgerEntry } from '@/types';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { getCategoryById } from '@/lib/categories';

interface DashboardProps {
  onNavigateTab: (tab: TabType) => void;
  onOpenAskAI: () => void;
  onQuickCashIn: () => void;
  onQuickCashOut: () => void;
  onOpenScanner?: () => void;
  onOpenVoice?: () => void;
}

export function DashboardScreen({
  onNavigateTab,
  onOpenAskAI,
  onQuickCashIn,
  onQuickCashOut,
  onOpenScanner,
  onOpenVoice,
}: DashboardProps) {
  const { entries: ledger } = useLedgerStore();
  const { dues, customers } = useCustomerStore();
  const { cards } = useCardStore();
  const { accounts } = useAccountStore();
  const { theme } = useSessionStore();
  const isLight = theme === 'light';

  const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<LedgerEntry | null>(null);

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
  const totalAccountBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalCash = totalAccountBalance > 0 ? totalAccountBalance : Math.max(0, totalInflow - totalOutflow);

  const netPosition = totalCash + totalReceivables - (totalPayables + totalCardDues);

  // Asset distribution calculation for colorful bar
  const totalAssets = Math.max(1, totalCash + totalReceivables);
  const cashPct = Math.round((totalCash / totalAssets) * 100);
  const recPct = Math.round((totalReceivables / totalAssets) * 100);

  // Top Expense Categories Breakdown
  const expenseEntries = ledger.filter(
    (e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment'
  );
  const totalExpenses = expenseEntries.reduce((s, e) => s + Number(e.amount), 0);

  const categoryMap = new Map<string, number>();
  for (const e of expenseEntries) {
    const catId = e.category_id || 'general';
    categoryMap.set(catId, (categoryMap.get(catId) || 0) + Number(e.amount));
  }

  const topCategories = Array.from(categoryMap.entries())
    .map(([catId, amount]) => ({
      category: getCategoryById(catId),
      amount,
      pct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 1. MODERN MULTICOLOR HERO CARD */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white border border-indigo-500/25 shadow-2xl transition-all"
      >
        {/* Ambient Gradient Glow Orbs */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Net Position
              </span>

              <button
                onClick={onOpenAskAI}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white shadow-md shadow-violet-500/25 transition-all hover-lift touch-press"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Ask AI</span>
              </button>
            </div>

            <div className="text-4xl sm:text-5xl font-black tracking-tight text-white tabular-nums">
              {formatPaise(netPosition)}
            </div>

            {/* Micro Formula Badge Strip */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-300">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                Cash: {formatPaise(totalCash)}
              </span>
              <span className="text-slate-500">+</span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300">
                Get: {formatPaise(totalReceivables)}
              </span>
              <span className="text-slate-500">−</span>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300">
                Give: {formatPaise(totalPayables)}
              </span>
              <span className="text-slate-500">−</span>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300">
                Cards: {formatPaise(totalCardDues)}
              </span>
            </div>
          </div>

          {/* Saturated Action Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
            <button
              onClick={onQuickCashIn}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/30 transition-all hover-lift touch-press"
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              <span>+ Inflow</span>
            </button>

            <button
              onClick={onQuickCashOut}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-500/30 transition-all hover-lift touch-press"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              <span>− Outflow</span>
            </button>

            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-teal-500/30 transition-all hover-lift touch-press"
              >
                <Camera className="w-4 h-4 stroke-[2.5]" />
                <span>Scan Bill</span>
              </button>
            )}

            {onOpenVoice && (
              <button
                onClick={onOpenVoice}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-violet-500/30 transition-all hover-lift touch-press"
              >
                <Mic className="w-4 h-4 stroke-[2.5]" />
                <span>Voice Entry</span>
              </button>
            )}

            <button
              onClick={onOpenAskAI}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-purple-500/30 transition-all hover-lift touch-press"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>

        {/* Assets Segmented Progress Bar */}
        <div className="relative mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2">
            <span>Liquid Asset Ratio</span>
            <span className="text-[11px] text-slate-400">Cash ({cashPct}%) • Receivables ({recPct}%)</span>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${cashPct}%` }}
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
              title={`Cash: ${cashPct}%`}
            />
            <div
              style={{ width: `${recPct}%` }}
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
              title={`Receivables: ${recPct}%`}
            />
          </div>
        </div>
      </div>

      {/* 2. FOUR VIBRANT MULTICOLOR METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Emerald Cash & Banks */}
        <div
          onClick={() => onNavigateTab('cash')}
          className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
            isLight
              ? 'bg-gradient-to-br from-white via-emerald-50/40 to-white border-emerald-200 shadow-sm hover:border-emerald-400'
              : 'bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 border-emerald-500/20 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Cash & Banks
            </span>
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatPaise(totalCash)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-emerald-100 dark:border-emerald-500/15 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <span>Manage accounts</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Cyan You Will Get (Receivables) */}
        <div
          onClick={() => onNavigateTab('dues')}
          className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
            isLight
              ? 'bg-gradient-to-br from-white via-cyan-50/40 to-white border-cyan-200 shadow-sm hover:border-cyan-400'
              : 'bg-gradient-to-br from-slate-900 via-cyan-950/20 to-slate-900 border-cyan-500/20 hover:border-cyan-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              You Will Get
            </span>
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform shadow-xs">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-cyan-600 dark:text-cyan-400 tabular-nums">
            +{formatPaise(totalReceivables)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-cyan-100 dark:border-cyan-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>From {customers.length} contacts</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-400 text-[11px]">Receivable</span>
          </div>
        </div>

        {/* Card 3: Rose You Will Give (Payables) */}
        <div
          onClick={() => onNavigateTab('dues')}
          className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
            isLight
              ? 'bg-gradient-to-br from-white via-rose-50/40 to-white border-rose-200 shadow-sm hover:border-rose-400'
              : 'bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-900 border-rose-500/20 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              You Will Give
            </span>
            <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform shadow-xs">
              <TrendingDown className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
            -{formatPaise(totalPayables)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-rose-100 dark:border-rose-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Vendors & suppliers</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">Payable</span>
          </div>
        </div>

        {/* Card 4: Purple Credit Card Dues */}
        <div
          onClick={() => onNavigateTab('cards')}
          className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
            isLight
              ? 'bg-gradient-to-br from-white via-purple-50/40 to-white border-purple-200 shadow-sm hover:border-purple-400'
              : 'bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 border-purple-500/20 hover:border-purple-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Card Dues
            </span>
            <div className="p-2.5 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400 tabular-nums">
            -{formatPaise(totalCardDues)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-purple-100 dark:border-purple-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>{cards.length} active cards</span>
            <span className="font-bold text-purple-600 dark:text-purple-400 text-[11px]">Limits & bills</span>
          </div>
        </div>
      </div>

      {/* Expense Categories Breakdown Strip */}
      {topCategories.length > 0 && (
        <div
          className={`rounded-3xl border p-5 transition-all ${
            isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Top Expense Categories ({formatPaise(totalExpenses)} total spent)
            </span>
            <span className="text-[11px] font-semibold text-slate-400">This Period</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {topCategories.map(({ category, amount, pct }) => (
              <div
                key={category.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {category.name}
                  </span>
                  <span className="font-bold text-slate-500 text-[11px]">{pct}%</span>
                </div>
                <div className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
                  {formatPaise(amount)}
                </div>
                <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: category.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. RECENT TRANSACTIONS WITH COLORFUL AVATARS */}
      <div
        className={`rounded-3xl border p-5 sm:p-6 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
        }`}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recent Transactions</h3>
          </div>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
            {ledger.length} total entries
          </span>
        </div>

        {ledger.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
              <Wallet className="w-6 h-6 opacity-60" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">No transactions recorded yet.</p>
            <p className="text-[11px] text-slate-400">
              Click <span className="font-bold text-emerald-600 dark:text-emerald-400">+ Inflow</span> or <span className="font-bold text-rose-600 dark:text-rose-400">− Outflow</span> above to record your first transaction.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {ledger.slice(0, 8).map((entry) => {
              const isInflow = entry.type === 'cash_in';
              const cat = getCategoryById(entry.category_id);
              const acc = accounts.find((a) => a.id === entry.cash_location_id);

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntryForDetail(entry)}
                  className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-white/5 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                        isInflow
                          ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white'
                          : 'bg-gradient-to-tr from-rose-500 to-red-400 text-white'
                      }`}
                    >
                      {isInflow ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <span>{entry.note || (isInflow ? 'Cash Received' : 'Expense Recorded')}</span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.2 rounded-full"
                          style={{
                            backgroundColor: cat.color + '18',
                            color: cat.color,
                          }}
                        >
                          {cat.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          {new Date(entry.entry_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        <span>•</span>
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {entry.mode}
                        </span>
                        {acc && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                              {acc.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`font-black text-sm tabular-nums ${
                      isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
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

      {/* Transaction Detail Popup Modal */}
      <TransactionDetailModal
        entry={selectedEntryForDetail}
        onClose={() => setSelectedEntryForDetail(null)}
      />
    </div>
  );
}
