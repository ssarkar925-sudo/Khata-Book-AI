'use client';

import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Plus,
  ArrowUpRight,
  TrendingDown,
  Calendar,
  CheckCircle2,
  DollarSign,
  Receipt,
  Clock,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRightLeft,
  Trash2,
  Edit3,
  Share2,
  Check,
} from 'lucide-react';
import { Card, LedgerEntry } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { calculateCardBilling } from '@/lib/cardBilling';
import { syncEngine } from '@/lib/syncEngine';

interface CardDetailModalProps {
  card: Card | null;
  onClose: () => void;
  onRecordSpend: () => void;
  onPayBill: () => void;
  onEditCard?: (card: Card) => void;
  onDeleteCard?: (cardId: string) => void;
}

export function CardDetailModal({ card, onClose, onRecordSpend, onPayBill, onEditCard, onDeleteCard }: CardDetailModalProps) {
  const { entries: ledger } = useLedgerStore();
  const [filterType, setFilterType] = useState<'all' | 'billed' | 'unbilled' | 'payments'>('all');
  const [copiedReminder, setCopiedReminder] = useState(false);

  if (!card) return null;

  // Calculate systematic Billed & Unbilled metrics
  const summary = calculateCardBilling(card, ledger);
  const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedNextStatement = summary.nextStatementDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

  const utilizationPct = Math.min(
    100,
    Math.round((summary.totalOutstanding / card.credit_limit) * 100)
  ) || 0;

  // Filter transactions based on active tab
  const displayTransactions: { entry: LedgerEntry; isBilled: boolean; isPayment: boolean }[] = [];

  const allCardEntries = ledger
    .filter((e) => e.card_id === card.id && (e.type === 'card_spend' || e.type === 'bill_payment'))
    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

  for (const entry of allCardEntries) {
    const isPayment = entry.type === 'bill_payment';
    const isBilled =
      !isPayment &&
      (entry.is_billed !== undefined
        ? entry.is_billed
        : new Date(entry.entry_date) <= summary.lastStatementDate);

    if (filterType === 'all') {
      displayTransactions.push({ entry, isBilled, isPayment });
    } else if (filterType === 'billed' && isBilled) {
      displayTransactions.push({ entry, isBilled, isPayment });
    } else if (filterType === 'unbilled' && !isBilled && !isPayment) {
      displayTransactions.push({ entry, isBilled, isPayment });
    } else if (filterType === 'payments' && isPayment) {
      displayTransactions.push({ entry, isBilled, isPayment });
    }
  }

  const handleShareReminder = () => {
    const text = `💳 *Credit Card Bill Reminder*\n*Card:* ${card.name} (${card.bank} •••• ${card.last4})\n*🔴 Billed Due:* ${formatPaise(summary.billedDue)}\n*⏰ Due Date:* ${formattedDueDate} (${summary.reminderMessage})\n*🟣 Unbilled Spends:* ${formatPaise(summary.netUnbilled)}\n*🟢 Available Limit:* ${formatPaise(summary.availableCredit)} / ${formatPaise(card.credit_limit)}\n\n_Tracked in Record Book_`;
    if (navigator.share) {
      navigator.share({ title: `${card.name} Payment Reminder`, text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/25">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {card.name}
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {card.bank} •••• {card.last4}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Share WhatsApp Reminder Button */}
            <button
              onClick={handleShareReminder}
              className="p-2 rounded-xl hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-colors"
              title="Share Bill Reminder via WhatsApp / Web Share"
            >
              {copiedReminder ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Edit Card Button */}
            {onEditCard && (
              <button
                onClick={() => {
                  onClose();
                  onEditCard(card);
                }}
                className="p-2 rounded-xl hover:bg-amber-500/10 text-slate-400 hover:text-amber-500 transition-colors"
                title="Edit Card Details (Limit, Dates)"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            {onDeleteCard && (
              <button
                onClick={() => {
                  if (confirm(`Delete card "${card.name}" (${card.bank} •••• ${card.last4})?`)) {
                    onDeleteCard(card.id);
                  }
                }}
                className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                title="Delete this Credit Card"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reminder Status Banner */}
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shrink-0 ${
            summary.status === 'overdue'
              ? 'bg-rose-500 text-white'
              : summary.status === 'urgent'
              ? 'bg-amber-400 text-slate-900'
              : summary.status === 'due'
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              : summary.status === 'advance_credit'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            <span>{summary.reminderMessage}</span>
          </div>

          <div className="text-right shrink-0 pl-2">
            <span className="text-[10px] block opacity-80 uppercase font-semibold">Statement Due</span>
            <span>{formattedDueDate}</span>
          </div>
        </div>

        {/* Billed vs Unbilled KPI Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5 shrink-0">
          {/* Billed Due */}
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                🔴 Billed Due
              </span>
            </div>
            <div className="text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {formatPaise(summary.billedDue)}
            </div>
            <span className="text-[10px] text-slate-400 block">
              Bill date: {summary.statementDay}th
            </span>
          </div>

          {/* Unbilled Spends */}
          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                🟣 Unbilled Spends
              </span>
            </div>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400 tabular-nums">
              {formatPaise(summary.netUnbilled)}
            </div>
            <span className="text-[10px] text-slate-400 block">
              Bills {formattedNextStatement}
            </span>
          </div>

          {/* Available Limit */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                🟢 Available Credit
              </span>
            </div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatPaise(summary.availableCredit)}
            </div>
            <span className="text-[10px] text-slate-400 block">
              Limit: {formatPaise(card.credit_limit)}
            </span>
          </div>
        </div>

        {/* Limit Utilization Progress Bar */}
        <div className="px-1 shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>
              Limit Used: <strong>{formatPaise(summary.totalOutstanding)}</strong> ({utilizationPct}%)
            </span>
            <span>
              {utilizationPct <= 30 ? (
                <span className="text-emerald-500 font-bold">✨ Safe for CIBIL (&lt; 30%)</span>
              ) : (
                <span className="text-amber-500 font-bold">⚠️ High Usage (&gt; 30%)</span>
              )}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              style={{ width: `${utilizationPct}%` }}
              className={`h-full transition-all duration-500 ${
                utilizationPct > 60
                  ? 'bg-rose-500'
                  : utilizationPct > 30
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
          </div>
        </div>

        {/* Action Buttons: Swipe vs Pay Bill */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <button
            onClick={() => {
              onClose();
              onRecordSpend();
            }}
            className="py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/25 transition-all hover-lift"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Record Spend (Swipe)</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onPayBill();
            }}
            className="py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all hover-lift"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {summary.billedDue > 0
                ? `Pay Bill (${formatPaise(summary.billedDue)})`
                : summary.netUnbilled > 0
                ? `Pay Unbilled (${formatPaise(summary.netUnbilled)})`
                : 'Advance Payment'}
            </span>
          </button>
        </div>

        {/* Transaction Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-100 dark:border-white/5 pb-2 shrink-0 overflow-x-auto text-[11px]">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              filterType === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
            }`}
          >
            All ({allCardEntries.length})
          </button>

          <button
            onClick={() => setFilterType('billed')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
              filterType === 'billed'
                ? 'bg-rose-500 text-white'
                : 'text-rose-500 hover:bg-rose-500/10'
            }`}
          >
            <span>🔴 Billed ({summary.billedSpendsList.length})</span>
          </button>

          <button
            onClick={() => setFilterType('unbilled')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
              filterType === 'unbilled'
                ? 'bg-purple-500 text-white'
                : 'text-purple-500 hover:bg-purple-500/10'
            }`}
          >
            <span>🟣 Unbilled ({summary.unbilledSpendsList.length})</span>
          </button>

          <button
            onClick={() => setFilterType('payments')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
              filterType === 'payments'
                ? 'bg-emerald-500 text-white'
                : 'text-emerald-500 hover:bg-emerald-500/10'
            }`}
          >
            <span>🟢 Payments ({summary.paymentsList.length})</span>
          </button>
        </div>

        {/* Spends History on this Card with 1-tap Move to Billed / Move to Unbilled */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {displayTransactions.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              No transactions found in this view.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {displayTransactions.map(({ entry, isBilled, isPayment }) => {
                return (
                  <div key={entry.id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {entry.note || (isPayment ? 'Bill Payment' : 'Card Swipe')}
                      </div>
                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                        <span>{new Date(entry.entry_date).toLocaleDateString()}</span>
                        <span>•</span>
                        {isPayment ? (
                          <span className="font-bold text-emerald-500 px-1.5 py-0.2 rounded-md bg-emerald-500/10">
                            PAYMENT / ADVANCE
                          </span>
                        ) : isBilled ? (
                          <span className="font-bold text-rose-500 px-1.5 py-0.2 rounded-md bg-rose-500/10">
                            🔴 BILLED
                          </span>
                        ) : (
                          <span className="font-bold text-purple-500 px-1.5 py-0.2 rounded-md bg-purple-500/10">
                            🟣 UNBILLED (Next Cycle)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isPayment && (
                        <button
                          onClick={() => {
                            syncEngine.updateLedgerEntry(entry.id, { is_billed: !isBilled });
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            isBilled
                              ? 'border-purple-300 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                              : 'border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                          }`}
                          title={isBilled ? 'Move this spend to Unbilled' : 'Move this spend to Current Billed Due'}
                        >
                          {isBilled ? 'Move to Unbilled' : 'Move to Billed'}
                        </button>
                      )}

                      <div
                        className={`font-black text-sm tabular-nums text-right ${
                          isPayment
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isBilled
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-purple-600 dark:text-purple-400'
                        }`}
                      >
                        {isPayment ? '-' : '+'}{formatPaise(entry.amount)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}