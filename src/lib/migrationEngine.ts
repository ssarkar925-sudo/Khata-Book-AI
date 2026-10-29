import { supabase } from '@/lib/supabase';
import {
  MigrationProgress,
  MigrationResult,
  MigrationFailure,
  MigrationErrorCategory,
  AccountReconciliationFailure,
  ReconciliationReport,
  EntityScope,
} from '@/types';
import { sanitizeLedgerPayload } from '@/lib/ledgerSanitizer';

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
    'rb_saved_sheets',
  ];

  let count = 0;
  const countedIds = new Set<string>();

  for (const key of stores) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (!item || !item.id || countedIds.has(item.id)) continue;

        const isLocalRecord =
          item.is_local === true ||
          item.origin === 'local' ||
          !item.workspace_id ||
          localWsIds.has(item.workspace_id);

        if (isLocalRecord && item.workspace_id !== targetCloudWorkspaceId) {
          countedIds.add(item.id);
          count++;
        }
      }
    } catch {}
  }
  return count;
}

// ============================================================================
// ERROR CLASSIFICATION & VALIDATION HELPERS
// ============================================================================

export function categorizeError(error: any): {
  category: MigrationErrorCategory;
  isRetryable: boolean;
  message: string;
} {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || 0);

  if (
    code === '42501' ||
    status === 403 ||
    msg.includes('unauthorized') ||
    msg.includes('permission denied') ||
    msg.includes('write access')
  ) {
    return {
      category: 'authorization',
      isRetryable: false,
      message: error?.message || 'Unauthorized: write access denied by workspace policy',
    };
  }

  if (
    code === '42883' ||
    code === 'PGRST202' ||
    (msg.includes('function') && (msg.includes('does not exist') || msg.includes('not found')))
  ) {
    return {
      category: 'rpc_unavailable',
      isRetryable: true,
      message: error?.message || 'RPC function is not installed or available in database',
    };
  }

  if (
    code === '22P02' ||
    code === '23502' ||
    code === '23503' ||
    code === '23514' ||
    status === 400 ||
    msg.includes('violates check constraint') ||
    msg.includes('invalid input') ||
    msg.includes('null value') ||
    msg.includes('unsupported')
  ) {
    return {
      category: 'validation',
      isRetryable: false,
      message: error?.message || 'Database validation error',
    };
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    status === 0
  ) {
    return {
      category: 'network_connectivity',
      isRetryable: true,
      message: error?.message || 'Network connectivity error',
    };
  }

  if (status >= 500 || code.startsWith('XX')) {
    return {
      category: 'server_error',
      isRetryable: true,
      message: error?.message || 'Internal server error',
    };
  }

  return {
    category: 'server_error',
    isRetryable: true,
    message: error?.message || 'Unknown migration error',
  };
}

export const ALLOWED_NOTE_FIELDS = new Set([
  'id',
  'workspace_id',
  'title',
  'body',
  'color',
  'tags',
  'is_pinned',
  'checklist_items',
  'scope',
  'created_at',
  'updated_at',
  'deleted_at',
]);

export const ALLOWED_SHEET_FIELDS = new Set([
  'id',
  'workspace_id',
  'title',
  'category',
  'color',
  'columns',
  'rows',
  'scope',
  'frozen_row_count',
  'row_height',
  'show_gridlines',
  'created_at',
  'updated_at',
]);

// Allowed fields on original local source objects (raw offline entities)
export const ALLOWED_RAW_ACCOUNT_FIELDS = new Set([
  'id',
  'workspace_id',
  'name',
  'balance',
  'is_default',
  'scope',
  'account_type',
  'bank_name',
  'account_number_last4',
  'ifsc',
  'gradient',
  'icon_color',
  'iconColor',
  'created_at',
  'updated_at',
  'is_local',
  'origin',
]);

export const ALLOWED_RAW_CUSTOMER_FIELDS = new Set([
  'id',
  'workspace_id',
  'name',
  'phone',
  'address',
  'scope',
  'type',
  'created_at',
  'updated_at',
  'is_local',
  'origin',
]);

