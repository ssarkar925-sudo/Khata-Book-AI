'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  ArrowUpRight,
  Calendar,
  Store,
  Zap,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  Users,
} from 'lucide-react';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { syncEngine } from '@/lib/syncEngine';
import { parseToPaise, formatPaise } from '@/lib/money';
import { LedgerEntry } from '@/types';

interface CardSpendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToCards?: () => void;
  initialCardId?: string;
}

export function CardSpendModal({
  isOpen,
  onClose,
  onNavigateToCards,
  initialCardId,
}: CardSpendModalProps) {
  const { cards } = useCardStore();
  const { user, activeWorkspaceId, userRole } = useSessionStore();
  const isViewer = userRole === 'viewer';

  const [spendCardId, setSpendCardId] = useState('');
  const [spendAmountRupees, setSpendAmountRupees] = useState('');
  const [spendCategory, setSpendCategory] = useState('Shopping');
  const [spendMerchant, setSpendMerchant] = useState('');
  const [spendDate, setSpendDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [spendBillingOption, setSpendBillingOption] = useState<'auto' | 'billed' | 'unbilled'>('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter to active cards
  const activeCards = cards.filter((c) => c.is_active);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setSpendAmountRupees('');
      setSpendMerchant('');
      setSpendDate(new Date().toISOString().slice(0, 10));
      setSpendBillingOption('auto');

      if (initialCardId && activeCards.some((c) => c.id === initialCardId)) {
        setSpendCardId(initialCardId);
      } else if (activeCards.length > 0) {
        setSpendCardId(activeCards[0].id);
      } else {
        setSpendCardId('');
      }
    }
  }, [isOpen, initialCardId, activeCards.length]);

  if (!isOpen) return null;

  const selectedCard = cards.find((c) => c.id === spendCardId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isViewer) {
      setErrorMsg('Read-only access: Viewer role cannot record transactions.');
      return;
    }

    const paise = parseToPaise(spendAmountRupees);
    if (paise <= 0) {
      setErrorMsg('Please enter a valid spend amount greater than ₹0.');
      return;
    }

    if (!spendCardId) {
      setErrorMsg('Please select a credit card.');
      return;
    }

    setIsSubmitting(true);

    try {
      const isBilledOverride =
        spendBillingOption === 'billed' ? true : spendBillingOption === 'unbilled' ? false : undefined;

      const merchantLabel = spendMerchant.trim();
      const cardLabel = selectedCard ? `${selectedCard.name} (${selectedCard.bank})` : 'Card Swipe';
      const note = merchantLabel ? `${spendCategory} - ${merchantLabel}` : `${spendCategory} - ${cardLabel}`;

      const entry: LedgerEntry = {
        id: crypto.randomUUID(),
        workspace_id: activeWorkspaceId || '00000000-0000-0000-0000-000000000010',
        type: 'card_spend',
        amount: paise,
        card_id: spendCardId,
        mode: 'card',
        scope: selectedCard?.scope || 'business',
        is_billed: isBilledOverride,
        note,
        entry_date: new Date(spendDate + 'T12:00:00Z').toISOString(),
        created_by: user?.id || 'owner',
      };

      await syncEngine.pushLedgerEntry(entry);

      setSuccessMsg(`Card spend of ${formatPaise(paise)} recorded successfully!`);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Failed to record card spend.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <CreditCard className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Spend (Swipe)</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Credit Card
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Record an instant card swipe with smart statement-cycle classification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Empty State: No Active Cards */}
        {activeCards.length === 0 ? (
          <div className="py-10 text-center space-y-4 flex-1 flex flex-col items-center justify-center">
            <div className="p-4 rounded-3xl bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20">
              <CreditCard className="w-10 h-10 stroke-[1.5]" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">No Credit Cards Found</h4>
              <p className="text-xs text-slate-400">
                You must have at least one active credit card to record card swipe transactions.
              </p>
            </div>
            {onNavigateToCards && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToCards();
                }}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Go to Cards & Add Card</span>
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1 mt-4">
            {/* Card Selector with Visual Details */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Select Credit Card
              </label>
              <select
                value={spendCardId}
                onChange={(e) => setSpendCardId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
              >
                {activeCards.map((c) => (
                  <option key={c.id} value={c.id} className="dark:bg-slate-900">
                    {c.name} •••• {c.last4} ({c.bank}) [{c.scope?.toUpperCase() || 'BUSINESS'}]
                  </option>
                ))}
              </select>

              {selectedCard && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span>Scope:</span>
                    <span className="font-bold uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      {selectedCard.scope === 'personal' && <User className="w-3 h-3" />}
                      {selectedCard.scope === 'family' && <Users className="w-3 h-3" />}
                      {(!selectedCard.scope || selectedCard.scope === 'business') && <Building2 className="w-3 h-3" />}
                      {selectedCard.scope || 'business'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <span>Limit:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatPaise(selectedCard.credit_limit)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Amount and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Swipe Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    placeholder="0.00"
                    value={spendAmountRupees}
                    onChange={(e) => setSpendAmountRupees(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white font-black tabular-nums focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Spend Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={spendDate}
                    onChange={(e) => setSpendDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Smart Billing Cycle Classification Choice (Auto by Default) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Billing Cycle Classification
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSpendBillingOption('auto')}
                  className={`p-2.5 rounded-xl text-center border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    spendBillingOption === 'auto'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/30 ring-2 ring-purple-500/30'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Auto Cycle</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSpendBillingOption('billed')}
                  className={`p-2.5 rounded-xl text-center border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    spendBillingOption === 'billed'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/30 ring-2 ring-rose-500/30'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span>🔴 Billed Due</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSpendBillingOption('unbilled')}
                  className={`p-2.5 rounded-xl text-center border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    spendBillingOption === 'unbilled'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-500/30'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span>🟣 Unbilled</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1.5">
                {spendBillingOption === 'auto'
                  ? '⚡ Auto: Automatically classifies based on card statement day vs spend date.'
                  : spendBillingOption === 'billed'
                  ? '🔴 Billed: Adds directly to current statement bill due for immediate settlement.'
                  : '🟣 Unbilled: Classified as current cycle spend rolling into the next statement.'}
              </span>
            </div>

            {/* Category and Merchant */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={spendCategory}
                  onChange={(e) => setSpendCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
                >
                  <option value="Shopping">🛍️ Shopping & Retail</option>
                  <option value="Dining">🍽️ Food & Dining</option>
                  <option value="Groceries">🛒 Groceries & Supermarket</option>
                  <option value="Fuel">⛽ Fuel & Travel</option>
                  <option value="Utilities">💡 Utilities & Bills</option>
                  <option value="Electronics">💻 Electronics & Tech</option>
                  <option value="Entertainment">🎬 Entertainment & OTT</option>
                  <option value="Medical">💊 Medical & Health</option>
                  <option value="Travel">✈️ Flights & Hotels</option>
                  <option value="Other">📦 Other Card Spends</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Merchant / Store Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Amazon, Swiggy, Petrol Pump"
                    value={spendMerchant}
                    onChange={(e) => setSpendMerchant(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isViewer}
                className={`flex-1 py-3 rounded-2xl text-white font-black text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isViewer
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] shadow-purple-600/30'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                <span>{isSubmitting ? 'Recording Spend...' : 'Record Spend (Swipe)'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
