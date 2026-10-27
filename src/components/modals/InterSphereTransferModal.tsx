'use client';

import React, { useState } from 'react';
import {
  X,
  Repeat,
  ArrowRight,
  Wallet,
  Building2,
  User,
  Users2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAccountStore } from '@/stores/useAccountStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { EntityScope, LedgerEntry } from '@/types';
import { formatPaise } from '@/lib/money';

interface InterSphereTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSourceScope?: EntityScope;
}

export function InterSphereTransferModal({
  isOpen,
  onClose,
  defaultSourceScope = 'business',
}: InterSphereTransferModalProps) {
  const { accounts, updateAccountBalance } = useAccountStore();
  const { addEntryOptimistic } = useLedgerStore();

  const [fromScope, setFromScope] = useState<EntityScope>(defaultSourceScope);
  const [toScope, setToScope] = useState<EntityScope>(
    defaultSourceScope === 'business' ? 'personal' : 'business'
  );
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('Owner Drawing / Profit Share');
  const [note, setNote] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  // Filter accounts for source and destination
  const fromAccounts = accounts.filter((a) => (a.scope || 'business') === fromScope);
  const toAccounts = accounts.filter((a) => (a.scope || 'business') === toScope);

  const [fromAccountId, setFromAccountId] = useState(fromAccounts[0]?.id || accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(toAccounts[0]?.id || accounts[1]?.id || '');

  // Keep selected accounts updated when scopes change
  const handleFromScopeChange = (scope: EntityScope) => {
    setFromScope(scope);
    const validFromAccs = accounts.filter((a) => (a.scope || 'business') === scope);
    if (validFromAccs.length > 0) {
      setFromAccountId(validFromAccs[0].id);
    }
    if (toScope === scope) {
      const fallbackTo = scope === 'business' ? 'personal' : 'business';
      setToScope(fallbackTo);
      const validToAccs = accounts.filter((a) => (a.scope || 'business') === fallbackTo);
      if (validToAccs.length > 0) {
        setToAccountId(validToAccs[0].id);
      }
    }
  };

  const handleToScopeChange = (scope: EntityScope) => {
    setToScope(scope);
    const validToAccs = accounts.filter((a) => (a.scope || 'business') === scope);
    if (validToAccs.length > 0) {
      setToAccountId(validToAccs[0].id);
    }
  };

  if (!isOpen) return null;

  const numAmount = parseFloat(amountStr) || 0;
  const amountPaise = Math.round(numAmount * 100);

  const selectedFromAccount = accounts.find((a) => a.id === fromAccountId);
  const selectedToAccount = accounts.find((a) => a.id === toAccountId);

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountPaise <= 0 || !selectedFromAccount || !selectedToAccount) return;

    // 1. Deduct from source
    updateAccountBalance(selectedFromAccount.id, selectedFromAccount.balance - amountPaise);

    // 2. Add to destination
    updateAccountBalance(selectedToAccount.id, selectedToAccount.balance + amountPaise);

    // 3. Log paired entries in ledger
    const now = new Date().toISOString();
    const memo = note ? `${reason}: ${note}` : reason;

    // Outflow entry from source sphere
    const outEntry: LedgerEntry = {
      id: `tf-out-${Date.now()}`,
      workspace_id: selectedFromAccount.workspace_id,
      type: 'cash_out',
      amount: amountPaise,
      mode: 'bank',
      scope: fromScope,
      cash_location_id: selectedFromAccount.id,
      note: `⇄ Sphere Transfer to ${toScope.toUpperCase()} (${memo})`,
      category_id: 'cat-general',
      entry_date: now,
      created_at: now,
    };

    // Inflow entry to destination sphere
    const inEntry: LedgerEntry = {
      id: `tf-in-${Date.now() + 1}`,
      workspace_id: selectedToAccount.workspace_id,
      type: 'cash_in',
      amount: amountPaise,
      mode: 'bank',
      scope: toScope,
      cash_location_id: selectedToAccount.id,
      note: `⇄ Sphere Transfer from ${fromScope.toUpperCase()} (${memo})`,
      category_id: 'cat-general',
      entry_date: now,
      created_at: now,
    };

    addEntryOptimistic(outEntry);
    addEntryOptimistic(inEntry);

    setSuccessMsg(true);
    setTimeout(() => {
      setSuccessMsg(false);
      onClose();
    }, 1200);
  };

  const getScopeMeta = (scope: EntityScope) => {
    switch (scope) {
      case 'business':
        return { label: 'Business', icon: Building2, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' };
      case 'personal':
        return { label: 'Personal', icon: User, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' };
      case 'family':
        return { label: 'Family', icon: Users2, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' };
    }
  };

  const FromMeta = getScopeMeta(fromScope);
  const ToMeta = getScopeMeta(toScope);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Repeat className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Inter-Sphere Fund Transfer
              </h3>
              <p className="text-xs text-slate-400">
                Move money cleanly between Business, Personal & Family
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white">Transfer Complete!</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatPaise(amountPaise)} transferred from {FromMeta.label} to {ToMeta.label}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleTransfer} className="space-y-4 pt-4">
            {/* From -> To Sphere Visual Selector */}
            <div className="grid grid-cols-2 gap-3 items-center">
              {/* FROM */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Transfer From
                </label>
                <div className="flex gap-1">
                  {(['business', 'personal', 'family'] as EntityScope[]).map((s) => (
                    <button
                      key={`from-${s}`}
                      type="button"
                      onClick={() => handleFromScopeChange(s)}
                      className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all ${
                        fromScope === s
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                          : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* TO */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Transfer To
                </label>
                <div className="flex gap-1">
                  {(['business', 'personal', 'family'] as EntityScope[]).map((s) => {
                    const isSame = s === fromScope;
                    return (
                      <button
                        key={`to-${s}`}
                        type="button"
                        disabled={isSame}
                        onClick={() => handleToScopeChange(s)}
                        className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all ${
                          toScope === s
                            ? 'bg-indigo-600 text-white border-transparent shadow-xs'
                            : isSame
                            ? 'opacity-30 border-transparent cursor-not-allowed'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Account Selector Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Source Account ({FromMeta.label})
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatPaise(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Destination Account ({ToMeta.label})
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatPaise(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transfer Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-base font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  placeholder="0.00"
                  step="any"
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 text-lg font-black rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {selectedFromAccount && amountPaise > selectedFromAccount.balance && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Amount exceeds current balance ({formatPaise(selectedFromAccount.balance)})</span>
                </div>
              )}
            </div>

            {/* Transfer Reason Preset */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Transfer Purpose / Tag
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Owner Drawing / Profit Share">Owner Drawing / Profit Share (Business → Personal)</option>
                <option value="Household Monthly Allowance">Household Monthly Allowance (Personal → Family)</option>
                <option value="Capital Infusion / Owner Loan">Capital Infusion / Owner Loan (Personal → Business)</option>
                <option value="Family Surplus Refund">Family Surplus Refund (Family → Personal)</option>
                <option value="Routine Internal Rebalance">Routine Internal Rebalance</option>
              </select>
            </div>

            {/* Note input */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Optional Memo
              </label>
              <input
                type="text"
                placeholder="e.g. October month drawing, school fee pool"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={amountPaise <= 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all hover-lift"
              >
                <span>Confirm Transfer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
