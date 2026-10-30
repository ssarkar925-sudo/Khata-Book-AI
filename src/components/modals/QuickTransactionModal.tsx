'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Landmark,
  Calendar,
  Tag,
  CreditCard,
  Smartphone,
  Coins,
  Package,
  Building2,
  Zap,
  Users,
  Coffee,
  Car,
  Megaphone,
  Wrench,
  Truck,
  TrendingUp,
  Briefcase,
  Check,
} from 'lucide-react';
import { PaymentMode, LedgerEntry, EntityScope } from '@/types';
import { parseToPaise, formatPaise } from '@/lib/money';
import { useAccountStore } from '@/stores/useAccountStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { EXPENSE_CATEGORIES, ExpenseCategoryDef } from '@/lib/categories';

interface QuickTransactionModalProps {
  isOpen: boolean;
  type: 'in' | 'out';
  initialScope?: EntityScope;
  onClose: () => void;
  onSubmit: (data: {
    amountPaise: number;
    categoryId: string;
    accountId?: string;
    mode: PaymentMode;
    note: string;
    entryDate: string;
    scope?: EntityScope;
  }) => void;
}

export function QuickTransactionModal({
  isOpen,
  type,
  initialScope,
  onClose,
  onSubmit,
}: QuickTransactionModalProps) {
  const { accounts } = useAccountStore();
  const { userRole, workspaces, activeWorkspaceId } = useSessionStore();
  const isViewer = userRole === 'viewer';

  // Determine starting scope from initialScope, active workspace name, or first account
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const inferredWsScope: EntityScope = activeWs?.name.toLowerCase().includes('personal')
    ? 'personal'
    : activeWs?.name.toLowerCase().includes('family')
    ? 'family'
    : 'business';

  const defaultEffectiveScope = initialScope || inferredWsScope;

  const [amountRupees, setAmountRupees] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [selectedScope, setSelectedScope] = useState<EntityScope>(defaultEffectiveScope);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedMode, setSelectedMode] = useState<PaymentMode>('upi');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    if (isOpen) {
      setAmountRupees('');
      setNote('');
      setEntryDate(new Date().toISOString().slice(0, 10));
      // Default category based on type
      if (type === 'in') {
        setSelectedCategory('sales_revenue');
      } else {
        setSelectedCategory('food');
      }

      const startingScope = initialScope || inferredWsScope;
      setSelectedScope(startingScope);

      // Pick first account matching this scope
      const scopeMatchingAccs = accounts.filter(
        (a) => (a.scope || 'business') === startingScope
      );
      if (scopeMatchingAccs.length > 0) {
        setSelectedAccountId(scopeMatchingAccs[0].id);
      } else if (accounts.length > 0) {
        setSelectedAccountId(accounts[0].id);
      } else {
        setSelectedAccountId('');
      }
    }
  }, [isOpen, type, initialScope, accounts]);

  if (!isOpen) return null;

  const isInflow = type === 'in';

  // Filter categories relevant for inflow vs outflow
  const relevantCategories = EXPENSE_CATEGORIES.filter((c) =>
    isInflow ? c.type === 'income' || c.type === 'both' : c.type === 'expense' || c.type === 'both'
  );

  const handleAddQuickAmount = (extraRupees: number) => {
    const current = parseFloat(amountRupees) || 0;
    setAmountRupees((current + extraRupees).toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(amountRupees);
    if (paise <= 0) return;

    onSubmit({
      amountPaise: paise,
      categoryId: selectedCategory,
      accountId: selectedAccountId || undefined,
      mode: selectedMode,
      note: note.trim(),
      entryDate: new Date(entryDate).toISOString(),
      scope: selectedScope,
    });
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Package':
        return <Package className="w-3.5 h-3.5" />;
      case 'Building2':
        return <Building2 className="w-3.5 h-3.5" />;
      case 'Zap':
        return <Zap className="w-3.5 h-3.5" />;
      case 'Users':
        return <Users className="w-3.5 h-3.5" />;
      case 'Coffee':
        return <Coffee className="w-3.5 h-3.5" />;
      case 'Car':
        return <Car className="w-3.5 h-3.5" />;
      case 'Megaphone':
        return <Megaphone className="w-3.5 h-3.5" />;
      case 'Wrench':
        return <Wrench className="w-3.5 h-3.5" />;
      case 'Truck':
        return <Truck className="w-3.5 h-3.5" />;
      case 'TrendingUp':
        return <TrendingUp className="w-3.5 h-3.5" />;
      case 'Briefcase':
        return <Briefcase className="w-3.5 h-3.5" />;
      default:
        return <Tag className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                isInflow
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/25'
                  : 'bg-gradient-to-tr from-rose-500 to-red-500 shadow-rose-500/25'
              }`}
            >
              {isInflow ? (
                <ArrowDownLeft className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {isInflow ? 'Record Cash Inflow (+)' : 'Record Outflow / Expense (−)'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isInflow
                  ? 'Add revenue, client payment, or cash deposit'
                  : 'Track shop kharcha, bills, inventory & purchases'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Amount Input with Large Styling */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                required
                autoFocus
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-2xl font-black text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
              {[100, 500, 1000, 2000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleAddQuickAmount(amt)}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 shrink-0 transition-colors"
                >
                  +₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selector Grid */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {relevantCategories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-left border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className="p-1 rounded-lg"
                      style={{
                        backgroundColor: isSelected ? cat.color + '25' : 'transparent',
                        color: cat.color,
                      }}
                    >
                      {getCategoryIcon(cat.iconName)}
                    </span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sphere Selector: Business / Personal / Family */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Entity Sphere (Financial Lens)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'business', label: '🏢 Business' },
                { id: 'personal', label: '👤 Personal' },
                { id: 'family', label: '👨‍👩‍👧‍👦 Family' },
              ].map((s) => {
                const isSelected = selectedScope === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const newScope = s.id as EntityScope;
                      setSelectedScope(newScope);
                      const matchingAccs = accounts.filter(
                        (a) => (a.scope || 'business') === newScope
                      );
                      if (matchingAccs.length > 0) {
                        setSelectedAccountId(matchingAccs[0].id);
                      }
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                        : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paid Through / Bank Account Dropdown Filtered by Category / Sphere */}
          {(() => {
            const scopeAccounts = accounts.filter(
              (a) => (a.scope || 'business') === selectedScope
            );
            const otherAccounts = accounts.filter(
              (a) => (a.scope || 'business') !== selectedScope
            );

            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {isInflow ? 'Deposit Into (Bank / Cash)' : 'Paid From (Bank / Cash)'}
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {selectedScope.toUpperCase()} ({scopeAccounts.length})
                  </span>
                </div>
                <select
                  value={selectedAccountId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedAccountId(newId);
                    const matched = accounts.find((a) => a.id === newId);
                    if (matched && matched.scope && matched.scope !== selectedScope) {
                      setSelectedScope(matched.scope);
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  {scopeAccounts.length > 0 ? (
                    <optgroup label={`${selectedScope.toUpperCase()} ACCOUNTS (${scopeAccounts.length})`}>
                      {scopeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} className="dark:bg-slate-900 font-semibold">
                          {acc.name} — Balance: {formatPaise(acc.balance)}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option value="" disabled className="dark:bg-slate-900 text-slate-400">
                      No {selectedScope.toUpperCase()} accounts found
                    </option>
                  )}

                  {otherAccounts.length > 0 && (
                    <optgroup label="OTHER SPHERES (CROSS-SPHERE / SWITCH)">
                      {otherAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} className="dark:bg-slate-900 text-slate-400">
                          {acc.name} ({(acc.scope || 'business').toUpperCase()}) — Balance: {formatPaise(acc.balance)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <span className="text-[10px] text-slate-400 block">
                  {isInflow
                    ? 'Selected account balance will increase automatically.'
                    : 'Selected account balance will be deducted automatically.'}
                </span>
              </div>
            );
          })()}

          {/* Payment Mode Pills */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Payment Mode
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'upi', label: 'UPI / QR', icon: <Smartphone className="w-3.5 h-3.5" /> },
                { id: 'cash', label: 'Cash', icon: <Coins className="w-3.5 h-3.5" /> },
                { id: 'bank', label: 'Net Banking', icon: <Landmark className="w-3.5 h-3.5" /> },
                { id: 'card', label: 'Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
              ].map((m) => {
                const isSelected = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id as PaymentMode)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker & Note Field */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Note / Description (Optional)
              </label>
              <input
                type="text"
                placeholder={isInflow ? 'e.g. Sales, Project Advance' : 'e.g. Grocery, Electricity, Office Tea'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Viewer Role Notice */}
          {isViewer && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
              <span className="font-bold">Read-Only Workspace:</span> You have Viewer access. Creating or modifying financial records is restricted to owners and members.
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-2 flex gap-2 shrink-0 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isViewer || !amountRupees || parseFloat(amountRupees) <= 0}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isInflow
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-500/25'
              }`}
            >
              {isViewer ? 'Read-Only (Viewer)' : isInflow ? 'Save Inflow' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
