'use client';

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Receipt,
  Users,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Printer,
  Share2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  Filter,
  PieChart,
  BarChart3,
  Wallet,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { paiseToRupees, formatPaise } from '@/lib/money';
import { calculateAllCardsBillingReport } from '@/lib/cardBilling';
import { getCategoryById, EXPENSE_CATEGORIES } from '@/lib/categories';
import { StatementPrintModal } from '@/components/modals/StatementPrintModal';

type DatePreset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_fy' | 'all_time' | 'custom';
type ReportTab = 'pnl' | 'cashflow' | 'udhar' | 'cards';

export function ReportsScreen() {
  const { entries: ledger } = useLedgerStore();
  const { customers, dues } = useCustomerStore();
  const { cards } = useCardStore();
  const { accounts } = useAccountStore();
  const { workspaces, activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const cardBillingReport = calculateAllCardsBillingReport(cards, ledger);

  // State
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Date range calculation
  const { startDateStr, endDateStr, periodLabel } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (datePreset === 'today') {
      return { startDateStr: todayStr, endDateStr: todayStr, periodLabel: 'Today' };
    }
    if (datePreset === 'this_week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      return {
        startDateStr: monday.toISOString().slice(0, 10),
        endDateStr: todayStr,
        periodLabel: 'This Week',
      };
    }
    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDateStr: start.toISOString().slice(0, 10),
        endDateStr: todayStr,
        periodLabel: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      };
    }
    if (datePreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDateStr: start.toISOString().slice(0, 10),
        endDateStr: end.toISOString().slice(0, 10),
        periodLabel: start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      };
    }
    if (datePreset === 'this_fy') {
      const currentYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      const start = `${fyStartYear}-04-01`;
      const end = `${fyStartYear + 1}-03-31`;
      return {
        startDateStr: start,
        endDateStr: end,
        periodLabel: `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`,
      };
    }
    if (datePreset === 'custom') {
      return {
        startDateStr: customStartDate,
        endDateStr: customEndDate,
        periodLabel: `${customStartDate} to ${customEndDate}`,
      };
    }
    // all_time
    return {
      startDateStr: '1970-01-01',
      endDateStr: '2099-12-31',
      periodLabel: 'All Time Records',
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Filtered ledger entries
  const filteredEntries = useMemo(() => {
    return ledger.filter((entry) => {
      const d = entry.entry_date.slice(0, 10);
      return d >= startDateStr && d <= endDateStr;
    });
  }, [ledger, startDateStr, endDateStr]);

  // Financial Metrics for the period
  const totalInflow = useMemo(() => {
    return filteredEntries
      .filter((e) => e.type === 'cash_in')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredEntries]);

  const totalOutflow = useMemo(() => {
    return filteredEntries
      .filter((e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment' || e.type === 'card_spend')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredEntries]);

  const netProfit = totalInflow - totalOutflow;
  const profitMarginPercent = totalInflow > 0 ? ((netProfit / totalInflow) * 100).toFixed(1) : '0';

  // Category Breakdown for P&L
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredEntries
      .filter((e) => e.type === 'expense' || e.type === 'cash_out' || e.type === 'card_spend')
      .forEach((e) => {
        const catId = e.category_id || 'general';
        map.set(catId, (map.get(catId) || 0) + Number(e.amount));
      });

    return Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = getCategoryById(catId);
        const sharePercent = totalOutflow > 0 ? ((amount / totalOutflow) * 100).toFixed(1) : '0';
        return {
          catId,
          name: cat.name,
          color: cat.color,
          amount,
          sharePercent: Number(sharePercent),
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredEntries, totalOutflow]);

  // Payment Mode Breakdown
  const modeBreakdown = useMemo(() => {
    const map = {
      upi: { in: 0, out: 0 },
      cash: { in: 0, out: 0 },
      bank: { in: 0, out: 0 },
      card: { in: 0, out: 0 },
    };

    filteredEntries.forEach((e) => {
      const mode = (e.mode || 'cash') as keyof typeof map;
      if (!map[mode]) return;
      if (e.type === 'cash_in') {
        map[mode].in += Number(e.amount);
      } else {
        map[mode].out += Number(e.amount);
      }
    });

    return map;
  }, [filteredEntries]);

  // Account Liquidity Movement
  const accountMovement = useMemo(() => {
    return accounts.map((acc) => {
      const inAmount = filteredEntries
        .filter((e) => e.cash_location_id === acc.id && e.type === 'cash_in')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const outAmount = filteredEntries
        .filter(
          (e) =>
            e.cash_location_id === acc.id &&
            (e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment')
        )
        .reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        id: acc.id,
        name: acc.name,
        bank_name: acc.bank_name,
        account_type: acc.account_type,
        currentBalance: acc.balance,
        inAmount,
        outAmount,
        netFlow: inAmount - outAmount,
      };
    });
  }, [accounts, filteredEntries]);

  // Udhar / Dues Aging Analysis
  const udharAging = useMemo(() => {
    const nowTime = new Date().getTime();
    let bracket0to7 = 0;
    let bracket8to30 = 0;
    let bracket30Plus = 0;
    let totalPendingReceivable = 0;
    let totalPendingPayable = 0;

    dues.forEach((due) => {
      if (due.status !== 'pending') return;
      const amt = Number(due.amount);

      if (due.direction === 'you_will_get') {
        totalPendingReceivable += amt;
        if (due.due_date) {
          const dueTime = new Date(due.due_date).getTime();
          const daysOverdue = Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24));
          if (daysOverdue > 30) {
            bracket30Plus += amt;
          } else if (daysOverdue > 7) {
            bracket8to30 += amt;
          } else {
            bracket0to7 += amt;
          }
        } else {
          bracket0to7 += amt;
        }
      } else {
        totalPendingPayable += amt;
      }
    });

    // Top Debtors (Customers who owe you)
    const partyBalances = customers.map((c) => {
      const custDues = dues.filter((d) => d.customer_id === c.id && d.status === 'pending');
      const receivable = custDues
        .filter((d) => d.direction === 'you_will_get')
        .reduce((sum, d) => sum + Number(d.amount), 0);
      const payable = custDues
        .filter((d) => d.direction === 'you_will_give')
        .reduce((sum, d) => sum + Number(d.amount), 0);
      return {
        customer: c,
        receivable,
        payable,
        netDue: receivable - payable,
      };
    });

    const topDebtors = partyBalances
      .filter((p) => p.receivable > 0)
      .sort((a, b) => b.receivable - a.receivable)
      .slice(0, 5);

    const topCreditors = partyBalances
      .filter((p) => p.payable > 0)
      .sort((a, b) => b.payable - a.payable)
      .slice(0, 5);

    return {
      bracket0to7,
      bracket8to30,
      bracket30Plus,
      totalPendingReceivable,
      totalPendingPayable,
      topDebtors,
      topCreditors,
    };
  }, [dues, customers]);

  // Daily Trend for the period (last 7 active days)
  const dailyTrends = useMemo(() => {
    const map = new Map<string, { date: string; inflow: number; outflow: number }>();
    filteredEntries.forEach((e) => {
      const day = e.entry_date.slice(0, 10);
      if (!map.has(day)) {
        map.set(day, { date: day, inflow: 0, outflow: 0 });
      }
      const item = map.get(day)!;
      if (e.type === 'cash_in') {
        item.inflow += Number(e.amount);
      } else {
        item.outflow += Number(e.amount);
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
  }, [filteredEntries]);

  // CSV Exporters
  const handleExportFullCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Account', 'Amount (Rupees)', 'Payment Mode', 'Notes'];
    const rows = filteredEntries.map((entry) => {
      const cat = getCategoryById(entry.category_id);
      const acc = accounts.find((a) => a.id === entry.cash_location_id);
      return [
        entry.entry_date,
        entry.type,
        `"${cat.name.replace(/"/g, '""')}"`,
        `"${(acc?.name || 'Unassigned').replace(/"/g, '""')}"`,
        paiseToRupees(entry.amount).toFixed(2),
        entry.mode,
        `"${(entry.note || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(
      csvContent,
      `${activeWs?.name || 'RecordBook'}_FullLedger_${startDateStr}_to_${endDateStr}.csv`,
      'text/csv;charset=utf-8;'
    );
    setShowExportMenu(false);
  };

  const handleExportPnLCSV = () => {
    const headers = ['Category', 'Type', 'Amount (Rupees)', 'Share of Expense (%)'];
    const rows = expenseByCategory.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      'Expense',
      paiseToRupees(c.amount).toFixed(2),
      `${c.sharePercent}%`,
    ]);
    rows.push(['Total Inflow / Revenue', 'Income', paiseToRupees(totalInflow).toFixed(2), '100%']);
    rows.push(['Total Expenses / Outflow', 'Expense', paiseToRupees(totalOutflow).toFixed(2), '100%']);
    rows.push(['Net Profit / Margin', netProfit >= 0 ? 'Profit' : 'Deficit', paiseToRupees(netProfit).toFixed(2), `${profitMarginPercent}%`]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(
      csvContent,
      `${activeWs?.name || 'RecordBook'}_PnL_Summary_${startDateStr}_to_${endDateStr}.csv`,
      'text/csv;charset=utf-8;'
    );
    setShowExportMenu(false);
  };

  const handleExportUdharCSV = () => {
    const headers = ['Contact Name', 'Type', 'Phone', 'Receivable (Rupees)', 'Payable (Rupees)', 'Net Balance (Rupees)'];
    const rows = customers.map((c) => {
      const custDues = dues.filter((d) => d.customer_id === c.id && d.status === 'pending');
      const rec = custDues.filter((d) => d.direction === 'you_will_get').reduce((s, d) => s + Number(d.amount), 0);
      const pay = custDues.filter((d) => d.direction === 'you_will_give').reduce((s, d) => s + Number(d.amount), 0);
      return [
        `"${c.name.replace(/"/g, '""')}"`,
        c.type,
        c.phone || '-',
        paiseToRupees(rec).toFixed(2),
        paiseToRupees(pay).toFixed(2),
        paiseToRupees(rec - pay).toFixed(2),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(
      csvContent,
      `${activeWs?.name || 'RecordBook'}_Udhar_Ledger_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;'
    );
    setShowExportMenu(false);
  };

  const handleExportCardBillingCSV = () => {
    const headers = [
      'Card Name',
      'Bank',
      'Last 4',
      'Statement Day',
      'Payment Due Date',
      'Days Until Due',
      'Status',
      'Billed Due (Rupees)',
      'Unbilled Spends (Rupees)',
      'Advance Paid (Rupees)',
      'Available Limit (Rupees)',
    ];

    const rows = cardBillingReport.cardSummaries.map((s) => [
      `"${s.card.name.replace(/"/g, '""')}"`,
      `"${s.card.bank.replace(/"/g, '""')}"`,
      s.card.last4,
      s.statementDay,
      s.dueDate.toISOString().slice(0, 10),
      s.daysUntilDue,
      s.status,
      paiseToRupees(s.billedDue).toFixed(2),
      paiseToRupees(s.netUnbilled).toFixed(2),
      paiseToRupees(s.advancePayments).toFixed(2),
      paiseToRupees(s.availableCredit).toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(
      csvContent,
      `RecordBook_Card_Billing_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;'
    );
    setShowExportMenu(false);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Business Summary
  const handleShareWhatsAppSummary = () => {
    const wsName = activeWs?.name || 'My Business';
    const msg = [
      `📊 *Financial Summary: ${wsName}*`,
      `📅 Period: ${periodLabel} (${startDateStr} to ${endDateStr})`,
      ``,
      `📈 *Revenue / Inflow:* ${formatPaise(totalInflow)}`,
      `📉 *Expenses / Outflow:* ${formatPaise(totalOutflow)}`,
      `${netProfit >= 0 ? '🟢 *Net Profit:*' : '🔴 *Net Deficit:*'} ${formatPaise(netProfit)} (Margin: ${profitMarginPercent}%)`,
      ``,
      `👥 *Udhar Outstanding:*`,
      `• Customers owe you: ${formatPaise(udharAging.totalPendingReceivable)}`,
      `• You owe suppliers: ${formatPaise(udharAging.totalPendingPayable)}`,
      ``,
      `💳 *Credit Cards Due:* ${formatPaise(cardBillingReport.totalBilledDue)}`,
      ``,
      `_Generated via Record Book (Khata Book AI)_`,
    ].join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span>Financial Reports & Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time P&L statement, cash flow dynamics, party aging and certified PDF statements.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* WhatsApp Share Button */}
          <button
            onClick={handleShareWhatsAppSummary}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover-lift touch-press"
            title="Share financial summary on WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp Summary</span>
          </button>

          {/* Print / PDF Modal Button */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-xs shadow-md shadow-blue-500/25 transition-all hover-lift touch-press"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF Statement</span>
          </button>

          {/* Export Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-slate-700 dark:text-slate-200 text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl py-2 z-30 animate-in fade-in zoom-in-95 text-xs">
                <button
                  onClick={handleExportFullCSV}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-white/5 font-medium text-slate-700 dark:text-slate-200"
                >
                  📄 Full Ledger CSV ({filteredEntries.length} rows)
                </button>
                <button
                  onClick={handleExportPnLCSV}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-white/5 font-medium text-slate-700 dark:text-slate-200"
                >
                  📊 P&L Category Breakdown CSV
                </button>
                <button
                  onClick={handleExportUdharCSV}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-white/5 font-medium text-slate-700 dark:text-slate-200"
                >
                  👥 Customer & Supplier Udhar CSV
                </button>
                {cards.length > 0 && (
                  <button
                    onClick={handleExportCardBillingCSV}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-white/5 font-medium text-slate-700 dark:text-slate-200"
                  >
                    💳 Credit Card Billing CSV
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Period Filter Bar */}
      <div
        className={`p-3 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
          isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/60 border-white/10'
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Period:
          </span>
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_fy', label: 'This FY' },
              { id: 'all_time', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              onClick={() => setDatePreset(preset.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                datePreset === preset.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-slate-900 dark:text-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-slate-900 dark:text-white"
            />
          </div>
        )}

        <div className="text-[11px] text-slate-400 font-mono hidden md:block">
          {startDateStr} ~ {endDateStr}
        </div>
      </div>

      {/* Top 3 Metric Cards: Inflow, Outflow & Net Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Inflow */}
        <div
          className={`p-5 rounded-3xl border relative overflow-hidden transition-all ${
            isLight ? 'bg-white border-emerald-200/80 shadow-xs' : 'bg-slate-900/80 border-emerald-500/20 shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Total Inflow / Sales
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
            {formatPaise(totalInflow)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Money received across accounts & cash
          </p>
        </div>

        {/* Total Outflow */}
        <div
          className={`p-5 rounded-3xl border relative overflow-hidden transition-all ${
            isLight ? 'bg-white border-rose-200/80 shadow-xs' : 'bg-slate-900/80 border-rose-500/20 shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Total Outflow / Spends
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
            {formatPaise(totalOutflow)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Expenses, bills & vendor payouts
          </p>
        </div>

        {/* Net Profit & Margin */}
        <div
          className={`p-5 rounded-3xl border relative overflow-hidden transition-all ${
            netProfit >= 0
              ? isLight
                ? 'bg-white border-blue-200/80 shadow-xs'
                : 'bg-slate-900/80 border-blue-500/20 shadow-md'
              : isLight
              ? 'bg-white border-amber-200/80 shadow-xs'
              : 'bg-slate-900/80 border-amber-500/20 shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {netProfit >= 0 ? 'Net Profit' : 'Net Deficit / Burn'}
            </span>
            <div
              className={`p-2 rounded-xl ${
                netProfit >= 0
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              {netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div
            className={`text-2xl font-black mt-2 tabular-nums ${
              netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatPaise(netProfit)}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {profitMarginPercent}% Margin
            </span>
            <span>• {filteredEntries.length} transactions</span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs: P&L | Cash Flow | Udhar Aging | Credit Cards */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('pnl')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'pnl'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Profit & Loss (P&L)</span>
        </button>

        <button
          onClick={() => setActiveTab('cashflow')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'cashflow'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Cash Flow & Liquidity</span>
        </button>

        <button
          onClick={() => setActiveTab('udhar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'udhar'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Udhar & Party Aging</span>
        </button>

        <button
          onClick={() => setActiveTab('cards')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'cards'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Credit Card Statement</span>
        </button>
      </div>

      {/* VIEW 1: PROFIT & LOSS (P&L) */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          {/* Category-wise Expense Breakdown */}
          <div
            className={`rounded-3xl border p-6 space-y-5 transition-all ${
              isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Operating Expenses by Category
                </h3>
                <p className="text-[11px] text-slate-400">
                  Where your capital was spent during {periodLabel}
                </p>
              </div>
              <span className="font-bold text-xs text-rose-600 dark:text-rose-400 tabular-nums">
                Total: {formatPaise(totalOutflow)}
              </span>
            </div>

            {expenseByCategory.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No categorized expenses found in this period.
              </div>
            ) : (
              <div className="space-y-4">
                {expenseByCategory.map((item) => (
                  <div key={item.catId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400">{item.sharePercent}%</span>
                        <span className="font-black text-slate-900 dark:text-white tabular-nums">
                          {formatPaise(item.amount)}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, item.sharePercent)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily Trend Mini Bars */}
          {dailyTrends.length > 0 && (
            <div
              className={`rounded-3xl border p-6 space-y-4 transition-all ${
                isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Daily Flow Trend (Active Days)
                </h3>
                <span className="text-[11px] text-slate-400">Green = Inflow, Red = Outflow</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 pt-2">
                {dailyTrends.map((d) => (
                  <div
                    key={d.date}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center space-y-1.5"
                  >
                    <span className="text-[10px] font-mono text-slate-400 block">{d.date.slice(5)}</span>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatPaise(d.inflow)}
                    </div>
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      −{formatPaise(d.outflow)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CASH FLOW & LIQUIDITY */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          {/* Payment Mode Share */}
          <div
            className={`rounded-3xl border p-6 space-y-5 transition-all ${
              isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Payment Channels & Modes
                </h3>
                <p className="text-[11px] text-slate-400">
                  Volume through UPI, Cash Drawer, Bank Wire and Credit Cards
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              {(
                [
                  { key: 'upi', label: 'UPI / QR Code', icon: '⚡', color: 'from-blue-500/10 to-indigo-500/10' },
                  { key: 'cash', label: 'Physical Cash', icon: '💵', color: 'from-emerald-500/10 to-teal-500/10' },
                  { key: 'bank', label: 'NetBanking / NEFT', icon: '🏛️', color: 'from-purple-500/10 to-pink-500/10' },
                  { key: 'card', label: 'Debit & Credit Cards', icon: '💳', color: 'from-amber-500/10 to-orange-500/10' },
                ] as const
              ).map((m) => {
                const data = modeBreakdown[m.key];
                return (
                  <div
                    key={m.key}
                    className={`p-4 rounded-2xl bg-gradient-to-br ${m.color} border border-slate-200/60 dark:border-white/10 space-y-2`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </span>
                    </div>
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">In:</span>
                        <span className="font-black text-slate-900 dark:text-white tabular-nums">
                          {formatPaise(data.in)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1">
                        <span className="text-rose-600 dark:text-rose-400 font-bold">Out:</span>
                        <span className="font-black text-slate-900 dark:text-white tabular-nums">
                          {formatPaise(data.out)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account-wise Flow Statement */}
          <div
            className={`rounded-3xl border p-6 space-y-4 transition-all ${
              isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Bank & Cash Accounts Movement
              </h3>
              <span className="text-[11px] text-slate-400">Total {accounts.length} Accounts</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Account Name</th>
                    <th className="py-2.5 px-3 text-right">Inflow (+)</th>
                    <th className="py-2.5 px-3 text-right">Outflow (−)</th>
                    <th className="py-2.5 px-3 text-right">Net Period Flow</th>
                    <th className="py-2.5 px-3 text-right">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {accountMovement.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 dark:text-white block">{acc.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          {acc.bank_name || acc.account_type || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{formatPaise(acc.inAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400 tabular-nums">
                        −{formatPaise(acc.outAmount)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-black tabular-nums ${
                          acc.netFlow >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatPaise(acc.netFlow)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white tabular-nums">
                        {formatPaise(acc.currentBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: UDHAR & PARTY AGING */}
      {activeTab === 'udhar' && (
        <div className="space-y-6">
          {/* Aging Brackets */}
          <div
            className={`rounded-3xl border p-6 space-y-4 transition-all ${
              isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Customer Udhar Aging Analysis
                </h3>
                <p className="text-[11px] text-slate-400">
                  Total Receivables: {formatPaise(udharAging.totalPendingReceivable)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                  🟢 0 to 7 Days (Fresh)
                </span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                  {formatPaise(udharAging.bracket0to7)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Standard recovery cycle</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                  🟡 8 to 30 Days (Follow-up)
                </span>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                  {formatPaise(udharAging.bracket8to30)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Send WhatsApp reminder</span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                  🔴 30+ Days (High Risk)
                </span>
                <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                  {formatPaise(udharAging.bracket30Plus)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Critical collection priority</span>
              </div>
            </div>
          </div>

          {/* Top Debtors & Top Creditors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Top Debtors */}
            <div
              className={`rounded-3xl border p-5 space-y-3 transition-all ${
                isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
              }`}
            >
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Top Customers Who Owe You (Receivable)
              </h4>
              {udharAging.topDebtors.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No pending customer dues.</p>
              ) : (
                <div className="space-y-2">
                  {udharAging.topDebtors.map((p) => (
                    <div
                      key={p.customer.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {p.customer.name}
                        </span>
                        <span className="text-[10px] text-slate-400">{p.customer.phone || 'No phone'}</span>
                      </div>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatPaise(p.receivable)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Creditors */}
            <div
              className={`rounded-3xl border p-5 space-y-3 transition-all ${
                isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
              }`}
            >
              <h4 className="font-bold text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Top Suppliers You Owe (Payable)
              </h4>
              {udharAging.topCreditors.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No pending supplier payables.</p>
              ) : (
                <div className="space-y-2">
                  {udharAging.topCreditors.map((p) => (
                    <div
                      key={p.customer.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {p.customer.name}
                        </span>
                        <span className="text-[10px] text-slate-400">{p.customer.phone || 'No phone'}</span>
                      </div>
                      <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatPaise(p.payable)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: CREDIT CARD BILLING REPORT */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
          <div
            className={`rounded-3xl border p-6 space-y-5 transition-all ${
              isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Credit Cards Billed & Unbilled Statement Report
                </h3>
                <p className="text-[11px] text-slate-400">
                  Statement cutoff cycles & payment due countdown
                </p>
              </div>
              {cards.length > 0 && (
                <button
                  onClick={handleExportCardBillingCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white text-xs transition-all shadow-md shadow-purple-500/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Card CSV</span>
                </button>
              )}
            </div>

            {/* 4 Metric Cards for Card Dues */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                  🔴 Total Billed Due
                </span>
                <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                  {formatPaise(cardBillingReport.totalBilledDue)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Must pay before due date</span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                  🟣 Total Unbilled Spends
                </span>
                <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
                  {formatPaise(cardBillingReport.totalUnbilledSpends)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Bills next statement cycle</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  🟢 Advance Payments / Credit
                </span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                  {formatPaise(cardBillingReport.totalAdvancePayments)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Offsets future spends</span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                  💳 Total Available Limit
                </span>
                <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                  {formatPaise(cardBillingReport.totalAvailableCredit)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  of {formatPaise(cardBillingReport.totalCreditLimit)} limit
                </span>
              </div>
            </div>

            {/* Detailed Table */}
            {cards.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No credit cards tracked yet. Add cards in the Credit Cards tab to generate this statement.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Card Name</th>
                      <th className="py-2.5 px-3">Bill Date</th>
                      <th className="py-2.5 px-3">Payment Due Date</th>
                      <th className="py-2.5 px-3 text-right">🔴 Billed Due</th>
                      <th className="py-2.5 px-3 text-right">🟣 Unbilled</th>
                      <th className="py-2.5 px-3 text-right">🟢 Advance</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {cardBillingReport.cardSummaries.map((summary) => {
                      const card = summary.card;
                      const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      });

                      return (
                        <tr key={card.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {card.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {card.bank} •••• {card.last4}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-300">
                            {summary.statementDay}th of month
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              {formattedDueDate}
                            </span>
                            <span
                              className={`text-[10px] font-bold ${
                                summary.isOverdue
                                  ? 'text-rose-500'
                                  : summary.daysUntilDue <= 3
                                  ? 'text-amber-500'
                                  : 'text-slate-400'
                              }`}
                            >
                              {summary.isOverdue
                                ? `⚠️ Overdue ${Math.abs(summary.daysUntilDue)}d`
                                : summary.daysUntilDue === 0
                                ? '🚨 Today'
                                : `${summary.daysUntilDue}d left`}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatPaise(summary.billedDue)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                            {formatPaise(summary.netUnbilled)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatPaise(summary.advanceCredit)}
                          </td>

                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                summary.status === 'overdue'
                                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                  : summary.status === 'urgent'
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                  : summary.status === 'due'
                                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                  : summary.status === 'advance_credit'
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {summary.status === 'overdue' && '⚠️ Overdue'}
                              {summary.status === 'urgent' && '🚨 Due Soon'}
                              {summary.status === 'due' && '📅 Due'}
                              {summary.status === 'unbilled_only' && '🗓️ Unbilled'}
                              {summary.status === 'advance_credit' && '🟢 In Advance'}
                              {summary.status === 'cleared' && '✅ Cleared'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Official Printable Statement Modal */}
      <StatementPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        workspace={activeWs}
        periodLabel={periodLabel}
        startDateStr={startDateStr}
        endDateStr={endDateStr}
        entries={filteredEntries}
        accounts={accounts}
        customers={customers}
        totalInflow={totalInflow}
        totalOutflow={totalOutflow}
        netProfit={netProfit}
      />
    </div>
  );
}
