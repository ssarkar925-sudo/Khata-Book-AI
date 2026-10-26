'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  ArrowRightLeft,
  Building,
  X,
} from 'lucide-react';
import { CashLocation } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { useSessionStore } from '@/stores/useSessionStore';

export function CashScreen() {
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const [accounts, setAccounts] = useState<CashLocation[]>([
    {
      id: 'default-cash',
      workspace_id: activeWorkspaceId,
      name: 'Physical Cash Drawer',
      balance: 1500000,
      is_default: true,
    },
    {
      id: 'default-sbi',
      workspace_id: activeWorkspaceId,
      name: 'SBI Savings Account',
      balance: 4500000,
      is_default: false,
    },
    {
      id: 'default-hdfc',
      workspace_id: activeWorkspaceId,
      name: 'HDFC Business Current',
      balance: 8200000,
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-zinc-500" />
            <span>Bank & Cash Accounts</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage your multiple bank accounts and cash balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFromAccId(accounts[0]?.id || '');
              setToAccId(accounts[1]?.id || '');
              setShowTransferModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-850 font-medium text-xs text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 opacity-70" />
            <span>Transfer</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div
        className={`rounded-xl border p-4 sm:p-5 transition-colors ${
          isLight ? 'bg-white border-zinc-200' : 'bg-[#121215] border-zinc-800/80'
        }`}
      >
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
          Total Liquid Balance
        </span>
        <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums font-mono">
          {formatPaise(totalBalance)}
        </div>
        <span className="text-xs text-zinc-400 mt-1 inline-block">
          Across {accounts.length} accounts
        </span>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className={`rounded-xl border p-4 transition-colors ${
              isLight
                ? 'bg-white border-zinc-200 hover:border-zinc-400'
                : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-zinc-400" />
                <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">{acc.name}</span>
              </div>
              {acc.is_default && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  Primary
                </span>
              )}
            </div>

            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">
              {formatPaise(acc.balance)}
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add Account */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Add Account</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SBI Savings, Cash Counter"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Initial Balance (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newAccBalanceRupees}
                  onChange={(e) => setNewAccBalanceRupees(e.target.value)}
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Money */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Transfer Funds</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">From Account</label>
                <select
                  value={fromAccId}
                  onChange={(e) => setFromAccId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="dark:bg-zinc-900">
                      {a.name} ({formatPaise(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">To Account</label>
                <select
                  value={toAccId}
                  onChange={(e) => setToAccId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="dark:bg-zinc-900">
                      {a.name} ({formatPaise(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Transfer Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={transferAmountRupees}
                  onChange={(e) => setTransferAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors"
                >
                  Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
