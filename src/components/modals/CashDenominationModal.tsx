'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Coins,
  Share2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Landmark,
  Plus,
  Minus,
  Sparkles,
  Calculator,
} from 'lucide-react';
import { CashLocation } from '@/types';
import { formatPaise, parseToPaise, paiseToRupees } from '@/lib/money';
import { useAccountStore } from '@/stores/useAccountStore';
import { syncEngine } from '@/lib/syncEngine';

interface DenominationConfig {
  value: number;
  label: string;
  type: 'note' | 'coin';
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

const DENOMINATIONS: DenominationConfig[] = [
  {
    value: 500,
    label: '₹500',
    type: 'note',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
  },
  {
    value: 200,
    label: '₹200',
    type: 'note',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-500/30',
  },
  {
    value: 100,
    label: '₹100',
    type: 'note',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
  },
  {
    value: 50,
    label: '₹50',
    type: 'note',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    badgeBorder: 'border-cyan-500/30',
  },
  {
    value: 20,
    label: '₹20',
    type: 'note',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-500/30',
  },
  {
    value: 10,
    label: '₹10',
    type: 'note',
    badgeBg: 'bg-amber-700/15',
    badgeText: 'text-amber-800 dark:text-amber-200',
    badgeBorder: 'border-amber-700/30',
  },
  {
    value: 5,
    label: '₹5',
    type: 'coin',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-500/30',
  },
  {
    value: 2,
    label: '₹2',
    type: 'coin',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-500/30',
  },
  {
    value: 1,
    label: '₹1',
    type: 'coin',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-500/30',
  },
];

interface CashDenominationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetAccount?: CashLocation | null;
}

