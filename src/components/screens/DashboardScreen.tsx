'use client';

import React, { useState, useMemo } from 'react';
import {
  Wallet,
  CreditCard,
  Users,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Camera,
  Mic,
  Repeat,
  Building2,
  User,
  Users2,
  Globe,
  FileSpreadsheet,
  StickyNote,
  ShieldCheck,
  Lock,
  Unlock,
  PieChart,
  BarChart3,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useSheetStore } from '@/stores/useSheetStore';
import { useNoteStore } from '@/stores/useNoteStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { formatPaise } from '@/lib/money';
import { TabType, LedgerEntry, EntityScope } from '@/types';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { InterSphereTransferModal } from '@/components/modals/InterSphereTransferModal';
import { CardSpendModal } from '@/components/modals/CardSpendModal';
import { getCategoryById } from '@/lib/categories';

interface DashboardProps {
  onNavigateTab: (tab: TabType) => void;
  onOpenAskAI: () => void;
  onQuickCashIn: () => void;
  onQuickCashOut: () => void;
  onOpenScanner?: () => void;
  onOpenVoice?: () => void;
}

export function DashboardScreen({
  onNavigateTab,
  onOpenAskAI,
  onQuickCashIn,
  onQuickCashOut,
  onOpenScanner,
  onOpenVoice,
}: DashboardProps) {
  const { entries: ledger } = useLedgerStore();
  const { dues, customers } = useCustomerStore();
  const { cards } = useCardStore();
  const { accounts } = useAccountStore();
  const { sheets } = useSheetStore();
  const { notes } = useNoteStore();
  const { vaultItems, isUnlocked } = useVaultStore();
  const { theme, userRole } = useSessionStore();
  const isViewer = userRole === 'viewer';
  const isLight = theme === 'light';

  // Active Scope Lens: 'all' (Combined) | 'business' | 'personal' | 'family'
  const [selectedScope, setSelectedScope] = useState<'all' | EntityScope>('all');
  const [chartDays, setChartDays] = useState<7 | 30>(30);
  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);

  // Modals state
  const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<LedgerEntry | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSpendModalOpen, setIsSpendModalOpen] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);

  // ==========================================
  // SPHERE POSITIONS CALCULATION (Independent)
  // ==========================================
  const sphereStats = useMemo(() => {
    const calcSphere = (scope: EntityScope) => {
      const scopeAccounts = accounts.filter((a) => (a.scope || 'business') === scope);
      const scopeCash = scopeAccounts.reduce((s, a) => s + Number(a.balance), 0);

      const scopeReceivables = dues
        .filter((d) => (d.scope || 'business') === scope && d.status === 'pending' && d.direction === 'you_will_get')
        .reduce((sum, d) => sum + Number(d.amount), 0);

      const scopePayables = dues
        .filter((d) => (d.scope || 'business') === scope && d.status === 'pending' && d.direction === 'you_will_give')
        .reduce((sum, d) => sum + Number(d.amount), 0);

      const scopeCards = cards.filter((c) => (c.scope || 'business') === scope);
      const scopeCardDues = scopeCards.reduce((sum, card) => {
        const spend = ledger
          .filter((e) => e.card_id === card.id && e.type === 'card_spend')
          .reduce((s, e) => s + Number(e.amount), 0);
        const paid = ledger
          .filter((e) => e.card_id === card.id && e.type === 'bill_payment')
          .reduce((s, e) => s + Number(e.amount), 0);
        return sum + Math.max(0, spend - paid);
      }, 0);

      const net = scopeCash + scopeReceivables - (scopePayables + scopeCardDues);

      return {
        cash: scopeCash,
        receivables: scopeReceivables,
        payables: scopePayables,
        cardDues: scopeCardDues,
        net,
      };
    };

    const business = calcSphere('business');
    const personal = calcSphere('personal');
    const family = calcSphere('family');
    const combinedNet = business.net + personal.net + family.net;

    return { business, personal, family, combinedNet };
  }, [accounts, dues, cards, ledger]);

  // ==========================================
  // SCOPED METRICS (Filtered by Active Lens)
  // ==========================================
  const metrics = useMemo(() => {
    const isAll = selectedScope === 'all';

    const filteredAccounts = isAll
      ? accounts
      : accounts.filter((a) => (a.scope || 'business') === selectedScope);

    const filteredDues = isAll
      ? dues
      : dues.filter((d) => (d.scope || 'business') === selectedScope);

    const filteredCards = isAll
      ? cards
      : cards.filter((c) => (c.scope || 'business') === selectedScope);

    const filteredLedger = isAll
      ? ledger
      : ledger.filter((l) => (l.scope || 'business') === selectedScope);

    const receivables = filteredDues
      .filter((d) => d.status === 'pending' && d.direction === 'you_will_get')
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const payables = filteredDues
      .filter((d) => d.status === 'pending' && d.direction === 'you_will_give')
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const cardDues = filteredCards.reduce((sum, card) => {
      const spend = filteredLedger
        .filter((e) => e.card_id === card.id && e.type === 'card_spend')
        .reduce((s, e) => s + Number(e.amount), 0);
      const paid = filteredLedger
        .filter((e) => e.card_id === card.id && e.type === 'bill_payment')
        .reduce((s, e) => s + Number(e.amount), 0);
      return sum + Math.max(0, spend - paid);
    }, 0);

    const totalCardLimit = filteredCards.reduce((sum, c) => sum + Number(c.credit_limit || 0), 0);

    const inflow = filteredLedger
      .filter((e) => e.type === 'cash_in')
      .reduce((s, e) => s + Number(e.amount), 0);

    const outflow = filteredLedger
      .filter((e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment')
      .reduce((s, e) => s + Number(e.amount), 0);

    const accountBalance = filteredAccounts.reduce((s, a) => s + Number(a.balance), 0);
    const cash = accountBalance > 0 ? accountBalance : Math.max(0, inflow - outflow);

    const net = cash + receivables - (payables + cardDues);

    const totalAssets = Math.max(1, cash + receivables);
    const cashPct = Math.round((cash / totalAssets) * 100);
    const recPct = Math.round((receivables / totalAssets) * 100);

    // Expenses breakdown
    const expenseEntries = filteredLedger.filter(
      (e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment'
    );
    const totalExpenses = expenseEntries.reduce((s, e) => s + Number(e.amount), 0);

    const categoryAggMap = new Map<string, { category: ReturnType<typeof getCategoryById>; amount: number }>();
    for (const e of expenseEntries) {
      const def = getCategoryById(e.category_id);
      const existing = categoryAggMap.get(def.id);
      if (existing) {
        existing.amount += Number(e.amount);
      } else {
        categoryAggMap.set(def.id, { category: def, amount: Number(e.amount) });
      }
    }

    const categories = Array.from(categoryAggMap.values())
      .map(({ category, amount }) => ({
        category,
        amount,
        pct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      filteredLedger,
      filteredAccounts,
      filteredCards,
      filteredDues,
      totalCash: cash,
      totalReceivables: receivables,
      totalPayables: payables,
      totalCardDues: cardDues,
      totalCardLimit,
      totalInflow: inflow,
      totalOutflow: outflow,
      netPosition: net,
      cashPct,
      recPct,
      totalExpenses,
      topCategories: categories.slice(0, 4),
      allCategories: categories,
    };
  }, [selectedScope, accounts, dues, cards, ledger]);

  // ==========================================
  // 30-DAY SVG CASH FLOW DYNAMICS
  // ==========================================
  const chartData = useMemo(() => {
    const daysCount = chartDays;
    const now = new Date();
    const points: Array<{ label: string; dateStr: string; inflow: number; outflow: number }> = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateIso = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      const dayInflow = metrics.filteredLedger
        .filter((e) => e.type === 'cash_in' && e.entry_date.startsWith(dateIso))
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const dayOutflow = metrics.filteredLedger
        .filter(
          (e) =>
            (e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment') &&
            e.entry_date.startsWith(dateIso)
        )
        .reduce((sum, e) => sum + Number(e.amount), 0);

      points.push({
        label,
        dateStr: dateIso,
        inflow: dayInflow,
        outflow: dayOutflow,
      });
    }

    const maxVal = Math.max(
      100000,
      ...points.map((p) => Math.max(p.inflow, p.outflow))
    );

    return { points, maxVal };
  }, [metrics.filteredLedger, chartDays]);

  // Priority Alerts (Overdue dues, Upcoming card bills)
  const priorityAlerts = useMemo(() => {
    const alerts: Array<{ id: string; type: 'warning' | 'info'; title: string; desc: string; tab: TabType }> = [];
    const now = new Date().getTime();

    // Overdue receivables
    for (const d of dues) {
      if (d.status === 'pending' && d.direction === 'you_will_get') {
        const dueDate = new Date(d.due_date).getTime();
        if (dueDate < now) {
          const daysOverdue = Math.max(1, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));
          const cust = customers.find((c) => c.id === d.customer_id);
          alerts.push({
            id: `alert-due-${d.id}`,
            type: 'warning',
            title: `${cust?.name || 'Customer'} payment overdue by ${daysOverdue}d`,
            desc: `${formatPaise(d.amount)} pending. Send WhatsApp reminder.`,
            tab: 'dues',
          });
        }
      }
    }

    // High card bill dues
    if (metrics.totalCardDues > 0) {
      alerts.push({
        id: 'alert-card-1',
        type: 'info',
        title: `Card bills due: ${formatPaise(metrics.totalCardDues)}`,
        desc: `${metrics.filteredCards.length} active credit card(s) ready for settlement.`,
        tab: 'cards',
      });
    }

    return alerts.slice(0, 2);
  }, [dues, customers, metrics.totalCardDues, metrics.filteredCards.length]);

  // Overall Financial Health Score (0 - 100)
  const healthScore = useMemo(() => {
    if (metrics.netPosition <= 0) return 45;
    const debt = metrics.totalPayables + metrics.totalCardDues;
    const assets = metrics.totalCash + metrics.totalReceivables;
    if (debt === 0) return 98;
    const ratio = debt / assets;
    if (ratio < 0.2) return 94;
    if (ratio < 0.5) return 82;
    if (ratio < 0.8) return 68;
    return 55;
  }, [metrics.netPosition, metrics.totalPayables, metrics.totalCardDues, metrics.totalCash, metrics.totalReceivables]);

  // Helper for scope styling
  const getHeroTheme = () => {
    switch (selectedScope) {
      case 'business':
        return 'from-slate-900 via-indigo-950 to-slate-950 border-indigo-500/30';
      case 'personal':
        return 'from-slate-900 via-emerald-950 to-slate-950 border-emerald-500/30';
      case 'family':
        return 'from-slate-900 via-amber-950 to-slate-950 border-amber-500/30';
      default:
        return 'from-slate-950 via-slate-900 to-indigo-950 border-indigo-500/25';
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* TOP HEADER & 3-SPHERE LENS SWITCHER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-xl sm:text-2xl font-black tracking-tight"
              style={{ color: isLight ? '#0f172a' : '#f8fafc' }}
            >
              Financial Command Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Live Lens
            </span>
          </div>
          <p
            className="text-xs mt-0.5 font-medium"
            style={{ color: isLight ? '#475569' : '#94a3b8' }}
          >
            Switch perspectives to isolate Business, Personal, and Family finances
          </p>
        </div>

        {/* 4-Pill Scope Switcher */}
        <div
          className={`w-full sm:w-auto p-1 rounded-2xl border shadow-xs transition-colors ${
            isLight ? 'bg-slate-200/90 border-slate-300' : 'bg-slate-900/90 border-white/10'
          }`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          }}
        >
          <button
            onClick={() => setSelectedScope('all')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs transition-all ${
              selectedScope === 'all'
                ? isLight
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-300/80 font-black'
                  : 'bg-indigo-600 text-white shadow-sm font-black'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 font-bold'
                : 'text-slate-400 hover:text-white font-bold'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">All</span>
          </button>

          <button
            onClick={() => setSelectedScope('business')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs transition-all ${
              selectedScope === 'business'
                ? isLight
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-300/80 font-black'
                  : 'bg-indigo-600 text-white shadow-sm font-black'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 font-bold'
                : 'text-slate-400 hover:text-white font-bold'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">Biz</span>
          </button>

          <button
            onClick={() => setSelectedScope('personal')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs transition-all ${
              selectedScope === 'personal'
                ? isLight
                  ? 'bg-white text-emerald-700 shadow-sm border border-slate-300/80 font-black'
                  : 'bg-emerald-600 text-white shadow-sm font-black'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 font-bold'
                : 'text-slate-400 hover:text-white font-bold'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Personal</span>
          </button>

          <button
            onClick={() => setSelectedScope('family')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs transition-all ${
              selectedScope === 'family'
                ? isLight
                  ? 'bg-white text-amber-700 shadow-sm border border-slate-300/80 font-black'
                  : 'bg-amber-600 text-white shadow-sm font-black'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 font-bold'
                : 'text-slate-400 hover:text-white font-bold'
            }`}
          >
            <Users2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Family</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. EXECUTIVE GLASSMORPHIc HERO WEALTH CARD                */}
      {/* ========================================================= */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br ${getHeroTheme()} text-white border shadow-2xl transition-all duration-300`}
      >
        {/* Ambient Gradient Glow Orbs */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {selectedScope === 'all'
                    ? 'Total Financial Net Worth'
                    : `${selectedScope.toUpperCase()} Net Position`}
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-slate-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Health {healthScore}%
                </span>
              </div>

              <div className="text-4xl sm:text-5xl font-black tracking-tight text-white tabular-nums">
                {formatPaise(metrics.netPosition)}
              </div>

              {/* Micro Breakdown Formula */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-300">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                  Cash: {formatPaise(metrics.totalCash)}
                </span>
                <span className="text-slate-500">+</span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300">
                  Get: {formatPaise(metrics.totalReceivables)}
                </span>
                <span className="text-slate-500">−</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300">
                  Give: {formatPaise(metrics.totalPayables)}
                </span>
                <span className="text-slate-500">−</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300">
                  Cards: {formatPaise(metrics.totalCardDues)}
                </span>
              </div>
            </div>

            {/* 3-Sphere Interactive Balance Chips (Clickable) */}
            <div className="grid grid-cols-3 gap-2 bg-black/30 p-2 sm:p-3 rounded-2xl border border-white/10 backdrop-blur-md w-full">
              {/* Business Sphere Chip */}
              <div
                onClick={() => setSelectedScope('business')}
                className={`p-2 sm:p-3 rounded-xl cursor-pointer transition-all ${
                  selectedScope === 'business'
                    ? 'bg-indigo-600/50 border border-indigo-400/50 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] sm:text-xs text-indigo-300 font-bold mb-0.5 sm:mb-1 truncate">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Biz</span>
                </div>
                <div className="text-xs sm:text-base font-black tabular-nums text-white truncate">
                  {formatPaise(sphereStats.business.net)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate hidden xs:block">
                  Cash: {formatPaise(sphereStats.business.cash)}
                </div>
              </div>

              {/* Personal Sphere Chip */}
              <div
                onClick={() => setSelectedScope('personal')}
                className={`p-2 sm:p-3 rounded-xl cursor-pointer transition-all ${
                  selectedScope === 'personal'
                    ? 'bg-emerald-600/50 border border-emerald-400/50 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] sm:text-xs text-emerald-300 font-bold mb-0.5 sm:mb-1 truncate">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Personal</span>
                </div>
                <div className="text-xs sm:text-base font-black tabular-nums text-white truncate">
                  {formatPaise(sphereStats.personal.net)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate hidden xs:block">
                  Cash: {formatPaise(sphereStats.personal.cash)}
                </div>
              </div>

              {/* Family Sphere Chip */}
              <div
                onClick={() => setSelectedScope('family')}
                className={`p-2 sm:p-3 rounded-xl cursor-pointer transition-all ${
                  selectedScope === 'family'
                    ? 'bg-amber-600/50 border border-amber-400/50 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] sm:text-xs text-amber-300 font-bold mb-0.5 sm:mb-1 truncate">
                  <Users2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Family</span>
                </div>
                <div className="text-xs sm:text-base font-black tabular-nums text-white truncate">
                  {formatPaise(sphereStats.family.net)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate hidden xs:block">
                  Pool: {formatPaise(sphereStats.family.cash)}
                </div>
              </div>
            </div>
          </div>

          {/* Asset Allocation Segmented Bar */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                Liquid Asset Distribution
              </span>
              <span className="text-[11px] text-slate-400">
                Cash ({metrics.cashPct}%) • Receivables ({metrics.recPct}%)
              </span>
            </div>
            <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${metrics.cashPct}%` }}
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
                title={`Cash: ${metrics.cashPct}%`}
              />
              <div
                style={{ width: `${metrics.recPct}%` }}
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                title={`Receivables: ${metrics.recPct}%`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* NATIVE ANDROID ACTION HUB (MOBILE-FIRST FULL WIDTH)       */}
      {/* ========================================================= */}
      <div
        className={`w-full rounded-3xl p-3.5 sm:p-4 border shadow-sm backdrop-blur-md space-y-3 transition-colors ${
          isLight
            ? 'bg-white border-slate-200/90 shadow-md shadow-slate-200/50'
            : 'bg-slate-900/90 border-white/10 shadow-lg'
        }`}
      >
        {/* Core Primary Financial Actions: Full Width Mobile Dual Split */}
        <div
          className="w-full gap-2.5"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          }}
        >
          <button
            onClick={isViewer ? undefined : onQuickCashIn}
            disabled={isViewer}
            title={isViewer ? 'Read-only access: Viewer role cannot add transactions' : undefined}
            className={`w-full py-3.5 px-3 rounded-2xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all min-h-[50px] ${
              isViewer
                ? 'bg-slate-400 text-white cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-emerald-600/30 cursor-pointer'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
            <span>+ Add Income</span>
          </button>

          <button
            onClick={isViewer ? undefined : onQuickCashOut}
            disabled={isViewer}
            title={isViewer ? 'Read-only access: Viewer role cannot add transactions' : undefined}
            className={`w-full py-3.5 px-3 rounded-2xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all min-h-[50px] ${
              isViewer
                ? 'bg-slate-400 text-white cursor-not-allowed opacity-60'
                : 'bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white shadow-rose-600/30 cursor-pointer'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 stroke-[3]" />
            <span>− Add Expense</span>
          </button>
        </div>

        {/* 4-Column Android Quick Actions Grid (Spanning Full Mobile Width) */}
        <div
          className="w-full gap-2 pt-0.5"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          }}
        >
          <button
            onClick={() => onNavigateTab('dues')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl border shadow-xs active:scale-95 transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-1">
              <Users className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span
              className="text-[11px] font-bold"
              style={{ color: isLight ? '#1e293b' : '#f1f5f9' }}
            >
              Udhar
            </span>
          </button>

          <button
            onClick={() => setIsTransferModalOpen(true)}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl border shadow-xs active:scale-95 transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1">
              <Repeat className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span
              className="text-[11px] font-bold"
              style={{ color: isLight ? '#1e293b' : '#f1f5f9' }}
            >
              Transfer
            </span>
          </button>

          <button
            onClick={isViewer ? undefined : () => setIsSpendModalOpen(true)}
            disabled={isViewer}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl border shadow-xs transition-all ${
              isViewer
                ? 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-400 opacity-60 cursor-not-allowed'
                : isLight
                ? 'border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-800 active:scale-95 cursor-pointer'
                : 'border-purple-500/30 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 active:scale-95 cursor-pointer'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1">
              <CreditCard className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span
              className="text-[11px] font-bold"
              style={{ color: isLight ? '#581c87' : '#d8b4fe' }}
            >
              Cards
            </span>
          </button>

          {onOpenScanner ? (
            <button
              onClick={onOpenScanner}
              className={`flex flex-col items-center justify-center p-2 rounded-2xl border shadow-xs active:scale-95 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-1">
                <Camera className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span
                className="text-[11px] font-bold"
                style={{ color: isLight ? '#1e293b' : '#f1f5f9' }}
              >
                Scan Bill
              </span>
            </button>
          ) : (
            <button
              onClick={() => onNavigateTab('expenses')}
              className={`flex flex-col items-center justify-center p-2 rounded-2xl border shadow-xs active:scale-95 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-1">
                <TrendingDown className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span
                className="text-[11px] font-bold"
                style={{ color: isLight ? '#1e293b' : '#f1f5f9' }}
              >
                Spends
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Priority Smart Alerts */}
      {priorityAlerts.length > 0 && (
        <div className="space-y-2">
          {priorityAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onNavigateTab(alert.tab)}
              className={`cursor-pointer flex items-center justify-between p-3.5 rounded-2xl border transition-all hover-lift ${
                alert.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    alert.type === 'warning' ? 'bg-amber-500/20 text-amber-600' : 'bg-indigo-500/20 text-indigo-600'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">{alert.title}</div>
                  <div className="text-[11px] opacity-80">{alert.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold shrink-0">
                <span>View</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* INTERACTIVE VISUAL CHARTS & ANALYTICS                     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: 30-Day Cash Flow Dynamics (Inflow vs Outflow) */}
        <div
          className={`lg:col-span-2 rounded-3xl border p-5 sm:p-6 transition-all ${
            isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Cash Flow Dynamics
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  +{formatPaise(metrics.totalInflow)}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  -{formatPaise(metrics.totalOutflow)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily comparison of money earned vs spent
              </p>
            </div>

            {/* 7D vs 30D Filter Pill */}
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs font-bold">
              <button
                onClick={() => setChartDays(7)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartDays === 7
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setChartDays(30)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartDays === 30
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          {/* SVG Cashflow Chart Area */}
          <div className="relative h-48 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
              <defs>
                <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="37.5" x2="500" y2="37.5" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="4 4" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="4 4" />
              <line x1="0" y1="112.5" x2="500" y2="112.5" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="4 4" />

              {/* Inflow Area & Curve */}
              {(() => {
                const step = 500 / Math.max(1, chartData.points.length - 1);
                const pts = chartData.points.map((p, i) => {
                  const x = i * step;
                  const y = 140 - (p.inflow / chartData.maxVal) * 125;
                  return { x, y };
                });

                const linePath = pts.reduce(
                  (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                  ''
                );
                const areaPath = `${linePath} L 500 150 L 0 150 Z`;

                return (
                  <React.Fragment key="inflow-chart-paths">
                    <path d={areaPath} fill="url(#inflowGrad)" />
                    <path d={linePath} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
                  </React.Fragment>
                );
              })()}

              {/* Outflow Area & Curve */}
              {(() => {
                const step = 500 / Math.max(1, chartData.points.length - 1);
                const pts = chartData.points.map((p, i) => {
                  const x = i * step;
                  const y = 140 - (p.outflow / chartData.maxVal) * 125;
                  return { x, y };
                });

                const linePath = pts.reduce(
                  (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                  ''
                );
                const areaPath = `${linePath} L 500 150 L 0 150 Z`;

                return (
                  <React.Fragment key="outflow-chart-paths">
                    <path d={areaPath} fill="url(#outflowGrad)" />
                    <path d={linePath} fill="none" stroke="#F43F5E" strokeWidth="2" strokeDasharray="3 3" />
                  </React.Fragment>
                );
              })()}
            </svg>

            {/* Hover Points Overlays */}
            <div className="absolute inset-0 flex">
              {chartData.points.map((p, i) => (
                <div
                  key={p.dateStr}
                  onMouseEnter={() => setHoveredChartIndex(i)}
                  onMouseLeave={() => setHoveredChartIndex(null)}
                  className="flex-1 h-full cursor-pointer group relative flex flex-col justify-end"
                >
                  {hoveredChartIndex === i && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none p-2 rounded-xl bg-slate-900 text-white text-[11px] shadow-xl border border-white/10 whitespace-nowrap space-y-0.5">
                      <div className="font-bold text-slate-300">{p.label}</div>
                      <div className="text-emerald-400 font-bold">+In: {formatPaise(p.inflow)}</div>
                      <div className="text-rose-400 font-bold">−Out: {formatPaise(p.outflow)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100 dark:border-white/5 font-semibold">
            <span>{chartData.points[0]?.label}</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-1 rounded-full bg-emerald-500" />
                Inflow (Earnings)
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-1 rounded-full bg-rose-500" />
                Outflow (Spend)
              </span>
            </div>
            <span>{chartData.points[chartData.points.length - 1]?.label}</span>
          </div>
        </div>

        {/* Chart 2: Category Expense Radial / Donut */}
        <div
          className={`rounded-3xl border p-5 sm:p-6 transition-all flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-rose-500" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Expense Radial
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('expenses')}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Details →
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Top spending categories across active lens
            </p>

            {/* Circular Donut Graphic */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-36 h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    strokeWidth="12"
                  />
                  {(() => {
                    let cumulative = 0;
                    const circumference = 2 * Math.PI * 40; // ~251.327
                    return metrics.topCategories.map(({ category, pct }) => {
                      const strokeDash = (pct / 100) * circumference;
                      const strokeOffset = circumference - (cumulative / 100) * circumference;
                      cumulative += pct;
                      return (
                        <circle
                          key={category.id}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke={category.color || '#6366F1'}
                          strokeWidth="12"
                          strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                          strokeDashoffset={strokeOffset}
                          strokeLinecap="round"
                          className="transition-all duration-700"
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums px-2">
                    {formatPaise(metrics.totalExpenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Category Legend Badges */}
          <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
            {metrics.topCategories.slice(0, 3).map(({ category, amount, pct }) => (
              <div key={category.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[110px]">
                    {category.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatPaise(amount)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 w-7 text-right">{pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ALL-MODULE SUMMARY MATRIX (8 MODULES CONNECTED)           */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500" />
            <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              Financial Ecosystem (All 8 Modules)
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">Instant 1-Click Access</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. BANK ACCOUNTS & CASH */}
          <div
            onClick={() => onNavigateTab('cash')}
            className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
              isLight
                ? 'bg-gradient-to-br from-white via-emerald-50/40 to-white border-emerald-200 shadow-sm hover:border-emerald-400'
                : 'bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 border-emerald-500/20 hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                1. Cash & Banks
              </span>
              <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
              {formatPaise(metrics.totalCash)}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-emerald-100 dark:border-emerald-500/15 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>{metrics.filteredAccounts.length} Active Accounts</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. EXPENSE MANAGER */}
          <div
            onClick={() => onNavigateTab('expenses')}
            className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
              isLight
                ? 'bg-gradient-to-br from-white via-rose-50/40 to-white border-rose-200 shadow-sm hover:border-rose-400'
                : 'bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-900 border-rose-500/20 hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                2. Expenses
              </span>
              <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
              {formatPaise(metrics.totalExpenses)}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-rose-100 dark:border-rose-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{metrics.topCategories[0]?.category.name || 'Categorized'}</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">Track →</span>
            </div>
          </div>

          {/* 3. KHATA DUES & UDHAR */}
          <div
            onClick={() => onNavigateTab('dues')}
            className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
              isLight
                ? 'bg-gradient-to-br from-white via-cyan-50/40 to-white border-cyan-200 shadow-sm hover:border-cyan-400'
                : 'bg-gradient-to-br from-slate-900 via-cyan-950/20 to-slate-900 border-cyan-500/20 hover:border-cyan-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                3. Khata Dues
              </span>
              <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-cyan-600 dark:text-cyan-400 tabular-nums">
              +{formatPaise(metrics.totalReceivables)}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-cyan-100 dark:border-cyan-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Give: {formatPaise(metrics.totalPayables)}</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400 text-[11px]">Ledger →</span>
            </div>
          </div>

          {/* 4. CREDIT CARDS */}
          <div
            onClick={() => onNavigateTab('cards')}
            className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
              isLight
                ? 'bg-gradient-to-br from-white via-purple-50/40 to-white border-purple-200 shadow-sm hover:border-purple-400'
                : 'bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 border-purple-500/20 hover:border-purple-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                4. Credit Cards
              </span>
              <div className="p-2.5 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400 tabular-nums">
              -{formatPaise(metrics.totalCardDues)}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-purple-100 dark:border-purple-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{metrics.filteredCards.length} Active Cards</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isViewer) setIsSpendModalOpen(true);
                }}
                disabled={isViewer}
                className="font-bold text-purple-600 dark:text-purple-400 text-[11px] px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition-all cursor-pointer flex items-center gap-1"
              >
                <span>⚡ Spend (Swipe)</span>
              </button>
            </div>
          </div>

          {/* 5. REGISTERS & SHEETS */}
          <div
            onClick={() => onNavigateTab('sheets')}
            className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
              isLight
                ? 'bg-gradient-to-br from-white via-blue-50/40 to-white border-blue-200 shadow-sm hover:border-blue-400'
                : 'bg-gradient-to-br from-slate-900 via-blue-950/20 to-slate-900 border-blue-500/20 hover:border-blue-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                5. Registers & Sheets
              </span>
              <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
              {sheets.length} Sheets
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-blue-100 dark:border-blue-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{sheets.reduce((sum, s) => sum + s.rows.length, 0)} Total Rows</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">Open Grid →</span>
            </div>
          </div>

          {/* 6. DAILY NOTES & CHECKLIST */}
          <div
            onClick={() => onNavigateTab('notes')}
            className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
              isLight
                ? 'bg-gradient-to-br from-white via-amber-50/40 to-white border-amber-200 shadow-sm hover:border-amber-400'
                : 'bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border-amber-500/20 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                6. Daily Notes
              </span>
              <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <StickyNote className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
              {notes.length} Notes
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-amber-100 dark:border-amber-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{notes.filter((n) => n.is_pinned).length} Pinned Reminders</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px]">Tasks →</span>
            </div>
          </div>

          {/* 7. ENCRYPTED VAULT */}
          <div
            onClick={() => onNavigateTab('vault')}
            className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
              isLight
                ? 'bg-gradient-to-br from-white via-teal-50/40 to-white border-teal-200 shadow-sm hover:border-teal-400'
                : 'bg-gradient-to-br from-slate-900 via-teal-950/20 to-slate-900 border-teal-500/20 hover:border-teal-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                7. Password Vault
              </span>
              <div className="p-2.5 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
                {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
              {vaultItems.length} Keys
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-teal-100 dark:border-teal-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{isUnlocked ? '🔓 Unlocked' : '🔒 AES-256 Locked'}</span>
              <span className="font-bold text-teal-600 dark:text-teal-400 text-[11px]">Vault →</span>
            </div>
          </div>

          {/* 8. REPORTS & TAX */}
          <div
            onClick={() => onNavigateTab('reports')}
            className={`group cursor-pointer rounded-3xl border p-5 transition-all hover-lift ${
              isLight
                ? 'bg-gradient-to-br from-white via-indigo-50/40 to-white border-indigo-200 shadow-sm hover:border-indigo-400'
                : 'bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border-indigo-500/20 hover:border-indigo-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                8. Reports & Tax
              </span>
              <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
              P&L Reports
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-indigo-100 dark:border-indigo-500/15 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Audit & Tax Statements</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">View →</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RECENT TRANSACTIONS LEDGER TIMELINE                       */}
      {/* ========================================================= */}
      <div
        className={`rounded-3xl border p-5 sm:p-6 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
        }`}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Recent Activity Ledger
            </h3>
          </div>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
            {metrics.filteredLedger.length} entries in {selectedScope.toUpperCase()}
          </span>
        </div>

        {metrics.filteredLedger.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
              <Wallet className="w-6 h-6 opacity-60" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              No transactions recorded in this sphere yet.
            </p>
            <p className="text-[11px] text-slate-400">
              Click <span className="font-bold text-emerald-600 dark:text-emerald-400">+ Inflow</span> or <span className="font-bold text-rose-600 dark:text-rose-400">− Expense</span> above to add.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {metrics.filteredLedger.slice(0, 8).map((entry) => {
              const isInflow = entry.type === 'cash_in';
              const cat = getCategoryById(entry.category_id);
              const acc = accounts.find((a) => a.id === entry.cash_location_id);
              const entryScope = entry.scope || 'business';

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntryForDetail(entry)}
                  className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-white/5 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                        isInflow
                          ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white'
                          : 'bg-gradient-to-tr from-rose-500 to-red-400 text-white'
                      }`}
                    >
                      {isInflow ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <span>{entry.note || (isInflow ? 'Cash Received' : 'Expense Recorded')}</span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.2 rounded-full"
                          style={{
                            backgroundColor: cat.color + '18',
                            color: cat.color,
                          }}
                        >
                          {cat.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          {new Date(entry.entry_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        <span>•</span>
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {entry.mode}
                        </span>
                        <span>•</span>
                        <span
                          className={`uppercase text-[9px] font-black px-1.5 py-0.2 rounded ${
                            entryScope === 'business'
                              ? 'bg-indigo-500/10 text-indigo-500'
                              : entryScope === 'personal'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {entryScope}
                        </span>
                        {acc && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                              {acc.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`font-black text-sm tabular-nums ${
                      isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isInflow ? '+' : '-'}{formatPaise(entry.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Detail Popup Modal */}
      <TransactionDetailModal
        entry={selectedEntryForDetail}
        onClose={() => setSelectedEntryForDetail(null)}
      />

      {/* Inter-Sphere Transfer Modal */}
      <InterSphereTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        defaultSourceScope={selectedScope === 'all' ? 'business' : selectedScope}
      />

      {/* Credit Card Spend (Swipe) Modal */}
      <CardSpendModal
        isOpen={isSpendModalOpen}
        onClose={() => setIsSpendModalOpen(false)}
        onNavigateToCards={() => onNavigateTab('cards')}
      />
    </div>
  );
}