export const ALLOWED_RAW_CARD_FIELDS = new Set([
  'id',
  'workspace_id',
  'name',
  'bank',
  'variant',
  'network',
  'last4',
  'credit_limit',
  'statement_day',
  'due_day',
  'is_active',
  'scope',
  'created_at',
  'updated_at',
  'is_local',
  'origin',
]);

export const ALLOWED_RAW_DUE_FIELDS = new Set([
  'id',
  'workspace_id',
  'customer_id',
  'direction',
  'amount',
  'due_date',
  'status',
  'scope',
  'notes',
  'created_at',
  'updated_at',
  'is_local',
  'origin',
]);

export const ALLOWED_RAW_LEDGER_FIELDS = new Set([
  'id',
  'workspace_id',
  'type',
  'amount',
  'category_id',
  'cash_location_id',
  'customer_id',
  'card_id',
  'mode',
  'scope',
  'note',
  'entry_date',
  'is_billed',
  'idempotency_key',
  'created_by',
  'created_at',
  'updated_at',
  'deleted_at',
  'is_local',
  'origin',
]);

export const ALLOWED_RAW_NOTE_FIELDS = new Set([
  'id',
  'workspace_id',
  'title',
  'body',
  'content',
  'color',
  'tags',
  'is_pinned',
  'pinned',
  'checklist_items',
  'checklistItems',
  'scope',
  'created_at',
  'updated_at',
  'deleted_at',
  'is_local',
  'origin',
]);

export const ALLOWED_RAW_SHEET_FIELDS = new Set([
  'id',
  'workspace_id',
  'title',
  'category',
  'color',
  'columns',
  'rows',
  'scope',
  'frozen_row_count',
  'frozenRowCount',
  'row_height',
  'rowHeight',
  'show_gridlines',
  'showGridlines',
  'created_at',
  'updated_at',
  'is_local',
  'origin',
]);

export function validateRawSourceEntity(
  entityName: string,
  sourceItem: Record<string, any>,
  allowedFields: Set<string>
): { valid: boolean; error?: string; unmappedFields?: string[] } {
  if (!sourceItem || typeof sourceItem !== 'object') {
    return { valid: false, error: `${entityName} source item is not a valid object` };
  }
  if (!sourceItem.id) {
    return { valid: false, error: `${entityName} source item is missing required id` };
  }
  const unexpected = Object.keys(sourceItem).filter((k) => !allowedFields.has(k));
  if (unexpected.length > 0) {
    return {
      valid: false,
      error: `Unsupported source field(s) on local ${entityName} (${sourceItem.id}): [${unexpected.join(', ')}]. Migration rejected to prevent silent data loss.`,
      unmappedFields: unexpected,
    };
  }
  return { valid: true };
}

export function validateNotePayload(payload: Record<string, any>): { valid: boolean; error?: string } {
  if (!payload.id || !payload.workspace_id || !payload.title) {
    return { valid: false, error: 'Note payload missing required fields: id, workspace_id, or title' };
  }
  const unexpected = Object.keys(payload).filter((k) => !ALLOWED_NOTE_FIELDS.has(k));
  if (unexpected.length > 0) {
    return {
      valid: false,
      error: `Unsupported note field(s): [${unexpected.join(', ')}]. Database schema accepts: body, is_pinned, checklist_items, scope, color, tags, timestamps.`,
    };
  }
  return { valid: true };
}

export function validateSheetPayload(payload: Record<string, any>): { valid: boolean; error?: string } {
  if (!payload.id || !payload.workspace_id || !payload.title) {
    return { valid: false, error: 'Sheet payload missing required fields: id, workspace_id, or title' };
  }
  const unexpected = Object.keys(payload).filter((k) => !ALLOWED_SHEET_FIELDS.has(k));
  if (unexpected.length > 0) {
    return {
      valid: false,
      error: `Unsupported sheet field(s): [${unexpected.join(', ')}]. Database schema accepts: category, color, columns, rows, scope, frozen_row_count, row_height, show_gridlines, timestamps.`,
    };
  }
  return { valid: true };
}

