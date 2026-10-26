import { Card, LedgerEntry } from '@/types';

export interface CardBillingSummary {
  card: Card;
  statementDay: number;
  dueDay: number;
  lastStatementDate: Date;
  nextStatementDate: Date;
  dueDate: Date;
  daysUntilDue: number;
  isOverdue: boolean;
  isDueToday: boolean;

  // Transactions
  billedSpendsList: LedgerEntry[];
  unbilledSpendsList: LedgerEntry[];
  paymentsList: LedgerEntry[];

  // Amounts in Paise
  billedSpends: number;
  billedPaid: number;
  billedDue: number; // MUST PAY by Due Date

  unbilledSpends: number; // Spends after statement date (pay in next cycle)
  advancePayments: number; // Payments exceeding billed amount
  netUnbilled: number; // Unbilled minus advance
  advanceCredit: number; // Extra money with bank if payments > all spends

  totalOutstanding: number; // Total owed to bank (Billed Due + Net Unbilled)
  availableCredit: number;

  status: 'overdue' | 'urgent' | 'due' | 'unbilled_only' | 'cleared' | 'advance_credit';
  reminderMessage: string;
}

export interface AllCardsBillingReport {
  totalBilledDue: number;
  totalUnbilledSpends: number;
  totalAdvancePayments: number;
  totalOutstanding: number;
  totalCreditLimit: number;
  totalAvailableCredit: number;
  urgentCardsCount: number;
  cardSummaries: CardBillingSummary[];
}

/**
 * Calculates Statement Date, Due Date, Billed & Unbilled amounts,
 * advance payments, and reminders for a single credit card.
 */
