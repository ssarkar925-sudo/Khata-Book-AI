'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  Plus,
  Search,
  Filter,
  Camera,
  Mic,
  Calendar,
  Wallet,
  CreditCard,
  Users,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowRight,
  Download,
  Trash2,
  Tag,
  CheckCircle2,
  Clock,
  Sparkles,
  PieChart,
  ChevronDown,
  Building2,
  Zap,
  Coffee,
  Car,
  Package,
  Wrench,
  Megaphone,
  Truck,
  HelpCircle,
  Globe,
  User,
  Users2,
} from 'lucide-react';
import { TabType, LedgerEntry, PaymentMode, EntityScope } from '@/types';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useCardStore } from '@/stores/useCardStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { formatPaise, parseToPaise } from '@/lib/money';
import { getCategoryById, EXPENSE_CATEGORIES } from '@/lib/categories';
import { syncEngine } from '@/lib/syncEngine';
import { ViewToggle, ViewMode } from '@/components/common/ViewToggle';

interface ExpensesScreenProps {
  onNavigateTab: (tab: TabType) => void;
  onOpenScanner?: () => void;
  onOpenVoice?: () => void;
  onOpenQuickExpense?: () => void;
}

type DateRangeFilter = 'today' | 'this_week' | 'this_month' | 'last_month' | 'all';

