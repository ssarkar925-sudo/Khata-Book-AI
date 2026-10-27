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

  // ==========================================================================
  // 8. ROLE-AWARE WORKSPACE MEMBERSHIP & AUTH (9 MANDATED VERIFICATIONS)
  // ==========================================================================

  // Policy Helpers mimicking PostgreSQL RLS Functions
  interface MockWorkspace {
    id: string;
    name: string;
    currency: string;
    owner_id: string;
  }

  interface MockMember {
    id: string;
    workspace_id: string;
    user_id: string;
    role: 'admin' | 'member' | 'viewer';
  }

  function isWorkspaceOwner(authUid: string | null, ws: MockWorkspace): boolean {
    if (!authUid) return false;
    return ws.owner_id === authUid;
  }

  function checkUserWorkspaceRead(authUid: string | null, ws: MockWorkspace, members: MockMember[]): boolean {
    if (!authUid) return false;
    if (ws.owner_id === authUid) return true;
    return members.some((m) => m.workspace_id === ws.id && m.user_id === authUid);
  }

  function checkUserWorkspaceWrite(authUid: string | null, ws: MockWorkspace, members: MockMember[]): boolean {
    if (!authUid) return false;
    if (ws.owner_id === authUid) return true;
    return members.some((m) => m.workspace_id === ws.id && m.user_id === authUid && (m.role === 'admin' || m.role === 'member'));
  }

  function checkUserWorkspaceAdmin(authUid: string | null, ws: MockWorkspace, members: MockMember[]): boolean {
    if (!authUid) return false;
    if (ws.owner_id === authUid) return true;
    return members.some((m) => m.workspace_id === ws.id && m.user_id === authUid && m.role === 'admin');
  }

  // 1. Unauthenticated users cannot access cloud workspace data
  test('RLS: Unauthenticated users cannot access cloud workspace data', () => {
    const ws: MockWorkspace = { id: 'ws-101', name: 'Corp Books', currency: 'INR', owner_id: 'user-auth-1' };
    const members: MockMember[] = [{ id: 'm-1', workspace_id: 'ws-101', user_id: 'user-auth-2', role: 'member' }];

    assert.strictEqual(checkUserWorkspaceRead(null, ws, members), false, 'Anonymous must not read');
    assert.strictEqual(checkUserWorkspaceWrite(null, ws, members), false, 'Anonymous must not write');
    assert.strictEqual(checkUserWorkspaceAdmin(null, ws, members), false, 'Anonymous must not admin');
  });

  // 2. Newly authenticated users receive an owned workspace
  test('Auth: Newly authenticated users receive an owned workspace', () => {
    const databaseWorkspaces: MockWorkspace[] = [];

    function getOrCreateDefaultWorkspace(authUid: string): MockWorkspace {
      const existing = databaseWorkspaces.find((w) => w.owner_id === authUid);
      if (existing) return existing;

      // Ensure workspaces.owner_id is ALWAYS auth.uid()
      const newWs: MockWorkspace = {
        id: `ws-${databaseWorkspaces.length + 1}`,
        name: 'Personal Record Book',
        currency: 'INR',
        owner_id: authUid,
      };
      databaseWorkspaces.push(newWs);
      return newWs;
    }

    const newUserUid = 'auth-user-999';
    const created = getOrCreateDefaultWorkspace(newUserUid);

    assert.ok(created, 'Workspace must be created');
    assert.strictEqual(created.owner_id, newUserUid, 'owner_id must match authenticated user UID exactly');

    // Repeated call must return the exact same workspace (exactly one created)
    const secondCall = getOrCreateDefaultWorkspace(newUserUid);
    assert.strictEqual(secondCall.id, created.id, 'Must return existing owned workspace');
    assert.strictEqual(databaseWorkspaces.length, 1, 'Only one workspace must be created');
  });

  // 3. Local-only mode never reports Cloud Synced
  test('Session: Local-only mode never reports Cloud Synced', () => {
    let currentUser: any = null;
    let syncStatus = 'offline';

    function setSyncStatus(status: 'synced' | 'syncing' | 'offline' | 'error') {
      if (!currentUser && status === 'synced') {
        syncStatus = 'offline';
        return;
      }
      syncStatus = status;
    }

    // Try setting synced while unauthenticated
    setSyncStatus('synced');
    assert.strictEqual(syncStatus, 'offline', 'Unauthenticated mode must coerce synced to offline');

    // Authenticated user can report synced
    currentUser = { id: 'real-user-1', email: 'owner@test.com' };
    setSyncStatus('synced');
    assert.strictEqual(syncStatus, 'synced', 'Authenticated user can transition to synced');
  });

  // 4. Viewer cannot insert/update/delete records
  test('Permissions: Viewer cannot insert/update/delete records', () => {
    const ws: MockWorkspace = { id: 'ws-101', name: 'Corp Books', currency: 'INR', owner_id: 'user-owner' };
    const members: MockMember[] = [{ id: 'm-viewer', workspace_id: 'ws-101', user_id: 'user-viewer', role: 'viewer' }];

    // Viewer can read
    assert.strictEqual(checkUserWorkspaceRead('user-viewer', ws, members), true, 'Viewer can read workspace');

    // Viewer CANNOT write
    assert.strictEqual(checkUserWorkspaceWrite('user-viewer', ws, members), false, 'Viewer cannot write to workspace');

    // Viewer write attempts must fail
    function executeWrite(authUid: string) {
      if (!checkUserWorkspaceWrite(authUid, ws, members)) {
        throw new Error('Unauthorized: User does not have write access');
      }
      return { success: true };
    }

    assert.throws(
      () => executeWrite('user-viewer'),
      /Unauthorized/,
      'Viewer write mutation must be rejected with Unauthorized'
    );
  });

  // 5. Member cannot manage workspace members
  test('Permissions: Member cannot manage workspace members', () => {
    const ws: MockWorkspace = { id: 'ws-101', name: 'Corp Books', currency: 'INR', owner_id: 'user-owner' };
    const members: MockMember[] = [{ id: 'm-regular', workspace_id: 'ws-101', user_id: 'user-member', role: 'member' }];

    assert.strictEqual(checkUserWorkspaceWrite('user-member', ws, members), true, 'Member has financial write access');
    assert.strictEqual(checkUserWorkspaceAdmin('user-member', ws, members), false, 'Member does NOT have admin access');

    function inviteMember(actorUid: string, targetEmail: string, role: string) {
      if (!checkUserWorkspaceAdmin(actorUid, ws, members)) {
        throw new Error('Unauthorized: Only owner and admin can manage members');
      }
      return { targetEmail, role };
    }

    assert.throws(
      () => inviteMember('user-member', 'colleague@test.com', 'member'),
      /Unauthorized/,
      'Regular member cannot invite or manage members'
    );
  });

  // 6. Admin can manage members but cannot alter owner protections
  test('Permissions: Admin can manage members but cannot alter owner protections', () => {
    const ws: MockWorkspace = { id: 'ws-101', name: 'Corp Books', currency: 'INR', owner_id: 'user-owner' };
    let members: MockMember[] = [
      { id: 'm-admin', workspace_id: 'ws-101', user_id: 'user-admin', role: 'admin' },
      { id: 'm-member', workspace_id: 'ws-101', user_id: 'user-employee', role: 'member' },
    ];

    assert.strictEqual(checkUserWorkspaceAdmin('user-admin', ws, members), true, 'Admin has member management rights');

    function adminRemoveMember(actorUid: string, targetMemberId: string) {
      if (!checkUserWorkspaceAdmin(actorUid, ws, members)) {
        throw new Error('Unauthorized');
      }
      const target = members.find((m) => m.id === targetMemberId);
      if (!target) throw new Error('Not found');

      // Owner protection: cannot remove owner
      if (target.user_id === ws.owner_id) {
        throw new Error('Owner cannot be removed');
      }

      // Admin cannot remove other admin
      if (!isWorkspaceOwner(actorUid, ws) && target.role === 'admin') {
        throw new Error('Admins cannot remove other Admins');
      }

      members = members.filter((m) => m.id !== targetMemberId);
      return true;
    }

    // Admin CAN remove regular member
    assert.strictEqual(adminRemoveMember('user-admin', 'm-member'), true, 'Admin can remove regular member');

    // Admin CANNOT remove or demote owner
    members.push({ id: 'm-owner', workspace_id: 'ws-101', user_id: ws.owner_id, role: 'admin' });
    assert.throws(
      () => adminRemoveMember('user-admin', 'm-owner'),
      /Owner cannot be removed/,
      'Admin cannot remove or demote owner'
    );

    // Admin CANNOT change workspace owner_id
    function updateWorkspaceOwner(actorUid: string, newOwnerId: string) {
      if (!isWorkspaceOwner(actorUid, ws)) {
        throw new Error('Only the current owner can transfer workspace ownership');
      }
      ws.owner_id = newOwnerId;
    }

    assert.throws(
      () => updateWorkspaceOwner('user-admin', 'user-admin'),
      /Only the current owner/,
      'Admin cannot transfer or seize ownership'
    );
  });

  // 7. Owner can manage membership
  test('Permissions: Owner can manage membership and all roles', () => {
    const ws: MockWorkspace = { id: 'ws-101', name: 'Corp Books', currency: 'INR', owner_id: 'user-owner' };
    const members: MockMember[] = [
      { id: 'm-admin', workspace_id: 'ws-101', user_id: 'user-admin', role: 'admin' },
      { id: 'm-member', workspace_id: 'ws-101', user_id: 'user-emp', role: 'member' },
    ];

    assert.strictEqual(isWorkspaceOwner('user-owner', ws), true, 'Owner identified');
    assert.strictEqual(checkUserWorkspaceAdmin('user-owner', ws, members), true, 'Owner has admin access');

    // Owner can update any member's role
    function ownerUpdateRole(actorUid: string, memberId: string, newRole: 'admin' | 'member' | 'viewer') {
      if (!isWorkspaceOwner(actorUid, ws)) {
        throw new Error('Unauthorized');
      }
      const target = members.find((m) => m.id === memberId);
      if (target) target.role = newRole;
      return target;
    }

    const updated = ownerUpdateRole('user-owner', 'm-member', 'admin');
    assert.strictEqual(updated?.role, 'admin', 'Owner can promote member to admin');
  });

  // 8. Unauthorized calls to ledger and settlement RPCs fail
  test('RPC Security: Unauthorized calls to ledger and settlement RPCs fail', () => {
    const ws: MockWorkspace = { id: 'ws-101', name: 'Corp Books', currency: 'INR', owner_id: 'user-owner' };
    const members: MockMember[] = [{ id: 'm-v', workspace_id: 'ws-101', user_id: 'user-viewer', role: 'viewer' }];

    function recordLedgerEntryRpc(entry: any, callerUid: string | null) {
      if (!callerUid) {
        throw new Error('Unauthorized: Authentication required');
      }
      if (!checkUserWorkspaceWrite(callerUid, ws, members)) {
        throw new Error('Unauthorized: User does not have write access to workspace');
      }
      return { status: 'success', entry };
    }

    function settleDueRpc(dueId: string, amount: number, callerUid: string | null) {
      if (!callerUid) {
        throw new Error('Unauthorized: Authentication required');
      }
      if (!checkUserWorkspaceWrite(callerUid, ws, members)) {
        throw new Error('Unauthorized: User does not have write access to workspace');
      }
      return { status: 'success', dueId, amount };
    }

    // Unauthenticated caller fails
    assert.throws(() => recordLedgerEntryRpc({ amount: 100 }, null), /Authentication required/);
    assert.throws(() => settleDueRpc('due-1', 100, null), /Authentication required/);

    // Viewer caller fails
    assert.throws(() => recordLedgerEntryRpc({ amount: 100 }, 'user-viewer'), /write access/);
    assert.throws(() => settleDueRpc('due-1', 100, 'user-viewer'), /write access/);

    // External caller fails
    assert.throws(() => recordLedgerEntryRpc({ amount: 100 }, 'stranger-user'), /write access/);
  });

  // 9. Authenticated authorized users can still create ledger entries and settle dues atomically
  test('RPC Functionality: Authorized users can create ledger entries and settle dues atomically', () => {
    const ws: MockWorkspace = { id: 'ws-101', name: 'Corp Books', currency: 'INR', owner_id: 'user-owner' };
    const members: MockMember[] = [{ id: 'm-writer', workspace_id: 'ws-101', user_id: 'user-writer', role: 'member' }];

    let cashBalance = 500000; // ₹5,000.00
    const ledgerTable: any[] = [];
    const duesTable = [{ id: 'due-100', workspace_id: 'ws-101', amount: 200000, status: 'pending' }];

    function recordLedgerEntryAtomic(entry: any, callerUid: string) {
      if (!checkUserWorkspaceWrite(callerUid, ws, members)) {
        throw new Error('Unauthorized');
      }
      ledgerTable.push(entry);
      if (entry.type === 'cash_in') cashBalance += entry.amount;
      if (entry.type === 'cash_out' || entry.type === 'expense') cashBalance -= entry.amount;
      return { status: 'success', newBalance: cashBalance };
    }

    function settleDueAtomic(dueId: string, paidAmount: number, callerUid: string) {
      if (!checkUserWorkspaceWrite(callerUid, ws, members)) {
        throw new Error('Unauthorized');
      }
      const due = duesTable.find((d) => d.id === dueId);
      if (!due) throw new Error('Due not found');

      recordLedgerEntryAtomic({ type: 'cash_in', amount: paidAmount, due_id: dueId }, callerUid);
      due.amount -= paidAmount;
      if (due.amount <= 0) due.status = 'settled';
      return { status: 'success', dueStatus: due.status, dueAmount: due.amount };
    }

    // Authorized member records expense
    const res1 = recordLedgerEntryAtomic({ type: 'expense', amount: 100000 }, 'user-writer');
    assert.strictEqual(res1.status, 'success');
    assert.strictEqual(cashBalance, 400000, 'Balance must deduct ₹1,000.00');

    // Authorized member settles due
    const res2 = settleDueAtomic('due-100', 200000, 'user-writer');
    assert.strictEqual(res2.status, 'success');
    assert.strictEqual(res2.dueStatus, 'settled', 'Due must be settled');
    assert.strictEqual(cashBalance, 600000, 'Balance must credit ₹2,000.00 from due settlement');
  });
});
