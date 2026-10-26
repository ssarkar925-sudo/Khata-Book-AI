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
  Edit3,
  Trash2,
  FileText,
  CheckCircle2,
  Landmark,
  Smartphone,
  Coins,
  ShieldAlert,
  Calculator,
} from 'lucide-react';
import { CashLocation, AccountType } from '@/types';
import { formatPaise, parseToPaise, paiseToRupees } from '@/lib/money';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAccountStore, BankAccountItem } from '@/stores/useAccountStore';
import { syncEngine } from '@/lib/syncEngine';
import { AccountDetailModal } from '@/components/modals/AccountDetailModal';
import { CashDenominationModal } from '@/components/modals/CashDenominationModal';

const BANK_OPTIONS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Kotak Mahindra Bank',
  'Canara Bank',
  'Union Bank of India',
  'IndusInd Bank',
  'Paytm Payments Bank',
  'Cash Counter',
  'Other Bank',
];

const COLOR_THEMES = [
  {
    id: 'blue',
    name: 'Blue',
    gradient: 'from-blue-600/20 via-cyan-500/10 to-transparent',
    iconColor: 'bg-blue-600 text-white',
    dot: 'bg-blue-600',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    gradient: 'from-indigo-600/20 via-purple-500/10 to-transparent',
    iconColor: 'bg-indigo-600 text-white',
    dot: 'bg-indigo-600',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    iconColor: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-600',
  },
  {
    id: 'amber',
    name: 'Amber',
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    iconColor: 'bg-amber-500 text-white',
    dot: 'bg-amber-500',
  },
  {
    id: 'purple',
    name: 'Purple',
    gradient: 'from-purple-600/20 via-fuchsia-500/10 to-transparent',
    iconColor: 'bg-purple-600 text-white',
    dot: 'bg-purple-600',
  },
  {
    id: 'rose',
    name: 'Rose',
    gradient: 'from-rose-500/20 via-red-500/10 to-transparent',
    iconColor: 'bg-rose-600 text-white',
    dot: 'bg-rose-600',
  },
];