export function CashDenominationModal({
  isOpen,
  onClose,
  targetAccount,
}: CashDenominationModalProps) {
  const { accounts } = useAccountStore();

  // Find physical cash drawer accounts
  const cashAccounts = accounts.filter(
    (a) => a.account_type === 'cash_counter' || a.name.toLowerCase().includes('cash')
  );
  const activeCashAccounts = cashAccounts.length > 0 ? cashAccounts : accounts;

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [counts, setCounts] = useState<Record<number, number>>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  });
  const [looseRupees, setLooseRupees] = useState('');
  const [closingRemark, setClosingRemark] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Initialize selected account
  useEffect(() => {
    if (isOpen) {
      if (targetAccount) {
        setSelectedAccountId(targetAccount.id);
      } else if (activeCashAccounts.length > 0) {
        setSelectedAccountId(activeCashAccounts[0].id);
      }
      setSyncSuccess(false);
    }
  }, [isOpen, targetAccount, activeCashAccounts]);

  if (!isOpen) return null;

  const currentAccount = accounts.find((a) => a.id === selectedAccountId);
  const expectedPaise = currentAccount ? currentAccount.balance : 0;

  // Calculate totals
  let totalNotesCount = 0;
  let totalCoinsCount = 0;
  let totalDenominationPaise = 0;

  DENOMINATIONS.forEach((d) => {
    const qty = counts[d.value] || 0;
    if (d.type === 'note') totalNotesCount += qty;
    else totalCoinsCount += qty;
    totalDenominationPaise += qty * d.value * 100;
  });

  const loosePaise = parseToPaise(looseRupees);
  const totalCountedPaise = totalDenominationPaise + loosePaise;
  const differencePaise = totalCountedPaise - expectedPaise;

  const handleCountChange = (val: number, newCount: number) => {
    const safeCount = Math.max(0, Math.floor(newCount || 0));
    setCounts((prev) => ({ ...prev, [val]: safeCount }));
  };

  const handleStepCount = (val: number, delta: number) => {
    const current = counts[val] || 0;
    handleCountChange(val, current + delta);
  };

  const handleReset = () => {
    setCounts({
      500: 0,
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      2: 0,
      1: 0,
    });
    setLooseRupees('');
    setClosingRemark('');
  };

  // Sync drawer balance to counted physical cash
  const handleSyncDrawerBalance = () => {
    if (!currentAccount) return;

    // 1. Update account balance directly
    syncEngine.updateAccountBalance(currentAccount.id, totalCountedPaise);

    // 2. If there is a reconciliation difference, record a ledger entry for audit trail
    if (differencePaise !== 0) {
      const isExcess = differencePaise > 0;
      syncEngine.pushLedgerEntry({
        id: crypto.randomUUID(),
        workspace_id: currentAccount.workspace_id,
        type: isExcess ? 'cash_in' : 'cash_out',
        amount: Math.abs(differencePaise),
        mode: 'cash',
        cash_location_id: currentAccount.id,
        note: `Cash Drawer Tally Adjustment (${isExcess ? 'Surplus' : 'Shortage'} reconciled)${
          closingRemark.trim() ? ': ' + closingRemark.trim() : ''
        }`,
        entry_date: new Date().toISOString(),
      });
    }

    setSyncSuccess(true);
    setTimeout(() => {
      setSyncSuccess(false);
      onClose();
    }, 1200);
  };

  // Share closing slip via WhatsApp
  const handleShareWhatsApp = () => {
    let msg = `💵 *Physical Cash Counting Slip — Record Book*\n`;
    if (currentAccount) msg += `Counter/Drawer: *${currentAccount.name}*\n`;
    msg += `Date & Time: ${new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })}\n`;
    msg += `------------------------------\n`;

    DENOMINATIONS.forEach((d) => {
      const qty = counts[d.value] || 0;
      if (qty > 0) {
        msg += `${d.label} × ${qty} = ₹${(qty * d.value).toLocaleString('en-IN')}\n`;
      }
    });

    if (loosePaise > 0) {
      msg += `Loose Cash / Coins: ${formatPaise(loosePaise)}\n`;
    }

    msg += `------------------------------\n`;
    msg += `🧾 *Total Notes:* ${totalNotesCount} notes\n`;
    msg += `💰 *Total Physical Cash:* ${formatPaise(totalCountedPaise)}\n`;
    msg += `📊 *System Expected:* ${formatPaise(expectedPaise)}\n`;

    if (differencePaise === 0) {
      msg += `🟢 *Tally Status:* Exact Match (₹0 Difference)\n`;
    } else if (differencePaise > 0) {
      msg += `🟡 *Tally Status:* Surplus / Excess of +${formatPaise(differencePaise)}\n`;
    } else {
      msg += `🔴 *Tally Status:* Deficit / Shortage of -${formatPaise(Math.abs(differencePaise))}\n`;
    }

    if (closingRemark.trim()) {
      msg += `Note: ${closingRemark.trim()}\n`;
    }

    msg += `------------------------------\n`;
    msg += `_Generated via Record Book_`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/25">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                Physical Cash Note Counter
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Count notes & coins in drawer, bar till, or shop counter and tally with ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              title="Reset all counts to 0"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Target Cash Drawer Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Cash Drawer / Counter:
              </span>
            </div>

            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
            >
              {activeCashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatPaise(a.balance)})
                </option>
              ))}
            </select>
          </div>

          {/* Hero Count Summary & Difference Card */}
          <div className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-950 text-white border border-amber-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Total Physical Cash Counted
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                {totalNotesCount} notes • {totalCoinsCount} coins
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white tabular-nums">
              {formatPaise(totalCountedPaise)}
            </div>

            {/* Difference / Tally Comparison Bar */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-semibold block">
                  System Drawer Balance
                </span>
                <span className="font-bold text-slate-200 tabular-nums">
                  {formatPaise(expectedPaise)}
                </span>
              </div>

              <div
                className={`p-2.5 rounded-xl space-y-0.5 ${
                  differencePaise === 0
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : differencePaise > 0
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}
              >
                <span className="text-[10px] font-bold block uppercase tracking-wider">
                  {differencePaise === 0
                    ? 'Tally Matched'
                    : differencePaise > 0
                    ? 'Surplus (+)'
                    : 'Deficit / Shortage (−)'}
                </span>
                <span className="font-black tabular-nums text-sm">
                  {differencePaise === 0
                    ? 'Exact ₹0.00'
                    : (differencePaise > 0 ? '+' : '-') + formatPaise(Math.abs(differencePaise))}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Denomination Counter Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
              <span>Denomination</span>
              <span className="text-center">Count / Pieces</span>
              <span className="text-right">Total (₹)</span>
            </div>

            <div className="space-y-1.5">
              {DENOMINATIONS.map((d) => {
                const count = counts[d.value] || 0;
                const lineTotal = count * d.value;

                return (
                  <div
                    key={d.value}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-colors"
                  >
                    {/* Denomination Badge */}
                    <div className="w-24 shrink-0 flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-xs font-black border ${d.badgeBg} ${d.badgeText} ${d.badgeBorder}`}
                      >
                        {d.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {d.type === 'note' ? 'note' : 'coin'}
                      </span>
                    </div>

                    {/* Step & Input Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepCount(d.value, -1)}
                        disabled={count <= 0}
                        className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-white/10 disabled:opacity-30 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        value={count === 0 ? '' : count}
                        placeholder="0"
                        onChange={(e) =>
                          handleCountChange(d.value, parseInt(e.target.value) || 0)
                        }
                        className="w-16 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-center font-black text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 tabular-nums"
                      />

                      <button
                        type="button"
                        onClick={() => handleStepCount(d.value, 1)}
                        className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="w-24 text-right shrink-0">
                      <span className="font-black text-xs text-slate-900 dark:text-white tabular-nums">
                        ₹{lineTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Loose Coins / Extra Cash Input */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
            <div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                Loose Coins / Petty Cash
              </span>
              <span className="text-[10px] text-slate-400">
                Any mixed coins, paise, or unseparated change
              </span>
            </div>

            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                placeholder="0.00"
                value={looseRupees}
                onChange={(e) => setLooseRupees(e.target.value)}
                className="w-full pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-right font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 tabular-nums"
              />
            </div>
          </div>

          {/* Closing Remark */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Closing Remark / Verification Note
            </label>
            <input
              type="text"
              placeholder="e.g. End of day shift closing, Cashier: Ramesh"
              value={closingRemark}
              onChange={(e) => setClosingRemark(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={totalCountedPaise === 0}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-40"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Slip</span>
          </button>

          <button
            type="button"
            onClick={handleSyncDrawerBalance}
            disabled={!currentAccount || totalCountedPaise === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs shadow-md shadow-amber-500/25 transition-all hover-lift touch-press disabled:opacity-40"
          >
            {syncSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Drawer Balanced & Saved!</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Update Drawer Balance to {formatPaise(totalCountedPaise)}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
