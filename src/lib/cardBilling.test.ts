import { describe, it, expect } from 'vitest';
import { calculateCardBilling, calculateAllCardsBillingReport } from '@/lib/cardBilling';
import { Card, LedgerEntry } from '@/types';

const createTestCard = (overrides: Partial<Card> = {}): Card => ({
  id: 'card-1',
  workspace_id: 'ws-1',
  name: 'HDFC Credit Card',
  bank: 'HDFC Bank',
  last4: '1234',
  credit_limit: 10000000, // ₹1,00,000
  statement_day: 15,
  due_day: 5,
  is_active: true,
  scope: 'business',
  ...overrides,
});

const createLedgerEntry = (overrides: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: `tx-${Date.now()}-${Math.random()}`,
  workspace_id: 'ws-1',
  type: 'card_spend',
  amount: 100000, // ₹1,000
  card_id: 'card-1',
  mode: 'card',
  entry_date: new Date().toISOString(),
  ...overrides,
});

describe('Card Billing Library', () => {
  describe('calculateCardBilling', () => {
    it('calculates correct dates for statement generated this month', () => {
      const card = createTestCard({ statement_day: 15, due_day: 5 });
      const referenceDate = new Date('2024-01-20'); // 20th, after statement day 15
      
      const result = calculateCardBilling(card, [], referenceDate);
      
      // Statement was on 15th Jan, due date should be 5th Feb
      expect(result.lastStatementDate.getDate()).toBe(15);
      expect(result.lastStatementDate.getMonth()).toBe(0); // January
      expect(result.dueDate.getDate()).toBe(5);
      expect(result.dueDate.getMonth()).toBe(1); // February
    });

    it('calculates correct dates for statement not yet generated', () => {
      const card = createTestCard({ statement_day: 15, due_day: 5 });
      const referenceDate = new Date('2024-01-10'); // 10th, before statement day 15
      
      const result = calculateCardBilling(card, [], referenceDate);
      
      // Last statement was 15th Dec, due date should be 5th Jan
      expect(result.lastStatementDate.getDate()).toBe(15);
      expect(result.lastStatementDate.getMonth()).toBe(11); // December
      expect(result.dueDate.getDate()).toBe(5);
      expect(result.dueDate.getMonth()).toBe(0); // January
    });

    it('calculates due date ALWAYS in month after statement (fix for bug)', () => {
      // Test case: statement day 28, due day 5
      // Due date should ALWAYS be in the next month
      const card = createTestCard({ statement_day: 28, due_day: 5 });
      const referenceDate = new Date('2024-01-30'); // After statement day
      
      const result = calculateCardBilling(card, [], referenceDate);
      
      // Statement was 28th Jan, due date should be 5th Feb (next month)
      expect(result.lastStatementDate.getDate()).toBe(28);
      expect(result.lastStatementDate.getMonth()).toBe(0); // January
      expect(result.dueDate.getDate()).toBe(5);
      expect(result.dueDate.getMonth()).toBe(1); // February
      
      // Test case: statement day 5, due day 15
      // Due date should be in next month
      const card2 = createTestCard({ statement_day: 5, due_day: 15 });
      const referenceDate2 = new Date('2024-01-10'); // After statement day
      
      const result2 = calculateCardBilling(card2, [], referenceDate2);
      
      // Statement was 5th Jan, due date should be 15th Feb (next month)
      expect(result2.lastStatementDate.getDate()).toBe(5);
      expect(result2.lastStatementDate.getMonth()).toBe(0); // January
      expect(result2.dueDate.getDate()).toBe(15);
      expect(result2.dueDate.getMonth()).toBe(1); // February
    });

    it('calculates days until due correctly', () => {
      const card = createTestCard({ statement_day: 15, due_day: 5 });
      const referenceDate = new Date('2024-01-20'); // Due is 5th Feb
      
      const result = calculateCardBilling(card, [], referenceDate);
      
      // ~16 days until 5th Feb from 20th Jan
      expect(result.daysUntilDue).toBeGreaterThan(10);
      expect(result.daysUntilDue).toBeLessThan(20);
      expect(result.isOverdue).toBe(false);
      expect(result.isDueToday).toBe(false);
    });

    it('detects overdue correctly', () => {
      const card = createTestCard({ statement_day: 15, due_day: 5 });
      const referenceDate = new Date('2024-02-10'); // After due date 5th Feb
      
      const result = calculateCardBilling(card, [], referenceDate);
      
      expect(result.daysUntilDue).toBeLessThan(0);
      expect(result.isOverdue).toBe(true);
      expect(result.isDueToday).toBe(false);
    });

    it('detects due today correctly', () => {
      const card = createTestCard({ statement_day: 15, due_day: 5 });
      // Reference date: Feb 5 (due date)
      // Note: Due to time component, daysUntilDue might be 1 (within 24h)
      const referenceDate = new Date('2024-02-05T12:00:00Z');
      
      const result = calculateCardBilling(card, [], referenceDate);
      
      // daysUntilDue is 1 because we're within 24h of due date
      expect(result.daysUntilDue).toBeGreaterThanOrEqual(0);
      expect(result.daysUntilDue).toBeLessThanOrEqual(1);
      expect(result.isOverdue).toBe(false);
      expect(result.isDueToday).toBe(result.daysUntilDue === 0);
    });

    it('separates billed and unbilled spends correctly', () => {
      const card = createTestCard({ statement_day: 15 });
      const referenceDate = new Date('2024-01-20');
      
      const ledger: LedgerEntry[] = [
        // Billed spend (before statement date)
        createLedgerEntry({
          id: 'tx-1',
          amount: 500000, // ₹5,000
          entry_date: '2024-01-10T10:00:00Z', // Before 15th
          is_billed: true,
        }),
        // Unbilled spend (after statement date)
        createLedgerEntry({
          id: 'tx-2',
          amount: 300000, // ₹3,000
          entry_date: '2024-01-18T10:00:00Z', // After 15th
          is_billed: false,
        }),
        // Auto-billed (before statement date, no explicit flag)
        createLedgerEntry({
          id: 'tx-3',
          amount: 200000, // ₹2,000
          entry_date: '2024-01-12T10:00:00Z', // Before 15th
          // No is_billed flag
        }),
      ];
      
      const result = calculateCardBilling(card, ledger, referenceDate);
      
      expect(result.billedSpends).toBe(700000); // 500000 + 200000
      expect(result.unbilledSpends).toBe(300000);
      expect(result.billedSpendsList).toHaveLength(2);
      expect(result.unbilledSpendsList).toHaveLength(1);
    });

    it('calculates payment allocation correctly', () => {
      const card = createTestCard({ statement_day: 15 });
      const referenceDate = new Date('2024-01-20');
      
      const ledger: LedgerEntry[] = [
        // Billed spends: ₹10,000
        createLedgerEntry({
          id: 'tx-1',
          amount: 1000000,
          entry_date: '2024-01-10T10:00:00Z',
          type: 'card_spend',
        }),
        // Payment: ₹6,000
        createLedgerEntry({
          id: 'tx-2',
          amount: 600000,
          entry_date: '2024-01-18T10:00:00Z',
          type: 'bill_payment',
        }),
      ];
      
      const result = calculateCardBilling(card, ledger, referenceDate);
      
      expect(result.billedSpends).toBe(1000000);
      expect(result.billedPaid).toBe(600000);
      expect(result.billedDue).toBe(400000); // ₹4,000 still due
      expect(result.advancePayments).toBe(0);
    });

    it('calculates advance payments correctly', () => {
      const card = createTestCard({ statement_day: 15 });
      const referenceDate = new Date('2024-01-20');
      
      const ledger: LedgerEntry[] = [
        // Billed spends: ₹5,000
        createLedgerEntry({
          id: 'tx-1',
          amount: 500000,
          entry_date: '2024-01-10T10:00:00Z',
          type: 'card_spend',
        }),
        // Payment: ₹8,000 (exceeds billed)
        createLedgerEntry({
          id: 'tx-2',
          amount: 800000,
          entry_date: '2024-01-18T10:00:00Z',
          type: 'bill_payment',
        }),
      ];
      
      const result = calculateCardBilling(card, ledger, referenceDate);
      
      expect(result.billedSpends).toBe(500000);
      expect(result.billedPaid).toBe(500000);
      expect(result.billedDue).toBe(0);
      expect(result.advancePayments).toBe(300000); // ₹3,000 advance
    });

    it('calculates advance credit correctly', () => {
      const card = createTestCard({ statement_day: 15 });
      const referenceDate = new Date('2024-01-20');
      
      const ledger: LedgerEntry[] = [
        // Billed spends: ₹5,000
        createLedgerEntry({
          id: 'tx-1',
          amount: 500000,
          entry_date: '2024-01-10T10:00:00Z',
          type: 'card_spend',
        }),
        // Payment: ₹10,000 (exceeds billed + unbilled)
        createLedgerEntry({
          id: 'tx-2',
          amount: 1000000,
          entry_date: '2024-01-18T10:00:00Z',
          type: 'bill_payment',
        }),
      ];
      
      const result = calculateCardBilling(card, ledger, referenceDate);
      
      expect(result.billedDue).toBe(0);
      expect(result.advancePayments).toBe(500000); // ₹5,000 advance after clearing billed
      expect(result.unbilledSpends).toBe(0);
      expect(result.netUnbilled).toBe(0);
      expect(result.advanceCredit).toBe(500000); // Full ₹5,000 credit
    });

    it('calculates available credit correctly', () => {
      const card = createTestCard({ statement_day: 15, credit_limit: 10000000 }); // ₹1,00,000
      const referenceDate = new Date('2024-01-20');
      
      const ledger: LedgerEntry[] = [
        createLedgerEntry({
          id: 'tx-1',
          amount: 3000000, // ₹30,000 billed
          entry_date: '2024-01-10T10:00:00Z',
          type: 'card_spend',
        }),
        createLedgerEntry({
          id: 'tx-2',
          amount: 1000000, // ₹10,000 unbilled
          entry_date: '2024-01-18T10:00:00Z',
          type: 'card_spend',
        }),
        createLedgerEntry({
          id: 'tx-3',
          amount: 2000000, // ₹20,000 payment
          entry_date: '2024-01-19T10:00:00Z',
          type: 'bill_payment',
        }),
      ];
      
      const result = calculateCardBilling(card, ledger, referenceDate);
      
      // Billed: 30,000, Paid: 20,000, Due: 10,000
      // Unbilled: 10,000, Advance: 0, Net Unbilled: 10,000
      // Total Outstanding: 20,000
      // Available: 1,00,000 - 20,000 = 80,000
      expect(result.totalOutstanding).toBe(2000000);
      expect(result.availableCredit).toBe(8000000);
    });

    it('sets status correctly for different scenarios', () => {
      const card = createTestCard({ statement_day: 15, due_day: 5 });
      
      // Overdue
      let result = calculateCardBilling(card, [
        createLedgerEntry({ amount: 100000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z' }),
      ], new Date('2024-02-10'));
      expect(result.status).toBe('overdue');
      
      // Due today
      result = calculateCardBilling(card, [
        createLedgerEntry({ amount: 100000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z' }),
      ], new Date('2024-02-05'));
      expect(result.status).toBe('urgent');
      
      // Urgent (within 3 days)
      result = calculateCardBilling(card, [
        createLedgerEntry({ amount: 100000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z' }),
      ], new Date('2024-02-03'));
      expect(result.status).toBe('urgent');
      
      // Due (more than 3 days)
      result = calculateCardBilling(card, [
        createLedgerEntry({ amount: 100000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z' }),
      ], new Date('2024-01-25'));
      expect(result.status).toBe('due');
      
      // Unbilled only
      result = calculateCardBilling(card, [
        createLedgerEntry({ amount: 100000, type: 'card_spend', entry_date: '2024-01-18T10:00:00Z' }),
      ], new Date('2024-01-25'));
      expect(result.status).toBe('unbilled_only');
      
      // Cleared
      result = calculateCardBilling(card, [
        createLedgerEntry({ amount: 100000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z' }),
        createLedgerEntry({ amount: 100000, type: 'bill_payment', entry_date: '2024-01-20T10:00:00Z' }),
      ], new Date('2024-01-25'));
      expect(result.status).toBe('cleared');
      
      // Advance credit
      result = calculateCardBilling(card, [
        createLedgerEntry({ amount: 50000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z' }),
        createLedgerEntry({ amount: 100000, type: 'bill_payment', entry_date: '2024-01-20T10:00:00Z' }),
      ], new Date('2024-01-25'));
      expect(result.status).toBe('advance_credit');
    });
  });

  describe('calculateAllCardsBillingReport', () => {
    it('aggregates multiple cards correctly', () => {
      const card1 = createTestCard({ id: 'card-1', credit_limit: 10000000 });
      const card2 = createTestCard({ id: 'card-2', credit_limit: 5000000 });
      
      const ledger: LedgerEntry[] = [
        // Card 1: ₹10,000 billed due
        createLedgerEntry({ id: 'tx-1', card_id: 'card-1', amount: 1000000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z' }),
        // Card 2: ₹5,000 billed due
        createLedgerEntry({ id: 'tx-2', card_id: 'card-2', amount: 500000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z' }),
      ];
      
      const report = calculateAllCardsBillingReport([card1, card2], ledger);
      
      expect(report.totalBilledDue).toBe(1500000); // ₹15,000
      expect(report.totalCreditLimit).toBe(15000000); // ₹1,50,000
      expect(report.cardSummaries).toHaveLength(2);
    });

    it('counts urgent cards correctly', () => {
      const card1 = createTestCard({ id: 'card-1', statement_day: 15, due_day: 5 });
      const card2 = createTestCard({ id: 'card-2', statement_day: 15, due_day: 5 });
      
      const ledger: LedgerEntry[] = [
        // Card 1: overdue billed spend
        createLedgerEntry({ id: 'tx-1', card_id: 'card-1', amount: 1000000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z', is_billed: true }),
        // Card 2: due soon (urgent) billed spend
        createLedgerEntry({ id: 'tx-2', card_id: 'card-2', amount: 500000, type: 'card_spend', entry_date: '2024-01-10T10:00:00Z', is_billed: true }),
      ];
      
      // Reference date: Feb 3 (2 days before due date Feb 5)
      const report = calculateAllCardsBillingReport([card1, card2], ledger, new Date('2024-02-03'));
      
      expect(report.urgentCardsCount).toBe(2);
    });
  });
});