'use client';

import React, { useState, useEffect } from 'react';
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
  Globe,
  User,
  Users2,
  Building2,
} from 'lucide-react';
import { CashLocation, AccountType, EntityScope } from '@/types';
import { formatPaise, parseToPaise, paiseToRupees } from '@/lib/money';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAccountStore, BankAccountItem } from '@/stores/useAccountStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { syncEngine } from '@/lib/syncEngine';
import { AccountDetailModal } from '@/components/modals/AccountDetailModal';
import { CashDenominationModal } from '@/components/modals/CashDenominationModal';
import { ViewToggle, ViewMode } from '@/components/common/ViewToggle';

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
  'Bank of India',
  'Central Bank of India',
  'IDBI Bank',
  'IDFC FIRST Bank',
  'Yes Bank',
  'Federal Bank',
  'Bandhan Bank',
  'Indian Bank',
  'UCO Bank',
  'Indian Overseas Bank',
  'Paytm Payments Bank',
  'Airtel Payments Bank',
  'IPPB (India Post Payments Bank)',
  'Other Bank',
];

const WALLET_OPTIONS = [
  'Paytm Wallet',
  'Amazon Pay Balance',
  'PhonePe Wallet',
  'Mobikwik',
  'Ola Money',
  'Sodexo / Pluxee',
  'Airtel Money',
  'Freecharge',
  'Other Wallet',
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
  const { entries: ledger } = useLedgerStore();
  const isLight = theme === 'light';

  // Filter state: 'all' | 'bank' | 'cash' | 'wallet'
  const [selectedScope, setSelectedScope] = useState<'all' | EntityScope>('all');
  const [accountFilter, setAccountFilter] = useState<'all' | 'bank' | 'cash' | 'wallet'>('all');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('rb_view_cash') as ViewMode) || 'grid';
    }
    return 'grid';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_view_cash', mode);
    }
  };

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDenominationModal, setShowDenominationModal] = useState(false);
  const [denominationTargetAccount, setDenominationTargetAccount] = useState<CashLocation | null>(null);
  const [selectedAccForDetail, setSelectedAccForDetail] = useState<CashLocation | null>(null);
  const [openDetailWithAddRecord, setOpenDetailWithAddRecord] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<BankAccountItem | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<BankAccountItem | null>(null);

  // Form state for Add Account
  const [newAccScope, setNewAccScope] = useState<EntityScope>('business');
  const [newAccName, setNewAccName] = useState('');
  const [newAccBank, setNewAccBank] = useState('State Bank of India');
  const [newAccCustomBank, setNewAccCustomBank] = useState('');
  const [newAccWalletProvider, setNewAccWalletProvider] = useState('Paytm Wallet');
  const [newAccCustomWallet, setNewAccCustomWallet] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('savings');
  const [newAccLast4, setNewAccLast4] = useState('');
  const [newAccBalanceRupees, setNewAccBalanceRupees] = useState('');
  const [newAccColor, setNewAccColor] = useState('blue');
  const [newAccNotes, setNewAccNotes] = useState('');

  // Form state for Edit Account
  const [editScope, setEditScope] = useState<EntityScope>('business');
  const [editName, setEditName] = useState('');
  const [editBank, setEditBank] = useState('');
  const [editCustomBank, setEditCustomBank] = useState('');
  const [editWalletProvider, setEditWalletProvider] = useState('Paytm Wallet');
  const [editCustomWallet, setEditCustomWallet] = useState('');
  const [editType, setEditType] = useState<AccountType>('savings');
  const [editLast4, setEditLast4] = useState('');
  const [editBalanceRupees, setEditBalanceRupees] = useState('');
  const [editColor, setEditColor] = useState('blue');
  const [editNotes, setEditNotes] = useState('');

  // Transfer state
  const [fromAccId, setFromAccId] = useState('');
  const [toAccId, setToAccId] = useState('');
  const [transferAmountRupees, setTransferAmountRupees] = useState('');
  const [transferNote, setTransferNote] = useState('');

  // Scope-filtered accounts (before accountType filter, preserving category counts)
  const scopeFilteredAccounts = accounts.filter((acc) => {
    if (selectedScope !== 'all' && (acc.scope || 'business') !== selectedScope) {
      return false;
    }
    return true;
  });

  const bankCount = scopeFilteredAccounts.filter(
    (a) => a.account_type === 'savings' || a.account_type === 'current' || a.account_type === 'od_cc'
  ).length;
  const cashCount = scopeFilteredAccounts.filter((a) => a.account_type === 'cash_counter').length;
  const walletCount = scopeFilteredAccounts.filter((a) => a.account_type === 'wallet').length;

  // Filtered accounts list respecting both selected Scope and Account Type Filter
  const filteredAccounts = scopeFilteredAccounts.filter((acc) => {
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

  // Derive effective balance per account taking ledger entries into account if stored balance is 0
  const getAccountEffectiveBalance = (acc: BankAccountItem): number => {
    if (acc.balance && acc.balance !== 0) return acc.balance;
    const entries = ledger.filter((e) => e.cash_location_id === acc.id);
    if (entries.length === 0) return acc.balance || 0;
    const credits = entries
      .filter((e) => e.type === 'cash_in')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const debits = entries
      .filter((e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const net = credits - debits;
    return net !== 0 ? net : (acc.balance || 0);
  };

  const totalBalance = filteredAccounts.reduce(
    (sum, a) => sum + getAccountEffectiveBalance(a),
    0
  );

  // Auto-heal account balances in the background if stored balance is 0 but active ledger entries exist
  useEffect(() => {
    accounts.forEach((acc) => {
      if (acc.balance === 0) {
        const eff = getAccountEffectiveBalance(acc);
        if (eff !== 0) {
          syncEngine.updateAccountBalance(acc.id, eff);
        }
      }
    });
  }, [accounts, ledger]);

  // Handle Add Account
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    const balancePaise = parseToPaise(newAccBalanceRupees);
    const themeDef = COLOR_THEMES.find((c) => c.id === newAccColor) || COLOR_THEMES[0];

    const resolvedBankName =
      newAccType === 'cash_counter'
        ? 'Cash Counter'
        : newAccType === 'wallet'
        ? (newAccWalletProvider === 'Other Wallet' ? (newAccCustomWallet.trim() || 'Other Wallet') : newAccWalletProvider)
        : newAccBank === 'Other Bank'
        ? (newAccCustomBank.trim() || 'Other Bank')
        : newAccBank;

    const newAcc: BankAccountItem = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      name: newAccName.trim(),
      balance: balancePaise,
      scope: newAccScope,
      is_default: accounts.length === 0,
      account_type: newAccType,
      bank_name: resolvedBankName,
      account_number_last4: newAccLast4.trim() || undefined,
      color_theme: newAccColor,
      gradient: themeDef.gradient,
      iconColor: themeDef.iconColor,
      notes: newAccNotes.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    syncEngine.pushAccount(newAcc);
    setShowAddModal(false);
    setNewAccName('');
    setNewAccBank('State Bank of India');
    setNewAccCustomBank('');
    setNewAccWalletProvider('Paytm Wallet');
    setNewAccCustomWallet('');
    setNewAccLast4('');
    setNewAccBalanceRupees('');
    setNewAccNotes('');
    setNewAccType('savings');
    setNewAccColor('blue');
  };

  // Open Edit Account Modal
  const handleOpenEdit = (acc: BankAccountItem) => {
    setAccountToEdit(acc);
    setEditName(acc.name);
    setEditScope(acc.scope || 'business');
    if (acc.account_type === 'wallet') {
      if (WALLET_OPTIONS.includes(acc.bank_name || '')) {
        setEditWalletProvider(acc.bank_name || 'Paytm Wallet');
        setEditCustomWallet('');
      } else {
        setEditWalletProvider('Other Wallet');
        setEditCustomWallet(acc.bank_name || '');
      }
    } else {
      if (BANK_OPTIONS.includes(acc.bank_name || '')) {
        setEditBank(acc.bank_name || 'State Bank of India');
        setEditCustomBank('');
      } else {
        setEditBank('Other Bank');
        setEditCustomBank(acc.bank_name || '');
      }
    }
    setEditType(acc.account_type || 'savings');
    setEditLast4(acc.account_number_last4 || '');
    setEditBalanceRupees(acc.balance ? paiseToRupees(acc.balance).toString() : '0');
    setEditColor(acc.color_theme || 'blue');
    setEditNotes(acc.notes || '');
  };

  // Save Edit Account
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountToEdit || !editName.trim()) return;

    const themeDef = COLOR_THEMES.find((c) => c.id === editColor) || COLOR_THEMES[0];
    const newBalance = parseToPaise(editBalanceRupees);

    const resolvedBankName =
      editType === 'cash_counter'
        ? 'Cash Counter'
        : editType === 'wallet'
        ? (editWalletProvider === 'Other Wallet' ? (editCustomWallet.trim() || 'Other Wallet') : editWalletProvider)
        : editBank === 'Other Bank'
        ? (editCustomBank.trim() || 'Other Bank')
        : editBank;

    const updates: Partial<BankAccountItem> = {
      name: editName.trim(),
      bank_name: resolvedBankName,
      account_type: editType,
      scope: editScope,
      account_number_last4: editLast4.trim() || undefined,
      balance: newBalance,
      notes: editNotes.trim() || null,
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
        return <Wallet className="w-4 h-4" />;
      default:
        return <Landmark className="w-4 h-4" />;
    }
  };

  const getAccountTypeBadge = (type?: string) => {
    switch (type) {
      case 'savings':
        return 'Savings A/C (UPI)';
      case 'current':
        return 'Current A/C (UPI)';
      case 'cash_counter':
        return 'Cash Drawer';
      case 'wallet':
        return 'Prepaid Wallet';
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Primary Action Button: Full width on mobile */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 py-3.5 sm:py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-bold text-white text-xs sm:text-xs shadow-md shadow-emerald-500/25 active:scale-[0.98] transition-all min-h-[48px] sm:min-h-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Add Bank / Cash Account</span>
          </button>

          {/* Quick Tools Row: 50/50 Dual Split on Mobile */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                const defaultDrawer = accounts.find((a) => a.account_type === 'cash_counter') || accounts[0];
                setDenominationTargetAccount(defaultDrawer || null);
                setShowDenominationModal(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-3 sm:py-2.5 px-3 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 font-bold text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 active:scale-[0.98] transition-all cursor-pointer min-h-[44px] sm:min-h-0"
            >
              <Calculator className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">Count Cash</span>
            </button>

            <button
              onClick={() => {
                setFromAccId(accounts[0]?.id || '');
                setToAccId(accounts[1]?.id || '');
                setShowTransferModal(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-3 sm:py-2.5 px-3 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30 font-bold text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 active:scale-[0.98] transition-all cursor-pointer min-h-[44px] sm:min-h-0"
            >
              <ArrowRightLeft className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">Transfer</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4-Pill Sphere Lens Switcher */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-2 w-full">
        <div className="w-full sm:w-auto grid grid-cols-4 sm:flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 shadow-xs">
          <button
            onClick={() => setSelectedScope('all')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'all'
                ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">All</span>
          </button>
          <button
            onClick={() => setSelectedScope('business')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'business'
                ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300 shrink-0" />
            <span className="truncate">Biz</span>
          </button>
          <button
            onClick={() => setSelectedScope('personal')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'personal'
                ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-300 shrink-0" />
            <span className="truncate">Personal</span>
          </button>
          <button
            onClick={() => setSelectedScope('family')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'family'
                ? 'bg-white dark:bg-amber-600 text-amber-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300 shrink-0" />
            <span className="truncate">Family</span>
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
          Aggregated across {filteredAccounts.length} active bank, cash & wallet accounts
        </p>
      </div>

      {/* Filter Tabs & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setAccountFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              accountFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            All Accounts ({scopeFilteredAccounts.length})
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
            <span>Banks & UPI ({bankCount})</span>
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
            <Wallet className="w-3.5 h-3.5" />
            <span>Prepaid Wallets ({walletCount})</span>
          </button>
        </div>

        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* Accounts: Grid View vs List View */}
      {viewMode === 'grid' ? (
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
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                        acc.scope === 'personal'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : acc.scope === 'family'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {acc.scope ? (acc.scope === 'business' ? '🏢 Biz' : acc.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                    </span>

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
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Edit Button */}
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      title="Edit Account"
                      className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button (non-default only) */}
                    {!acc.is_default && (
                      <button
                        onClick={() => setAccountToDelete(acc)}
                        title="Delete Account"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Balance Amount */}
                <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {formatPaise(getAccountEffectiveBalance(acc))}
                </div>

                {/* Account Remark */}
                {acc.notes && (
                  <div className="mt-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate font-medium">
                      <strong className="text-amber-700 dark:text-amber-300">Remark:</strong> {acc.notes}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-white/10 text-xs">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>View Passbook</span>
                </span>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccForDetail(acc);
                      setOpenDetailWithAddRecord(true);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] hover:bg-emerald-500/25 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Record</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFromAccId(acc.id);
                      setShowTransferModal(true);
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <span>Transfer</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
          {filteredAccounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => setSelectedAccForDetail(acc)}
              className="p-4 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shadow-xs shrink-0 ${
                    acc.iconColor || 'bg-blue-600 text-white'
                  }`}
                >
                  {getAccountIcon(acc.account_type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                      {acc.name}
                    </h3>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                        acc.scope === 'personal'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : acc.scope === 'family'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {acc.scope ? (acc.scope === 'business' ? '🏢 Biz' : acc.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                    </span>
                    {acc.is_default ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 shrink-0">
                        Primary
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-semibold shrink-0">
                        {getAccountTypeBadge(acc.account_type)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{acc.bank_name || 'Bank'}</span>
                    {acc.account_number_last4 && (
                      <span className="font-mono text-[11px] text-slate-400">
                        •••• {acc.account_number_last4}
                      </span>
                    )}
                  </div>
                  {acc.notes && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 max-w-fit font-medium">
                      <FileText className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate"><strong className="text-amber-800 dark:text-amber-200">Remark:</strong> {acc.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-left sm:text-right">
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                    {formatPaise(getAccountEffectiveBalance(acc))}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Available balance</span>
                </div>

                <div className="flex items-center gap-1">
                  {(acc.account_type === 'cash_counter' || acc.name.toLowerCase().includes('cash')) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDenominationTargetAccount(acc);
                        setShowDenominationModal(true);
                      }}
                      title="Count Physical Notes"
                      className="p-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                    >
                      <Calculator className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccForDetail(acc);
                      setOpenDetailWithAddRecord(true);
                    }}
                    title="Quick Record Transaction"
                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFromAccId(acc.id);
                      setShowTransferModal(true);
                    }}
                    title="Transfer Funds"
                    className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(acc)}
                    title="Edit Account"
                    className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {!acc.is_default && (
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(acc)}
                      title="Delete Account"
                      className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POPUP: Account Passbook Detail */}
      {selectedAccForDetail && (
        <AccountDetailModal
          account={selectedAccForDetail}
          initialOpenAddRecord={openDetailWithAddRecord}
          onClose={() => {
            setSelectedAccForDetail(null);
            setOpenDetailWithAddRecord(false);
          }}
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
      )}

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
              {/* Sphere Selector: Business / Personal / Family */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Entity Sphere (Financial Lens)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'business', label: '🏢 Business' },
                    { id: 'personal', label: '👤 Personal' },
                    { id: 'family', label: '👨‍👩‍👧‍👦 Family' },
                  ].map((s) => {
                    const isSelected = newAccScope === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setNewAccScope(s.id as EntityScope)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-transparent shadow-xs'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Account Type
                </label>
                <select
                  value={newAccType}
                  onChange={(e) => {
                    const val = e.target.value as AccountType;
                    setNewAccType(val);
                    if (val === 'wallet') {
                      setNewAccName(newAccWalletProvider);
                    } else if (val === 'cash_counter') {
                      setNewAccName('Cash Counter');
                    } else if (newAccName === 'Cash Counter' || WALLET_OPTIONS.includes(newAccName)) {
                      setNewAccName(`${newAccBank} Account`);
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="savings" className="dark:bg-slate-900">Savings Account (Bank / UPI)</option>
                  <option value="current" className="dark:bg-slate-900">Current Account (Bank / UPI / GST)</option>
                  <option value="cash_counter" className="dark:bg-slate-900">Physical Cash Drawer / Counter</option>
                  <option value="wallet" className="dark:bg-slate-900">Prepaid Wallet (Paytm Wallet, Amazon Pay, Mobikwik)</option>
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
                  placeholder={
                    newAccType === 'wallet'
                      ? 'e.g. My Paytm Wallet, Amazon Pay Balance'
                      : newAccType === 'cash_counter'
                      ? 'e.g. Shop Cash Drawer, Main Till'
                      : 'e.g. SBI Main Branch, Salary Account'
                  }
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Bank Issuer (only if bank account) */}
              {newAccType !== 'cash_counter' && newAccType !== 'wallet' && (
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Bank Issuer (UPI Linked Bank)
                      </label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        ⚡ UPI Linked
                      </span>
                    </div>
                    <select
                      value={newAccBank}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewAccBank(val);
                        if (val !== 'Other Bank' && (!newAccName.trim() || newAccName.includes('Bank') || newAccName.includes('Account'))) {
                          setNewAccName(`${val} Account`);
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    >
                      {BANK_OPTIONS.map((b) => (
                        <option key={b} value={b} className="dark:bg-slate-900">
                          {b}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      UPI payments (GPay, PhonePe, Paytm UPI, BHIM) debit and credit directly from this bank account.
                    </p>
                  </div>

                  {/* If Other Bank selected: Show Custom Bank Name Input */}
                  {newAccBank === 'Other Bank' && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2 animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Enter Bank Name
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Yes Bank, IDFC FIRST Bank, Federal Bank, Bandhan Bank"
                        value={newAccCustomBank}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewAccCustomBank(val);
                          if (!newAccName.trim() || newAccName.includes('Bank') || newAccName.includes('Account')) {
                            setNewAccName(`${val.trim()} Account`.trim());
                          }
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {['Yes Bank', 'IDFC FIRST', 'Federal Bank', 'Bandhan Bank', 'Bank of India', 'Central Bank'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => {
                              setNewAccCustomBank(b);
                              if (!newAccName.trim() || newAccName.includes('Bank') || newAccName.includes('Account')) {
                                setNewAccName(`${b} Account`);
                              }
                            }}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-white/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-white/15 transition-colors cursor-pointer"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Wallet Provider (only if prepaid wallet) */}
              {newAccType === 'wallet' && (
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Prepaid Wallet Provider
                      </label>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                        Independent Balance
                      </span>
                    </div>
                    <select
                      value={newAccWalletProvider}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewAccWalletProvider(val);
                        if (val !== 'Other Wallet' && (!newAccName.trim() || newAccName.includes('Wallet') || newAccName.includes('Account'))) {
                          setNewAccName(val);
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    >
                      {WALLET_OPTIONS.map((w) => (
                        <option key={w} value={w} className="dark:bg-slate-900">
                          {w}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Prepaid wallets maintain a standalone stored-value balance separate from bank accounts.
                    </p>
                  </div>

                  {newAccWalletProvider === 'Other Wallet' && (
                    <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-2 animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                        Enter Wallet Provider Name
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. JioMoney, Bajaj Pay, Uber Cash, PayZapp"
                        value={newAccCustomWallet}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewAccCustomWallet(val);
                          if (!newAccName.trim() || newAccName.includes('Wallet')) {
                            setNewAccName(val.trim() ? `${val.trim()} Wallet` : 'Custom Wallet');
                          }
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-purple-300 dark:border-purple-500/30 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {['Bajaj Pay', 'JioMoney', 'Uber Cash', 'PayZapp'].map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => {
                              setNewAccCustomWallet(w);
                              setNewAccName(`${w} Wallet`);
                            }}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-white/10 border border-purple-200 dark:border-purple-500/30 text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-white/15 transition-colors cursor-pointer"
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Last 4 Digits */}
              {newAccType !== 'cash_counter' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {newAccType === 'wallet'
                      ? 'Registered Mobile / Wallet Last 4 Digits (Optional)'
                      : 'Last 4 Digits of Account No. (Optional)'}
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder={newAccType === 'wallet' ? 'e.g. 9845' : 'e.g. 4821'}
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

              {/* Remark / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Remark / Account Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary salary account, Shop cash counter, GST vendor payouts"
                  value={newAccNotes}
                  onChange={(e) => setNewAccNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                />
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
              {/* Sphere Selector: Business / Personal / Family */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Entity Sphere (Financial Lens)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'business', label: '🏢 Business' },
                    { id: 'personal', label: '👤 Personal' },
                    { id: 'family', label: '👨‍👩‍👧‍👦 Family' },
                  ].map((s) => {
                    const isSelected = editScope === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditScope(s.id as EntityScope)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-transparent shadow-xs'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Account Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as AccountType)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="savings" className="dark:bg-slate-900">Savings Account (Bank / UPI)</option>
                  <option value="current" className="dark:bg-slate-900">Current Account (Bank / UPI)</option>
                  <option value="cash_counter" className="dark:bg-slate-900">Physical Cash Drawer</option>
                  <option value="wallet" className="dark:bg-slate-900">Prepaid Wallet (Paytm/Amazon/Mobikwik)</option>
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

              {/* Bank Issuer (only if bank account) */}
              {editType !== 'cash_counter' && editType !== 'wallet' && (
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Bank Issuer (UPI Linked Bank)
                      </label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        ⚡ UPI Linked
                      </span>
                    </div>
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

                  {editBank === 'Other Bank' && (
                    <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 space-y-2 animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                        Enter Bank Name
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Yes Bank, IDFC FIRST Bank, Federal Bank, Bandhan Bank"
                        value={editCustomBank}
                        onChange={(e) => setEditCustomBank(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-indigo-300 dark:border-indigo-500/30 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {['Yes Bank', 'IDFC FIRST', 'Federal Bank', 'Bandhan Bank', 'Bank of India', 'Central Bank'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setEditCustomBank(b)}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-white/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-white/15 transition-colors cursor-pointer"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Wallet Provider (only if prepaid wallet) */}
              {editType === 'wallet' && (
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Prepaid Wallet Provider
                      </label>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                        Independent Balance
                      </span>
                    </div>
                    <select
                      value={editWalletProvider}
                      onChange={(e) => setEditWalletProvider(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      {WALLET_OPTIONS.map((w) => (
                        <option key={w} value={w} className="dark:bg-slate-900">
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>

                  {editWalletProvider === 'Other Wallet' && (
                    <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 space-y-2 animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                        Enter Wallet Provider Name
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. JioMoney, Bajaj Pay, Uber Cash, PayZapp"
                        value={editCustomWallet}
                        onChange={(e) => setEditCustomWallet(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-indigo-300 dark:border-indigo-500/30 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {['Bajaj Pay', 'JioMoney', 'Uber Cash', 'PayZapp'].map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setEditCustomWallet(w)}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-white/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-white/15 transition-colors cursor-pointer"
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Last 4 Digits */}
              {editType !== 'cash_counter' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {editType === 'wallet' ? 'Registered Mobile Last 4 Digits (Optional)' : 'Last 4 Digits (Optional)'}
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

              {/* Remark / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Remark / Account Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary salary account, Shop cash counter, GST vendor payouts"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                />
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
                      {a.name} ({formatPaise(getAccountEffectiveBalance(a))})
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
                      {a.name} ({formatPaise(getAccountEffectiveBalance(a))})
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
