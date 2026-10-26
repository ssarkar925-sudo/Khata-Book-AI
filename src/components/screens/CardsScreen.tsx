'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Calendar,
  X,
  Wifi,
  ArrowUpRight,
  CheckCircle2,
  TrendingDown,
  ShoppingBag,
} from 'lucide-react';
import { Card, LedgerEntry } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { useCardStore } from '@/stores/useCardStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { syncEngine } from '@/lib/syncEngine';
import { CardDetailModal } from '@/components/modals/CardDetailModal';

export function CardsScreen() {
  const { cards, addCardOptimistic } = useCardStore();
  const { entries: ledger, addEntryOptimistic } = useLedgerStore();
  const { activeWorkspaceId, theme, user } = useSessionStore();
  const isLight = theme === 'light';

  const [selectedCardForDetail, setSelectedCardForDetail] = useState<Card | null>(null);

  // New Card State
  const [showAddModal, setShowAddModal] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [last4, setLast4] = useState('');
  const [limitRupees, setLimitRupees] = useState('');
  const [statementDay, setStatementDay] = useState('15');

  // Spend State
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [spendCardId, setSpendCardId] = useState('');
  const [spendAmountRupees, setSpendAmountRupees] = useState('');
  const [spendCategory, setSpendCategory] = useState('Shopping');
  const [spendMerchant, setSpendMerchant] = useState('');

  // Bill Payment State
  const [showPayBillModal, setShowPayBillModal] = useState(false);
  const [payCardId, setPayCardId] = useState('');
  const [payAmountRupees, setPayAmountRupees] = useState('');
  const [payNote, setPayNote] = useState('');

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

    syncEngine.pushCard(newCard);
    setShowAddModal(false);
    setCardName('');
    setCardBank('');
    setLast4('');
    setLimitRupees('');
  };

  const handleRecordSpend = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(spendAmountRupees);
    if (paise <= 0 || !spendCardId) return;

    const selectedCard = cards.find((c) => c.id === spendCardId);
    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: 'card_spend',
      amount: paise,
      card_id: spendCardId,
      mode: 'card',
      note: `${spendCategory} - ${spendMerchant.trim() || selectedCard?.name || 'Card Swipe'}`,
      entry_date: new Date().toISOString(),
      created_by: user?.id || 'owner',
    };

    syncEngine.pushLedgerEntry(entry);
    setShowSpendModal(false);
    setSpendAmountRupees('');
    setSpendMerchant('');
  };

  const handlePayBill = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(payAmountRupees);
    if (paise <= 0 || !payCardId) return;

    const selectedCard = cards.find((c) => c.id === payCardId);
    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: 'bill_payment',
      amount: paise,
      card_id: payCardId,
      mode: 'bank',
      note: `Bill Payment - ${selectedCard?.name || 'Card'} (${payNote || 'Full / Part'})`,
      entry_date: new Date().toISOString(),
      created_by: user?.id || 'owner',
    };

    syncEngine.pushLedgerEntry(entry);
    setShowPayBillModal(false);
    setPayAmountRupees('');
    setPayNote('');
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
            Track credit limits, card swipe spends, statement cycles, and bill payments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cards.length > 0 && (
            <>
              <button
                onClick={() => {
                  setSpendCardId(cards[0].id);
                  setShowSpendModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 font-bold text-white text-xs shadow-md shadow-rose-500/25 transition-all hover-lift touch-press"
              >
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                <span>Swipe (Spend)</span>
              </button>

              <button
                onClick={() => {
                  setPayCardId(cards[0].id);
                  setShowPayBillModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-bold text-white text-xs shadow-md shadow-emerald-500/25 transition-all hover-lift touch-press"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Pay Bill</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 font-bold text-white text-xs shadow-lg shadow-purple-500/25 transition-all hover-lift touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>Add Card</span>
          </button>
        </div>
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
          cards.map((card, idx) => {
            const cardSpends = ledger.filter((e) => e.card_id === card.id && e.type === 'card_spend');
            const cardPayments = ledger.filter((e) => e.card_id === card.id && e.type === 'bill_payment');
            const totalSpent = cardSpends.reduce((s, e) => s + Number(e.amount), 0);
            const totalPaid = cardPayments.reduce((s, e) => s + Number(e.amount), 0);
            const outstanding = Math.max(0, totalSpent - totalPaid);
            const available = Math.max(0, card.credit_limit - outstanding);

            return (
              <div
                key={card.id}
                onClick={() => setSelectedCardForDetail(card)}
                className={`cursor-pointer rounded-3xl p-6 bg-gradient-to-br ${
                  cardGradients[idx % cardGradients.length]
                } text-white shadow-xl hover-lift space-y-5 relative overflow-hidden transition-all`}
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

                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm tracking-widest text-white/90">
                    •••• •••• •••• {card.last4}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20">
                    Tap for details &gt;
                  </span>
                </div>

                <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-white/70 uppercase tracking-wider block font-semibold">Available Limit</span>
                    <span className="font-black text-sm text-emerald-300 tabular-nums">
                      {formatPaise(available)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-white/70 uppercase tracking-wider block font-semibold">Current Due</span>
                    <span className="font-black text-sm text-rose-300 tabular-nums">
                      {formatPaise(outstanding)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Card Detail Popup Modal */}
      <CardDetailModal
        card={selectedCardForDetail}
        onClose={() => setSelectedCardForDetail(null)}
        onRecordSpend={() => {
          if (selectedCardForDetail) setSpendCardId(selectedCardForDetail.id);
          setShowSpendModal(true);
        }}
        onPayBill={() => {
          if (selectedCardForDetail) setPayCardId(selectedCardForDetail.id);
          setShowPayBillModal(true);
        }}
      />

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
                  placeholder="e.g. HDFC Millennia, SBI SimplyClick"
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

      {/* Modal: Record Card Spend */}
      {showSpendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Record Card Spend (Swipe)</h3>
              <button onClick={() => setShowSpendModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSpend} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Select Card</label>
                <select
                  value={spendCardId}
                  onChange={(e) => setSpendCardId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      {c.name} (•••• {c.last4})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={spendAmountRupees}
                  onChange={(e) => setSpendAmountRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Spend Category</label>
                <select
                  value={spendCategory}
                  onChange={(e) => setSpendCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="Shopping">🛍️ Shopping & Retail</option>
                  <option value="Dining">🍽️ Food & Dining</option>
                  <option value="Groceries">🛒 Groceries & Supermarket</option>
                  <option value="Fuel">⛽ Fuel & Travel</option>
                  <option value="Utilities">💡 Utilities & Bills</option>
                  <option value="Electronics">💻 Electronics & Gadgets</option>
                  <option value="Other">📦 Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Merchant / Store Name</label>
                <input
                  type="text"
                  placeholder="e.g. Amazon, Zomato, Reliance Smart"
                  value={spendMerchant}
                  onChange={(e) => setSpendMerchant(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSpendModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold text-xs shadow-md shadow-rose-500/25"
                >
                  Save Spend
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pay Card Bill */}
      {showPayBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Pay Credit Card Bill</h3>
              <button onClick={() => setShowPayBillModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayBill} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Card to Pay</label>
                <select
                  value={payCardId}
                  onChange={(e) => setPayCardId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      {c.name} (•••• {c.last4})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={payAmountRupees}
                  onChange={(e) => setPayAmountRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Minimum due paid, Full settlement via Netbanking"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayBillModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/25"
                >
                  Record Bill Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
