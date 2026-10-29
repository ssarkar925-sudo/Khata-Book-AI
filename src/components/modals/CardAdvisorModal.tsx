'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShoppingBag,
  Utensils,
  Plane,
  Fuel,
  Receipt,
  CreditCard,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { recommendBestCardForSpend } from '@/lib/cardRewards';

interface CardAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  onSelectCardToSpend?: (cardId: string) => void;
}

export function CardAdvisorModal({
  isOpen,
  onClose,
  cards,
  onSelectCardToSpend,
}: CardAdvisorModalProps) {
  const [category, setCategory] = useState<'shopping' | 'dining' | 'travel' | 'fuel' | 'utility' | 'general'>('shopping');
  const [spendRupees, setSpendRupees] = useState<string>('5000');

  if (!isOpen) return null;

  const spendNum = parseFloat(spendRupees) || 0;
  const recommendations = recommendBestCardForSpend(cards, category, spendNum);

  const CATEGORIES = [
    { id: 'shopping' as const, label: 'Shopping / Amazon', icon: ShoppingBag, color: 'text-amber-500 bg-amber-500/10' },
    { id: 'dining' as const, label: 'Dining & Food', icon: Utensils, color: 'text-rose-500 bg-rose-500/10' },
    { id: 'travel' as const, label: 'Travel & Flights', icon: Plane, color: 'text-sky-500 bg-sky-500/10' },
    { id: 'fuel' as const, label: 'Fuel / Petrol', icon: Fuel, color: 'text-orange-500 bg-orange-500/10' },
    { id: 'utility' as const, label: 'Bills & Recharges', icon: Receipt, color: 'text-emerald-500 bg-emerald-500/10' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white shadow-md shadow-amber-500/25">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                Smart Card Swipe Advisor
              </h3>
              <p className="text-xs text-slate-400">
                AI reward optimizer & interest-free window calculator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter controls */}
        <div className="space-y-3 shrink-0">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              1. Select Spend Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-600/10 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              2. Planned Spend Amount (₹)
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                value={spendRupees}
                onChange={(e) => setSpendRupees(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">
                INR (₹)
              </span>
            </div>
          </div>
        </div>

        {/* Recommendations list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Best Cards Ranked For This Swipe
          </label>

          {recommendations.length === 0 ? (
            <div className="text-center py-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-xs text-slate-400">
              No registered cards found. Add your credit cards first to receive recommendations!
            </div>
          ) : (
            recommendations.map((rec) => {
              const isBest = rec.rank === 1;
              return (
                <div
                  key={rec.card.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isBest
                      ? 'border-amber-400/60 bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-transparent shadow-md'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          isBest
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        #{rec.rank}
                      </span>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {rec.card.name}
                      </h4>
                      {rec.card.variant && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {rec.card.variant}
                        </span>
                      )}
                      {rec.card.network && (
                        <span className="text-[9px] font-bold uppercase text-slate-400">
                          • {rec.card.network}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block tabular-nums">
                        +₹{rec.estimatedReturnRupees.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Est. Reward Value
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 font-medium">
                    {rec.recommendationReason}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                    <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {rec.daysInterestFree} days interest-free
                    </span>

                    {onSelectCardToSpend && (
                      <button
                        onClick={() => {
                          onSelectCardToSpend(rec.card.id);
                          onClose();
                        }}
                        className="font-bold text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        <span>Swipe Card</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 shrink-0 border-t border-slate-100 dark:border-white/5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            Close Advisor
          </button>
        </div>
      </div>
    </div>
  );
}
