'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  ArrowRightLeft,
  Building,
  ArrowRight,
  X,
  CreditCard,
} from 'lucide-react';
import { CashLocation } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { useSessionStore } from '@/stores/useSessionStore';

export function CashScreen() {
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const [accounts, setAccounts] = useState<Array<CashLocation & { gradient?: string; iconColor?: string }>>([
    {
      id: 'default-cash',
      workspace_id: activeWorkspaceId,
      name: 'Physical Cash Drawer',
      balance: 1500000,
      is_default: true,
      gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
      iconColor: 'bg-amber-500 text-white',
    },
    {
      id: 'default-sbi',
      workspace_id: activeWorkspaceId,
      name: 'SBI Savings Account',
      balance: 4500000,
      is_default: false,
      gradient: 'from-blue-600/20 via-cyan-500/10 to-transparent',
      iconColor: 'bg-blue-600 text-white',
    },
    {
      id: 'default-hdfc',
      workspace_id: activeWorkspaceId,
      name: 'HDFC Business Current',
      balance: 8200000,
      is_default: false,
      gradient: 'from-indigo-600/20 via-purple-500/10 to-transparent',
      iconColor: 'bg-indigo-600 text-white',
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalanceRupees, setNewAccBalanceRupees] = useState('');

  // Transfer state
  const [fromAccId, setFromAccId] = useState('');
  const [toAccId, setToAccId] = useState('');
  const [transferAmountRupees, setTransferAmountRupees] = useState('');

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    const balancePaise = parseToPaise(newAccBalanceRupees);
    const newAcc = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      name: newAccName.trim(),
      balance: balancePaise,
      is_default: false,
      gradient: 'from-teal-500/20 via-emerald-500/10 to-transparent',
      iconColor: 'bg-teal-600 text-white',
    };
    setAccounts((prev) => [...prev, newAcc]);
    setShowAddModal(false);
    setNewAccName('');
    setNewAccBalanceRupees('');
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = parseToPaise(transferAmountRupees);
    if (amountPaise <= 0 || !fromAccId || !toAccId || fromAccId === toAccId) return;

    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === fromAccId) return { ...acc, balance: acc.balance - amountPaise };
        if (acc.id === toAccId) return { ...acc, balance: acc.balance + amountPaise };
        return acc;
      })
    );

    setShowTransferModal(false);
    setTransferAmountRupees('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/25">
              <Wallet className="w-5 h-5" />
            </div>
            <span>Bank & Cash Accounts</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track your multiple bank accounts, cash in hand, and internal funds movement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFromAccId(accounts[0]?.id || '');
              setToAccId(accounts[1]?.id || '');
              setShowTransferModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30 font-bold text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all hover-lift touch-press"
          >
            <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
            <span>Transfer Funds</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-bold text-white text-xs shadow-lg shadow-emerald-500/25 transition-all hover-lift touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bank / Cash</span>
          </button>
        </div>
      </div>

      {/* Hero Summary Card */}
      <div
        className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white border border-emerald-500/25 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
          Total Liquid Balance
        </span>
        <div className="text-3xl sm:text-4xl font-black tracking-tight text-white mt-1 tabular-nums">
          {formatPaise(totalBalance)}
        </div>
        <p className="text-xs text-slate-300 mt-2 font-medium">
          Accumulated across {accounts.length} active bank and physical cash counters
        </p>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className={`rounded-3xl border p-5 transition-all hover-lift bg-gradient-to-br ${acc.gradient} ${
              isLight
                ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                : 'bg-slate-900/80 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shadow-md ${acc.iconColor}`}>
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                    {acc.name}
                  </h3>
                  <span className="text-[10px] text-slate-400">Personal Account</span>
                </div>
              </div>
              {acc.is_default && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  Primary
                </span>
              )}
            </div>

            <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatPaise(acc.balance)}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Active & verified</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">100% liquid</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add Account */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Bank Account or Counter</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SBI Savings, Paytm Wallet, Shop Cash"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Starting Balance (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newAccBalanceRupees}
                  onChange={(e) => setNewAccBalanceRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/25"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Money */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Internal Funds Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transfer From</label>
                <select
                  value={fromAccId}
                  onChange={(e) => setFromAccId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="dark:bg-slate-900">
                      {a.name} ({formatPaise(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transfer To</label>
                <select
                  value={toAccId}
                  onChange={(e) => setToAccId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="dark:bg-slate-900">
                      {a.name} ({formatPaise(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount to Transfer (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={transferAmountRupees}
                  onChange={(e) => setTransferAmountRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-xs shadow-md shadow-indigo-500/25"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
