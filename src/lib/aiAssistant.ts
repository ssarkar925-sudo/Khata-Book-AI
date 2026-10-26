import { LedgerEntry, PeopleDue, Customer, Card, CashLocation } from '@/types';
import { formatPaise, parseToPaise } from './money';

export interface AIAnalysisResult {
  answer: string;
  actionSuggestion?: {
    type: 'whatsapp' | 'add_entry' | 'pay_bill';
    payload?: any;
    label: string;
  };
}

export interface ParsedQuickIntent {
  type: 'cash_in' | 'cash_out' | 'expense' | 'due_get' | 'due_give' | 'card_spend' | 'bill_pay' | 'note';
  amount?: number;
  contact?: string;
  category?: string;
  note?: string;
}

/**
 * Natural Language Fast Intent Parser for "Ask AI"
 */
export function parseNaturalLanguageEntry(text: string): ParsedQuickIntent | null {
  const t = text.trim();
  const lower = t.toLowerCase();

  // Extract amount
  const amountMatch = t.match(/(?:₹|rs\.?|rupees?)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:₹|rs\.?|rupees?)/i) ||
                      t.match(/\b(\d+(?:\.\d{1,2})?)\b/);
  const amount = amountMatch ? parseToPaise(amountMatch[1] || amountMatch[2]) : undefined;

  // Determine intent
  if (lower.includes('got') || lower.includes('received') || lower.includes('income') || lower.includes('cash in')) {
    const contactMatch = t.match(/from\s+([A-Za-z\s]+?)(?:\s+for|\s+in|\s+via|$)/i);
    return {
      type: 'cash_in',
      amount,
      contact: contactMatch ? contactMatch[1].trim() : undefined,
      note: t,
    };
  }

  if (lower.includes('spent') || lower.includes('paid') || lower.includes('expense') || lower.includes('bill')) {
    const isCard = lower.includes('card') || lower.includes('hdfc') || lower.includes('sbi') || lower.includes('icici');
    return {
      type: isCard ? 'card_spend' : 'expense',
      amount,
      note: t,
    };
  }

  if (lower.includes('due') || lower.includes('udhar') || lower.includes('will get') || lower.includes('owes')) {
    const contactMatch = t.match(/(?:from|to|by)\s+([A-Za-z\s]+?)(?:\s+amount|$)/i);
    return {
      type: 'due_get',
      amount,
      contact: contactMatch ? contactMatch[1].trim() : undefined,
      note: t,
    };
  }

  if (amount && amount > 0) {
    return {
      type: 'expense',
      amount,
      note: t,
    };
  }

  return null;
}

/**
 * AI Financial Advisor logic: answers financial questions directly from state
 */
export function answerFinancialQuery(
  question: string,
  context: {
    ledger: LedgerEntry[];
    dues: PeopleDue[];
    customers: Customer[];
    cards: Card[];
    cashLocations: CashLocation[];
  }
): AIAnalysisResult {
  const q = question.toLowerCase();
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM

  // 1. "How much did I spend this month?"
  if (q.includes('spend') || q.includes('expense') || q.includes('spent')) {
    let monthlySpend = 0;
    for (const e of context.ledger) {
      if ((e.type === 'expense' || e.type === 'card_spend') && e.entry_date.startsWith(currentMonthStr)) {
        monthlySpend += Number(e.amount);
      }
    }
    return {
      answer: `This month (${now.toLocaleString('default', { month: 'long' })}), your total spending across cash, UPI, and credit cards is **${formatPaise(monthlySpend)}**.`,
    };
  }

  // 2. "Who owes me money?" / "Receivables"
  if (q.includes('owe') || q.includes('due') || q.includes('udhar') || q.includes('receivable')) {
    const pendingDues = context.dues.filter((d) => d.status === 'pending' && d.direction === 'you_will_get');
    if (pendingDues.length === 0) {
      return { answer: 'Great news! All customer dues are currently settled. No one owes you money right now.' };
    }

    const totalOwed = pendingDues.reduce((sum, d) => sum + Number(d.amount), 0);
    const topDebtors = pendingDues
      .map((d) => {
        const cust = context.customers.find((c) => c.id === d.customer_id);
        return { name: cust?.name || 'Customer', amount: Number(d.amount), phone: cust?.phone };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const debtorsList = topDebtors.map((t) => `• **${t.name}**: ${formatPaise(t.amount)}`).join('\n');

    return {
      answer: `You have **${pendingDues.length} pending dues** totaling **${formatPaise(totalOwed)}**.\n\nTop balances:\n${debtorsList}`,
      actionSuggestion: topDebtors[0]?.phone
        ? {
            type: 'whatsapp',
            label: `Remind ${topDebtors[0].name} via WhatsApp`,
            payload: { phone: topDebtors[0].phone, name: topDebtors[0].name, amount: topDebtors[0].amount },
          }
        : undefined,
    };
  }

  // 3. "Upcoming Card Bills" / "Cards"
  if (q.includes('card') || q.includes('bill') || q.includes('credit')) {
    if (context.cards.length === 0) {
      return { answer: 'You have not added any credit cards yet. Tap **Cards** to add your first card.' };
    }

    const cardSummary = context.cards.map((c) => {
      // Calculate outstanding spend
      const spend = context.ledger
        .filter((e) => e.card_id === c.id && e.type === 'card_spend')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const paid = context.ledger
        .filter((e) => e.card_id === c.id && e.type === 'bill_payment')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const outstanding = Math.max(0, spend - paid);
      return `• **${c.name}** (${c.bank}): ${formatPaise(outstanding)} due (Statement day: ${c.statement_day}th)`;
    }).join('\n');

    return {
      answer: `Here is your credit card status:\n\n${cardSummary}`,
    };
  }

  // 4. "Total Cash & Bank Balance" / "Accounts"
  if (q.includes('cash') || q.includes('bank') || q.includes('balance') || q.includes('account')) {
    const totalCash = context.cashLocations.reduce((sum, loc) => sum + Number(loc.balance), 0);
    const accountsList = context.cashLocations.map((loc) => `• **${loc.name}**: ${formatPaise(loc.balance)}`).join('\n');

    return {
      answer: `Total liquid balance across all accounts is **${formatPaise(totalCash)}**:\n\n${accountsList}`,
    };
  }

  // 5. Default General Overview
  const totalCash = context.cashLocations.reduce((sum, loc) => sum + Number(loc.balance), 0);
  const totalReceivables = context.dues
    .filter((d) => d.status === 'pending' && d.direction === 'you_will_get')
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const totalPayables = context.dues
    .filter((d) => d.status === 'pending' && d.direction === 'you_will_give')
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const netPosition = totalCash + totalReceivables - totalPayables;

  return {
    answer: `Here is your real-time financial health summary:\n\n• **Net Worth / Position**: ${formatPaise(netPosition)}\n• **Cash & Bank Balances**: ${formatPaise(totalCash)}\n• **Receivables (Udhar)**: +${formatPaise(totalReceivables)}\n• **Payables**: -${formatPaise(totalPayables)}\n\nYou can ask me specific questions like: *"How much did I spend this month?"*, *"Who owes me money?"*, or *"Show my credit card bills"*!`,
  };
}
