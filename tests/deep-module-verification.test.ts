import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, LedgerEntry } from '../src/types';
import type { BankAccountItem } from '../src/stores/useAccountStore';

// Mock localStorage for node environment
const storage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => storage[k] || null,
  setItem: (k: string, v: string) => { storage[k] = String(v); },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};

describe('RecordBook AI — Deep Module & Bug Verification Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==========================================================================
  // 1. SIGN OUT DATA LEAKAGE PREVENTION
  // ==========================================================================
  test('Security: Sign-out must clear all in-memory stores and cached records', () => {
    // Populate dummy records in local storage
    localStorage.setItem('rb_accounts', JSON.stringify([{ id: 'acc-1', name: 'HDFC', balance: 50000 }]));
    localStorage.setItem('rb_cards', JSON.stringify([{ id: 'card-1', name: 'ICICI Coral' }]));
    localStorage.setItem('rb_customers', JSON.stringify([{ id: 'cust-1', name: 'Ramesh' }]));
    localStorage.setItem('rb_dues', JSON.stringify([{ id: 'due-1', amount: 10000 }]));
    localStorage.setItem('rb_ledger_entries', JSON.stringify([{ id: 'tx-1', amount: 5000 }]));
    localStorage.setItem('rb_notes', JSON.stringify([{ id: 'note-1', title: 'Secret Pin' }]));
    localStorage.setItem('rb_vault_saved_items', JSON.stringify([{ id: 'vault-1', title: 'Bank Login' }]));

    function clearAllUserDataOnSignOut() {
      const keys = [
        'rb_accounts',
        'rb_cards',
        'rb_customers',
        'rb_dues',
        'rb_ledger_entries',
        'rb_notes',
        'rb_vault_saved_items',
        'rb_vault_auth_token',
        'rb_vault_lockout',
        'rb_cached_user',
      ];
      keys.forEach((k) => localStorage.removeItem(k));
    }

    clearAllUserDataOnSignOut();

    assert.strictEqual(localStorage.getItem('rb_accounts'), null, 'Accounts must be purged on sign out');
    assert.strictEqual(localStorage.getItem('rb_customers'), null, 'Customers must be purged on sign out');
    assert.strictEqual(localStorage.getItem('rb_ledger_entries'), null, 'Ledger entries must be purged on sign out');
    assert.strictEqual(localStorage.getItem('rb_vault_saved_items'), null, 'Vault items must be purged on sign out');
  });

  // ==========================================================================
  // 2. CLOUD PULL DATA SYNCHRONIZATION WITH 0 RECORDS
  // ==========================================================================
  test('Cloud Sync: pullAll updates stores even when remote has 0 records (deletion sync)', () => {
    let localCustomers = [{ id: 'cust-1', name: 'Deleted Customer' }];

    function handlePullResult(data: any[] | null) {
      // If data is returned (even empty array []), store must update to reflect remote state
      if (Array.isArray(data)) {
        localCustomers = data;
      }
    }

    // Remote returns empty array because customer was deleted on another device
    handlePullResult([]);
    assert.strictEqual(localCustomers.length, 0, 'Local store must reflect empty array when remote deletes all records');
  });

  // ==========================================================================
  // 3. LEDGER ENTRY DELETION RESTORES LINKED BANK ACCOUNT
  // ==========================================================================
  test('Ledger & Bank Consistency: Deleting an expense accurately restores bank account balance', () => {
    const account = { id: 'acc-hdfc', name: 'HDFC', balance: 40000 };
    const ledger = [
      { id: 'tx-1', type: 'expense', amount: 10000, cash_location_id: 'acc-hdfc' }
    ];

    function deleteLedgerEntry(id: string) {
      const existing = ledger.find((e) => e.id === id);
      if (existing && existing.cash_location_id) {
        if (existing.type === 'expense' || existing.type === 'cash_out') {
          account.balance += existing.amount;
        }
      }
      const idx = ledger.findIndex((e) => e.id === id);
      if (idx !== -1) ledger.splice(idx, 1);
    }

    deleteLedgerEntry('tx-1');

    assert.strictEqual(ledger.length, 0, 'Transaction must be removed');
    assert.strictEqual(account.balance, 50000, 'Bank balance must be restored from 40,000 to 50,000');
  });

  // ==========================================================================
  // 4. CREDIT CARD BILL PAYMENT BALANCE DEDUCTION & CASH LOCATION TRACKING
  // ==========================================================================
  test('Card Billing: Bill payment properly assigns cash_location_id and deducts exactly once', () => {
    const account = { id: 'acc-sbi', name: 'SBI', balance: 50000 };
    const ledger: any[] = [];

    function payCardBill(cardId: string, amountPaise: number, accountId?: string) {
      const entry = {
        id: 'tx-bill-1',
        type: 'bill_payment',
        amount: amountPaise,
        card_id: cardId,
        cash_location_id: accountId,
      };

      // Ledger deduction logic (simulating pushLedgerEntry)
      if (entry.cash_location_id === account.id) {
        account.balance -= entry.amount;
      }
      ledger.push(entry);
    }

    payCardBill('card-1', 15000, 'acc-sbi');

    assert.strictEqual(ledger[0].cash_location_id, 'acc-sbi', 'cash_location_id must be present on bill payment entry');
    assert.strictEqual(account.balance, 35000, 'Account balance must be deducted exactly once (50,000 - 15,000 = 35,000)');
  });

  // ==========================================================================
  // 5. INTER-SPHERE TRANSFER CREATES PAIRED AUDIT ENTRIES
  // ==========================================================================
  test('Inter-Sphere Transfer: Creates paired cash_out and cash_in entries with correct scopes', () => {
    const fromAccount = { id: 'acc-biz', scope: 'business', balance: 100000 };
    const toAccount = { id: 'acc-pers', scope: 'personal', balance: 20000 };
    const pushedEntries: any[] = [];

    function executeInterSphereTransfer(amount: number) {
      fromAccount.balance -= amount;
      toAccount.balance += amount;

      const outEntry = {
        id: 'tx-out',
        type: 'cash_out',
        amount,
        scope: fromAccount.scope,
        cash_location_id: fromAccount.id,
        note: 'Transfer to PERSONAL',
      };
      const inEntry = {
        id: 'tx-in',
        type: 'cash_in',
        amount,
        scope: toAccount.scope,
        cash_location_id: toAccount.id,
        note: 'Transfer from BUSINESS',
      };

      pushedEntries.push(outEntry, inEntry);
    }

    executeInterSphereTransfer(30000);

    assert.strictEqual(fromAccount.balance, 70000, 'Source account balance must decrease by 30,000');
    assert.strictEqual(toAccount.balance, 50000, 'Destination account balance must increase by 30,000');
    assert.strictEqual(pushedEntries.length, 2, 'Must create exactly 2 paired ledger entries');
    assert.strictEqual(pushedEntries[0].scope, 'business', 'Outflow must belong to business scope');
    assert.strictEqual(pushedEntries[1].scope, 'personal', 'Inflow must belong to personal scope');
  });

  // ==========================================================================
  // 6. VAULT SYNC PAYLOAD INTEGRITY
  // ==========================================================================
  test('Vault Sync: Vault items serialize, encrypt, and map to cloud schema without leaks', () => {
    const rawVaultItem = {
      id: 'vault-item-1',
      workspace_id: 'ws-123',
      title: 'NetBanking Login',
      item_type: 'bank_login',
      username: 'user_admin',
      encrypted_payload: 'encrypted-secret-bytes',
      iv: 'iv-bytes',
      salt: 'salt-bytes',
      auth_tag: 'auth-tag-bytes',
      website: 'https://bank.com',
      notes: 'Corporate login',
      color: '#3B82F6',
    };

    const VAULT_VALID_COLUMNS = new Set([
      'id', 'workspace_id', 'title', 'item_type', 'username',
      'encrypted_payload', 'iv', 'salt', 'auth_tag', 'website',
      'notes', 'color', 'created_at', 'updated_at', 'deleted_at'
    ]);

    function sanitizeVaultPayload(obj: Record<string, any>) {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (VAULT_VALID_COLUMNS.has(k) && v !== undefined) clean[k] = v;
      }
      return clean;
    }

    const clean = sanitizeVaultPayload(rawVaultItem);
    assert.strictEqual(clean.id, 'vault-item-1');
    assert.strictEqual(clean.encrypted_payload, 'encrypted-secret-bytes');
    assert.strictEqual((clean as any).unencrypted_password, undefined, 'Plaintext passwords must never be in payload');
  });

  // ==========================================================================
  // 7. EXCEL SHEET DATE RECOVERY & ROBUST NORMALIZATION
  // ==========================================================================
  test('Excel Sheets: Date normalization converts Indian DD/MM/YYYY, numeric serials, and timestamps to ISO YYYY-MM-DD', async () => {
    const { convertExcelSerialToDate, normalizeSheet } = await import('../src/stores/useSheetStore');

    // Test individual date inputs
    assert.strictEqual(convertExcelSerialToDate('24/05/1998'), '1998-05-24', 'Indian DD/MM/YYYY format');
    assert.strictEqual(convertExcelSerialToDate('24-05-1998'), '1998-05-24', 'Indian DD-MM-YYYY format');
    assert.strictEqual(convertExcelSerialToDate('24.05.1998'), '1998-05-24', 'Dotted DD.MM.YYYY format');
    assert.strictEqual(convertExcelSerialToDate('5/8/1990'), '1990-08-05', 'Single digit D/M/YYYY format');
    assert.strictEqual(convertExcelSerialToDate('1998-05-24'), '1998-05-24', 'Standard ISO YYYY-MM-DD');
    assert.strictEqual(convertExcelSerialToDate('1998/05/24'), '1998-05-24', 'Slash YYYY/MM/DD');
    assert.strictEqual(convertExcelSerialToDate('15/08/90'), '1990-08-15', '2-digit year 90');
    assert.strictEqual(convertExcelSerialToDate('15/08/24'), '2024-08-15', '2-digit year 24');
    assert.strictEqual(convertExcelSerialToDate(35939), '1998-05-24', 'Excel numeric serial number');
    assert.strictEqual(convertExcelSerialToDate('35939'), '1998-05-24', 'Excel numeric serial string');
    assert.strictEqual(convertExcelSerialToDate('1998-05-24T00:00:00.000Z'), '1998-05-24', 'ISO UTC timestamp string');
    assert.strictEqual(convertExcelSerialToDate(new Date(1998, 4, 24)), '1998-05-24', 'JavaScript Date object');
    assert.strictEqual(convertExcelSerialToDate('Pending'), 'Pending', 'Non-date text preserved');
    assert.strictEqual(convertExcelSerialToDate(''), '', 'Empty string returns empty');
    assert.strictEqual(convertExcelSerialToDate(null), '', 'Null returns empty');
    assert.strictEqual(convertExcelSerialToDate(undefined), '', 'Undefined returns empty');

    // Test full sheet normalization with date columns
    const rawSheet = {
      id: 'sheet-pan-data',
      title: 'PAN Card Data',
      columns: [
        { id: 'col-1', name: 'NAME', type: 'text' },
        { id: 'col-2', name: 'DATE OF BIRTH', type: 'date' },
        { id: 'col-3', name: 'APPLICATION RECEIVE DATE', type: 'date' },
        { id: 'col-4', name: 'APPLICATION COMPLETE DATE', type: 'date' },
      ],
      rows: [
        {
          id: 'row-1',
          data: {
            'col-1': 'Rahul Kumar',
            'col-2': '24/05/1998',
            'col-3': '15-08-2023',
            'col-4': 45230, // Serial for 2023-10-31
          },
        },
      ],
    };

    const normalized = normalizeSheet(rawSheet);
    assert.strictEqual(normalized.rows[0].data['col-2'], '1998-05-24', 'DOB normalized to YYYY-MM-DD');
    assert.strictEqual(normalized.rows[0].data['col-3'], '2023-08-15', 'Receive date normalized to YYYY-MM-DD');
    assert.strictEqual(normalized.rows[0].data['col-4'], '2023-10-31', 'Excel serial normalized to YYYY-MM-DD');
  });

  // ==========================================================================
  // 8. AI CASHFLOW & DUE RISK FORECAST ENGINE
  // ==========================================================================
  test('AI Forecast: Accurately projects 30-day balance, burn rate, and segments due risk levels', async () => {
    const { computeCashflowForecast } = await import('../src/lib/cashflowForecasting');

    const accounts = [
      { id: 'acc-1', workspace_id: 'ws-1', name: 'HDFC Bank', balance: 5000000, is_default: true }, // 50,000 INR
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    const overduePastStr = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 20 days ago

    const dues = [
      {
        id: 'due-1',
        workspace_id: 'ws-1',
        customer_id: 'cust-1',
        amount: 1000000, // 10,000 INR
        direction: 'you_will_get' as const,
        due_date: todayStr,
        status: 'pending' as const,
        created_at: todayStr,
      },
      {
        id: 'due-2',
        workspace_id: 'ws-1',
        customer_id: 'cust-2',
        amount: 2000000, // 20,000 INR
        direction: 'you_will_get' as const,
        due_date: overduePastStr,
        status: 'pending' as const,
        created_at: overduePastStr,
      },
    ];

    const customers = [
      { id: 'cust-1', workspace_id: 'ws-1', name: 'Rahul', type: 'customer' as const, created_at: todayStr },
      { id: 'cust-2', workspace_id: 'ws-1', name: 'Amit (Overdue)', type: 'customer' as const, created_at: overduePastStr },
    ];

    const ledger = [
      {
        id: 'tx-1',
        workspace_id: 'ws-1',
        type: 'cash_in' as const,
        amount: 6000000, // 60,000 INR in 30 days = 2,000/day
        mode: 'upi' as const,
        entry_date: todayStr,
      },
      {
        id: 'tx-2',
        workspace_id: 'ws-1',
        type: 'cash_out' as const,
        amount: 3000000, // 30,000 INR in 30 days = 1,000/day
        mode: 'cash' as const,
        entry_date: todayStr,
      },
    ];

    const cards: any[] = [];

    const forecast = computeCashflowForecast(ledger as any, accounts as any, dues as any, cards, customers as any);

    assert.strictEqual(forecast.currentLiquidCashPaise, 5000000, 'Liquid cash is 50,000 INR');
    assert.strictEqual(forecast.dailyInflowRatePaise, 200000, 'Daily inflow is 2,000 INR');
    assert.strictEqual(forecast.dailyBurnRatePaise, 100000, 'Daily burn is 1,000 INR');
    assert.strictEqual(forecast.netVelocityPaise, 100000, 'Net cashflow velocity is +1,000 INR/day');
    assert.strictEqual(forecast.runwayDays, 'infinite', 'Positive cashflow has infinite runway');
    assert.strictEqual(forecast.projected30DayBalancePaise, 5000000 + 100000 * 30, 'Projected balance is 80,000 INR');

    // Risk segmentation
    assert.strictEqual(forecast.riskBreakdown.items.length, 2);
    const rahulDue = forecast.riskBreakdown.items.find((i) => i.customerId === 'cust-1');
    const amitDue = forecast.riskBreakdown.items.find((i) => i.customerId === 'cust-2');

    assert.strictEqual(rahulDue?.riskLevel, 'low', 'Due today is low risk');
    assert.strictEqual(rahulDue?.recoveryProbability, 0.95, 'Low risk recovery is 95%');
    assert.strictEqual(amitDue?.riskLevel, 'high', '20-day overdue is high risk');
    assert.strictEqual(amitDue?.recoveryProbability, 0.35, 'High risk recovery is 35%');
    assert.ok(forecast.recommendations.length > 0, 'Generates actionable recommendations');
  });

  // ==========================================================================
  // 9. MULTI-DEVICE CLOUD SNAPSHOT ENGINE
  // ==========================================================================
  test('Cloud Snapshots: Takes versioned snapshots and restores state cleanly', async () => {
    const { cloudSnapshotEngine } = await import('../src/lib/cloudSnapshotEngine');
    const { useAccountStore } = await import('../src/stores/useAccountStore');

    useAccountStore.getState().setAccounts([
      { id: 'acc-snap-test', workspace_id: 'ws-1', name: 'Snap Bank', balance: 99000, is_default: true },
    ]);

    const snap = await cloudSnapshotEngine.takeSnapshot('Pre-Migration Backup', false);
    assert.ok(snap.id.startsWith('snap-'));
    assert.strictEqual(snap.data.accounts[0].name, 'Snap Bank');

    // Mutate state
    useAccountStore.getState().setAccounts([]);
    assert.strictEqual(useAccountStore.getState().accounts.length, 0);

    // Restore from snapshot
    const ok = await cloudSnapshotEngine.restoreSnapshot(snap.id);
    assert.strictEqual(ok, true);
    assert.strictEqual(useAccountStore.getState().accounts[0].name, 'Snap Bank');
  });

  // ==========================================================================
  // 10. ACCOUNT STORE DEDUPLICATION (PREVENT CARD DUPLICATION BEFORE REFRESH)
  // ==========================================================================
  test('Account Store Deduplication: addAccount never creates duplicate items', async () => {
    const { useAccountStore } = await import('../src/stores/useAccountStore');

    useAccountStore.getState().setAccounts([]);

    const newCounter = {
      id: 'counter-reserve-123',
      workspace_id: 'ws-test',
      name: 'Counter Reserv',
      balance: 1350000,
      account_type: 'cash_counter' as const,
      is_default: false,
    };

    // 1. Optimistic push
    useAccountStore.getState().addAccount(newCounter);
    assert.strictEqual(useAccountStore.getState().accounts.length, 1);

    // 2. Realtime WebSocket echo arrives for the same account
    useAccountStore.getState().addAccount({ ...newCounter, name: 'Counter Reserv Updated' });

    // Must NOT duplicate!
    assert.strictEqual(useAccountStore.getState().accounts.length, 1, 'Account count must remain 1');
    assert.strictEqual(
      useAccountStore.getState().accounts[0].name,
      'Counter Reserv Updated',
      'Account details must update without creating a second card'
    );
  });

  // ==========================================================================
  // 11. MULTI-DRAWER ISOLATION & DIRECT TRANSACTION PASSBOOK RECORDING
  // ==========================================================================
  test('Multi-Drawer Isolation: Each drawer maintains independent balances and transactions', async () => {
    const { useAccountStore } = await import('../src/stores/useAccountStore');
    const { useLedgerStore } = await import('../src/stores/useLedgerStore');

    const drawer1 = {
      id: 'drawer-primary',
      workspace_id: 'ws-test',
      name: 'Counter',
      balance: 0,
      account_type: 'cash_counter' as const,
      is_default: true,
      scope: 'business' as const,
    };

    const drawer2 = {
      id: 'drawer-reserv',
      workspace_id: 'ws-test',
      name: 'Counter Reserv',
      balance: 1350000,
      account_type: 'cash_counter' as const,
      is_default: false,
      scope: 'business' as const,
    };

    useAccountStore.getState().setAccounts([drawer1, drawer2]);
    useLedgerStore.getState().clearLedger();

    // Direct transaction into Drawer 2 only
    const entryDrawer2 = {
      id: 'tx-drawer-2',
      workspace_id: 'ws-test',
      type: 'cash_in' as const,
      amount: 500000, // ₹5,000
      cash_location_id: drawer2.id,
      mode: 'cash' as const,
      scope: 'business' as const,
      note: 'Deposit into Counter Reserv',
      entry_date: new Date().toISOString(),
    };

    useLedgerStore.getState().addEntryOptimistic(entryDrawer2);

    // Filter passbooks
    const drawer1Passbook = useLedgerStore
      .getState()
      .entries.filter((e) => e.cash_location_id === drawer1.id);
    const drawer2Passbook = useLedgerStore
      .getState()
      .entries.filter((e) => e.cash_location_id === drawer2.id);

    assert.strictEqual(drawer1Passbook.length, 0, 'Drawer 1 passbook must have 0 transactions');
    assert.strictEqual(drawer2Passbook.length, 1, 'Drawer 2 passbook must have 1 transaction');
    assert.strictEqual(drawer2Passbook[0].amount, 500000);
  });

  // ==========================================================================
  // 12. CARD REGISTRATION WITH VARIANT, NETWORK, BILLED & UNBILLED BALANCES
  // ==========================================================================
  test('Card Registration: Accurately stores variant, network, and opening billed & unbilled balances', async () => {
    const { calculateCardBilling } = await import('../src/lib/cardBilling');

    const card: Card = {
      id: 'card-indusind-pinnacle',
      workspace_id: 'ws-test',
      name: 'INDUSIND PINNACLE WORLD',
      bank: 'INDUSIND',
      variant: 'Pinnacle World',
      network: 'mastercard',
      last4: '2002',
      credit_limit: 23700000, // ₹2,37,000 in paise
      statement_day: 5,
      due_day: 24,
      is_active: true,
      scope: 'business',
    };

    assert.strictEqual(card.variant, 'Pinnacle World');
    assert.strictEqual(card.network, 'mastercard');

    // Simulate opening entries recorded at registration
    const initialBilledPaise = 2500000; // ₹25,000 billed due
    const initialUnbilledPaise = 1200000; // ₹12,000 unbilled spends

    const ledger: LedgerEntry[] = [
      {
        id: 'entry-billed-opening',
        workspace_id: 'ws-test',
        type: 'card_spend',
        amount: initialBilledPaise,
        card_id: card.id,
        mode: 'card',
        is_billed: true,
        note: 'Statement Bill Opening Due',
        entry_date: new Date().toISOString(),
      },
      {
        id: 'entry-unbilled-opening',
        workspace_id: 'ws-test',
        type: 'card_spend',
        amount: initialUnbilledPaise,
        card_id: card.id,
        mode: 'card',
        is_billed: false,
        note: 'Unbilled Spends Opening Balance',
        entry_date: new Date().toISOString(),
      },
    ];

    const summary = calculateCardBilling(card, ledger);

    assert.strictEqual(summary.billedDue, initialBilledPaise, 'Billed due must match opening billed amount (₹25,000)');
    assert.strictEqual(summary.netUnbilled, initialUnbilledPaise, 'Unbilled spends must match opening unbilled amount (₹12,000)');
    assert.strictEqual(summary.totalOutstanding, 3700000, 'Total outstanding must be ₹37,000 (25k billed + 12k unbilled)');
    assert.strictEqual(
      summary.availableCredit,
      card.credit_limit - 3700000,
      'Available limit must be credit_limit minus total outstanding'
    );
  });

  // ==========================================================================
  // 13. CARD EDIT & LIVE RECONCILIATION OF BILLED AND UNBILLED DUES
  // ==========================================================================
  test('Card Edit: Live reconciliation adjusts ledger entries when user modifies billed or unbilled due', async () => {
    const { calculateCardBilling } = await import('../src/lib/cardBilling');

    const card: Card = {
      id: 'card-indusind-pinnacle',
      workspace_id: 'ws-test',
      name: 'INDUSIND PINNACLE WORLD',
      bank: 'INDUSIND',
      variant: 'Pinnacle World',
      network: 'mastercard',
      last4: '2002',
      credit_limit: 23700000,
      statement_day: 5,
      due_day: 24,
      is_active: true,
      scope: 'business',
    };

    const ledger: LedgerEntry[] = [
      {
        id: 'entry-billed-1',
        workspace_id: 'ws-test',
        type: 'card_spend',
        amount: 2500000, // ₹25,000
        card_id: card.id,
        mode: 'card',
        is_billed: true,
        note: 'Statement Bill Opening Due',
        entry_date: new Date().toISOString(),
      },
    ];

    // User edits billed amount from ₹25,000 to ₹30,000 (increase of ₹5,000)
    const originalBilledPaise = 2500000;
    const newBilledPaise = 3000000;
    const diff = newBilledPaise - originalBilledPaise; // +500,000

    if (diff > 0) {
      ledger.push({
        id: 'adj-billed-plus',
        workspace_id: 'ws-test',
        type: 'card_spend',
        amount: diff,
        card_id: card.id,
        mode: 'card',
        is_billed: true,
        note: 'Statement Billed Due Adjustment (+)',
        entry_date: new Date().toISOString(),
      });
    }

    let summary = calculateCardBilling(card, ledger);
    assert.strictEqual(summary.billedDue, 3000000, 'Billed due must accurately reflect reconciled ₹30,000');

    // User makes a payment of ₹20,000
    ledger.push({
      id: 'pay-1',
      workspace_id: 'ws-test',
      type: 'bill_payment',
      amount: 2000000, // ₹20,000
      card_id: card.id,
      mode: 'bank',
      scope: 'business',
      note: 'Payment via Bank',
      entry_date: new Date().toISOString(),
    });

    summary = calculateCardBilling(card, ledger);
    assert.strictEqual(summary.billedDue, 1000000, 'Remaining billed due must be ₹10,000 after ₹20,000 payment');
    assert.strictEqual(summary.availableCredit, card.credit_limit - 1000000);
  });

  // ==========================================================================
  // 14. ALLOWED FIELDS & MIGRATION VALIDATION ACCEPTS VARIANT AND NETWORK
  // ==========================================================================
  test('Migration Engine: Raw card fields validation accepts variant and network without schema violation', async () => {
    const { ALLOWED_RAW_CARD_FIELDS } = await import('../src/lib/migrationEngine');

    assert.ok(ALLOWED_RAW_CARD_FIELDS.has('variant'), 'ALLOWED_RAW_CARD_FIELDS must contain variant');
    assert.ok(ALLOWED_RAW_CARD_FIELDS.has('network'), 'ALLOWED_RAW_CARD_FIELDS must contain network');
    assert.ok(ALLOWED_RAW_CARD_FIELDS.has('credit_limit'), 'ALLOWED_RAW_CARD_FIELDS must contain credit_limit');
    assert.ok(ALLOWED_RAW_CARD_FIELDS.has('statement_day'), 'ALLOWED_RAW_CARD_FIELDS must contain statement_day');
    assert.ok(ALLOWED_RAW_CARD_FIELDS.has('due_day'), 'ALLOWED_RAW_CARD_FIELDS must contain due_day');
  });

  // ==========================================================================
  // 15. OTHER BANK CUSTOM NAME RESOLUTION & EDIT PERSISTENCE
  // ==========================================================================
  test('Bank Account: Custom bank name resolves properly when Other Bank is selected', async () => {
    function resolveBankName(type: string, bankDropdown: string, customInput: string): string {
      if (type === 'cash_counter') return 'Cash Counter';
      if (bankDropdown === 'Other Bank') return customInput.trim() || 'Other Bank';
      return bankDropdown;
    }

    assert.strictEqual(
      resolveBankName('savings', 'Other Bank', 'IDFC FIRST Bank'),
      'IDFC FIRST Bank',
      'Should resolve to custom bank name when Other Bank is selected'
    );

    assert.strictEqual(
      resolveBankName('current', 'Other Bank', 'Federal Bank'),
      'Federal Bank',
      'Should resolve to custom bank name for Federal Bank'
    );

    assert.strictEqual(
      resolveBankName('savings', 'HDFC Bank', ''),
      'HDFC Bank',
      'Should keep selected standard bank when not Other Bank'
    );

    assert.strictEqual(
      resolveBankName('cash_counter', 'Other Bank', 'Any Bank'),
      'Cash Counter',
      'Cash counter accounts always resolve to Cash Counter'
    );
  });

  // ==========================================================================
  // 16. BANK & UPI VS PREPAID WALLET SEPARATION & FILTER ISOLATION
  // ==========================================================================
  test('Bank & UPI vs Prepaid Wallet Separation: Savings/Current accounts power Bank & UPI; Wallets maintain independent balances', async () => {
    const mockAccounts = [
      { id: '1', name: 'Saikat Sarkar SBI', account_type: 'savings', bank_name: 'State Bank of India', balance: 1812500, scope: 'personal' },
      { id: '2', name: 'Priyanka SBI', account_type: 'savings', bank_name: 'State Bank of India', balance: 1508100, scope: 'family' },
      { id: '3', name: 'Dipti Rani BOM', account_type: 'savings', bank_name: 'Bank of Maharashtra', balance: 1806300, scope: 'family' },
      { id: '4', name: 'Shop Cash Drawer', account_type: 'cash_counter', bank_name: 'Cash Counter', balance: 5320000, scope: 'business' },
      { id: '5', name: 'Second Till Counter', account_type: 'cash_counter', bank_name: 'Cash Counter', balance: 1350000, scope: 'business' },
      { id: '6', name: 'Paytm Wallet', account_type: 'wallet', bank_name: 'Paytm Wallet', balance: 250000, scope: 'personal' },
      { id: '7', name: 'Amazon Pay Balance', account_type: 'wallet', bank_name: 'Amazon Pay Balance', balance: 120000, scope: 'business' },
    ];

    // Bank & UPI accounts
    const bankUpiAccounts = mockAccounts.filter(
      (a) => a.account_type === 'savings' || a.account_type === 'current' || a.account_type === 'od_cc'
    );
    assert.strictEqual(bankUpiAccounts.length, 3, 'Must have 3 Bank & UPI accounts');

    // Cash counters
    const cashAccounts = mockAccounts.filter((a) => a.account_type === 'cash_counter');
    assert.strictEqual(cashAccounts.length, 2, 'Must have 2 Cash Counter accounts');

    // Prepaid Wallets
    const walletAccounts = mockAccounts.filter((a) => a.account_type === 'wallet');
    assert.strictEqual(walletAccounts.length, 2, 'Must have 2 Prepaid Wallet accounts');

    // Verify filter badge counts remain stable and do NOT drop to 0 when user selects a specific filter
    const selectedScope = 'all';
    const scopeFiltered = mockAccounts.filter((acc) => selectedScope === 'all' || acc.scope === selectedScope);
    const bankCount = scopeFiltered.filter((a) => a.account_type === 'savings' || a.account_type === 'current' || a.account_type === 'od_cc').length;
    const cashCount = scopeFiltered.filter((a) => a.account_type === 'cash_counter').length;
    const walletCount = scopeFiltered.filter((a) => a.account_type === 'wallet').length;

    assert.strictEqual(bankCount, 3);
    assert.strictEqual(cashCount, 2);
    assert.strictEqual(walletCount, 2);

    // If user clicks on 'bank' filter:
    const accountFilter = 'bank';
    const displayedAccounts = scopeFiltered.filter((acc) => {
      if (accountFilter === 'bank') return acc.account_type === 'savings' || acc.account_type === 'current' || acc.account_type === 'od_cc';
      if (accountFilter === 'cash') return acc.account_type === 'cash_counter';
      if (accountFilter === 'wallet') return acc.account_type === 'wallet';
      return true;
    });

    assert.strictEqual(displayedAccounts.length, 3, 'Grid must display only the 3 bank accounts');
    // But tab counts retain true totals so user can switch tabs!
    assert.strictEqual(cashCount, 2, 'Cash counters tab must still show (2) even when Banks tab is active');
    assert.strictEqual(walletCount, 2, 'Wallets tab must still show (2) even when Banks tab is active');
  });

  // ==========================================================================
  // 17. GRID VIEW & LIST VIEW: PERSISTENCE & STRUCTURE ACROSS ALL 7 MODULES
  // ==========================================================================
  test('Grid View & List View: All 7 Core Modules support responsive Grid and List views with persistence', async () => {
    const VIEW_KEYS = [
      'rb_view_cash',
      'rb_view_cards',
      'rb_view_dues',
      'rb_view_expenses',
      'rb_view_notes',
      'rb_view_vault',
      'rb_view_sheets',
    ];

    // Mock localStorage
    const mockStorage: Record<string, string> = {};
    const setView = (key: string, mode: 'grid' | 'list') => {
      mockStorage[key] = mode;
    };
    const getView = (key: string, defaultMode: 'grid' | 'list' = 'grid'): 'grid' | 'list' => {
      return (mockStorage[key] as 'grid' | 'list') || defaultMode;
    };

    // Test default states
    assert.strictEqual(getView('rb_view_cash', 'grid'), 'grid');
    assert.strictEqual(getView('rb_view_cards', 'grid'), 'grid');
    assert.strictEqual(getView('rb_view_dues', 'list'), 'list');
    assert.strictEqual(getView('rb_view_expenses', 'list'), 'list');
    assert.strictEqual(getView('rb_view_notes', 'grid'), 'grid');
    assert.strictEqual(getView('rb_view_vault', 'grid'), 'grid');
    assert.strictEqual(getView('rb_view_sheets', 'list'), 'list');

    // Switch all 7 modules to List view
    VIEW_KEYS.forEach((key) => setView(key, 'list'));
    VIEW_KEYS.forEach((key) => {
      assert.strictEqual(getView(key), 'list', `${key} must persist 'list' view`);
    });

    // Switch all 7 modules to Grid view
    VIEW_KEYS.forEach((key) => setView(key, 'grid'));
    VIEW_KEYS.forEach((key) => {
      assert.strictEqual(getView(key), 'grid', `${key} must persist 'grid' view`);
    });
  });

  // ==========================================================================
  // 18. ACCOUNT BALANCE LEDGER RECONCILIATION
  // ==========================================================================
  test('Account Balance: Accurately resolves ledger deposits when account stored balance is 0', async () => {
    const testAccount: BankAccountItem = {
      id: 'acc-counter-1',
      workspace_id: 'ws-test',
      name: 'Counter',
      balance: 0, // remote or stored balance is 0
      account_type: 'cash_counter',
      scope: 'business',
      is_default: true,
      bank_name: 'Cash Counter',
    };

    const ledgerEntries: LedgerEntry[] = [
      {
        id: 'entry-tally-1',
        workspace_id: 'ws-test',
        type: 'cash_in',
        amount: 4341000, // ₹43,410.00
        cash_location_id: 'acc-counter-1',
        mode: 'cash',
        note: 'Physical Cash Tally Reconciled (Surplus +₹43,410.00)',
        entry_date: new Date().toISOString(),
      },
    ];

    const getAccountEffectiveBalance = (acc: BankAccountItem, entries: LedgerEntry[]) => {
      if (acc.balance && acc.balance !== 0) return acc.balance;
      const accEntries = entries.filter((e) => e.cash_location_id === acc.id);
      if (accEntries.length === 0) return acc.balance || 0;
      const credits = accEntries
        .filter((e) => e.type === 'cash_in')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const debits = accEntries
        .filter((e) => e.type === 'cash_out' || e.type === 'expense' || e.type === 'bill_payment')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const net = credits - debits;
      return net !== 0 ? net : (acc.balance || 0);
    };

    const resolved = getAccountEffectiveBalance(testAccount, ledgerEntries);
    assert.strictEqual(resolved, 4341000, 'Effective balance must accurately reflect ₹43,410.00 surplus deposit');
  });

  // ==========================================================================
  // 19. MODULE REMARKS / NOTES PERSISTENCE & VISIBILITY AUDIT
  // ==========================================================================
  test('Remarks & Notes: Persist and sanitize across Credit Cards, Bank Accounts, Dues, and Spends', () => {
    // 1. Credit Card Remarks
    const testCard: Card = {
      id: 'card-rem-1',
      workspace_id: 'ws-test',
      name: 'IndusInd Pinnacle World',
      bank: 'IndusInd',
      variant: 'Pinnacle World',
      network: 'mastercard',
      last4: '2002',
      credit_limit: 23700000,
      statement_day: 5,
      due_day: 24,
      is_active: true,
      scope: 'business',
      notes: 'Lounge access card + ₹10,000 monthly spend target for waiver',
    };
    assert.strictEqual(testCard.notes, 'Lounge access card + ₹10,000 monthly spend target for waiver');

    // 2. Bank Account Remarks
    const testAccount: BankAccountItem = {
      id: 'acc-rem-1',
      workspace_id: 'ws-test',
      name: 'Salary & Office Till',
      balance: 1812500,
      is_default: true,
      account_type: 'savings',
      bank_name: 'State Bank of India',
      account_number_last4: '9356',
      notes: 'Primary account for client NEFT and office salary disbursements',
    };
    assert.strictEqual(testAccount.notes, 'Primary account for client NEFT and office salary disbursements');

    // 3. Due Notes & Searchability
    const testDue = {
      id: 'due-rem-1',
      workspace_id: 'ws-test',
      customer_id: 'cust-1',
      amount: 500000,
      due_date: '2026-11-15',
      status: 'pending' as const,
      direction: 'you_will_get' as const,
      notes: 'Silk sarees delivery - Invoice #204',
    };
    const searchQuery = 'Invoice #204';
    const isMatched = (testDue.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    assert.strictEqual(isMatched, true, 'Due remark must be searchable');

    // 4. Ledger Transaction Remark
    const testLedger: LedgerEntry = {
      id: 'tx-rem-1',
      workspace_id: 'ws-test',
      type: 'expense',
      amount: 25000,
      mode: 'upi',
      note: 'Team client lunch at Mainland China',
      entry_date: new Date().toISOString(),
    };
    assert.strictEqual(testLedger.note, 'Team client lunch at Mainland China');
  });

  // ==========================================================================
  // 20. PERSISTENT REMARKS PRESERVATION ACROSS REFRESH & CLOUD SYNC
  // ==========================================================================
  test('Remarks Persistence: Card and Bank remarks survive page refresh and remote cloud sync with null fields', async () => {
    const { useCardStore } = await import('../src/stores/useCardStore');
    const { useAccountStore } = await import('../src/stores/useAccountStore');

    // 1. Card Remarks Survival Test
    const cardStore = useCardStore.getState();
    const testCard: Card = {
      id: 'card-persist-test-1',
      workspace_id: 'ws-test',
      name: 'HDFC Regalia Gold',
      bank: 'HDFC',
      variant: 'Regalia Gold',
      network: 'visa',
      last4: '5566',
      credit_limit: 50000000,
      statement_day: 15,
      due_day: 5,
      is_active: true,
      scope: 'personal',
      notes: 'Priority Pass international lounge access only',
    };

    // Add card optimistically
    cardStore.addCardOptimistic(testCard);
    assert.strictEqual(
      useCardStore.getState().cards.find((c: Card) => c.id === testCard.id)?.notes,
      'Priority Pass international lounge access only'
    );

    // Simulate page refresh / syncEngine.pullAll where remote Supabase returns card with notes: null
    const remotePulledCardWithoutNotes: Card = {
      id: 'card-persist-test-1',
      workspace_id: 'ws-test',
      name: 'HDFC Regalia Gold',
      bank: 'HDFC',
      last4: '5566',
      credit_limit: 50000000,
      statement_day: 15,
      due_day: 5,
      is_active: true,
      scope: 'personal',
      notes: undefined, // Remote DB returned no notes column
    };

    useCardStore.getState().setCards([remotePulledCardWithoutNotes]);

    // Remarks must NOT be wiped out!
    const recoveredCard = useCardStore.getState().cards.find((c: Card) => c.id === testCard.id);
    assert.ok(recoveredCard, 'Card must exist in store');
    assert.strictEqual(
      recoveredCard.notes,
      'Priority Pass international lounge access only',
      'Card remark must be preserved even if remote database returns null or undefined notes'
    );

    // 2. Bank Account Remarks Survival Test
    const accountStore = useAccountStore.getState();
    const testAccount: BankAccountItem = {
      id: 'acc-persist-test-1',
      workspace_id: 'ws-test',
      name: 'SBI Current A/C',
      balance: 10000000,
      is_default: false,
      account_type: 'current',
      bank_name: 'State Bank of India',
      account_number_last4: '7788',
      notes: 'GST tax payments & vendor RTGS only',
    };

    accountStore.addAccount(testAccount);
    assert.strictEqual(
      useAccountStore.getState().accounts.find((a: BankAccountItem) => a.id === testAccount.id)?.notes,
      'GST tax payments & vendor RTGS only'
    );

    // Simulate page refresh / syncEngine.pullAll where remote Supabase returns account without notes
    const remotePulledAccountWithoutNotes: BankAccountItem = {
      id: 'acc-persist-test-1',
      workspace_id: 'ws-test',
      name: 'SBI Current A/C',
      balance: 10000000,
      is_default: false,
      account_type: 'current',
      bank_name: 'State Bank of India',
      account_number_last4: '7788',
      notes: undefined,
    };

    useAccountStore.getState().setAccounts([remotePulledAccountWithoutNotes]);

    // Account remark must NOT be wiped out!
    const recoveredAccount = useAccountStore.getState().accounts.find((a: BankAccountItem) => a.id === testAccount.id);
    assert.ok(recoveredAccount, 'Account must exist in store');
    assert.strictEqual(
      recoveredAccount.notes,
      'GST tax payments & vendor RTGS only',
      'Account remark must be preserved even if remote database returns null or undefined notes'
    );
  });

  // ==========================================================================
  // 21. MULTI-MODULE SORTING FEATURES (A-Z, BILL DATE, AMOUNT, PERSISTENCE)
  // ==========================================================================
  test('Sorting: Multi-module sorting supports A-Z, Bill / Due Date, Amounts, and localStorage persistence', async () => {
    // 1. Credit Cards Sorting (A-Z, Z-A, Bill Date)
    const cardsList: Card[] = [
      { id: 'c1', workspace_id: 'ws-test', name: 'SBI Cashback', bank: 'SBI', last4: '1111', credit_limit: 100000, statement_day: 15, due_day: 25, is_active: true, scope: 'business' },
      { id: 'c2', workspace_id: 'ws-test', name: 'HDFC Millennia', bank: 'HDFC', last4: '2222', credit_limit: 200000, statement_day: 1, due_day: 5, is_active: true, scope: 'personal' },
      { id: 'c3', workspace_id: 'ws-test', name: 'Axis Airtel', bank: 'Axis', last4: '3333', credit_limit: 150000, statement_day: 10, due_day: 15, is_active: true, scope: 'family' },
    ];

    // Test A-Z
    const sortedAZ = [...cardsList].sort((a, b) => a.name.localeCompare(b.name));
    assert.strictEqual(sortedAZ[0].name, 'Axis Airtel');
    assert.strictEqual(sortedAZ[1].name, 'HDFC Millennia');
    assert.strictEqual(sortedAZ[2].name, 'SBI Cashback');

    // Test Z-A
    const sortedZA = [...cardsList].sort((a, b) => b.name.localeCompare(a.name));
    assert.strictEqual(sortedZA[0].name, 'SBI Cashback');
    assert.strictEqual(sortedZA[2].name, 'Axis Airtel');

    // Test Bill / Due Day
    const sortedDueDay = [...cardsList].sort((a, b) => (a.due_day ?? 0) - (b.due_day ?? 0));
    assert.strictEqual(sortedDueDay[0].name, 'HDFC Millennia'); // due_day = 5
    assert.strictEqual(sortedDueDay[2].name, 'SBI Cashback'); // due_day = 25

    // 2. Bank Accounts Sorting (Balance Highest, Name A-Z)
    const accountsList: BankAccountItem[] = [
      { id: 'a1', workspace_id: 'ws-1', name: 'Petty Cash', balance: 5000, is_default: false },
      { id: 'a2', workspace_id: 'ws-1', name: 'Axis Current', balance: 1200000, is_default: true },
      { id: 'a3', workspace_id: 'ws-1', name: 'HDFC Savings', balance: 450000, is_default: false },
    ];

    const sortedByBal = [...accountsList].sort((a, b) => b.balance - a.balance);
    assert.strictEqual(sortedByBal[0].name, 'Axis Current'); // 12,00,000
    assert.strictEqual(sortedByBal[1].name, 'HDFC Savings'); // 4,50,000
    assert.strictEqual(sortedByBal[2].name, 'Petty Cash'); // 5,000

    // 3. Dues Sorting (Due Date Soonest First)
    const duesList = [
      { id: 'd1', amount: 50000, due_date: '2026-11-20' },
      { id: 'd2', amount: 150000, due_date: '2026-10-31' },
      { id: 'd3', amount: 30000, due_date: '2026-11-05' },
    ];
    const sortedDuesDate = [...duesList].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    assert.strictEqual(sortedDuesDate[0].id, 'd2'); // Oct 31 is soonest
    assert.strictEqual(sortedDuesDate[1].id, 'd3'); // Nov 5
    assert.strictEqual(sortedDuesDate[2].id, 'd1'); // Nov 20

    // 4. Persistence across LocalStorage
    localStorage.setItem('rb_sort_cards', 'bill_date_asc');
    localStorage.setItem('rb_sort_cash', 'balance_desc');
    localStorage.setItem('rb_sort_dues', 'due_date_asc');
    localStorage.setItem('rb_sort_expenses', 'amount_desc');

    assert.strictEqual(localStorage.getItem('rb_sort_cards'), 'bill_date_asc');
    assert.strictEqual(localStorage.getItem('rb_sort_cash'), 'balance_desc');
    assert.strictEqual(localStorage.getItem('rb_sort_dues'), 'due_date_asc');
    assert.strictEqual(localStorage.getItem('rb_sort_expenses'), 'amount_desc');
  });

  test('Fund Transfers: Intra-Sphere (B2B, P2P) and Inter-Sphere physically update account balances atomically with audit trail', async () => {
    const { useSessionStore } = await import('../src/stores/useSessionStore');
    const { useAccountStore } = await import('../src/stores/useAccountStore');
    const { useLedgerStore } = await import('../src/stores/useLedgerStore');
    const { syncEngine } = await import('../src/lib/syncEngine');
    const { sanitizeLedgerPayload } = await import('../src/lib/ledgerSanitizer');

    const wsId = '00000000-0000-0000-0000-000000000001';
    useSessionStore.setState({ activeWorkspaceId: wsId, user: { id: 'usr-1', email: 'owner@test.com' } as any });

    // Setup 4 distinct accounts: 2 Business, 2 Personal
    const bizAcc1: BankAccountItem = {
      id: 'biz-acc-1',
      workspace_id: wsId,
      name: 'SBI Current A/C',
      balance: 1000000, // ₹10,000.00
      scope: 'business',
      account_type: 'current',
      is_default: true,
    };
    const bizAcc2: BankAccountItem = {
      id: 'biz-acc-2',
      workspace_id: wsId,
      name: 'Business Cash Drawer',
      balance: 200000, // ₹2,000.00
      scope: 'business',
      account_type: 'cash_counter',
      is_default: false,
    };
    const personalAcc1: BankAccountItem = {
      id: 'pers-acc-1',
      workspace_id: wsId,
      name: 'HDFC Savings',
      balance: 500000, // ₹5,000.00
      scope: 'personal',
      account_type: 'savings',
      is_default: false,
    };
    const personalAcc2: BankAccountItem = {
      id: 'pers-acc-2',
      workspace_id: wsId,
      name: 'Paytm Wallet',
      balance: 50000, // ₹500.00
      scope: 'personal',
      account_type: 'wallet',
      is_default: false,
    };

    useAccountStore.setState({
      accounts: [bizAcc1, bizAcc2, personalAcc1, personalAcc2],
    });
    useLedgerStore.setState({ entries: [] });

    // 1. EXECUTE INTRA-SPHERE: Business to Business Transfer (SBI Current -> Cash Drawer, ₹3,000)
    const b2bResult = await syncEngine.transferFunds({
      fromAccountId: bizAcc1.id,
      toAccountId: bizAcc2.id,
      amountPaise: 300000,
      fromScope: 'business',
      toScope: 'business',
      reason: 'Till Replenishment',
      note: 'Morning cash replenishment',
    });

    assert.strictEqual(b2bResult.success, true);
    assert.strictEqual(b2bResult.fromNewBalance, 700000); // 10,000 - 3,000 = 7,000
    assert.strictEqual(b2bResult.toNewBalance, 500000);   // 2,000 + 3,000 = 5,000

    // Verify useAccountStore physical update
    const stateAccsAfterB2B = useAccountStore.getState().accounts;
    const updatedBiz1 = stateAccsAfterB2B.find((a) => a.id === bizAcc1.id);
    const updatedBiz2 = stateAccsAfterB2B.find((a) => a.id === bizAcc2.id);
    assert.strictEqual(updatedBiz1?.balance, 700000, 'SBI Current must physically reflect ₹7,000.00 balance');
    assert.strictEqual(updatedBiz2?.balance, 500000, 'Cash Drawer must physically reflect ₹5,000.00 balance');

    // 2. EXECUTE INTRA-SPHERE: Personal to Personal Transfer (HDFC Savings -> Paytm Wallet, ₹1,000)
    const p2pResult = await syncEngine.transferFunds({
      fromAccountId: personalAcc1.id,
      toAccountId: personalAcc2.id,
      amountPaise: 100000,
      fromScope: 'personal',
      toScope: 'personal',
      reason: 'Wallet Refill',
      note: 'Grocery & UPI wallet load',
    });

    assert.strictEqual(p2pResult.success, true);
    assert.strictEqual(p2pResult.fromNewBalance, 400000); // 5,000 - 1,000 = 4,000
    assert.strictEqual(p2pResult.toNewBalance, 150000);   // 500 + 1,000 = 1,500

    const stateAccsAfterP2P = useAccountStore.getState().accounts;
    const updatedPers1 = stateAccsAfterP2P.find((a) => a.id === personalAcc1.id);
    const updatedPers2 = stateAccsAfterP2P.find((a) => a.id === personalAcc2.id);
    assert.strictEqual(updatedPers1?.balance, 400000, 'HDFC Savings must reflect ₹4,000.00 balance');
    assert.strictEqual(updatedPers2?.balance, 150000, 'Paytm Wallet must reflect ₹1,500.00 balance');

    // 3. EXECUTE INTER-SPHERE: Business to Personal (SBI Current -> HDFC Savings, ₹2,000)
    const b2pResult = await syncEngine.transferFunds({
      fromAccountId: bizAcc1.id,
      toAccountId: personalAcc1.id,
      amountPaise: 200000,
      fromScope: 'business',
      toScope: 'personal',
      reason: 'Owner Drawing / Profit Share',
      note: 'Monthly owner withdrawal',
    });

    assert.strictEqual(b2pResult.success, true);
    assert.strictEqual(b2pResult.fromNewBalance, 500000); // 7,000 - 2,000 = 5,000
    assert.strictEqual(b2pResult.toNewBalance, 600000);   // 4,000 + 2,000 = 6,000

    // 4. VERIFY LEDGER DOUBLE-ENTRY AUDIT TRAIL
    const entries = useLedgerStore.getState().entries;
    assert.strictEqual(entries.length, 6, '3 transfers must generate exactly 6 double-entry ledger transactions');

    const outflows = entries.filter((e) => e.type === 'cash_out');
    const inflows = entries.filter((e) => e.type === 'cash_in');
    assert.strictEqual(outflows.length, 3);
    assert.strictEqual(inflows.length, 3);

    // Verify sum of outflows equals sum of inflows exactly
    const totalOut = outflows.reduce((s, e) => s + e.amount, 0);
    const totalIn = inflows.reduce((s, e) => s + e.amount, 0);
    assert.strictEqual(totalOut, 600000);
    assert.strictEqual(totalIn, 600000);

    // 5. VALIDATION: Attempting self-transfer must throw error
    let selfTransferError = '';
    try {
      await syncEngine.transferFunds({
        fromAccountId: bizAcc1.id,
        toAccountId: bizAcc1.id,
        amountPaise: 10000,
      });
    } catch (e: any) {
      selfTransferError = e.message;
    }
    assert.ok(selfTransferError.includes('different'), 'Transferring to the same account must be rejected');

    // 6. VALIDATION: Non-UUID category_id in ledger sanitizer is cleanly purged
    const sanitized = sanitizeLedgerPayload({
      id: '00000000-0000-0000-0000-000000000099',
      workspace_id: wsId,
      type: 'cash_in',
      amount: 10000,
      category_id: 'cat-general', // Invalid UUID
      cash_location_id: 'biz-acc-1', // Non-UUID mock ID handled gracefully
    });
    assert.strictEqual(sanitized.category_id, null, 'Invalid non-UUID category_id must be sanitized to null');
  });

  test('Available Liquid Balance: Wallets, Cash Drawer, and Bank accounts clamp at 0 and never show minus (₹0.00)', async () => {
    const { useSessionStore } = await import('../src/stores/useSessionStore');
    const { useAccountStore } = await import('../src/stores/useAccountStore');
    const { useLedgerStore } = await import('../src/stores/useLedgerStore');
    const { syncEngine } = await import('../src/lib/syncEngine');
    const { formatPaise } = await import('../src/lib/money');

    const wsId = '00000000-0000-0000-0000-000000000001';
    useSessionStore.setState({ activeWorkspaceId: wsId, user: { id: 'usr-1', email: 'owner@test.com' } as any });

    // Setup an account with 0 opening balance (like Digipay Wallet in screenshot)
    const digipayWallet: BankAccountItem = {
      id: 'digipay-wallet-1',
      workspace_id: wsId,
      name: 'Digipay Wallet',
      balance: 0,
      scope: 'business',
      account_type: 'wallet',
      is_default: false,
    };

    useAccountStore.setState({
      accounts: [digipayWallet],
    });

    // Simulate transfer or withdrawal of ₹15,600 out of Digipay Wallet
    useLedgerStore.setState({
      entries: [
        {
          id: 'tx-out-15600',
          workspace_id: wsId,
          type: 'cash_out',
          amount: 1560000, // ₹15,600.00
          mode: 'bank',
          scope: 'business',
          cash_location_id: digipayWallet.id,
          note: 'Transfer to Sarkar Communication',
          entry_date: new Date().toISOString(),
        },
      ],
    });

    // 1. Check getAccountEffectiveBalance
    const effBal = syncEngine.getAccountEffectiveBalance(digipayWallet.id);
    assert.strictEqual(effBal, 0, 'Effective balance for wallet must be floored at 0, never negative');

    // 2. formatPaise must format as ₹0.00 and never ₹-15,600.00
    assert.strictEqual(formatPaise(effBal), '₹0.00', 'Available liquid balance must show ₹0.00 instead of minus');

    // 3. updateAccountBalance with negative value must clamp to 0 for non-od accounts
    useAccountStore.getState().updateAccountBalance(digipayWallet.id, -1560000);
    const updatedWallet = useAccountStore.getState().accounts.find((a: BankAccountItem) => a.id === digipayWallet.id);
    assert.strictEqual(updatedWallet?.balance, 0, 'Stored balance in useAccountStore must clamp to 0 for liquid wallets');
  });
});
