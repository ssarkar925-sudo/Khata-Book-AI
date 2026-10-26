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
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Eye,
  Wallet,
  ChevronRight,
  Info,
  Sparkles,
} from 'lucide-react';
import { Card, LedgerEntry } from '@/types';
import { formatPaise, parseToPaise, paiseToRupees } from '@/lib/money';
import { useCardStore } from '@/stores/useCardStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { syncEngine } from '@/lib/syncEngine';
import { CardDetailModal } from '@/components/modals/CardDetailModal';
import {
  calculateCardBilling,
  calculateAllCardsBillingReport,
  CardBillingSummary,
} from '@/lib/cardBilling';

export function CardsScreen() {
  const { cards, addCardOptimistic } = useCardStore();
  const { entries: ledger } = useLedgerStore();
  const { accounts, updateAccountBalance } = useAccountStore();
  const { activeWorkspaceId, theme, user } = useSessionStore();
  const isLight = theme === 'light';

  // Active view: 'cards' or 'report'
  const [activeTab, setActiveTab] = useState<'cards' | 'report'>('cards');
  const [selectedCardForDetail, setSelectedCardForDetail] = useState<Card | null>(null);

  // Billing Report calculation across all cards
  const billingReport = calculateAllCardsBillingReport(cards, ledger);

  // New Card State
  const [showAddModal, setShowAddModal] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [last4, setLast4] = useState('');
  const [limitRupees, setLimitRupees] = useState('');
  const [statementDay, setStatementDay] = useState('15');
  const [dueDay, setDueDay] = useState('5');

  // Spend State
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [spendCardId, setSpendCardId] = useState('');
  const [spendAmountRupees, setSpendAmountRupees] = useState('');
  const [spendCategory, setSpendCategory] = useState('Shopping');
  const [spendMerchant, setSpendMerchant] = useState('');

  // Bill Payment State
  const [showPayBillModal, setShowPayBillModal] = useState(false);
  const [payCardId, setPayCardId] = useState('');
  const [payOption, setPayOption] = useState<'billed' | 'total' | 'custom'>('billed');
  const [payAmountRupees, setPayAmountRupees] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [payNote, setPayNote] = useState('');

  const cardGradients = [
    'from-indigo-600 via-purple-600 to-slate-900',
    'from-amber-600 via-orange-600 to-slate-900',
    'from-teal-600 via-emerald-600 to-slate-900',
    'from-rose-600 via-pink-600 to-slate-900',
    'from-blue-600 via-cyan-600 to-slate-900',
  ];

  // Helper when opening Pay Bill modal for a specific card
  const openPayModalForCard = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const summary = calculateCardBilling(card, ledger);
    setPayCardId(cardId);

    // If there is billed due, default to billed amount; otherwise total outstanding
    if (summary.billedDue > 0) {
      setPayOption('billed');
      setPayAmountRupees(paiseToRupees(summary.billedDue).toString());
    } else if (summary.totalOutstanding > 0) {
      setPayOption('total');
      setPayAmountRupees(paiseToRupees(summary.totalOutstanding).toString());
    } else {
      setPayOption('custom');
      setPayAmountRupees('');
    }

    if (accounts.length > 0 && !payAccountId) {
      setPayAccountId(accounts[0].id);
    }
    setShowPayBillModal(true);
  };

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
      statement_day: parseInt(statementDay, 10) || 15,
      due_day: parseInt(dueDay, 10) || 5,
      is_active: true,
    };

    syncEngine.pushCard(newCard);
    setShowAddModal(false);
    setCardName('');
    setCardBank('');
    setLast4('');
    setLimitRupees('');
    setStatementDay('15');
    setDueDay('5');
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
    const summary = selectedCard ? calculateCardBilling(selectedCard, ledger) : null;

    // Check if this payment exceeds billed amount to label note accurately
    let paymentLabel = 'Bill Payment';
    if (summary && paise > summary.billedDue) {
      paymentLabel = summary.billedDue > 0 ? 'Bill & Advance Payment' : 'Advance Payment';
    }

    const selectedAccount = accounts.find((a) => a.id === payAccountId);

    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: 'bill_payment',
      amount: paise,
      card_id: payCardId,
      mode: selectedAccount ? 'bank' : 'cash',
      note: `${paymentLabel} - ${selectedCard?.name || 'Card'} (${payNote.trim() || selectedAccount?.name || 'Direct Bank Settlement'})`,
      entry_date: new Date().toISOString(),
      created_by: user?.id || 'owner',
    };

    // Deduct from paying account if selected
    if (selectedAccount) {
      const newBal = Math.max(0, selectedAccount.balance - paise);
      updateAccountBalance(selectedAccount.id, newBal);
      syncEngine.updateAccountBalance(selectedAccount.id, newBal);
    }

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
            <span>Credit Cards & Billed System</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track Billed Statement dues, unbilled current spends, advance payments & due reminders.
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
                onClick={() => openPayModalForCard(cards[0].id)}
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

      {/* 3 Core Metric KPI Cards: Billed Due vs Unbilled Spends vs Advance / Available */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Billed Statement Due */}
        <div
          className={`p-5 rounded-3xl border transition-all ${
            billingReport.totalBilledDue > 0
              ? 'bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent border-rose-500/30'
              : isLight
              ? 'bg-white border-slate-200'
              : 'bg-slate-900 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Billed Statement Due
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300">
              Pay by Due Date
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 tabular-nums">
            {formatPaise(billingReport.totalBilledDue)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-rose-500/10">
            <span>
              {billingReport.urgentCardsCount > 0
                ? `🚨 ${billingReport.urgentCardsCount} card(s) require payment`
                : billingReport.totalBilledDue > 0
                ? 'Statement generated'
                : '✅ All statement bills paid'}
            </span>
            {billingReport.totalBilledDue > 0 && (
              <button
                onClick={() => {
                  const firstDueCard = billingReport.cardSummaries.find((s) => s.billedDue > 0);
                  if (firstDueCard) openPayModalForCard(firstDueCard.card.id);
                }}
                className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
              >
                Pay Now &gt;
              </button>
            )}
          </div>
        </div>

        {/* KPI 2: Unbilled Spends */}
        <div
          className={`p-5 rounded-3xl border transition-all ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Unbilled Spends
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300">
              Future Cycle
            </span>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2 tabular-nums">
            {formatPaise(billingReport.totalUnbilledSpends)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
            Spends made after bill date. Will generate on next statement cycle.
          </p>
        </div>

        {/* KPI 3: Advance Payments & Available Limit */}
        <div
          className={`p-5 rounded-3xl border transition-all ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Available Credit Limit
            </span>
            {billingReport.totalAdvancePayments > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                +{formatPaise(billingReport.totalAdvancePayments)} Advance
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {formatPaise(billingReport.totalAvailableCredit)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
            <span>Total Limit: {formatPaise(billingReport.totalCreditLimit)}</span>
            <span className="text-slate-400 font-mono">
              {billingReport.totalCreditLimit > 0
                ? `${Math.round(
                    (billingReport.totalOutstanding / billingReport.totalCreditLimit) * 100
                  )}% used`
                : '0% used'}
            </span>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs: Cards Grid vs Systematic Report */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab('cards')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'cards'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>My Cards ({cards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'report'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Billed & Unbilled Report</span>
            {billingReport.urgentCardsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>

        <span className="text-xs text-slate-400 hidden sm:inline-block">
          {activeTab === 'cards'
            ? 'Interactive credit card view with live billing cycles'
            : 'Unified Billed vs Unbilled statement breakdown across all cards'}
        </span>
      </div>

      {/* TAB 1: Cards Grid View */}
      {activeTab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.length === 0 ? (
            <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto">
                <CreditCard className="w-6 h-6" />
              </div>
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                No credit cards added yet.
              </p>
              <p className="text-[11px]">
                Click &quot;Add Card&quot; to manage billing cycles, statement cutoff dates, and bill payments.
              </p>
            </div>
          ) : (
            billingReport.cardSummaries.map((summary, idx) => {
              const card = summary.card;
              const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              });

              // Status badges & colors
              let badgeColor = 'bg-slate-500/20 text-slate-300';
              let badgeText = `Bill: ${summary.statementDay}th • Due: ${formattedDueDate}`;

              if (summary.status === 'overdue') {
                badgeColor = 'bg-rose-500 text-white animate-pulse';
                badgeText = `⚠️ Overdue by ${Math.abs(summary.daysUntilDue)}d (${formattedDueDate})`;
              } else if (summary.status === 'urgent') {
                badgeColor = 'bg-amber-400 text-slate-900 font-black';
                badgeText = `🚨 Due in ${summary.daysUntilDue}d (${formattedDueDate})`;
              } else if (summary.status === 'due') {
                badgeColor = 'bg-rose-500/30 text-rose-200 border border-rose-400/30';
                badgeText = `📅 Due ${formattedDueDate} (${summary.daysUntilDue}d left)`;
              } else if (summary.status === 'unbilled_only') {
                badgeColor = 'bg-purple-500/30 text-purple-200';
                badgeText = `🗓️ Next Bill: ${summary.nextStatementDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}`;
              } else if (summary.status === 'advance_credit') {
                badgeColor = 'bg-emerald-500 text-white font-black';
                badgeText = `🟢 Advance Balance: ${formatPaise(summary.advanceCredit)}`;
              } else {
                badgeColor = 'bg-emerald-500/30 text-emerald-200';
                badgeText = `✅ Bill Cleared`;
              }

              const utilization = Math.min(
                100,
                Math.round((summary.totalOutstanding / card.credit_limit) * 100)
              ) || 0;

              return (
                <div
                  key={card.id}
                  className={`rounded-3xl p-5 bg-gradient-to-br ${
                    cardGradients[idx % cardGradients.length]
                  } text-white shadow-xl hover-lift space-y-4 relative overflow-hidden transition-all flex flex-col justify-between`}
                >
                  {/* Card Header */}
                  <div>
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

                    <div className="flex items-center justify-between mt-2">
                      <div className="font-mono text-xs tracking-widest text-white/90">
                        •••• •••• •••• {card.last4}
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>
                  </div>

                  {/* Billed vs Unbilled Dual Metric Display */}
                  <div className="p-3 rounded-2xl bg-black/25 backdrop-blur-xs border border-white/10 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Billed Due */}
                      <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                        <span className="text-[10px] text-rose-200 uppercase font-bold block">
                          🔴 Billed Due
                        </span>
                        <span className="font-black text-base text-white tabular-nums">
                          {formatPaise(summary.billedDue)}
                        </span>
                        <span className="text-[9px] text-rose-200/80 block mt-0.5">
                          {summary.billedDue > 0 ? `Pay by ${formattedDueDate}` : 'No bill due'}
                        </span>
                      </div>

                      {/* Unbilled Spends */}
                      <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
                        <span className="text-[10px] text-purple-200 uppercase font-bold block">
                          🟣 Unbilled Spends
                        </span>
                        <span className="font-black text-base text-white tabular-nums">
                          {formatPaise(summary.netUnbilled)}
                        </span>
                        <span className="text-[9px] text-purple-200/80 block mt-0.5">
                          Bills next cycle
                        </span>
                      </div>
                    </div>

                    {/* Advance balance note if any */}
                    {summary.advancePayments > 0 && (
                      <div className="text-[10px] text-emerald-300 flex items-center justify-between pt-1 border-t border-white/10 font-medium">
                        <span>Advance Paid: {formatPaise(summary.advancePayments)}</span>
                        <span>Credit: {formatPaise(summary.advanceCredit)}</span>
                      </div>
                    )}

                    {/* Utilization Progress Bar with 30% safety mark */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[10px] text-white/70 font-semibold mb-1">
                        <span>Limit: {formatPaise(card.credit_limit)}</span>
                        <span>
                          Avail: <strong className="text-emerald-300">{formatPaise(summary.availableCredit)}</strong> ({utilization}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${utilization}%` }}
                          className={`h-full transition-all ${
                            utilization > 50
                              ? 'bg-rose-400'
                              : utilization > 30
                              ? 'bg-amber-300'
                              : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSpendCardId(card.id);
                        setShowSpendModal(true);
                      }}
                      className="flex-1 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all touch-press"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Swipe</span>
                    </button>

                    <button
                      onClick={() => openPayModalForCard(card.id)}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all touch-press ${
                        summary.billedDue > 0
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{summary.billedDue > 0 ? 'Pay Bill' : 'Advance Pay'}</span>
                    </button>

                    <button
                      onClick={() => setSelectedCardForDetail(card)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
                      title="View Statement & History"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: Systematic Billed & Unbilled Report Table */}
      {activeTab === 'report' && (
        <div
          className={`rounded-3xl border overflow-hidden transition-all ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
          }`}
        >
          <div className="p-5 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-500" />
                <span>All Cards Billed & Unbilled Statement Report</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Clear separation of current statement dues vs upcoming billing cycle spends.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Billed = Pay Immediately
              </span>
              <span className="flex items-center gap-1 text-purple-500 font-bold">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Unbilled = Next Cycle
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-white/5">
                <tr>
                  <th className="py-3 px-4">Card & Issuer</th>
                  <th className="py-3 px-4">Statement Date</th>
                  <th className="py-3 px-4">Payment Due Date</th>
                  <th className="py-3 px-4 text-right">🔴 Billed Due (Must Pay)</th>
                  <th className="py-3 px-4 text-right">🟣 Unbilled Spends</th>
                  <th className="py-3 px-4 text-right">🟢 Advance Credit</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {billingReport.cardSummaries.map((summary) => {
                  const card = summary.card;
                  const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <tr
                      key={card.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {card.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {card.bank} •••• {card.last4}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                        {summary.statementDay}th of month
                        <div className="text-[10px] text-slate-400">
                          Last: {summary.lastStatementDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {formattedDueDate}
                        </div>
                        <div
                          className={`text-[10px] font-bold ${
                            summary.isOverdue
                              ? 'text-rose-500'
                              : summary.daysUntilDue <= 3
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}
                        >
                          {summary.isOverdue
                            ? `⚠️ Overdue by ${Math.abs(summary.daysUntilDue)} days`
                            : summary.daysUntilDue === 0
                            ? '🚨 Due today'
                            : `${summary.daysUntilDue} days left`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-black text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                          {formatPaise(summary.billedDue)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Total Billed: {formatPaise(summary.billedSpends)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-sm text-purple-600 dark:text-purple-400 tabular-nums">
                          {formatPaise(summary.netUnbilled)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {summary.unbilledSpendsList.length} swipe(s)
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatPaise(summary.advanceCredit)}
                        </div>
                        {summary.advancePayments > 0 && (
                          <div className="text-[10px] text-slate-400">
                            Paid: {formatPaise(summary.advancePayments)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            summary.status === 'overdue'
                              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                              : summary.status === 'urgent'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : summary.status === 'due'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : summary.status === 'advance_credit'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {summary.status === 'overdue' && '⚠️ Overdue'}
                          {summary.status === 'urgent' && '🚨 Urgent Due'}
                          {summary.status === 'due' && '📅 Due Soon'}
                          {summary.status === 'unbilled_only' && '🗓️ Unbilled Only'}
                          {summary.status === 'advance_credit' && '🟢 In Advance'}
                          {summary.status === 'cleared' && '✅ All Cleared'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => openPayModalForCard(card.id)}
                          className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs shadow-xs transition-all hover-lift"
                        >
                          {summary.billedDue > 0 ? 'Pay Due' : 'Advance'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
            <span>
              💡 <strong>Systematic Reminder Logic:</strong> Transactions made on or before your statement cutoff are Billed and must be settled by the Due Date. Transactions after the bill date are categorized as Unbilled and bill in the subsequent cycle. Any excess payment automatically applies to unbilled spends or turns into Advance Credit.
            </span>
          </div>
        </div>
      )}

      {/* Card Detail Popup Modal */}
      <CardDetailModal
        card={selectedCardForDetail}
        onClose={() => setSelectedCardForDetail(null)}
        onRecordSpend={() => {
          if (selectedCardForDetail) setSpendCardId(selectedCardForDetail.id);
          setShowSpendModal(true);
        }}
        onPayBill={() => {
          if (selectedCardForDetail) openPayModalForCard(selectedCardForDetail.id);
        }}
      />

      {/* Modal: Add Card */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-500" />
                <span>Add Credit Card</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Card Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Regalia, SBI SimplyClick, ICICI Amazon Pay"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Bank Issuer
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, SBI, ICICI, Axis"
                  value={cardBank}
                  onChange={(e) => setCardBank(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={last4}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Statement Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                    title="Day of month when statement is generated"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Due Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                    title="Payment due date (typically statement day + 20 days)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Total Credit Limit (₹)
                </label>
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

      {/* Modal: Record Card Spend (Swipe) */}
      {showSpendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-500" />
                <span>Record Card Spend (Swipe)</span>
              </h3>
              <button
                onClick={() => setShowSpendModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSpend} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select Card
                </label>
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={spendAmountRupees}
                  onChange={(e) => setSpendAmountRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Spend Category
                </label>
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Merchant / Store Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amazon, Zomato, Reliance Smart, Petrol Pump"
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

      {/* Modal: Pay Card Bill with Billed vs Total vs Advance Choice */}
      {showPayBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Pay Credit Card Bill</span>
              </h3>
              <button
                onClick={() => setShowPayBillModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayBill} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Card to Pay
                </label>
                <select
                  value={payCardId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setPayCardId(cId);
                    const selCard = cards.find((c) => c.id === cId);
                    if (selCard) {
                      const sum = calculateCardBilling(selCard, ledger);
                      if (sum.billedDue > 0) {
                        setPayOption('billed');
                        setPayAmountRupees(paiseToRupees(sum.billedDue).toString());
                      } else {
                        setPayOption('total');
                        setPayAmountRupees(paiseToRupees(sum.totalOutstanding).toString());
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      {c.name} (•••• {c.last4})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Statement Summary for the Selected Card */}
              {(() => {
                const selectedCard = cards.find((c) => c.id === payCardId);
                if (!selectedCard) return null;
                const summary = calculateCardBilling(selectedCard, ledger);
                const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-500 dark:text-slate-400">Statement Cutoff</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {summary.statementDay}th of month
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-500 dark:text-slate-400">Payment Due Date</span>
                      <span className="font-bold text-rose-500">
                        {formattedDueDate} ({summary.daysUntilDue}d left)
                      </span>
                    </div>

                    {/* Quick 3-Way Payment Selection Options */}
                    <div className="pt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPayOption('billed');
                          setPayAmountRupees(paiseToRupees(summary.billedDue).toString());
                        }}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          payOption === 'billed'
                            ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400'
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-[9px] uppercase font-bold block">1. Billed Due</span>
                        <span className="font-black text-xs tabular-nums block mt-0.5">
                          {formatPaise(summary.billedDue)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayOption('total');
                          setPayAmountRupees(paiseToRupees(summary.totalOutstanding).toString());
                        }}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          payOption === 'total'
                            ? 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400'
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-[9px] uppercase font-bold block">2. Total Owed</span>
                        <span className="font-black text-xs tabular-nums block mt-0.5">
                          {formatPaise(summary.totalOutstanding)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayOption('custom');
                        }}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          payOption === 'custom'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-[9px] uppercase font-bold block">3. Advance / Custom</span>
                        <span className="font-bold text-[11px] block mt-0.5">Custom</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={payAmountRupees}
                  onChange={(e) => setPayAmountRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-900 dark:text-white font-black"
                />
              </div>

              {/* Pay From Account */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Deduct From Account
                </label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="">Do not deduct from bank balance</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id} className="dark:bg-slate-900">
                      {acc.name} (Balance: {formatPaise(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Remarks / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Full settlement via Netbanking / UPI"
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
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}