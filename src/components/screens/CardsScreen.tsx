'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Calendar,
  X,
  Wifi,
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

  const cardGradients = [
    'from-indigo-600 via-purple-600 to-slate-900',
    'from-amber-600 via-orange-600 to-slate-900',
    'from-teal-600 via-emerald-600 to-slate-900',
    'from-rose-600 via-pink-600 to-slate-900',
    'from-blue-600 via-cyan-600 to-slate-900',
  ];

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/25">
              <CreditCard className="w-5 h-5" />
            </div>
            <span>Credit Cards & Billing</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track credit limits, billing statement cycles, and available headroom.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 font-bold text-white text-xs shadow-lg shadow-purple-500/25 transition-all hover-lift touch-press"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credit Card</span>
        </button>
      </div>

      {/* Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.length === 0 ? (
          <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">No credit cards added yet.</p>
            <p className="text-[11px]">Click &quot;Add Credit Card&quot; to monitor your billing cycles and spending limits.</p>
          </div>
        ) : (
          cards.map((card, idx) => (
            <div
              key={card.id}
              className={`rounded-3xl p-6 bg-gradient-to-br ${
                cardGradients[idx % cardGradients.length]
              } text-white shadow-xl hover-lift space-y-5 relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                    {card.bank}
                  </span>
                  <h3 className="font-black text-base text-white">{card.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-white/60 rotate-90" />
                  <div className="w-9 h-7 rounded-md bg-amber-400/80 border border-amber-300 flex items-center justify-center">
                    <div className="w-5 h-4 border border-amber-600/40 rounded-xs" />
                  </div>
                </div>
              </div>

              <div className="font-mono text-sm tracking-widest text-white/90 pt-1">
                •••• •••• •••• {card.last4}
              </div>

              <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-white/70 uppercase tracking-wider block font-semibold">Credit Limit</span>
                  <span className="font-black text-sm text-white tabular-nums">
                    {formatPaise(card.credit_limit)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/70 uppercase tracking-wider block font-semibold">Cutoff Cycle</span>
                  <span className="font-bold text-xs text-white">
                    {card.statement_day}th of month
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add Card */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Credit Card</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Card Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Millennia, SBI Cashback"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bank Issuer</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, ICICI"
                  value={cardBank}
                  onChange={(e) => setCardBank(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={last4}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Statement Day</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Credit Limit (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={limitRupees}
                  onChange={(e) => setLimitRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold text-xs shadow-md shadow-purple-500/25"
                >
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