export function mapNoteToCloudPayload(note: any, targetWorkspaceId: string): Record<string, any> {
  return {
    id: note.id,
    workspace_id: targetWorkspaceId,
    title: note.title || 'Untitled Note',
    body: note.body !== undefined ? note.body : (note.content !== undefined ? note.content : ''),
    color: note.color || '#EEF2FF',
    tags: Array.isArray(note.tags) ? note.tags : [],
    is_pinned: Boolean(note.is_pinned !== undefined ? note.is_pinned : (note.pinned !== undefined ? note.pinned : false)),
    checklist_items: Array.isArray(note.checklist_items)
      ? note.checklist_items
      : Array.isArray(note.checklistItems)
      ? note.checklistItems
      : [],
    scope: (note.scope as EntityScope) || 'business',
    created_at: note.created_at || new Date().toISOString(),
    updated_at: note.updated_at || new Date().toISOString(),
    deleted_at: note.deleted_at || null,
  };
}

export function mapSheetToCloudPayload(sheet: any, targetWorkspaceId: string): Record<string, any> {
  return {
    id: sheet.id,
    workspace_id: targetWorkspaceId,
    title: sheet.title || 'Untitled Sheet',
    category: sheet.category || null,
    color: sheet.color || null,
    columns: Array.isArray(sheet.columns) ? sheet.columns : [],
    rows: Array.isArray(sheet.rows) ? sheet.rows : [],
    scope: (sheet.scope as EntityScope) || 'business',
    frozen_row_count: Number(sheet.frozen_row_count !== undefined ? sheet.frozen_row_count : (sheet.frozenRowCount ?? 0)),
    row_height: sheet.row_height || sheet.rowHeight || 'normal',
    show_gridlines: sheet.show_gridlines !== undefined ? Boolean(sheet.show_gridlines) : (sheet.showGridlines !== undefined ? Boolean(sheet.showGridlines) : true),
    created_at: sheet.created_at || new Date().toISOString(),
    updated_at: sheet.updated_at || new Date().toISOString(),
  };
}

// ============================================================================
// MIGRATION ENGINE (Option A: Snapshot Strategy)
// ============================================================================

export class MigrationEngine {
  private isMigrating = false;

