'use client';

import { LedgerEntry, CashLocation, PeopleDue, Card, Customer } from '@/types';
import { paiseToRupees } from '@/lib/money';

export interface DueRiskItem {
  dueId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  amountPaise: number;
  dueDate: string;
  daysDiff: number; // positive = overdue days, negative = days remaining
  riskLevel: 'low' | 'medium' | 'high';
  recoveryProbability: number; // 0 to 1
  projectedCollectionPaise: number;
}

export interface CashflowForecastReport {
  currentLiquidCashPaise: number;
  dailyBurnRatePaise: number;
  dailyInflowRatePaise: number;
  netVelocityPaise: number;
  runwayDays: number | 'infinite';
  projected30DayBalancePaise: number;
  totalReceivablesPaise: number;
  projectedReceivablesPaise: number;
  totalPayablesPaise: number;
  totalCardObligations15dPaise: number;
  totalObligations15dPaise: number;
  liquidityRatio: number;
  healthGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  healthScore: number;
  riskBreakdown: {
    lowRiskTotalPaise: number;
    mediumRiskTotalPaise: number;
    highRiskTotalPaise: number;
    items: DueRiskItem[];
  };
  recommendations: Array<{
    id: string;
    type: 'critical' | 'warning' | 'positive' | 'tip';
    title: string;
    description: string;
    actionLabel?: string;
    actionTarget?: 'dues' | 'cards' | 'expenses' | 'whatsapp';
    targetDueId?: string;
    targetCustomerId?: string;
  }>;
}

