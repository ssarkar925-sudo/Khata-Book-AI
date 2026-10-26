'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Calendar,
  X,
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-zinc-500" />
            <span>Credit Cards</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor credit card limits and statement cutoff cycles.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium text-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Card</span>
        </button>
      </div>

      {/* Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.length === 0 ? (
          <div className="col-span-full text-center py-12 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-xs text-zinc-400 space-y-1">
            <p>No credit cards configured.</p>
            <p className="text-[11px] text-zinc-500">Click &quot;Add Card&quot; to manage your billing and limits.</p>
          </div>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              className={`rounded-xl border p-4 space-y-3 transition-colors ${
                isLight ? 'bg-white border-zinc-200' : 'bg-[#121215] border-zinc-800/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    {card.bank}
                  </span>
                  <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{card.name}</h3>
                </div>
                <CreditCard className="w-4 h-4 text-zinc-400" />
              </div>

              <div className="font-mono text-xs text-zinc-400">
                •••• •••• •••• {card.last4}
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Credit Limit</span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {formatPaise(card.credit_limit)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Cutoff Day</span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {card.statement_day}th / month
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add Card */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">New Credit Card</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Card Name / Nickname</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Regalia, SBI SimplyClick"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Bank Issuer</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, ICICI"
                  value={cardBank}
                  onChange={(e) => setCardBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={last4}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Bill Date (Day)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Total Limit (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={limitRupees}
                  onChange={(e) => setLimitRupees(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors"
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
