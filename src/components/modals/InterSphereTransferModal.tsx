'use client';

import React, { useState, useEffect } from 'react';
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
  ArrowRightLeft,
  Loader2,
} from 'lucide-react';
import { useAccountStore } from '@/stores/useAccountStore';
import { EntityScope } from '@/types';
import { formatPaise } from '@/lib/money';
import { syncEngine } from '@/lib/syncEngine';

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
  const { accounts } = useAccountStore();

  const [fromScope, setFromScope] = useState<EntityScope>(defaultSourceScope);
  const [toScope, setToScope] = useState<EntityScope>(defaultSourceScope);
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('Routine Business Rebalance');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<{
    amountPaise: number;
    fromName: string;
    fromNewBalance: number;
    toName: string;
    toNewBalance: number;
    isSameScope: boolean;
  } | null>(null);

  // Accounts belonging to source scope (or all accounts if none in scope)
  const fromAccounts = accounts.filter((a) => (a.scope || 'business') === fromScope);
  const resolvedFromAccounts = fromAccounts.length > 0 ? fromAccounts : accounts;

  // Accounts belonging to destination scope
  const toAccounts = accounts.filter((a) => (a.scope || 'business') === toScope);
  const resolvedToAccounts = toAccounts.length > 0 ? toAccounts : accounts;

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  // Keep fromAccountId valid when fromScope or accounts change
  useEffect(() => {
    if (resolvedFromAccounts.length > 0) {
      if (!fromAccountId || !resolvedFromAccounts.some((a) => a.id === fromAccountId)) {
        setFromAccountId(resolvedFromAccounts[0].id);
      }
    } else {
      setFromAccountId('');
    }
  }, [fromScope, accounts]);

  // Keep toAccountId valid when toScope, fromAccountId, or accounts change
  useEffect(() => {
    if (resolvedToAccounts.length > 0) {
      // If same scope, prefer an account that is not fromAccountId
      const candidate = fromScope === toScope
        ? resolvedToAccounts.find((a) => a.id !== fromAccountId) || resolvedToAccounts[0]
        : resolvedToAccounts[0];

      if (!toAccountId || !resolvedToAccounts.some((a) => a.id === toAccountId) || (fromScope === toScope && toAccountId === fromAccountId)) {
        if (candidate) {
          setToAccountId(candidate.id);
        }
      }
    } else {
      setToAccountId('');
    }
  }, [toScope, fromAccountId, accounts]);

  // Update reason preset suggestions whenever fromScope or toScope change
  useEffect(() => {
    if (fromScope === 'business' && toScope === 'business') {
      setReason('Routine Business Rebalance');
    } else if (fromScope === 'personal' && toScope === 'personal') {
      setReason('Personal Self-Transfer');
    } else if (fromScope === 'family' && toScope === 'family') {
      setReason('Family Reserve Fund Rebalance');
    } else if (fromScope === 'business' && toScope === 'personal') {
      setReason('Owner Drawing / Profit Share');
    } else if (fromScope === 'personal' && toScope === 'business') {
      setReason('Capital Infusion / Owner Loan');
    } else if (fromScope === 'personal' && toScope === 'family') {
      setReason('Household Monthly Allowance');
    } else if (fromScope === 'family' && toScope === 'personal') {
      setReason('Family Surplus Refund');
    } else {
      setReason('Internal Fund Transfer');
    }
  }, [fromScope, toScope]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amountStr) || 0;
  const amountPaise = Math.round(numAmount * 100);

  const selectedFromAccount = accounts.find((a) => a.id === fromAccountId);
  const selectedToAccount = accounts.find((a) => a.id === toAccountId);

  const fromEffectiveBalance = selectedFromAccount
    ? syncEngine.getAccountEffectiveBalance(selectedFromAccount.id)
    : 0;

  const isSameScope = fromScope === toScope;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (amountPaise <= 0) {
      setErrorMessage('Please enter a valid transfer amount greater than ₹0.');
      return;
    }
    if (!selectedFromAccount || !selectedToAccount) {
      setErrorMessage('Please select both a source and destination account.');
      return;
    }
    if (selectedFromAccount.id === selectedToAccount.id) {
      setErrorMessage('Source and Destination accounts must be different.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await syncEngine.transferFunds({
        fromAccountId: selectedFromAccount.id,
        toAccountId: selectedToAccount.id,
        amountPaise,
        note: note.trim(),
        fromScope,
        toScope,
        reason,
      });

      setSuccessData({
        amountPaise,
        fromName: selectedFromAccount.name,
        fromNewBalance: res.fromNewBalance,
        toName: selectedToAccount.name,
        toNewBalance: res.toNewBalance,
        isSameScope,
      });

      setTimeout(() => {
        setSuccessData(null);
        setIsSubmitting(false);
        setAmountStr('');
        setNote('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Fund transfer failed. Please try again.');
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ArrowRightLeft className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Fund Transfer & Rebalance
                </h3>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                  isSameScope
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                }`}>
                  {isSameScope ? `${FromMeta.label} to ${ToMeta.label} (Intra)` : `${FromMeta.label} → ${ToMeta.label}`}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Seamless transfer within same sphere or across Business, Personal & Family
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successData ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">Transfer Completed!</h4>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatPaise(successData.amountPaise)} transferred successfully
              </p>
            </div>

            {/* Balances summary card */}
            <div className="w-full grid grid-cols-2 gap-3 pt-2 text-left">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Source Account</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">{successData.fromName}</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100 mt-1 block tabular-nums">
                  {formatPaise(successData.fromNewBalance)}
                </span>
                <span className="text-[9px] text-slate-400">New Available Balance</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Destination Account</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">{successData.toName}</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
                  {formatPaise(successData.toNewBalance)}
                </span>
                <span className="text-[9px] text-slate-400">New Available Balance</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleTransfer} className="space-y-4 pt-4">
            {/* From -> To Sphere Visual Selector (Allows SAME SPHERE: Business to Business, Personal to Personal, Family to Family) */}
            <div className="grid grid-cols-2 gap-3 items-center">
              {/* FROM SPHERE */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Transfer From (Debit)
                </label>
                <div className="flex gap-1">
                  {(['business', 'personal', 'family'] as EntityScope[]).map((s) => (
                    <button
                      key={`from-${s}`}
                      type="button"
                      onClick={() => setFromScope(s)}
                      className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
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

              {/* TO SPHERE (Same sphere is fully allowed!) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Transfer To (Credit)
                </label>
                <div className="flex gap-1">
                  {(['business', 'personal', 'family'] as EntityScope[]).map((s) => (
                    <button
                      key={`to-${s}`}
                      type="button"
                      onClick={() => setToScope(s)}
                      className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        toScope === s
                          ? 'bg-indigo-600 text-white border-transparent shadow-xs'
                          : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Same sphere helper note */}
            {isSameScope && (
              <div className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{FromMeta.label} to {ToMeta.label} Transfer:</strong> Move funds between accounts inside your {FromMeta.label} workspace.
                </span>
              </div>
            )}

            {/* Account Selector Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Source Account ({FromMeta.label})
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {resolvedFromAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatPaise(syncEngine.getAccountEffectiveBalance(acc.id))})
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
                  className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {resolvedToAccounts.map((acc) => {
                    const isSelf = isSameScope && acc.id === fromAccountId;
                    return (
                      <option key={acc.id} value={acc.id} disabled={isSelf}>
                        {acc.name} ({formatPaise(syncEngine.getAccountEffectiveBalance(acc.id))}){isSelf ? ' — (Source)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Warning if source and dest are the same */}
            {fromAccountId && toAccountId && fromAccountId === toAccountId && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Please select a different destination account to transfer funds.</span>
              </div>
            )}

            {/* Transfer Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Amount to Transfer (₹)
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
              {selectedFromAccount && amountPaise > fromEffectiveBalance && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Amount exceeds available balance ({formatPaise(fromEffectiveBalance)})</span>
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
                {/* Business to Business */}
                {fromScope === 'business' && toScope === 'business' && (
                  <>
                    <option value="Routine Business Rebalance">Routine Business Rebalance</option>
                    <option value="Bank to Cash Counter (Withdrawal)">Bank to Cash Counter (Cash Withdrawal / Till Replenish)</option>
                    <option value="Cash Counter to Bank (Deposit)">Cash Counter to Bank (Sales Banking / Cash Deposit)</option>
                    <option value="Inter-Account Current Transfer">Inter-Account Current Transfer</option>
                    <option value="Tax & GST Escrow Allocation">Tax & GST Escrow Allocation</option>
                    <option value="Vendor Payout Pool">Vendor Payout Pool</option>
                  </>
                )}

                {/* Personal to Personal */}
                {fromScope === 'personal' && toScope === 'personal' && (
                  <>
                    <option value="Personal Self-Transfer">Personal Self-Transfer</option>
                    <option value="Savings to Expense Account">Savings to Expense Account</option>
                    <option value="Primary Bank to Wallet Refill">Primary Bank to Wallet Refill</option>
                    <option value="Emergency Fund Allocation">Emergency Fund Allocation</option>
                    <option value="Investment / Fixed Deposit Transfer">Investment / Fixed Deposit Transfer</option>
                  </>
                )}

                {/* Family to Family */}
                {fromScope === 'family' && toScope === 'family' && (
                  <>
                    <option value="Family Reserve Fund Rebalance">Family Reserve Fund Rebalance</option>
                    <option value="Joint Account to Member Allowance">Joint Account to Member Allowance</option>
                    <option value="Family Pool Contribution">Family Pool Contribution</option>
                  </>
                )}

                {/* Cross-Sphere */}
                {fromScope === 'business' && toScope === 'personal' && (
                  <>
                    <option value="Owner Drawing / Profit Share">Owner Drawing / Profit Share (Business → Personal)</option>
                    <option value="Director Remuneration / Salary">Director Remuneration / Salary</option>
                    <option value="Business Expense Reimbursement">Business Expense Reimbursement</option>
                  </>
                )}

                {fromScope === 'personal' && toScope === 'business' && (
                  <>
                    <option value="Capital Infusion / Owner Loan">Capital Infusion / Owner Loan (Personal → Business)</option>
                    <option value="Emergency Working Capital Infusion">Emergency Working Capital Infusion</option>
                  </>
                )}

                {fromScope === 'personal' && toScope === 'family' && (
                  <>
                    <option value="Household Monthly Allowance">Household Monthly Allowance (Personal → Family)</option>
                    <option value="Family Grocery & Utilities Pool">Family Grocery & Utilities Pool</option>
                    <option value="Children Education Fund">Children Education Fund</option>
                  </>
                )}

                {fromScope === 'family' && toScope === 'personal' && (
                  <>
                    <option value="Family Surplus Refund">Family Surplus Refund (Family → Personal)</option>
                    <option value="Shared Expense Settlement">Shared Expense Settlement</option>
                  </>
                )}

                <option value="Other Internal Transfer">Other Custom Transfer</option>
              </select>
            </div>

            {/* Note input */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Optional Memo / Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. Counter replenishment, Diwali rush funds, salary transfer"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || amountPaise <= 0 || !fromAccountId || !toAccountId || fromAccountId === toAccountId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer hover-lift"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Transfer...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Transfer</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}