export function computeCashflowForecast(
  ledger: LedgerEntry[],
  accounts: CashLocation[],
  dues: PeopleDue[],
  cards: Card[],
  customers: Customer[]
): CashflowForecastReport {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Calculate Current Liquid Cash
  const currentLiquidCashPaise = accounts.reduce(
    (sum, a) => sum + Math.max(0, Number(a.balance || 0)),
    0
  );

  // 2. 30-Day Historical Velocity
  const recentEntries = ledger.filter((e) => {
    const d = new Date(e.entry_date || e.created_at || '');
    return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
  });

  const thirtyDayOutflow = recentEntries
    .filter((e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const thirtyDayInflow = recentEntries
    .filter((e) => e.type === 'cash_in')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const dailyBurnRatePaise = Math.round(thirtyDayOutflow / 30);
  const dailyInflowRatePaise = Math.round(thirtyDayInflow / 30);
  const netVelocityPaise = dailyInflowRatePaise - dailyBurnRatePaise;

  // Runway Calculation
  let runwayDays: number | 'infinite' = 'infinite';
  if (netVelocityPaise < 0) {
    const netBurnPerDay = Math.abs(netVelocityPaise);
    runwayDays = netBurnPerDay > 0 ? Math.round(currentLiquidCashPaise / netBurnPerDay) : 0;
  } else if (dailyBurnRatePaise > 0 && dailyInflowRatePaise === 0) {
    runwayDays = Math.round(currentLiquidCashPaise / dailyBurnRatePaise);
  }

  // Projected 30-Day Balance
  const projected30DayBalancePaise = Math.max(
    0,
    currentLiquidCashPaise + netVelocityPaise * 30
  );

  // 3. Customer Dues Risk Analysis (Receivables)
  const custMap = new Map(customers.map((c) => [c.id, c]));
  const pendingReceivables = dues.filter(
    (d) => d.status === 'pending' && d.direction === 'you_will_get'
  );

  const riskItems: DueRiskItem[] = [];
  let lowRiskTotalPaise = 0;
  let mediumRiskTotalPaise = 0;
  let highRiskTotalPaise = 0;
  let totalReceivablesPaise = 0;
  let projectedReceivablesPaise = 0;

  pendingReceivables.forEach((due) => {
    const cust = custMap.get(due.customer_id);
    const dueDate = due.due_date ? new Date(due.due_date) : now;
    const diffMs = now.getTime() - dueDate.getTime();
    const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const amount = Number(due.amount);
    totalReceivablesPaise += amount;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let recoveryProbability = 0.95;

    if (daysDiff > 14) {
      riskLevel = 'high';
      recoveryProbability = 0.35;
      highRiskTotalPaise += amount;
    } else if (daysDiff > 0) {
      riskLevel = 'medium';
      recoveryProbability = 0.70;
      mediumRiskTotalPaise += amount;
    } else {
      riskLevel = 'low';
      recoveryProbability = 0.95;
      lowRiskTotalPaise += amount;
    }

    const projected = Math.round(amount * recoveryProbability);
    projectedReceivablesPaise += projected;

    riskItems.push({
      dueId: due.id,
      customerId: due.customer_id,
      customerName: cust?.name || 'Customer',
      customerPhone: cust?.phone || undefined,
      amountPaise: amount,
      dueDate: due.due_date,
      daysDiff,
      riskLevel,
      recoveryProbability,
      projectedCollectionPaise: projected,
    });
  });

  // Sort risk items: highest risk and largest amounts first
  riskItems.sort((a, b) => {
    if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
    if (b.riskLevel === 'high' && a.riskLevel !== 'high') return 1;
    return b.amountPaise - a.amountPaise;
  });

  // 4. Payables & 15-Day Obligations
  const totalPayablesPaise = dues
    .filter((d) => d.status === 'pending' && d.direction === 'you_will_give')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  // Credit Card upcoming bill estimation
  let totalCardObligations15dPaise = 0;
  const currentDay = now.getDate();
  cards.forEach((card) => {
    const cardSpends = ledger
      .filter((e) => e.card_id === card.id && e.type === 'card_spend')
      .reduce((s, e) => s + Number(e.amount), 0);
    const cardPaid = ledger
      .filter((e) => e.card_id === card.id && e.type === 'bill_payment')
      .reduce((s, e) => s + Number(e.amount), 0);
    const outstanding = Math.max(0, cardSpends - cardPaid);

    if (outstanding > 0) {
      const dueDay = card.due_day || 20;
      let daysUntilDue = dueDay - currentDay;
      if (daysUntilDue < 0) daysUntilDue += 30;
      if (daysUntilDue <= 15) {
        totalCardObligations15dPaise += outstanding;
      }
    }
  });

  const totalObligations15dPaise = totalCardObligations15dPaise + Math.round(totalPayablesPaise * 0.5);
  const liquidityRatio =
    totalObligations15dPaise > 0
      ? Number((currentLiquidCashPaise / totalObligations15dPaise).toFixed(2))
      : 9.99;

  // 5. Health Grade & Score
  let healthScore = 75;
  if (netVelocityPaise > 0) healthScore += 15;
  if (liquidityRatio >= 1.5) healthScore += 10;
  if (liquidityRatio < 0.8) healthScore -= 20;
  if (highRiskTotalPaise > currentLiquidCashPaise * 0.5) healthScore -= 15;
  healthScore = Math.max(20, Math.min(100, healthScore));

  let healthGrade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'B';
  if (healthScore >= 90) healthGrade = 'A+';
  else if (healthScore >= 80) healthGrade = 'A';
  else if (healthScore >= 65) healthGrade = 'B';
  else if (healthScore >= 50) healthGrade = 'C';
  else healthGrade = 'D';

  // 6. Generate Actionable AI Recommendations
  const recommendations: CashflowForecastReport['recommendations'] = [];

  // Rec 1: High risk overdue debtor
  const topHighRisk = riskItems.find((r) => r.riskLevel === 'high');
  if (topHighRisk) {
    recommendations.push({
      id: 'rec-high-risk-debtor',
      type: 'critical',
      title: `Overdue Receivables: ₹${paiseToRupees(topHighRisk.amountPaise).toLocaleString('en-IN')}`,
      description: `${topHighRisk.customerName} is overdue by ${topHighRisk.daysDiff} days. Dispatch a 1-tap WhatsApp reminder with UPI QR to accelerate settlement.`,
      actionLabel: 'Remind on WhatsApp',
      actionTarget: 'whatsapp',
      targetDueId: topHighRisk.dueId,
      targetCustomerId: topHighRisk.customerId,
    });
  }

  // Rec 2: Credit Card obligation
  if (totalCardObligations15dPaise > 0) {
    recommendations.push({
      id: 'rec-card-obligation',
      type: 'warning',
      title: `Credit Card Bill Due Soon: ₹${paiseToRupees(totalCardObligations15dPaise).toLocaleString('en-IN')}`,
      description: `You have ₹${paiseToRupees(totalCardObligations15dPaise).toLocaleString('en-IN')} in credit card bills due within 15 days. Ensure linked accounts hold sufficient liquidity.`,
      actionLabel: 'Inspect Cards',
      actionTarget: 'cards',
    });
  }

  // Rec 3: Positive Cashflow velocity or Burn Rate alert
  if (netVelocityPaise > 0) {
    recommendations.push({
      id: 'rec-positive-velocity',
      type: 'positive',
      title: 'Strong Operating Cashflow',
      description: `Inflows exceed outflows by +₹${paiseToRupees(netVelocityPaise).toLocaleString('en-IN')}/day. You are on track to accumulate +₹${paiseToRupees(netVelocityPaise * 30).toLocaleString('en-IN')} over the next 30 days.`,
      actionLabel: 'View Financial P&L',
      actionTarget: 'expenses',
    });
  } else if (runwayDays !== 'infinite' && runwayDays < 45) {
    recommendations.push({
      id: 'rec-burn-runway',
      type: 'critical',
      title: `Tight Cash Runway: ~${runwayDays} Days Remaining`,
      description: `At the current burn rate of ₹${paiseToRupees(dailyBurnRatePaise).toLocaleString('en-IN')}/day, available bank liquidity covers approximately ${runwayDays} days. Consider pausing discretionary outflows.`,
      actionLabel: 'Audit Expenses',
      actionTarget: 'expenses',
    });
  } else {
    recommendations.push({
      id: 'rec-healthy-liquidity',
      type: 'tip',
      title: 'Balanced Operating Runway',
      description: `Current liquid funds provide adequate cover for operations. Projected 30-day liquidity stands at ₹${paiseToRupees(projected30DayBalancePaise).toLocaleString('en-IN')}.`,
      actionLabel: 'Track Dues',
      actionTarget: 'dues',
    });
  }

  return {
    currentLiquidCashPaise,
    dailyBurnRatePaise,
    dailyInflowRatePaise,
    netVelocityPaise,
    runwayDays,
    projected30DayBalancePaise,
    totalReceivablesPaise,
    projectedReceivablesPaise,
    totalPayablesPaise,
    totalCardObligations15dPaise,
    totalObligations15dPaise,
    liquidityRatio,
    healthGrade,
    healthScore,
    riskBreakdown: {
      lowRiskTotalPaise,
      mediumRiskTotalPaise,
      highRiskTotalPaise,
      items: riskItems,
    },
    recommendations,
  };
}
