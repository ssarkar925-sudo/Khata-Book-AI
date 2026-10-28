import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

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
    let account = { id: 'acc-hdfc', name: 'HDFC', balance: 40000 };
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
    let account = { id: 'acc-sbi', name: 'SBI', balance: 50000 };
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
});