export function ExpensesScreen({
  onNavigateTab,
  onOpenScanner,
  onOpenVoice,
  onOpenQuickExpense,
}: ExpensesScreenProps) {
  const { entries: ledger, removeEntryOptimistic } = useLedgerStore();
  const { accounts } = useAccountStore();
  const { cards } = useCardStore();
  const { customers } = useCustomerStore();
  const { theme, activeWorkspaceId } = useSessionStore();
  const isLight = theme === 'light';

  // Filters
  const [selectedScope, setSelectedScope] = useState<'all' | EntityScope>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('this_month');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('rb_view_expenses') as ViewMode) || 'list';
    }
    return 'list';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_view_expenses', mode);
    }
  };

  // New Expense Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [expenseScope, setExpenseScope] = useState<EntityScope>('business');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('food');
  const [expenseMode, setExpenseMode] = useState<PaymentMode>('upi');
  const [expenseAccountId, setExpenseAccountId] = useState(accounts[0]?.id || '');
  const [expenseCardId, setExpenseCardId] = useState(cards[0]?.id || '');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Filter raw ledger down to expense items (cash_out, expense, card_spend, bill_payment)
  const allExpenses = useMemo(() => {
    return ledger.filter(
      (e) =>
        (e.type === 'cash_out' ||
          e.type === 'expense' ||
          e.type === 'card_spend' ||
          e.type === 'bill_payment') &&
        (selectedScope === 'all' || (e.scope || 'business') === selectedScope)
    );
  }, [ledger, selectedScope]);

  // Date Filtering helper
  const dateFilteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return allExpenses.filter((e) => {
      const entryDate = new Date(e.entry_date);
      const entryDateStr = e.entry_date.slice(0, 10);

      if (dateRange === 'today') {
        return entryDateStr === todayStr;
      }
      if (dateRange === 'this_week') {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        return entryDate >= startOfWeek;
      }
      if (dateRange === 'this_month') {
        return (
          entryDate.getFullYear() === now.getFullYear() &&
          entryDate.getMonth() === now.getMonth()
        );
      }
      if (dateRange === 'last_month') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return entryDate.getFullYear() === year && entryDate.getMonth() === lastMonth;
      }
      return true; // all
    });
  }, [allExpenses, dateRange]);

  // Secondary filters (search, category, payment mode, account)
  const filteredExpenses = useMemo(() => {
    return dateFilteredExpenses.filter((e) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const noteMatch = (e.note || '').toLowerCase().includes(q);
        const cat = getCategoryById(e.category_id || '');
        const catMatch = cat.name.toLowerCase().includes(q);
        if (!noteMatch && !catMatch) return false;
      }
      // Category
      if (selectedCategory !== 'all' && (e.category_id || 'general') !== selectedCategory) {
        return false;
      }
      // Mode
      if (selectedMode !== 'all' && e.mode !== selectedMode) {
        return false;
      }
      // Account / Card
      if (selectedAccount !== 'all') {
        if (selectedAccount.startsWith('card_')) {
          const cardId = selectedAccount.replace('card_', '');
          if (e.card_id !== cardId) return false;
        } else {
          if (e.cash_location_id !== selectedAccount) return false;
        }
      }
      return true;
    });
  }, [dateFilteredExpenses, searchQuery, selectedCategory, selectedMode, selectedAccount]);

  // Analytics Metrics
  const { totalSpentPaise, dailyAveragePaise, topCategory, categoryStats } = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Days count in current filter
    let days = 1;
    if (dateRange === 'this_month') {
      days = Math.max(1, new Date().getDate());
    } else if (dateRange === 'this_week') {
      days = Math.max(1, new Date().getDay() || 7);
    } else if (dateRange === 'last_month') {
      days = 30;
    } else if (dateRange === 'all') {
      days = Math.max(1, filteredExpenses.length ? 30 : 1);
    }
    const dailyAvg = Math.round(total / days);

    // Category breakdown
    const map = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const catId = e.category_id || 'general';
      map.set(catId, (map.get(catId) || 0) + Number(e.amount));
    });

    const stats = Array.from(map.entries())
      .map(([catId, amt]) => ({
        category: getCategoryById(catId),
        amount: amt,
        pct: total > 0 ? Math.round((amt / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalSpentPaise: total,
      dailyAveragePaise: dailyAvg,
      topCategory: stats[0] || null,
      categoryStats: stats,
    };
  }, [filteredExpenses, dateRange]);

  // Handle Create Expense
  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(expenseAmount);
    if (paise <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }

    const newEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId || '00000000-0000-0000-0000-000000000010',
      type: expenseMode === 'card' ? 'card_spend' : 'expense',
      amount: paise,
      scope: expenseScope,
      category_id: expenseCategory,
      cash_location_id: expenseMode !== 'card' ? expenseAccountId : undefined,
      card_id: expenseMode === 'card' ? expenseCardId : undefined,
      mode: expenseMode,
      note: expenseNote.trim() || 'Expense Recorded',
      entry_date: new Date(expenseDate).toISOString(),
    };

    syncEngine.pushLedgerEntry(newEntry);
    setShowAddModal(false);
    setExpenseAmount('');
    setExpenseNote('');
  };

  // Handle Delete Expense
  const handleDeleteExpense = (id: string, note?: string | null) => {
    if (confirm(`Delete expense "${note || 'Transaction'}"?`)) {
      syncEngine.deleteLedgerEntry(id);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Sphere', 'Amount (INR)', 'Category', 'Payment Mode', 'Source / Account', 'Note'];
    const rows = filteredExpenses.map((e) => {
      const cat = getCategoryById(e.category_id || '');
      const acc = accounts.find((a) => a.id === e.cash_location_id);
      const card = cards.find((c) => c.id === e.card_id);
      const source = card ? `Card: ${card.name}` : acc ? `Bank: ${acc.name}` : e.mode;
      const sphere = (e.scope || 'business').toUpperCase();
      return [
        e.entry_date.slice(0, 10),
        sphere,
        (Number(e.amount) / 100).toFixed(2),
        cat.name,
        e.mode.toUpperCase(),
        source,
        `"${(e.note || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expenses_Export_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* 1. TOP HEADER & HERO SUMMARY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/25">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span>Expense Manager</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dedicated expense tracking. Categorize spends, link with bank accounts & cards, and view tax reports.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Primary Action Button: Full width on mobile */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 py-3.5 sm:py-2.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 font-bold text-white text-xs shadow-md shadow-rose-500/25 active:scale-[0.98] transition-all min-h-[48px] sm:min-h-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Add Expense</span>
          </button>

          {/* Quick Tools Row: 50/50 Dual Split on Mobile */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-3 sm:py-2 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-500/25 active:scale-[0.98] transition-all min-h-[44px] sm:min-h-0 cursor-pointer"
                title="Scan bill or receipt with camera"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Bill</span>
              </button>
            )}

            {onOpenVoice && (
              <button
                onClick={onOpenVoice}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-3 sm:py-2 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm shadow-indigo-500/25 active:scale-[0.98] transition-all min-h-[44px] sm:min-h-0 cursor-pointer"
                title="Speak expense in Hindi or English"
              >
                <Mic className="w-4 h-4" />
                <span>Voice</span>
              </button>
            )}
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
                ? 'bg-white dark:bg-rose-600 text-rose-700 dark:text-white shadow-xs'
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

      {/* 2. HERO SPENDING METRICS CARD */}
      <div
        className={`rounded-3xl border p-5 sm:p-6 transition-all ${
          isLight
            ? 'bg-gradient-to-br from-white via-rose-50/30 to-red-50/20 border-slate-200 shadow-sm'
            : 'bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-950 border-white/10 shadow-xl'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/5 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Total Expenses Spent ({dateRange.replace('_', ' ').toUpperCase()})
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
              {formatPaise(totalSpentPaise)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span>{filteredExpenses.length} transactions recorded</span>
              <span>•</span>
              <span>Daily avg: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatPaise(dailyAveragePaise)}</strong></span>
            </div>
          </div>

          {/* Timeframe Presets */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold self-start md:self-auto">
            {(['today', 'this_week', 'this_month', 'last_month', 'all'] as DateRangeFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setDateRange(tab)}
                className={`px-3 py-1.5 rounded-xl capitalize transition-all ${
                  dateRange === tab
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab === 'all' ? 'All Time' : tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Category Visual Distribution Bar */}
        {categoryStats.length > 0 && (
          <div className="pt-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">Spending Breakdown by Category</span>
              {topCategory && (
                <span className="text-slate-600 dark:text-slate-300">
                  Top spend: <strong className="text-rose-600 dark:text-rose-400">{topCategory.category.name} ({topCategory.pct}%)</strong>
                </span>
              )}
            </div>

            <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
              {categoryStats.slice(0, 6).map((item) => (
                <div
                  key={item.category.id}
                  style={{
                    width: `${Math.max(item.pct, 3)}%`,
                    backgroundColor: item.category.color,
                  }}
                  className="h-full transition-all"
                  title={`${item.category.name}: ${formatPaise(item.amount)} (${item.pct}%)`}
                />
              ))}
            </div>

            {/* Quick Category Badges */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
              {categoryStats.slice(0, 5).map((item) => (
                <button
                  key={item.category.id}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === item.category.id ? 'all' : item.category.id)
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${
                    selectedCategory === item.category.id
                      ? 'ring-2 ring-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold'
                      : 'border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.category.color }} />
                  <span>{item.category.name}</span>
                  <span className="font-mono text-slate-400">{formatPaise(item.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. CROSS-LINKING SHORTCUT BANNERS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* Link to Reports */}
        <div
          onClick={() => onNavigateTab('reports')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all hover-lift touch-press flex items-center justify-between ${
            isLight
              ? 'bg-blue-50/60 border-blue-200 text-blue-900'
              : 'bg-blue-950/20 border-blue-500/20 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold block">Tax & P&L Reports</span>
              <span className="text-[11px] opacity-75">View GST breakdown and monthly analytics</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-500" />
        </div>

        {/* Link to Bank & Cash Accounts */}
        <div
          onClick={() => onNavigateTab('cash')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all hover-lift touch-press flex items-center justify-between ${
            isLight
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
              : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold block">Bank & Cash Accounts</span>
              <span className="text-[11px] opacity-75">Verify account balances and ledger entries</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-500" />
        </div>

        {/* Link to Credit Cards */}
        <div
          onClick={() => onNavigateTab('cards')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all hover-lift touch-press flex items-center justify-between ${
            isLight
              ? 'bg-purple-50/60 border-purple-200 text-purple-900'
              : 'bg-purple-950/20 border-purple-500/20 text-purple-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold block">Credit Card Spends</span>
              <span className="text-[11px] opacity-75">Track billing cycles and outstanding balances</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-purple-500" />
        </div>
      </div>

      {/* 4. EXPENSE LIST & FILTER CONTROLS */}
      <div
        className={`rounded-3xl border shadow-sm transition-all overflow-hidden ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-white/10'
        }`}
      >
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search expenses, vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Dropdown Filters & Export */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Payment Mode */}
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">All Modes</option>
              <option value="upi">UPI / QR</option>
              <option value="cash">Physical Cash</option>
              <option value="card">Credit / Debit Card</option>
              <option value="bank">Bank Transfer / IMPS</option>
            </select>

            {/* Account / Card Source Filter */}
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">All Payment Sources</option>
              <optgroup label="Bank Accounts & Cash Counters">
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    🏦 {acc.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Credit Cards">
                {cards.map((card) => (
                  <option key={card.id} value={`card_${card.id}`}>
                    💳 {card.name} (•• {card.last4})
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Download filtered expenses as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Expenses: Grid View vs List View */}
        {filteredExpenses.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">No expenses found</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                No records match your selected filters. Click &quot;+ Add Expense&quot; or scan a receipt.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-600/20 cursor-pointer"
            >
              + Record Expense
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredExpenses.map((expense) => {
              const cat = getCategoryById(expense.category_id || '');
              const acc = accounts.find((a) => a.id === expense.cash_location_id);
              const card = cards.find((c) => c.id === expense.card_id);
              const customer = customers.find((c) => c.id === expense.customer_id);

              return (
                <div
                  key={expense.id}
                  className={`p-4 rounded-3xl border transition-all hover-lift flex flex-col justify-between gap-3 ${
                    isLight
                      ? 'bg-slate-50/60 border-slate-200 hover:border-slate-300 shadow-xs'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                          style={{
                            backgroundColor: `${cat.color}15`,
                            color: cat.color,
                          }}
                        >
                          <TrendingDown className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider block truncate"
                            style={{
                              backgroundColor: `${cat.color}20`,
                              color: cat.color,
                            }}
                          >
                            {cat.name}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {new Date(expense.entry_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0 ${
                          expense.scope === 'personal'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : expense.scope === 'family'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {expense.scope ? (expense.scope === 'business' ? '🏢 Biz' : expense.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-2.5 line-clamp-2">
                      {expense.note || cat.name}
                    </h4>

                    {/* Cross-link chips */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap text-xs">
                      {acc && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('cash')}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-medium text-[10px] border border-emerald-200 dark:border-emerald-500/20 hover:underline"
                        >
                          <Wallet className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[120px]">{acc.name}</span>
                        </button>
                      )}
                      {card && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('cards')}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-medium text-[10px] border border-purple-200 dark:border-purple-500/20 hover:underline"
                        >
                          <CreditCard className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[120px]">{card.name}</span>
                        </button>
                      )}
                      {customer && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('dues')}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 font-medium text-[10px] border border-cyan-200 dark:border-cyan-500/20 hover:underline"
                        >
                          <Users className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[120px]">{customer.name}</span>
                        </button>
                      )}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 uppercase font-mono font-bold">
                        {expense.mode}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/60 dark:border-white/10">
                    <div className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                      - {formatPaise(expense.amount)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(expense.id, expense.note)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredExpenses.map((expense) => {
              const cat = getCategoryById(expense.category_id || '');
              const acc = accounts.find((a) => a.id === expense.cash_location_id);
              const card = cards.find((c) => c.id === expense.card_id);
              const customer = customers.find((c) => c.id === expense.customer_id);

              return (
                <div
                  key={expense.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors group"
                >
                  {/* Left: Category Icon, Note, Date */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                      style={{
                        backgroundColor: `${cat.color}15`,
                        color: cat.color,
                      }}
                    >
                      <TrendingDown className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {expense.note || cat.name}
                        </span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${cat.color}20`,
                            color: cat.color,
                          }}
                        >
                          {cat.name}
                        </span>
                      </div>

                      {/* Cross-linking Badges */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {new Date(expense.entry_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>

                        {/* Link to Bank Account */}
                        {acc && (
                          <button
                            onClick={() => onNavigateTab('cash')}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-medium text-[11px] border border-emerald-200 dark:border-emerald-500/20 hover:underline"
                            title="Paid from bank/cash account - click to inspect"
                          >
                            <Wallet className="w-3 h-3" />
                            <span>{acc.name}</span>
                          </button>
                        )}

                        {/* Link to Credit Card */}
                        {card && (
                          <button
                            onClick={() => onNavigateTab('cards')}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-medium text-[11px] border border-purple-200 dark:border-purple-500/20 hover:underline"
                            title="Paid via credit card - click to inspect"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>{card.name} (•• {card.last4})</span>
                          </button>
                        )}

                        {/* Link to Customer / Vendor */}
                        {customer && (
                          <button
                            onClick={() => onNavigateTab('dues')}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 font-medium text-[11px] border border-cyan-200 dark:border-cyan-500/20 hover:underline"
                            title="Vendor / Person - click to inspect dues"
                          >
                            <Users className="w-3 h-3" />
                            <span>{customer.name}</span>
                          </button>
                        )}

                        {/* Payment Mode */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 uppercase font-mono font-bold">
                          {expense.mode}
                        </span>

                        {/* Sphere Badge */}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                            expense.scope === 'personal'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : expense.scope === 'family'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {expense.scope ? (expense.scope === 'business' ? '🏢 Biz' : expense.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Delete Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center">
                    <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                      - {formatPaise(expense.amount)}
                    </span>

                    <button
                      onClick={() => handleDeleteExpense(expense.id, expense.note)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. ADD EXPENSE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Record New Expense</h3>
                  <p className="text-[11px] text-slate-400">Track spending and debit corresponding account</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
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
                    const isSelected = expenseScope === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setExpenseScope(s.id as EntityScope)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-rose-600 text-white border-transparent shadow-xs'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-base font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Note / Description */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Expense Note / Vendor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Office electricity bill, Client lunch, Tea"
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={expenseMode}
                    onChange={(e) => setExpenseMode(e.target.value as PaymentMode)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="upi">UPI / QR</option>
                    <option value="cash">Cash</option>
                    <option value="card">Credit Card</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>

                {/* Source: Account or Card */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {expenseMode === 'card' ? 'Charge Card' : 'Paid From Account'}
                  </label>
                  {expenseMode === 'card' ? (
                    <select
                      value={expenseCardId}
                      onChange={(e) => setExpenseCardId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (•• {c.last4})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={expenseAccountId}
                      onChange={(e) => setExpenseAccountId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Expense Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono font-medium text-slate-900 dark:text-white"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/25"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
