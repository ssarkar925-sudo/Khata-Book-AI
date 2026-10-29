'use client';

import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  CreditCard,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { computeCashflowForecast } from '@/lib/cashflowForecasting';
import { formatPaise, paiseToRupees } from '@/lib/money';
import { TabType, PeopleDue, Customer } from '@/types';
import { WhatsAppReminderModal } from '@/components/modals/WhatsAppReminderModal';

interface CashflowForecastWidgetProps {
  onNavigateTab: (tab: TabType) => void;
}

export function CashflowForecastWidget({ onNavigateTab }: CashflowForecastWidgetProps) {
  const { entries: ledger } = useLedgerStore();
  const { dues, customers } = useCustomerStore();
  const { cards } = useCardStore();
  const { accounts } = useAccountStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [activeReminderTarget, setActiveReminderTarget] = useState<{
    due: PeopleDue;
    customer: Customer;
  } | null>(null);

  const forecast = useMemo(() => {
    return computeCashflowForecast(ledger, accounts, dues, cards, customers);
  }, [ledger, accounts, dues, cards, customers]);

  const handleAction = (rec: (typeof forecast.recommendations)[0]) => {
    if (rec.actionTarget === 'whatsapp' && rec.targetDueId && rec.targetCustomerId) {
      const targetDue = dues.find((d) => d.id === rec.targetDueId);
      const targetCust = customers.find((c) => c.id === rec.targetCustomerId);
      if (targetDue && targetCust) {
        setActiveReminderTarget({ due: targetDue, customer: targetCust });
        return;
      }
    }
    if (rec.actionTarget) {
      onNavigateTab(rec.actionTarget as TabType);
    }
  };

  const gradeColors = {
    'A+': 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    A: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    B: 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400',
    C: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400',
    D: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400',
  };

  const totalRec = forecast.totalReceivablesPaise || 1;
  const lowPct = Math.round((forecast.riskBreakdown.lowRiskTotalPaise / totalRec) * 100);
  const medPct = Math.round((forecast.riskBreakdown.mediumRiskTotalPaise / totalRec) * 100);
  const highPct = Math.round((forecast.riskBreakdown.highRiskTotalPaise / totalRec) * 100);

  return (
    <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.04] via-blue-500/[0.02] to-transparent p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                AI Cashflow &amp; Due Forecast
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${gradeColors[forecast.healthGrade]}`}>
                Score: {forecast.healthScore}/100 ({forecast.healthGrade})
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              30-day automated burn projection, customer debt recovery probability &amp; short-term liquidity
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          title={isExpanded ? 'Collapse Forecast' : 'Expand Forecast'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
          {/* Key Metric Gauges Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. 30-Day Projected Balance */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">30-Day Forecast</span>
                {forecast.netVelocityPaise >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                )}
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                {formatPaise(forecast.projected30DayBalancePaise)}
              </div>
              <span className={`text-[10px] font-bold flex items-center gap-0.5 mt-1 ${
                forecast.netVelocityPaise >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {forecast.netVelocityPaise >= 0 ? '+' : ''}
                {formatPaise(forecast.netVelocityPaise)} / day
              </span>
            </div>

            {/* 2. Cash Runway */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Cash Runway</span>
                <Clock className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                {forecast.runwayDays === 'infinite' ? '∞ Surplus' : `~${forecast.runwayDays} Days`}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Burn: {formatPaise(forecast.dailyBurnRatePaise)} / day
              </span>
            </div>

            {/* 3. Expected Receivables Collection */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Collectible Debt</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatPaise(forecast.projectedReceivablesPaise)}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                of {formatPaise(forecast.totalReceivablesPaise)} nominal
              </span>
            </div>

            {/* 4. Liquidity Coverage (15d Obligations) */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">15d Coverage</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className={`text-base font-black tabular-nums ${
                forecast.liquidityRatio >= 1.2
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {forecast.liquidityRatio}x Liquid
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Obligations: {formatPaise(forecast.totalObligations15dPaise)}
              </span>
            </div>
          </div>

          {/* Debt Quality Spectrum Bar */}
          {forecast.totalReceivablesPaise > 0 && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span>Customer Debt Recovery Spectrum</span>
                  <span className="text-[10px] text-slate-400 font-normal">({forecast.riskBreakdown.items.length} pending dues)</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Expected Settlement Rate: <strong>{Math.round((forecast.projectedReceivablesPaise / forecast.totalReceivablesPaise) * 100)}%</strong>
                </span>
              </div>

              {/* Multi-segment Progress Bar */}
              <div className="h-2.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${lowPct}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Low Risk (<0d overdue): ${formatPaise(forecast.riskBreakdown.lowRiskTotalPaise)} (${lowPct}%)`}
                />
                <div
                  style={{ width: `${medPct}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`Medium Risk (1-14d overdue): ${formatPaise(forecast.riskBreakdown.mediumRiskTotalPaise)} (${medPct}%)`}
                />
                <div
                  style={{ width: `${highPct}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`High Risk (>14d overdue): ${formatPaise(forecast.riskBreakdown.highRiskTotalPaise)} (${highPct}%)`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>On-Track: {formatPaise(forecast.riskBreakdown.lowRiskTotalPaise)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <span>Due Soon (1-14d): {formatPaise(forecast.riskBreakdown.mediumRiskTotalPaise)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  <span>Critical (&gt;14d): {formatPaise(forecast.riskBreakdown.highRiskTotalPaise)}</span>
                </span>
              </div>
            </div>
          )}

          {/* Actionable AI Recommendations */}
          {forecast.recommendations.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                AI Strategic Actions &amp; Alerts
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {forecast.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition-all ${
                      rec.type === 'critical'
                        ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-500/25'
                        : rec.type === 'warning'
                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-500/25'
                        : rec.type === 'positive'
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500/25'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        {rec.type === 'critical' && <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                        {rec.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {rec.type === 'positive' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        {rec.type === 'tip' && <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {rec.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {rec.description}
                      </p>
                    </div>

                    {rec.actionLabel && (
                      <button
                        onClick={() => handleAction(rec)}
                        className={`shrink-0 px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-all shadow-xs ${
                          rec.type === 'critical'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : rec.type === 'warning'
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {rec.actionTarget === 'whatsapp' && <MessageSquare className="w-3 h-3" />}
                        <span>{rec.actionLabel}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Reminder Modal Triggered from AI Recommendation */}
      <WhatsAppReminderModal
        isOpen={!!activeReminderTarget}
        onClose={() => setActiveReminderTarget(null)}
        due={activeReminderTarget?.due || null}
        customer={activeReminderTarget?.customer || null}
      />
    </div>
  );
}
