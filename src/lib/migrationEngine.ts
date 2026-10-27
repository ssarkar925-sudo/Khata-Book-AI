import { supabase } from '@/lib/supabase';
import {
  MigrationProgress,
  MigrationResult,
  MigrationFailure,
  EntityScope,
} from '@/types';
import { sanitizeLedgerPayload } from '@/lib/syncEngine';

const LOCAL_WORKSPACE_IDS_KEY = 'rb_local_workspace_ids';
const LAST_BACKUP_KEY = 'rb_last_migration_backup';

export function getTrackedLocalWorkspaceIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_WORKSPACE_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    const defaultLegacy = '00000000-0000-0000-0000-000000000010';
    if (!ids.includes(defaultLegacy)) ids.push(defaultLegacy);
    return ids;
  } catch {
    return ['00000000-0000-0000-0000-000000000010'];
  }
}

export function registerLocalWorkspaceId(id: string) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const ids = getTrackedLocalWorkspaceIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(LOCAL_WORKSPACE_IDS_KEY, JSON.stringify(ids));
    }
  } catch {}
}

export function countUnmigratedLocalRecords(targetCloudWorkspaceId?: string): number {
  if (typeof window === 'undefined') return 0;
  const localWsIds = new Set(getTrackedLocalWorkspaceIds());
  const stores = [
    'rb_cash_locations',
    'rb_customers',
    'rb_cards',
    'rb_people_dues',
    'rb_ledger_entries',
    'rb_notes',
    'rb_sheets',
  ];

  let count = 0;
  for (const key of stores) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const isLocalRecord =
          item.is_local === true ||
          item.origin === 'local' ||
          !item.workspace_id ||
          localWsIds.has(item.workspace_id);

        if (isLocalRecord && item.workspace_id !== targetCloudWorkspaceId) {
          count++;
        }
      }
    } catch {}
  }
  return count;
}

export class MigrationEngine {
  private isMigrating = false;

