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
} from 'lucide-react';
import { Card, LedgerEntry } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useSessionStore } from '@/stores/useSessionStore';

interface CardDetailModalProps {
  card: Card | null;
  onClose: () => void;
  onRecordSpend: () => void;
  onPayBill: () => void;
}

export function CardDetailModal({ card, onClose, onRecordSpend, onPayBill }: CardDetailModalProps) {
  const { entries: ledger } = useLedgerStore();

  if (!card) return null;

  // Filter transactions for this card
  const cardSpends = ledger.filter((e) => e.card_id === card.id && e.type === 'card_spend');
  const cardPayments = ledger.filter((e) => e.card_id === card.id && e.type === 'bill_payment');

  const totalSpent = cardSpends.reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = cardPayments.reduce((s, e) => s + Number(e.amount), 0);
  const currentOutstanding = Math.max(0, totalSpent - totalPaid);
  const availableCredit = Math.max(0, card.credit_limit - currentOutstanding);

  const utilizationPct = Math.min(100, Math.round((currentOutstanding / card.credit_limit) * 100)) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {card.name} ({card.bank})
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Card ending in •••• {card.last4}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Available Limit & Outstanding Dues */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                Outstanding Balance
              </span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {formatPaise(currentOutstanding)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Available Credit
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatPaise(availableCredit)}
              </span>
            </div>
          </div>

          {/* Limit Utilization Meter */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span>Limit Used ({utilizationPct}%)</span>
              <span>Total Limit: {formatPaise(card.credit_limit)}</span>
            </div>
            <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                style={{ width: `${utilizationPct}%` }}
                className={`h-full transition-all duration-500 ${
                  utilizationPct > 70
                    ? 'bg-rose-500'
                    : utilizationPct > 40
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons: Swipe Card vs Pay Bill */}
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
            <span>Pay Card Bill</span>
          </button>
        </div>

        {/* Spends History on this Card */}
        <div className="flex-1 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Card Spend & Payment History
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Cutoff Day: {card.statement_day}th
            </span>
          </div>

          {[...cardSpends, ...cardPayments].length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No transactions recorded on this card.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {[...cardSpends, ...cardPayments]
                .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
                .map((entry) => {
                  const isPayment = entry.type === 'bill_payment';

                  return (
                    <div key={entry.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {entry.note || (isPayment ? 'Bill Payment' : 'Card Swipe')}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{new Date(entry.entry_date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className={isPayment ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                            {isPayment ? 'PAYMENT' : 'SPEND'}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`font-black text-sm tabular-nums ${
                          isPayment ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPayment ? '-' : '+'}{formatPaise(entry.amount)}
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