  public async executeMigration(
    targetWorkspaceId: string,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult> {
    return this.executeMigrationInternal(targetWorkspaceId, undefined, onProgress);
  }

  public async retryFailedRecords(
    targetWorkspaceId: string,
    failedItems: MigrationFailure[],
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

    const retryableFailures = failedItems.filter((f) => f.isRetryable !== false);
    if (retryableFailures.length === 0) {
      return {
        success: false,
        total: failedItems.length,
        migrated: 0,
        failed: failedItems,
        error: 'No retryable records found. Please resolve authorization or validation errors before retrying.',
      };
    }

    const retryIds = new Set(retryableFailures.map((f) => f.id));
    return this.executeMigrationInternal(targetWorkspaceId, retryIds, onProgress);
  }

  private async executeMigrationInternal(
    targetWorkspaceId: string,
    filterIds?: Set<string>,
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

    // 1. Gather local items
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

    // Deduplicate sheets across both storage keys
    const savedSheets = getStoreItems('rb_saved_sheets');
    const legacySheets = getStoreItems('rb_sheets');
    const sheetsMap = new Map<string, any>();
    for (const s of [...savedSheets, ...legacySheets]) {
      if (s && s.id) sheetsMap.set(s.id, s);
    }
    const allSheets = Array.from(sheetsMap.values());

    const shouldProcess = (item: any) => {
      if (!isLocalItem(item) || item.workspace_id === targetWorkspaceId) return false;
      if (filterIds && !filterIds.has(item.id)) return false;
      return true;
    };

    const accountsToMigrate = allAccounts.filter(shouldProcess);
    const customersToMigrate = allCustomers.filter(shouldProcess);
    const cardsToMigrate = allCards.filter(shouldProcess);
    const duesToMigrate = allDues.filter(shouldProcess);
    const ledgerToMigrate = allLedger.filter(shouldProcess);
    const notesToMigrate = allNotes.filter(shouldProcess);
    const sheetsToMigrate = allSheets.filter(shouldProcess);

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

    // 2. Pre-migration backup snapshot
    const timestamp = Date.now();
    const backupKey = `rb_migration_backup_${timestamp}`;
    const backupData = {
      timestamp: new Date().toISOString(),
      strategy: 'Option A: Snapshot Strategy (Current Account Balances + Historical Ledger Import RPC)',
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

    report({
      status: 'backing_up',
      currentStep: 'Created durable local safety backup. Starting dependency-safe upload...',
      progressPercent: 5,
      totalRecords,
      migratedRecords: 0,
      failedRecords: [],
      backupKey,
    });

    // 3. Upload to Supabase in Dependency Order
    const failedRecords: MigrationFailure[] = [];
    const successfulIds = new Set<string>();
    let processed = 0;

    const updateProgress = (step: string) => {
      const pct = Math.min(94, Math.round(5 + (processed / totalRecords) * 89));
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

    // Step 3a: Upload Accounts with SNAPSHOT BALANCES (Option A)
    for (const acc of accountsToMigrate) {
      updateProgress(`Uploading Bank Account: ${acc.name}...`);
      const rawVal = validateRawSourceEntity('Account', acc, ALLOWED_RAW_ACCOUNT_FIELDS);
      if (!rawVal.valid) {
        failedRecords.push({
          entity: 'Account',
          id: acc.id,
          error: rawVal.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

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
        const cat = categorizeError(error);
        failedRecords.push({
          entity: 'Account',
          id: acc.id,
          error: cat.message,
          errorCategory: cat.category,
          isRetryable: cat.isRetryable,
        });
      } else {
        successfulIds.add(acc.id);
      }
      processed++;
    }

    // Step 3b: Upload Customers
    for (const cust of customersToMigrate) {
      updateProgress(`Uploading Contact: ${cust.name}...`);
      const rawVal = validateRawSourceEntity('Customer', cust, ALLOWED_RAW_CUSTOMER_FIELDS);
      if (!rawVal.valid) {
        failedRecords.push({
          entity: 'Customer',
          id: cust.id,
          error: rawVal.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

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
        const cat = categorizeError(error);
        failedRecords.push({
          entity: 'Customer',
          id: cust.id,
          error: cat.message,
          errorCategory: cat.category,
          isRetryable: cat.isRetryable,
        });
      } else {
        successfulIds.add(cust.id);
      }
      processed++;
    }

    // Step 3c: Upload Cards
    for (const card of cardsToMigrate) {
      updateProgress(`Uploading Card: ${card.name}...`);
      const rawVal = validateRawSourceEntity('Card', card, ALLOWED_RAW_CARD_FIELDS);
      if (!rawVal.valid) {
        failedRecords.push({
          entity: 'Card',
          id: card.id,
          error: rawVal.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

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
        const cat = categorizeError(error);
        failedRecords.push({
          entity: 'Card',
          id: card.id,
          error: cat.message,
          errorCategory: cat.category,
          isRetryable: cat.isRetryable,
        });
      } else {
        successfulIds.add(card.id);
      }
      processed++;
    }

    // Step 3d: Upload Dues
    for (const due of duesToMigrate) {
      updateProgress(`Uploading Due / Udhar record...`);
      const rawVal = validateRawSourceEntity('Due', due, ALLOWED_RAW_DUE_FIELDS);
      if (!rawVal.valid) {
        failedRecords.push({
          entity: 'Due',
          id: due.id,
          error: rawVal.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

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
        const cat = categorizeError(error);
        failedRecords.push({
          entity: 'Due',
          id: due.id,
          error: cat.message,
          errorCategory: cat.category,
          isRetryable: cat.isRetryable,
        });
      } else {
        successfulIds.add(due.id);
      }
      processed++;
    }

    // Step 3e: Upload Historical Ledger Entries via dedicated import RPC (Snapshot Strategy)
    // CRITICAL: We NEVER call record_ledger_entry_and_update_balance during migration!
    // That would mutate balances and cause double counting!
    for (const entry of ledgerToMigrate) {
      updateProgress(`Uploading Ledger Entry: ${entry.note || entry.id}...`);
      const rawVal = validateRawSourceEntity('Ledger Entry', entry, ALLOWED_RAW_LEDGER_FIELDS);
      if (!rawVal.valid) {
        failedRecords.push({
          entity: 'Ledger Entry',
          id: entry.id,
          error: rawVal.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

      const cleanEntry = sanitizeLedgerPayload({
        ...entry,
        workspace_id: targetWorkspaceId,
        idempotency_key: entry.idempotency_key || `mig_${entry.id}_${entry.entry_date || timestamp}`,
        scope: entry.scope || 'business',
      });

      // Try dedicated historical-import RPC first
      const { error: rpcErr } = await supabase.rpc('import_historical_ledger_entry', {
        p_entry: cleanEntry,
      });

      if (rpcErr) {
        const cat = categorizeError(rpcErr);
        if (cat.category === 'rpc_unavailable') {
          // If RPC is missing on backend, direct insert is safe because it ALSO does not alter balances
          const { error: directErr } = await supabase.from('ledger_entries').insert(cleanEntry);
          if (directErr) {
            const directCat = categorizeError(directErr);
            failedRecords.push({
              entity: 'Ledger Entry',
              id: entry.id,
              error: directCat.message,
              errorCategory: directCat.category,
              isRetryable: directCat.isRetryable,
            });
          } else {
            successfulIds.add(entry.id);
          }
        } else {
          failedRecords.push({
            entity: 'Ledger Entry',
            id: entry.id,
            error: cat.message,
            errorCategory: cat.category,
            isRetryable: cat.isRetryable,
          });
        }
      } else {
        successfulIds.add(entry.id);
      }
      processed++;
    }

    // Step 3f: Upload Notes with Strict Whitelist Mapping & Validation
    for (const note of notesToMigrate) {
      updateProgress(`Uploading Note: ${note.title}...`);
      const rawVal = validateRawSourceEntity('Note', note, ALLOWED_RAW_NOTE_FIELDS);
      if (!rawVal.valid) {
        failedRecords.push({
          entity: 'Note',
          id: note.id,
          error: rawVal.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

      const payload = mapNoteToCloudPayload(note, targetWorkspaceId);
      const validation = validateNotePayload(payload);

      if (!validation.valid) {
        failedRecords.push({
          entity: 'Note',
          id: note.id,
          error: validation.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

      const { error } = await supabase.from('notes').upsert(payload);
      if (error) {
        const cat = categorizeError(error);
        failedRecords.push({
          entity: 'Note',
          id: note.id,
          error: cat.message,
          errorCategory: cat.category,
          isRetryable: cat.isRetryable,
        });
      } else {
        successfulIds.add(note.id);
      }
      processed++;
    }

    // Step 3g: Upload Sheets with Strict Whitelist Mapping & Validation
    for (const sheet of sheetsToMigrate) {
      updateProgress(`Uploading Sheet: ${sheet.title}...`);
      const rawVal = validateRawSourceEntity('Sheet', sheet, ALLOWED_RAW_SHEET_FIELDS);
      if (!rawVal.valid) {
        failedRecords.push({
          entity: 'Sheet',
          id: sheet.id,
          error: rawVal.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

      const payload = mapSheetToCloudPayload(sheet, targetWorkspaceId);
      const validation = validateSheetPayload(payload);

      if (!validation.valid) {
        failedRecords.push({
          entity: 'Sheet',
          id: sheet.id,
          error: validation.error!,
          errorCategory: 'validation',
          isRetryable: false,
        });
        processed++;
        continue;
      }

      const { error } = await supabase.from('sheets').upsert(payload);
      if (error) {
        const cat = categorizeError(error);
        failedRecords.push({
          entity: 'Sheet',
          id: sheet.id,
          error: cat.message,
          errorCategory: cat.category,
          isRetryable: cat.isRetryable,
        });
      } else {
        successfulIds.add(sheet.id);
      }
      processed++;
    }

    // 4. Post-Migration Balance Reconciliation Step
    report({
      status: 'reconciling',
      currentStep: 'Reconciling cloud account balances against local snapshot...',
      progressPercent: 96,
      totalRecords,
      migratedRecords: successfulIds.size,
      failedRecords,
      backupKey,
    });

    let reconciliationPassed = true;
    const reconciliationFailures: AccountReconciliationFailure[] = [];

    const successfullyUploadedAccounts = accountsToMigrate.filter((a) => successfulIds.has(a.id));

    if (successfullyUploadedAccounts.length > 0) {
      const { data: cloudAccounts, error: fetchErr } = await supabase
        .from('cash_locations')
        .select('id, name, balance')
        .in('id', successfullyUploadedAccounts.map((a) => a.id));

      if (fetchErr) {
        reconciliationPassed = false;
        const cat = categorizeError(fetchErr);
        failedRecords.push({
          entity: 'Reconciliation',
          id: 'cloud_fetch_failed',
          error: `Could not verify cloud account balances: ${cat.message}`,
          errorCategory: cat.category,
          isRetryable: cat.isRetryable,
        });
      } else {
        const cloudMap = new Map<string, number>();
        for (const ca of cloudAccounts || []) {
          cloudMap.set(ca.id, Number(ca.balance ?? 0));
        }

        for (const localAcc of successfullyUploadedAccounts) {
          const expected = Number(localAcc.balance ?? 0);
          const actual = cloudMap.get(localAcc.id);

          if (actual === undefined) {
            reconciliationPassed = false;
            const errMsg = `Account "${localAcc.name}" (${localAcc.id}) not found in cloud after upload`;
            reconciliationFailures.push({
              accountId: localAcc.id,
              accountName: localAcc.name,
              expectedBalance: expected,
              actualBalance: null,
              error: errMsg,
            });
            failedRecords.push({
              entity: 'Account',
              id: localAcc.id,
              error: errMsg,
              errorCategory: 'reconciliation_mismatch',
              isRetryable: false,
            });
          } else if (actual !== expected) {
            reconciliationPassed = false;
            const errMsg = `Account "${localAcc.name}" balance mismatch: expected ${expected} paise, found ${actual} paise in cloud`;
            reconciliationFailures.push({
              accountId: localAcc.id,
              accountName: localAcc.name,
              expectedBalance: expected,
              actualBalance: actual,
              error: errMsg,
            });
            failedRecords.push({
              entity: 'Account',
              id: localAcc.id,
              error: errMsg,
              errorCategory: 'reconciliation_mismatch',
              isRetryable: false,
            });
          }
        }
      }
    }

    const reconciliationReport: ReconciliationReport = {
      passed: reconciliationPassed,
      failures: reconciliationFailures,
      timestamp: new Date().toISOString(),
    };

    if (!reconciliationPassed) {
      // CRITICAL: When reconciliation fails, abort completion!
      // Do NOT clear is_local flag! Retain all local records and backup!
      report({
        status: 'error',
        currentStep: `Reconciliation failed: ${reconciliationFailures.length} account balance discrepancy detected. Local records retained intact.`,
        progressPercent: 100,
        totalRecords,
        migratedRecords: successfulIds.size,
        failedRecords,
        backupKey,
        reconciliation: reconciliationReport,
        errorMessage: `Reconciliation mismatch: cloud account balances do not match local snapshot. Local data was preserved intact.`,
      });

      this.isMigrating = false;

      return {
        success: false,
        total: totalRecords,
        migrated: successfulIds.size,
        failed: failedRecords,
        backupKey,
        reconciliation: reconciliationReport,
        error: `Reconciliation failed: ${reconciliationFailures.length} account balance mismatch(es) detected. Local records preserved.`,
      };
    }

    // 5. Verification and local state synchronization
    report({
      status: 'verifying',
      currentStep: 'Verifying cloud confirmations and syncing local stores...',
      progressPercent: 98,
      totalRecords,
      migratedRecords: successfulIds.size,
      failedRecords,
      backupKey,
      reconciliation: reconciliationReport,
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
        // Retain unmigrated / failed item in local state
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
    updateLocalStore('rb_saved_sheets', allSheets);
    updateLocalStore('rb_sheets', allSheets);

    const isComplete = failedRecords.length === 0;

    report({
      status: isComplete ? 'completed' : 'partial_failure',
      currentStep: isComplete
        ? `Migration completed! ${successfulIds.size} records confirmed in cloud with 100% balance reconciliation.`
        : `Partial migration: ${successfulIds.size} succeeded, ${failedRecords.length} failed.`,
      progressPercent: 100,
      totalRecords,
      migratedRecords: successfulIds.size,
      failedRecords,
      backupKey,
      reconciliation: reconciliationReport,
    });

    this.isMigrating = false;

    return {
      success: isComplete,
      total: totalRecords,
      migrated: successfulIds.size,
      failed: failedRecords,
      backupKey,
      reconciliation: reconciliationReport,
    };
  }
}

export const migrationEngine = new MigrationEngine();