export function calculateCardBilling(
  card: Card,
  ledger: LedgerEntry[],
  referenceDate: Date = new Date()
): CardBillingSummary {
  const statementDay = card.statement_day || 15;
  // Standard Indian banking default: payment due is 20 days after statement
  const dueDay = (card as any).due_day || ((statementDay + 20 - 1) % 30) + 1;

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();

  // 1. Calculate Last Statement Date & Next Statement Date
  let lastStatementDate: Date;
  let nextStatementDate: Date;

  if (currentDay >= statementDay) {
    // Statement has already generated this month
    lastStatementDate = new Date(currentYear, currentMonth, statementDay, 23, 59, 59, 999);
    nextStatementDate = new Date(currentYear, currentMonth + 1, statementDay, 23, 59, 59, 999);
  } else {
    // Statement has not generated yet this month; last statement was last month
    lastStatementDate = new Date(currentYear, currentMonth - 1, statementDay, 23, 59, 59, 999);
    nextStatementDate = new Date(currentYear, currentMonth, statementDay, 23, 59, 59, 999);
  }

  // 2. Calculate Payment Due Date for the last generated statement
  // Due date is in the month following the last statement
  let dueDate: Date;
  if (dueDay > statementDay) {
    // Due date in the same month as statement (rare, but possible if statement is early)
    dueDate = new Date(lastStatementDate.getFullYear(), lastStatementDate.getMonth(), dueDay, 23, 59, 59, 999);
  } else {
    // Due date in the month after statement (standard: e.g. statement 15th, due 5th next month)
    dueDate = new Date(lastStatementDate.getFullYear(), lastStatementDate.getMonth() + 1, dueDay, 23, 59, 59, 999);
  }

  // 3. Due Date countdown
  const diffTime = dueDate.getTime() - referenceDate.getTime();
  const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0;
  const isDueToday = daysUntilDue === 0;

  // 4. Filter all transactions for this card
  const cardSpends = ledger.filter((e) => e.card_id === card.id && e.type === 'card_spend');
  const cardPayments = ledger.filter((e) => e.card_id === card.id && e.type === 'bill_payment');

  // Separate Spends into Billed and Unbilled based on explicit override or lastStatementDate cutoff
  const billedSpendsList: LedgerEntry[] = [];
  const unbilledSpendsList: LedgerEntry[] = [];

  for (const spend of cardSpends) {
    if (spend.is_billed !== undefined) {
      if (spend.is_billed) {
        billedSpendsList.push(spend);
      } else {
        unbilledSpendsList.push(spend);
      }
    } else {
      const spendDate = new Date(spend.entry_date);
      if (spendDate <= lastStatementDate) {
        billedSpendsList.push(spend);
      } else {
        unbilledSpendsList.push(spend);
      }
    }
  }

  const billedSpends = billedSpendsList.reduce((sum, e) => sum + Number(e.amount), 0);
  const unbilledSpends = unbilledSpendsList.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPayments = cardPayments.reduce((sum, e) => sum + Number(e.amount), 0);

  // 5. Payment allocation logic (Payments first clear Billed Statement, remainder is Advance)
  const billedPaid = Math.min(billedSpends, totalPayments);
  const billedDue = Math.max(0, billedSpends - totalPayments);
  const advancePayments = Math.max(0, totalPayments - billedSpends);

  // Advance payments offset unbilled spends
  const netUnbilled = Math.max(0, unbilledSpends - advancePayments);
  const advanceCredit = Math.max(0, advancePayments - unbilledSpends);

  const totalOutstanding = billedDue + netUnbilled;
  const availableCredit = Math.max(0, card.credit_limit - totalOutstanding + advanceCredit);

  // 6. Status & Reminder Message
  let status: CardBillingSummary['status'] = 'cleared';
  let reminderMessage = 'All dues cleared. No payment required right now.';

  const formattedDueDate = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  if (billedDue > 0) {
    if (isOverdue) {
      status = 'overdue';
      reminderMessage = `⚠️ Overdue by ${Math.abs(daysUntilDue)} days! Bill was due on ${formattedDueDate}.`;
    } else if (isDueToday) {
      status = 'urgent';
      reminderMessage = `🚨 Due Today (${formattedDueDate})! Pay immediately to avoid interest.`;
    } else if (daysUntilDue <= 3) {
      status = 'urgent';
      reminderMessage = `⚡ Urgent: ${daysUntilDue} days left to pay bill (Due ${formattedDueDate}).`;
    } else {
      status = 'due';
      reminderMessage = `Bill generated. Pay by ${formattedDueDate} (${daysUntilDue} days left).`;
    }
  } else if (netUnbilled > 0) {
    status = 'unbilled_only';
    const formattedNextBill = nextStatementDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    reminderMessage = `Current bill is cleared. Unbilled spends will be billed on ${formattedNextBill}.`;
  } else if (advanceCredit > 0) {
    status = 'advance_credit';
    reminderMessage = `Card has an advance credit balance. No payments needed.`;
  }

  return {
    card,
    statementDay,
    dueDay,
    lastStatementDate,
    nextStatementDate,
    dueDate,
    daysUntilDue,
    isOverdue,
    isDueToday,
    billedSpendsList,
    unbilledSpendsList,
    paymentsList: cardPayments,
    billedSpends,
    billedPaid,
    billedDue,
    unbilledSpends,
    advancePayments,
    netUnbilled,
    advanceCredit,
    totalOutstanding,
    availableCredit,
    status,
    reminderMessage,
  };
}

/**
 * Aggregates Billed & Unbilled financial reporting across ALL cards.
 */
export function calculateAllCardsBillingReport(
  cards: Card[],
  ledger: LedgerEntry[]
): AllCardsBillingReport {
  const cardSummaries = cards.map((c) => calculateCardBilling(c, ledger));

  const totalBilledDue = cardSummaries.reduce((sum, s) => sum + s.billedDue, 0);
  const totalUnbilledSpends = cardSummaries.reduce((sum, s) => sum + s.netUnbilled, 0);
  const totalAdvancePayments = cardSummaries.reduce((sum, s) => sum + s.advancePayments, 0);
  const totalOutstanding = cardSummaries.reduce((sum, s) => sum + s.totalOutstanding, 0);
  const totalCreditLimit = cards.reduce((sum, c) => sum + Number(c.credit_limit), 0);
  const totalAvailableCredit = cardSummaries.reduce((sum, s) => sum + s.availableCredit, 0);
  const urgentCardsCount = cardSummaries.filter((s) => s.status === 'urgent' || s.status === 'overdue').length;

  return {
    totalBilledDue,
    totalUnbilledSpends,
    totalAdvancePayments,
    totalOutstanding,
    totalCreditLimit,
    totalAvailableCredit,
    urgentCardsCount,
    cardSummaries,
  };
}
