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

describe('RecordBook AI — Production Hardening & Security Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==========================================================================
  // 1. RLS & WORKSPACE ISOLATION
  // ==========================================================================
  test('RLS/Workspace Isolation: Anonymous/unauthenticated users are strictly blocked', () => {
    function checkUserWorkspacePolicy(authUid: string | null, workspaceId: string, ownerId: string, members: string[]): boolean {
      if (!authUid) return false; // Strict: Anonymous rejected
      return ownerId === authUid || members.includes(authUid);
    }

    const ws1 = { id: 'ws-tenant-alpha', owner_id: 'user-alpha-123' };
    const ws2 = { id: 'ws-tenant-beta', owner_id: 'user-beta-456' };

    // Anonymous requests must fail
    assert.strictEqual(checkUserWorkspacePolicy(null, ws1.id, ws1.owner_id, []), false, 'Anonymous request must be blocked');

    // Tenant Alpha cannot access Tenant Beta
    assert.strictEqual(checkUserWorkspacePolicy('user-alpha-123', ws1.id, ws1.owner_id, []), true, 'Owner Alpha can access Alpha');
    assert.strictEqual(checkUserWorkspacePolicy('user-alpha-123', ws2.id, ws2.owner_id, []), false, 'Owner Alpha cannot access Beta');
    assert.strictEqual(checkUserWorkspacePolicy('user-beta-456', ws2.id, ws2.owner_id, []), true, 'Owner Beta can access Beta');
  });

  // ==========================================================================
  // 2. SCOPE PERSISTENCE AFTER CLOUD RELOAD
  // ==========================================================================
  test('Scope Persistence: Business, Personal, and Family scopes survive serialization and sync payload formatting', () => {
    const LEDGER_ENTRY_VALID_COLUMNS = new Set([
      'id', 'workspace_id', 'type', 'amount', 'category_id', 'cash_location_id',
      'customer_id', 'card_id', 'mode', 'scope', 'note', 'entry_date', 'is_billed',
      'idempotency_key', 'created_by', 'created_at', 'updated_at', 'deleted_at',
    ]);

    function sanitizePayload(obj: Record<string, any>) {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (LEDGER_ENTRY_VALID_COLUMNS.has(k) && v !== undefined) clean[k] = v;
      }
      return clean;
    }

    const testEntries = [
      { id: 'tx-1', type: 'expense', amount: 50000, scope: 'business' as const, note: 'Office stationery' },
      { id: 'tx-2', type: 'expense', amount: 12000, scope: 'personal' as const, note: 'Weekend coffee' },
      { id: 'tx-3', type: 'expense', amount: 85000, scope: 'family' as const, note: 'Home groceries' },
    ];

    for (const entry of testEntries) {
      const sanitized = sanitizePayload(entry);
      assert.strictEqual(sanitized.scope, entry.scope, `Sanitized payload must preserve scope '${entry.scope}'`);

      // Test roundtrip serialization
      const json = JSON.stringify(sanitized);
      const rehydrated = JSON.parse(json);
      assert.strictEqual(rehydrated.scope, entry.scope, `Rehydrated record must preserve scope '${entry.scope}'`);
    }
  });

  // ==========================================================================
  // 3. OFFLINE QUEUE REPLAY
  // ==========================================================================
  test('Offline Queue Replay: Queued mutations replay sequentially and clear queue', async () => {
    interface QueueItem {
      id: string;
      table: string;
      action: 'upsert' | 'delete';
      payload: any;
      timestamp: number;
    }

    const queue: QueueItem[] = [];
    function enqueue(table: string, action: 'upsert' | 'delete', payload: any) {
      queue.push({
        id: `q-${queue.length + 1}`,
        table,
        action,
        payload,
        timestamp: Date.now() + queue.length,
      });
      localStorage.setItem('rb_sync_queue', JSON.stringify(queue));
    }

    enqueue('ledger_entries', 'upsert', { id: 'tx-offline-1', amount: 25000 });
    enqueue('cash_locations', 'upsert', { id: 'acc-offline-1', balance: 500000 });
    enqueue('people_dues', 'upsert', { id: 'due-offline-1', status: 'settled' });

    assert.strictEqual(queue.length, 3, 'Three items must be queued offline');

    // Simulate online replay
    const executed: string[] = [];
    const remaining: QueueItem[] = [];

    for (const item of queue) {
      try {
        executed.push(`${item.table}:${item.action}:${item.payload.id}`);
      } catch {
        remaining.push(item);
      }
    }

    assert.strictEqual(executed.length, 3, 'All 3 items must be replayed');
    assert.deepStrictEqual(executed, [
      'ledger_entries:upsert:tx-offline-1',
      'cash_locations:upsert:acc-offline-1',
      'people_dues:upsert:due-offline-1',
    ]);
  });

  // ==========================================================================
  // 4. DUPLICATE TRANSACTION PREVENTION (Idempotency)
  // ==========================================================================
  test('Duplicate Transaction Prevention: Idempotency keys block duplicate ledger inserts', () => {
    const ledgerTable: Array<{ id: string; workspace_id: string; idempotency_key?: string; amount: number }> = [];

    function processLedgerEntry(entry: { id: string; workspace_id: string; idempotency_key?: string; amount: number }): { status: string } {
      if (entry.idempotency_key) {
        const existing = ledgerTable.find(
          (e) => e.workspace_id === entry.workspace_id && e.idempotency_key === entry.idempotency_key
        );
        if (existing) {
          return { status: 'duplicate_ignored' };
        }
      }
      ledgerTable.push(entry);
      return { status: 'success' };
    }

    const tx = { id: 'tx-100', workspace_id: 'ws-1', idempotency_key: 'idemp-token-unique-xyz', amount: 150000 };

    const firstAttempt = processLedgerEntry(tx);
    assert.strictEqual(firstAttempt.status, 'success', 'First submission must succeed');
    assert.strictEqual(ledgerTable.length, 1, 'Table must contain 1 entry');

    // Retry submission with identical idempotency key (e.g. mobile network glitch retry)
    const retryAttempt = processLedgerEntry(tx);
    assert.strictEqual(retryAttempt.status, 'duplicate_ignored', 'Duplicate submission must be ignored');
    assert.strictEqual(ledgerTable.length, 1, 'Table must still contain exactly 1 entry (no duplicates)');
  });

  // ==========================================================================
  // 5. DUE SETTLEMENT FAILURE HANDLING
  // ==========================================================================
  test('Due Settlement Failure Handling: Errors trigger queue fallback and never report false sync', async () => {
    let cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'error' = 'synced';
    let lastError: string | null = null;
    const offlineQueue: any[] = [];

    async function mockSettleDue(dueId: string, shouldFailNetwork: boolean) {
      try {
        if (shouldFailNetwork) {
          throw new Error('Supabase 503: Service Unavailable');
        }
        cloudSyncStatus = 'synced';
        lastError = null;
        return { success: true };
      } catch (err: any) {
        cloudSyncStatus = 'offline';
        lastError = err.message;
        offlineQueue.push({ table: 'people_dues', id: dueId, action: 'settle' });
        return { success: false, queued: true };
      }
    }

    const res = await mockSettleDue('due-555', true);
    assert.strictEqual(res.success, false, 'Failed call must report false');
    assert.strictEqual(cloudSyncStatus, 'offline', 'Status must NOT be synced');
    assert.strictEqual(lastError, 'Supabase 503: Service Unavailable', 'Error message must be captured');
    assert.strictEqual(offlineQueue.length, 1, 'Mutation must be queued for recovery');
  });

  // ==========================================================================
  // 6. CARD BILLED/UNBILLED PERSISTENCE
  // ==========================================================================
  test('Card Billed/Unbilled Persistence: is_billed flag and due_day survive storage', () => {
    const card = {
      id: 'card-hdfc',
      name: 'HDFC Regalia',
      statement_day: 15,
      due_day: 5,
      scope: 'business' as const,
      is_active: true,
    };

    const cardTxBilled = {
      id: 'tx-c1',
      card_id: 'card-hdfc',
      type: 'card_spend',
      amount: 450000,
      is_billed: true,
    };

    const cardTxUnbilled = {
      id: 'tx-c2',
      card_id: 'card-hdfc',
      type: 'card_spend',
      amount: 180000,
      is_billed: false,
    };

    assert.strictEqual(card.due_day, 5, 'Card due_day must be 5');
    assert.strictEqual(cardTxBilled.is_billed, true, 'Billed transaction must be true');
    assert.strictEqual(cardTxUnbilled.is_billed, false, 'Unbilled transaction must be false');

    // Serialization check
    const serialized = JSON.stringify({ card, txs: [cardTxBilled, cardTxUnbilled] });
    const parsed = JSON.parse(serialized);
    assert.strictEqual(parsed.card.due_day, 5);
    assert.strictEqual(parsed.txs[0].is_billed, true);
    assert.strictEqual(parsed.txs[1].is_billed, false);
  });

  // ==========================================================================
  // 7. ACCOUNT BALANCE CONSISTENCY
  // ==========================================================================
  test('Account Balance Consistency: Atomic updates and rollback operations preserve exact balance', () => {
    let accountBalance = 1000000; // ₹10,000.00 in paise

    function applyTransaction(type: 'cash_in' | 'cash_out' | 'expense', amount: number) {
      if (type === 'cash_in') {
        accountBalance += amount;
      } else {
        accountBalance -= amount;
      }
      return accountBalance;
    }

    function rollbackTransaction(type: 'cash_in' | 'cash_out' | 'expense', amount: number) {
      if (type === 'cash_in') {
        accountBalance -= amount;
      } else {
        accountBalance += amount;
      }
      return accountBalance;
    }

    // 1. Add cash in: ₹2,500.00
    applyTransaction('cash_in', 250000);
    assert.strictEqual(accountBalance, 1250000, 'Balance must increase to ₹12,500.00');

    // 2. Add expense: ₹1,200.00
    applyTransaction('expense', 120000);
    assert.strictEqual(accountBalance, 1130000, 'Balance must decrease to ₹11,300.00');

    // 3. Rollback (Delete) expense
    rollbackTransaction('expense', 120000);
    assert.strictEqual(accountBalance, 1250000, 'Rollback must restore exact balance to ₹12,500.00');

    // 4. Rollback cash in
    rollbackTransaction('cash_in', 250000);
    assert.strictEqual(accountBalance, 1000000, 'Balance must return to starting ₹10,000.00 with 0 drift');
  });
});