export function CashScreen() {
  const { activeWorkspaceId, theme } = useSessionStore();
  const { accounts } = useAccountStore();
  const isLight = theme === 'light';

  // Filter state: 'all' | 'bank' | 'cash' | 'wallet'
  const [accountFilter, setAccountFilter] = useState<'all' | 'bank' | 'cash' | 'wallet'>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDenominationModal, setShowDenominationModal] = useState(false);
  const [denominationTargetAccount, setDenominationTargetAccount] = useState<CashLocation | null>(null);
  const [selectedAccForDetail, setSelectedAccForDetail] = useState<CashLocation | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<BankAccountItem | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<BankAccountItem | null>(null);

  // Form state for Add Account
  const [newAccName, setNewAccName] = useState('');
  const [newAccBank, setNewAccBank] = useState('State Bank of India');
  const [newAccType, setNewAccType] = useState<AccountType>('savings');
  const [newAccLast4, setNewAccLast4] = useState('');
  const [newAccBalanceRupees, setNewAccBalanceRupees] = useState('');
  const [newAccColor, setNewAccColor] = useState('blue');

  // Form state for Edit Account
  const [editName, setEditName] = useState('');
  const [editBank, setEditBank] = useState('');
  const [editType, setEditType] = useState<AccountType>('savings');
  const [editLast4, setEditLast4] = useState('');
  const [editBalanceRupees, setEditBalanceRupees] = useState('');
  const [editColor, setEditColor] = useState('blue');

  // Transfer state
  const [fromAccId, setFromAccId] = useState('');
  const [toAccId, setToAccId] = useState('');
  const [transferAmountRupees, setTransferAmountRupees] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  // Filtered accounts list
  const filteredAccounts = accounts.filter((acc) => {
    if (accountFilter === 'bank') {
      return acc.account_type === 'savings' || acc.account_type === 'current' || acc.account_type === 'od_cc';
    }
    if (accountFilter === 'cash') {
      return acc.account_type === 'cash_counter';
    }
    if (accountFilter === 'wallet') {
      return acc.account_type === 'wallet';
    }
    return true;
  });

  const bankCount = accounts.filter(
    (a) => a.account_type === 'savings' || a.account_type === 'current' || a.account_type === 'od_cc'
  ).length;
  const cashCount = accounts.filter((a) => a.account_type === 'cash_counter').length;
  const walletCount = accounts.filter((a) => a.account_type === 'wallet').length;

  // Handle Add Account
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    const balancePaise = parseToPaise(newAccBalanceRupees);
    const themeDef = COLOR_THEMES.find((c) => c.id === newAccColor) || COLOR_THEMES[0];

    const newAcc: BankAccountItem = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      name: newAccName.trim(),
      balance: balancePaise,
      is_default: accounts.length === 0,
      account_type: newAccType,
      bank_name: newAccType === 'cash_counter' ? 'Cash Counter' : newAccBank,
      account_number_last4: newAccLast4.trim() || undefined,
      color_theme: newAccColor,
      gradient: themeDef.gradient,
      iconColor: themeDef.iconColor,
      created_at: new Date().toISOString(),
    };

    syncEngine.pushAccount(newAcc);
    setShowAddModal(false);
    setNewAccName('');
    setNewAccLast4('');
    setNewAccBalanceRupees('');
    setNewAccType('savings');
    setNewAccColor('blue');
  };

  // Open Edit Account Modal
  const handleOpenEdit = (acc: BankAccountItem) => {
    setAccountToEdit(acc);
    setEditName(acc.name);
    setEditBank(acc.bank_name || 'State Bank of India');
    setEditType(acc.account_type || 'savings');
    setEditLast4(acc.account_number_last4 || '');
    setEditBalanceRupees(acc.balance ? paiseToRupees(acc.balance).toString() : '0');
    setEditColor(acc.color_theme || 'blue');
  };

  // Save Edit Account
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountToEdit || !editName.trim()) return;

    const themeDef = COLOR_THEMES.find((c) => c.id === editColor) || COLOR_THEMES[0];
    const newBalance = parseToPaise(editBalanceRupees);

    const updates: Partial<BankAccountItem> = {
      name: editName.trim(),
      bank_name: editType === 'cash_counter' ? 'Cash Counter' : editBank,
      account_type: editType,
      account_number_last4: editLast4.trim() || undefined,
      balance: newBalance,
      color_theme: editColor,
      gradient: themeDef.gradient,
      iconColor: themeDef.iconColor,
      updated_at: new Date().toISOString(),
    };

    syncEngine.updateAccount(accountToEdit.id, updates);

    if (selectedAccForDetail && selectedAccForDetail.id === accountToEdit.id) {
      setSelectedAccForDetail({ ...selectedAccForDetail, ...updates });
    }

    setAccountToEdit(null);
  };

  // Delete Account
  const handleDeleteAccount = (id: string) => {
    syncEngine.deleteAccount(id);
    if (selectedAccForDetail && selectedAccForDetail.id === id) {
      setSelectedAccForDetail(null);
    }
    setAccountToDelete(null);
  };

  // Handle Internal Funds Transfer with Ledger Audit Trail
  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = parseToPaise(transferAmountRupees);
    if (amountPaise <= 0 || !fromAccId || !toAccId || fromAccId === toAccId) return;

    const fromAcc = accounts.find((a) => a.id === fromAccId);
    const toAcc = accounts.find((a) => a.id === toAccId);
    if (!fromAcc || !toAcc) return;

    // 1. Outflow from source account
    syncEngine.pushLedgerEntry({
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: 'cash_out',
      amount: amountPaise,
      mode: 'bank',
      cash_location_id: fromAccId,
      note: transferNote.trim() ? `Transfer: ${transferNote} (To ${toAcc.name})` : `Transfer to ${toAcc.name}`,
      entry_date: new Date().toISOString(),
    });

    // 2. Inflow to destination account
    syncEngine.pushLedgerEntry({
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: 'cash_in',
      amount: amountPaise,
      mode: 'bank',
      cash_location_id: toAccId,
      note: transferNote.trim() ? `Transfer: ${transferNote} (From ${fromAcc.name})` : `Transfer from ${fromAcc.name}`,
      entry_date: new Date().toISOString(),
    });

    setShowTransferModal(false);
    setTransferAmountRupees('');
    setTransferNote('');
  };

  const getAccountIcon = (type?: string) => {
    switch (type) {
      case 'cash_counter':
        return <Coins className="w-4 h-4" />;
      case 'wallet':
        return <Smartphone className="w-4 h-4" />;
      default:
        return <Landmark className="w-4 h-4" />;
    }
  };

  const getAccountTypeBadge = (type?: string) => {
    switch (type) {
      case 'savings':
        return 'Savings A/C';
      case 'current':
        return 'Current A/C';
      case 'cash_counter':
        return 'Cash Drawer';
      case 'wallet':
        return 'Wallet / UPI';
      case 'od_cc':
        return 'Overdraft / CC';
      default:
        return 'Bank A/C';
    }
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
            Manage your bank accounts, physical cash counters, and view passbook statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Note Counting / Cash Denomination Calculator Button */}
          <button
            onClick={() => {
              const defaultDrawer = accounts.find((a) => a.account_type === 'cash_counter') || accounts[0];
              setDenominationTargetAccount(defaultDrawer || null);
              setShowDenominationModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 font-bold text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all hover-lift touch-press"
          >
            <Calculator className="w-4 h-4 text-amber-500" />
            <span>Count Cash (Till/Notes)</span>
          </button>

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
      <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white border border-emerald-500/25 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Total Liquid Balance
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Verified
          </span>
        </div>
        <div className="text-3xl sm:text-4xl font-black tracking-tight text-white mt-1 tabular-nums">
          {formatPaise(totalBalance)}
        </div>
        <p className="text-xs text-slate-300 mt-2 font-medium">
          Aggregated across {accounts.length} active bank accounts and cash counters
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => setAccountFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            accountFilter === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          All Accounts ({accounts.length})
        </button>
        <button
          onClick={() => setAccountFilter('bank')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            accountFilter === 'bank'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>Banks ({bankCount})</span>
        </button>
        <button
          onClick={() => setAccountFilter('cash')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            accountFilter === 'cash'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Cash Counters ({cashCount})</span>
        </button>
        <button
          onClick={() => setAccountFilter('wallet')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            accountFilter === 'wallet'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Wallets & UPI ({walletCount})</span>
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAccounts.map((acc) => (
          <div
            key={acc.id}
            onClick={() => setSelectedAccForDetail(acc)}
            className={`cursor-pointer rounded-3xl border p-5 transition-all hover-lift bg-gradient-to-br ${
              acc.gradient || 'from-blue-600/20 via-cyan-500/10 to-transparent'
            } ${
              isLight
                ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                : 'bg-slate-900/80 border-white/10 hover:border-white/20'
            } flex flex-col justify-between space-y-4`}
          >
            <div>
              {/* Account Card Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shadow-md ${
                      acc.iconColor || 'bg-blue-600 text-white'
                    }`}
                  >
                    {getAccountIcon(acc.account_type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                      {acc.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {acc.bank_name || 'Bank'}
                      </span>
                      {acc.account_number_last4 && (
                        <span className="text-[10px] font-mono text-slate-400">
                          •••• {acc.account_number_last4}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {acc.is_default ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                      Primary
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-semibold">
                      {getAccountTypeBadge(acc.account_type)}
                    </span>
                  )}

                  {/* Count Physical Cash / Notes Button for Cash Counter accounts */}
                  {(acc.account_type === 'cash_counter' || acc.name.toLowerCase().includes('cash')) && (
                    <button
                      onClick={() => {
                        setDenominationTargetAccount(acc);
                        setShowDenominationModal(true);
                      }}
                      title="Count Physical Notes & Coins (Denomination Counter)"
                      className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Edit Button */}
                  <button
                    onClick={() => handleOpenEdit(acc)}
                    title="Edit Account"
                    className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button (non-default only) */}
                  {!acc.is_default && (
                    <button
                      onClick={() => setAccountToDelete(acc)}
                      title="Delete Account"
                      className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Balance Amount */}
              <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatPaise(acc.balance)}
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-white/10 text-xs">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>View Passbook</span>
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFromAccId(acc.id);
                  setShowTransferModal(true);
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <span>Transfer</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* POPUP: Account Passbook Detail */}
      <AccountDetailModal
        account={selectedAccForDetail}
        onClose={() => setSelectedAccForDetail(null)}
        onTransfer={() => {
          if (selectedAccForDetail) setFromAccId(selectedAccForDetail.id);
          setShowTransferModal(true);
        }}
        onEdit={(acc) => handleOpenEdit(acc as BankAccountItem)}
        onDelete={(id) => handleDeleteAccount(id)}
        onCountCash={(acc) => {
          setDenominationTargetAccount(acc);
          setShowDenominationModal(true);
        }}
      />

      {/* MODAL: Physical Cash Denomination Counter */}
      <CashDenominationModal
        isOpen={showDenominationModal}
        targetAccount={denominationTargetAccount}
        onClose={() => {
          setShowDenominationModal(false);
          setDenominationTargetAccount(null);
        }}
      />

      {/* MODAL: Add Account */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-500" />
                <span>Add Bank Account or Counter</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Account Type */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Account Type
                </label>
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value as AccountType)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="savings" className="dark:bg-slate-900">Savings Account (Personal/Family)</option>
                  <option value="current" className="dark:bg-slate-900">Current Account (Business/GST)</option>
                  <option value="cash_counter" className="dark:bg-slate-900">Physical Cash Drawer / Counter</option>
                  <option value="wallet" className="dark:bg-slate-900">Digital Wallet / UPI (Paytm/PhonePe)</option>
                  <option value="od_cc" className="dark:bg-slate-900">Overdraft (OD) / Cash Credit (CC)</option>
                </select>
              </div>

              {/* Account Nickname */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Account Nickname
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SBI Main Branch, Shop Cash Drawer"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Bank Name (only if not cash counter) */}
              {newAccType !== 'cash_counter' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Bank Issuer / Provider
                  </label>
                  <select
                    value={newAccBank}
                    onChange={(e) => setNewAccBank(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                  >
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b} className="dark:bg-slate-900">
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Last 4 Digits (only if bank/wallet) */}
              {newAccType !== 'cash_counter' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Last 4 Digits of Account No. (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4821"
                    value={newAccLast4}
                    onChange={(e) => setNewAccLast4(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Starting Balance */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Starting Balance (₹)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newAccBalanceRupees}
                  onChange={(e) => setNewAccBalanceRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Color Theme */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Color Theme
                </label>
                <div className="flex gap-2">
                  {COLOR_THEMES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewAccColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.dot} transition-transform ${
                        newAccColor === c.id
                          ? 'scale-125 ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2 shrink-0 border-t border-slate-100 dark:border-white/5">
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

      {/* MODAL: Edit Account */}
      {accountToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                <span>Edit Account Details</span>
              </h3>
              <button
                onClick={() => setAccountToEdit(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Account Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as AccountType)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="savings" className="dark:bg-slate-900">Savings Account</option>
                  <option value="current" className="dark:bg-slate-900">Current Account</option>
                  <option value="cash_counter" className="dark:bg-slate-900">Cash Drawer</option>
                  <option value="wallet" className="dark:bg-slate-900">Digital Wallet / UPI</option>
                  <option value="od_cc" className="dark:bg-slate-900">Overdraft / CC</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {editType !== 'cash_counter' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Bank Issuer
                  </label>
                  <select
                    value={editBank}
                    onChange={(e) => setEditBank(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b} className="dark:bg-slate-900">
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editType !== 'cash_counter' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editLast4}
                    onChange={(e) => setEditLast4(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Current Balance (₹)
                </label>
                <input
                  type="number"
                  value={editBalanceRupees}
                  onChange={(e) => setEditBalanceRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Color Theme
                </label>
                <div className="flex gap-2">
                  {COLOR_THEMES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.dot} transition-transform ${
                        editColor === c.id
                          ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2 shrink-0 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setAccountToEdit(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-xs shadow-md shadow-indigo-500/25"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Account Confirmation */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Account?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to remove <strong>{accountToDelete.name}</strong>? Linked transaction history will remain intact.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAccount(accountToDelete.id)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/25"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Internal Funds Transfer */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                <span>Internal Funds Transfer</span>
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transfer From (Debit)</label>
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transfer To (Credit)</label>
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

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transfer Remark / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. ATM Cash Withdrawal, Weekly shop replenishment"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
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
                  disabled={!fromAccId || !toAccId || fromAccId === toAccId}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-xs shadow-md shadow-indigo-500/25 disabled:opacity-50"
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
