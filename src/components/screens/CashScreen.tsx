'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Building,
  CheckCircle2,
  X,
} from 'lucide-react';
import { CashLocation } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/lib/supabase';

export function CashScreen() {
  const { activeWorkspaceId, user, theme } = useSessionStore();
  const isLight = theme === 'light';

  const [accounts, setAccounts] = useState<CashLocation[]>([
    {
      id: 'default-cash',
      workspace_id: activeWorkspaceId,
      name: 'Physical Cash Drawer',
      balance: 1500000, // ₹15,000
      is_default: true,
    },
    {
      id: 'default-sbi',
      workspace_id: activeWorkspaceId,
      name: 'SBI Savings Account',
      balance: 4500000, // ₹45,000
      is_default: false,
    },
    {
      id: 'default-hdfc',
      workspace_id: activeWorkspaceId,
      name: 'HDFC Business Current',
      balance: 8200000, // ₹82,000
      is_default: false,
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
    const newAcc: CashLocation = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      name: newAccName.trim(),
      balance: balancePaise,
      is_default: false,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <span>Bank & Cash Accounts</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track multiple bank accounts (SBI, HDFC), cash in hand, and inter-account transfers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFromAccId(accounts[0]?.id || '');
              setToAccId(accounts[1]?.id || '');
              setShowTransferModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 font-semibold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-all touch-press"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
            <span>Transfer Money</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold text-white text-xs shadow-md shadow-emerald-500/20 transition-all touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bank / Cash</span>
          </button>
        </div>
      </div>

      {/* Hero Summary */}
      <div
        className={`rounded-3xl border p-6 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900/80 border-white/10'
        }`}
      >
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Liquid Funds</span>
        <div className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
          {formatPaise(totalBalance)}
        </div>
        <span className="text-xs text-slate-400 mt-1 inline-block">
          Across {accounts.length} bank and cash accounts
        </span>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className={`rounded-2xl border p-5 transition-all hover-lift ${
              isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900/80 border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Building className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">{acc.name}</span>
              </div>
              {acc.is_default && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 font-bold text-slate-500 dark:text-slate-400">
                  Default
                </span>
              )}
            </div>

            <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatPaise(acc.balance)}
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add Account */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Bank Account or Cash Counter</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SBI Savings, HDFC Current, Shop Drawer"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Starting Balance (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 25000"
                  value={newAccBalanceRupees}
                  onChange={(e) => setNewAccBalanceRupees(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Money */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Transfer Between Accounts</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">From Account</label>
                  <select
                    value={fromAccId}
                    onChange={(e) => setFromAccId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">To Account</label>
                  <select
                    value={toAccId}
                    onChange={(e) => setToAccId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Transfer Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  value={transferAmountRupees}
                  onChange={(e) => setTransferAmountRupees(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Complete Transfer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
