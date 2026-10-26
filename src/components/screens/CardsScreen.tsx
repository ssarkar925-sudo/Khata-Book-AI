'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Calendar,
  AlertCircle,
  X,
  TrendingDown,
} from 'lucide-react';
import { Card } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';

export function CardsScreen() {
  const { cards, addCardOptimistic } = useCardStore();
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const [showAddModal, setShowAddModal] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [last4, setLast4] = useState('');
  const [limitRupees, setLimitRupees] = useState('');
  const [statementDay, setStatementDay] = useState('15');

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || last4.length !== 4) return;

    const newCard: Card = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      name: cardName.trim(),
      bank: cardBank.trim() || 'Bank',
      last4: last4.trim(),
      credit_limit: parseToPaise(limitRupees),
      statement_day: parseInt(statementDay, 10) || 1,
      is_active: true,
    };

    addCardOptimistic(newCard);
    setShowAddModal(false);
    setCardName('');
    setCardBank('');
    setLast4('');
    setLimitRupees('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            <span>Credit Cards & Billing</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track credit limits, billing statement cut dates, and monthly swipe dues.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold text-white text-xs shadow-md shadow-indigo-500/20 transition-all touch-press"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credit Card</span>
        </button>
      </div>

      {/* Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.length === 0 ? (
          <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400">
            No credit cards added yet. Click <span className="font-bold text-indigo-500">+ Add Credit Card</span> above to track your limits and billing cycles.
          </div>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              className="rounded-3xl p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/20 shadow-xl space-y-4 hover-lift"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                    {card.bank}
                  </span>
                  <h3 className="font-bold text-base text-white">{card.name}</h3>
                </div>
                <div className="p-2 rounded-xl bg-white/10">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                </div>
              </div>

              <div className="flex items-center justify-between font-mono text-xs text-slate-300">
                <span>•••• •••• •••• {card.last4}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">
                  Bill Day: {card.statement_day}th
                </span>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Limit</span>
                  <span className="text-sm font-bold tabular-nums">{formatPaise(card.credit_limit)}</span>
                </div>
                <span className="text-xs text-emerald-400 font-bold">Active</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add Card */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Credit Card</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Card Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Millennia, ICICI Amazon Pay"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Bank Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC, SBI"
                    value={cardBank}
                    onChange={(e) => setCardBank(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="e.g. 4082"
                    value={last4}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Total Limit (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150000"
                    value={limitRupees}
                    onChange={(e) => setLimitRupees(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Statement Day</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                Add Card
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