  public async executeMigration(
    targetWorkspaceId: string,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult> {
    if (this.isMigrating) {
      return {
        success: false,
        total: 0,
        migrated: 0,
        failed: [],
        error: 'Migration already in progress',
      };
    }

    if (typeof window === 'undefined') {
      return { success: false, total: 0, migrated: 0, failed: [], error: 'Client-side execution only' };
    }

    this.isMigrating = true;
    const localWsIds = new Set(getTrackedLocalWorkspaceIds());

    const report = (progress: MigrationProgress) => {
      if (onProgress) onProgress(progress);
    };

    // 1. Gather all local candidate items across all stores
    const getStoreItems = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    };

    const isLocalItem = (item: any) =>
      item.is_local === true ||
      item.origin === 'local' ||
      !item.workspace_id ||
      localWsIds.has(item.workspace_id);

    const allAccounts = getStoreItems('rb_cash_locations');
    const allCustomers = getStoreItems('rb_customers');
    const allCards = getStoreItems('rb_cards');
    const allDues = getStoreItems('rb_people_dues');
    const allLedger = getStoreItems('rb_ledger_entries');
    const allNotes = getStoreItems('rb_notes');
    const allSheets = getStoreItems('rb_sheets');

    const accountsToMigrate = allAccounts.filter((i) => isLocalItem(i) && i.workspace_id !== targetWorkspaceId);
    const customersToMigrate = allCustomers.filter((i) => isLocalItem(i) && i.workspace_id !== targetWorkspaceId);
    const cardsToMigrate = allCards.filter((i) => isLocalItem(i) && i.workspace_id !== targetWorkspaceId);
    const duesToMigrate = allDues.filter((i) => isLocalItem(i) && i.workspace_id !== targetWorkspaceId);
    const ledgerToMigrate = allLedger.filter((i) => isLocalItem(i) && i.workspace_id !== targetWorkspaceId);
    const notesToMigrate = allNotes.filter((i) => isLocalItem(i) && i.workspace_id !== targetWorkspaceId);
    const sheetsToMigrate = allSheets.filter((i) => isLocalItem(i) && i.workspace_id !== targetWorkspaceId);

    const totalRecords =
      accountsToMigrate.length +
      customersToMigrate.length +
      cardsToMigrate.length +
      duesToMigrate.length +
      ledgerToMigrate.length +
      notesToMigrate.length +
      sheetsToMigrate.length;

    if (totalRecords === 0) {
      this.isMigrating = false;
      return { success: true, total: 0, migrated: 0, failed: [] };
    }

    // 2. Create durable pre-migration backup
    report({
      status: 'backing_up',
      currentStep: 'Creating durable local backup snapshot...',
      progressPercent: 5,
      totalRecords,
      migratedRecords: 0,
      failedRecords: [],
    });

    const timestamp = Date.now();
    const backupKey = `rb_migration_backup_${timestamp}`;
    const backupData = {
      timestamp: new Date().toISOString(),
      target_workspace_id: targetWorkspaceId,
      tracked_local_workspaces: Array.from(localWsIds),
      data: {
        accounts: allAccounts,
        customers: allCustomers,
        cards: allCards,
        dues: allDues,
        ledger: allLedger,
        notes: allNotes,
        sheets: allSheets,
      },
    };

    try {
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      localStorage.setItem(LAST_BACKUP_KEY, backupKey);
    } catch (err: any) {
      this.isMigrating = false;
      return {
        success: false,
        total: totalRecords,
        migrated: 0,
        failed: [],
        error: `Could not create safety backup: ${err.message}. Migration aborted.`,
      };
    }

    // 3. Dependency-safe upload to Supabase
    const failedRecords: MigrationFailure[] = [];
    const successfulIds = new Set<string>();
    let processed = 0;

    const updateProgress = (step: string) => {
      const pct = Math.min(95, Math.round(5 + (processed / totalRecords) * 90));
      report({
        status: 'uploading',
        currentStep: step,
        progressPercent: pct,
        totalRecords,
        migratedRecords: successfulIds.size,
        failedRecords,
        backupKey,
      });
    };

    // Step 3a: Upload Accounts (Parent entity)
    for (const acc of accountsToMigrate) {
      updateProgress(`Uploading Bank Account: ${acc.name}...`);
      const payload = {
        id: acc.id,
        workspace_id: targetWorkspaceId,
        name: acc.name,
        balance: acc.balance ?? 0,
        is_default: acc.is_default ?? false,
        scope: (acc.scope as EntityScope) || 'business',
        account_type: acc.account_type || 'savings',
        bank_name: acc.bank_name || null,
        account_number_last4: acc.account_number_last4 || null,
        ifsc: acc.ifsc || null,
        gradient: acc.gradient || null,
        icon_color: acc.iconColor || null,
      };

      const { error } = await supabase.from('cash_locations').upsert(payload);
      if (error) {
        failedRecords.push({ entity: 'Account', id: acc.id, error: error.message });
      } else {
        successfulIds.add(acc.id);
      }
      processed++;
    }

    // Step 3b: Upload Customers (Parent entity)
    for (const cust of customersToMigrate) {
      updateProgress(`Uploading Contact: ${cust.name}...`);
      const payload = {
        id: cust.id,
        workspace_id: targetWorkspaceId,
        name: cust.name,
        phone: cust.phone || null,
        address: cust.address || null,
        scope: (cust.scope as EntityScope) || 'business',
        type: cust.type || 'customer',
      };

      const { error } = await supabase.from('customers').upsert(payload);
      if (error) {
        failedRecords.push({ entity: 'Customer', id: cust.id, error: error.message });
      } else {
        successfulIds.add(cust.id);
      }
      processed++;
    }

    // Step 3c: Upload Cards (Parent entity)
    for (const card of cardsToMigrate) {
      updateProgress(`Uploading Card: ${card.name}...`);
      const payload = {
        id: card.id,
        workspace_id: targetWorkspaceId,
        name: card.name,
        bank: card.bank,
        last4: card.last4,
        credit_limit: card.credit_limit || 0,
        statement_day: card.statement_day || 1,
        due_day: card.due_day || 5,
        is_active: card.is_active ?? true,
        scope: (card.scope as EntityScope) || 'business',
      };

      const { error } = await supabase.from('cards').upsert(payload);
      if (error) {
        failedRecords.push({ entity: 'Card', id: card.id, error: error.message });
      } else {
        successfulIds.add(card.id);
      }
      processed++;
    }

    // Step 3d: Upload Dues (Depends on Customers)
    for (const due of duesToMigrate) {
      updateProgress(`Uploading Due / Udhar record...`);
      const payload = {
        id: due.id,
        workspace_id: targetWorkspaceId,
        customer_id: due.customer_id,
        direction: due.direction,
        amount: due.amount,
        due_date: due.due_date || new Date().toISOString(),
        status: due.status || 'pending',
        scope: (due.scope as EntityScope) || 'business',
        notes: due.notes || null,
      };

      const { error } = await supabase.from('people_dues').upsert(payload);
      if (error) {
        failedRecords.push({ entity: 'Due', id: due.id, error: error.message });
      } else {
        successfulIds.add(due.id);
      }
      processed++;
    }

    // Step 3e: Upload Ledger Entries (Depends on Accounts, Cards, Customers)
    for (const entry of ledgerToMigrate) {
      updateProgress(`Uploading Ledger Entry: ${entry.note || entry.id}...`);
      const cleanEntry = sanitizeLedgerPayload({
        ...entry,
        workspace_id: targetWorkspaceId,
        idempotency_key: entry.idempotency_key || `mig_${entry.id}_${entry.entry_date || timestamp}`,
        scope: entry.scope || 'business',
      });

      // Attempt atomic RPC first, fallback to direct upsert
      const { error: rpcErr } = await supabase.rpc('record_ledger_entry_and_update_balance', {
        p_entry: cleanEntry,
      });

      if (rpcErr) {
        const { error: upsertErr } = await supabase.from('ledger_entries').upsert(cleanEntry);
        if (upsertErr) {
          failedRecords.push({ entity: 'Ledger Entry', id: entry.id, error: upsertErr.message });
        } else {
          successfulIds.add(entry.id);
        }
      } else {
        successfulIds.add(entry.id);
      }
      processed++;
    }

    // Step 3f: Upload Notes & Sheets
    for (const note of notesToMigrate) {
      const payload = {
        id: note.id,
        workspace_id: targetWorkspaceId,
        title: note.title,
        content: note.content,
        color: note.color || null,
        pinned: note.pinned ?? false,
      };
      const { error } = await supabase.from('notes').upsert(payload);
      if (error) {
        failedRecords.push({ entity: 'Note', id: note.id, error: error.message });
      } else {
        successfulIds.add(note.id);
      }
      processed++;
    }

    for (const sheet of sheetsToMigrate) {
      const payload = {
        id: sheet.id,
        workspace_id: targetWorkspaceId,
        title: sheet.title,
        columns: sheet.columns || [],
        rows: sheet.rows || [],
      };
      const { error } = await supabase.from('sheets').upsert(payload);
      if (error) {
        failedRecords.push({ entity: 'Sheet', id: sheet.id, error: error.message });
      } else {
        successfulIds.add(sheet.id);
      }
      processed++;
    }

    // 4. Verification and local state synchronization
    report({
      status: 'verifying',
      currentStep: 'Verifying cloud confirmations and syncing local stores...',
      progressPercent: 98,
      totalRecords,
      migratedRecords: successfulIds.size,
      failedRecords,
      backupKey,
    });

    const updateLocalStore = (key: string, items: any[]) => {
      const updated = items.map((item) => {
        if (successfulIds.has(item.id)) {
          // Confirm migration: re-key to cloud workspace and clear local flag
          const clone = { ...item, workspace_id: targetWorkspaceId };
          delete clone.is_local;
          delete clone.origin;
          return clone;
        }
        // Retain unmigrated item in local state
        return item;
      });
      localStorage.setItem(key, JSON.stringify(updated));
    };

    updateLocalStore('rb_cash_locations', allAccounts);
    updateLocalStore('rb_customers', allCustomers);
    updateLocalStore('rb_cards', allCards);
    updateLocalStore('rb_people_dues', allDues);
    updateLocalStore('rb_ledger_entries', allLedger);
    updateLocalStore('rb_notes', allNotes);
    updateLocalStore('rb_sheets', allSheets);

    const isComplete = failedRecords.length === 0;

    report({
      status: isComplete ? 'completed' : 'partial_failure',
      currentStep: isComplete
        ? `Migration completed! ${successfulIds.size} records confirmed in cloud.`
        : `Partial migration: ${successfulIds.size} succeeded, ${failedRecords.length} failed.`,
      progressPercent: 100,
      totalRecords,
      migratedRecords: successfulIds.size,
      failedRecords,
      backupKey,
    });

    this.isMigrating = false;

    return {
      success: isComplete,
      total: totalRecords,
      migrated: successfulIds.size,
      failed: failedRecords,
      backupKey,
    };
  }
}

export const migrationEngine = new MigrationEngine();
