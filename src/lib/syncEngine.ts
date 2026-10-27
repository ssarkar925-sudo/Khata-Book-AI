import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAccountStore, BankAccountItem } from '@/stores/useAccountStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useNoteStore } from '@/stores/useNoteStore';
import { useSheetStore } from '@/stores/useSheetStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { CashLocation, Customer, PeopleDue, Card, LedgerEntry, NoteItem, RecordSheet, VaultItem, DueStatus, PaymentMode } from '@/types';

interface QueueItem {
  id: string;
  table: string;
  action: 'upsert' | 'delete';
  payload: any;
  timestamp: number;
}

const QUEUE_STORAGE_KEY = 'rb_sync_queue';

// Whitelist of columns physically present in public.ledger_entries Supabase table
const LEDGER_ENTRY_VALID_COLUMNS = new Set([
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
]);

function sanitizeLedgerPayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeLedgerPayload);
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (LEDGER_ENTRY_VALID_COLUMNS.has(k) && v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

class SyncEngine {
  private isSyncing = false;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private currentWorkspaceId = '';

  constructor() {
    if (typeof window !== 'undefined') {
      this.currentWorkspaceId = useSessionStore.getState().activeWorkspaceId || '';
      useSessionStore.getState().setPendingSyncCount(this.getQueue().length);
      window.addEventListener('online', () => {
        console.log('[SyncEngine] Device back online. Flushing queue...');
        this.flushQueue();
      });
    }
  }

  // ==========================================
  // OFFLINE QUEUE MANAGEMENT
  // ==========================================
  private getQueue(): QueueItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: QueueItem[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      useSessionStore.getState().setPendingSyncCount(queue.length);
    } catch {}
  }

  private enqueue(table: string, action: 'upsert' | 'delete', payload: any) {
    const queue = this.getQueue();
    queue.push({
      id: crypto.randomUUID(),
      table,
      action,
      payload,
      timestamp: Date.now(),
    });
    this.saveQueue(queue);
    useSessionStore.getState().setSyncStatus('offline');
  }

  public async flushQueue() {
    const user = useSessionStore.getState().user;
    if (!user) {
      // Cannot push to cloud without authenticated Supabase session
      return;
    }
    const userRole = useSessionStore.getState().userRole;
    if (userRole === 'viewer') {
      console.warn('[SyncEngine] Viewer role cannot flush mutations to cloud');
      return;
    }

    const queue = this.getQueue();
    if (queue.length === 0) return;

    console.log(`[SyncEngine] Flushing ${queue.length} pending items...`);
    const remaining: QueueItem[] = [];

    for (const item of queue) {
      try {
        let cleanPayload = item.payload;
        if (item.table === 'ledger_entries') {
          cleanPayload = sanitizeLedgerPayload(cleanPayload);
        }

        if (item.action === 'upsert') {
          const { error } = await supabase.from(item.table).upsert(cleanPayload);
          if (error) {
            // Drop unrecoverable schema mismatch errors so the offline queue doesn't lock up
            if (error.code === 'PGRST204' || (error as any).code === '42703') {
              console.warn(`[SyncEngine] Purging incompatible schema entry for ${item.table}:`, error.message);
              continue;
            }
            throw error;
          }
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', cleanPayload.id);
          if (error) throw error;
        }
      } catch (err: any) {
        const errCode = String(err?.code || '');
        // Purge invalid schema columns or impossible constraint violations (e.g. non-existent test user foreign keys)
        if (
          errCode === 'PGRST204' ||
          errCode === '42703' ||
          errCode === '23502' ||
          errCode === '23503' ||
          errCode === '22P02'
        ) {
          console.warn(`[SyncEngine] Purged invalid/obsolete database entry for ${item.table}:`, err?.message || errCode);
          continue;
        }
        console.warn(`[SyncEngine] Failed to flush item for table ${item.table}:`, err);
        remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    if (remaining.length === 0) {
      useSessionStore.getState().setSyncStatus('synced');
    }
  }

  // ==========================================
  // CLOUD PULL & HYDRATION (Stale-While-Revalidate)
  // ==========================================
  public async pullAll(workspaceId: string): Promise<boolean> {
    const user = useSessionStore.getState().user;
    if (!user) {
      // Unauthenticated mode is strictly local-only: never poll cloud or report synced
      useSessionStore.getState().setSyncStatus('offline');
      return false;
    }

    if (this.isSyncing) return false;
    this.isSyncing = true;
    this.currentWorkspaceId = workspaceId;
    useSessionStore.getState().setSyncStatus('syncing');

    try {
      // 1. Verify / register Workspace
      const { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();

      if (wsError) {
        console.warn('[SyncEngine] Cloud tables unreachable or offline:', wsError.message);
        useSessionStore.getState().setSyncStatus('offline');
        this.isSyncing = false;
        return false;
      }

      if (!wsData) {
        await supabase.from('workspaces').upsert({
          id: workspaceId,
          name: 'Primary Record Book',
          currency: 'INR',
          owner_id: user.id, // Strictly authenticated auth.uid()
        });
      }

      // Parallel Fetch: Fetch all 8 tables simultaneously with Promise.allSettled
      const [
        accResult,
        custResult,
        duesResult,
        cardResult,
        ledgerResult,
        noteResult,
        sheetResult,
        vaultResult,
      ] = await Promise.allSettled([
        supabase.from('cash_locations').select('*').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('customers').select('*').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('people_dues').select('*').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('cards').select('*').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('ledger_entries').select('*').eq('workspace_id', workspaceId).is('deleted_at', null).order('entry_date', { ascending: false }),
        supabase.from('notes').select('*').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('sheets').select('*').eq('workspace_id', workspaceId),
        supabase.from('vault_items').select('*').eq('workspace_id', workspaceId).is('deleted_at', null),
      ]);

      // 1. Process Bank Accounts
      if (accResult.status === 'fulfilled' && accResult.value.data && accResult.value.data.length > 0) {
        useAccountStore.getState().setAccounts(accResult.value.data);
      }

      // 2. Process Customers
      if (custResult.status === 'fulfilled' && custResult.value.data && custResult.value.data.length > 0) {
        useCustomerStore.getState().setCustomers(custResult.value.data);
      }

      // 3. Process Dues
      if (duesResult.status === 'fulfilled' && duesResult.value.data && duesResult.value.data.length > 0) {
        useCustomerStore.getState().setDues(duesResult.value.data);
      }

      // 4. Process Cards
      if (cardResult.status === 'fulfilled' && cardResult.value.data && cardResult.value.data.length > 0) {
        useCardStore.getState().setCards(cardResult.value.data);
      }

      // 5. Process Ledger Entries
      if (ledgerResult.status === 'fulfilled' && ledgerResult.value.data && ledgerResult.value.data.length > 0) {
        useLedgerStore.getState().setEntries(ledgerResult.value.data);
      }

      // 6. Process Notes
      if (noteResult.status === 'fulfilled' && noteResult.value.data && noteResult.value.data.length > 0) {
        useNoteStore.getState().setNotes(noteResult.value.data);
      }

      // 7. Process Sheets
      if (sheetResult.status === 'fulfilled' && sheetResult.value.data && sheetResult.value.data.length > 0) {
        useSheetStore.getState().setSheets(sheetResult.value.data);
      }

      // 8. Process Vault Items
      if (vaultResult.status === 'fulfilled' && vaultResult.value.data && vaultResult.value.data.length > 0) {
        useVaultStore.getState().setVaultItems(vaultResult.value.data);
      }

      // Check all results for Supabase errors
      const fetchErrors = [accResult, custResult, duesResult, cardResult, ledgerResult, noteResult, sheetResult, vaultResult]
        .filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any).error))
        .map((r) => (r.status === 'rejected' ? String(r.reason) : (r as any).value.error.message));

      if (fetchErrors.length > 0) {
        console.warn('[SyncEngine] Cloud sync had errors:', fetchErrors);
        useSessionStore.getState().setSyncStatus('error');
        useSessionStore.getState().setLastSyncError(fetchErrors[0]);
        this.isSyncing = false;
        return false;
      }

      // Flush any queued offline mutations
      await this.flushQueue();

      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
      this.isSyncing = false;
      return true;
    } catch (err) {
      console.warn('[SyncEngine] Cloud sync failed or offline:', err);
      useSessionStore.getState().setSyncStatus('offline');
      this.isSyncing = false;
      return false;
    }
  }

  // ==========================================
  // REALTIME WEBSOCKET SUBSCRIPTION
  // Server-side filtered by workspace_id
  // ==========================================
  public subscribeRealtime(workspaceId: string) {
    if (this.channel) {
      this.channel.unsubscribe();
    }

    const user = useSessionStore.getState().user;
    if (!user) {
      // Do not subscribe anonymously
      return;
    }

    this.currentWorkspaceId = workspaceId;

    this.channel = supabase
      .channel(`recordbook-realtime-${workspaceId}`)
      // Ledger Entries (Server-Side Filtered)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ledger_entries', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[SyncEngine] Realtime ledger update received:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            useLedgerStore.getState().addEntryOptimistic(payload.new as LedgerEntry);
          } else if (payload.eventType === 'DELETE') {
            useLedgerStore.getState().removeEntryOptimistic(payload.old.id);
          } else if (payload.eventType === 'UPDATE') {
            const current = useLedgerStore.getState().entries;
            const updated = current.map((e) => (e.id === payload.new.id ? (payload.new as LedgerEntry) : e));
            useLedgerStore.getState().setEntries(updated);
          }
        }
      )
      // Bank Accounts (Server-Side Filtered)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_locations', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[SyncEngine] Realtime account update received:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            useAccountStore.getState().addAccount(payload.new as BankAccountItem);
          } else if (payload.eventType === 'UPDATE') {
            useAccountStore.getState().updateAccount(payload.new.id, payload.new as Partial<BankAccountItem>);
          } else if (payload.eventType === 'DELETE') {
            useAccountStore.getState().deleteAccount(payload.old.id);
          }
        }
      )
      // Customers (Server-Side Filtered)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[SyncEngine] Realtime customer update received:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            useCustomerStore.getState().addCustomerOptimistic(payload.new as Customer);
          }
        }
      )
      // People Dues (Server-Side Filtered)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'people_dues', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[SyncEngine] Realtime dues update received:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            useCustomerStore.getState().addDueOptimistic(payload.new as PeopleDue);
          } else if (payload.eventType === 'UPDATE') {
            useCustomerStore.getState().updateDueStatusOptimistic(payload.new.id, payload.new.status);
          }
        }
      )
      // Cards (Server-Side Filtered)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[SyncEngine] Realtime card update received:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            useCardStore.getState().addCardOptimistic(payload.new as Card);
          } else if (payload.eventType === 'UPDATE') {
            useCardStore.getState().updateCardOptimistic(payload.new.id, payload.new as Partial<Card>);
          } else if (payload.eventType === 'DELETE') {
            useCardStore.getState().deleteCardOptimistic(payload.old.id);
          }
        }
      )
      // Notes (Server-Side Filtered)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[SyncEngine] Realtime note update received:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            useNoteStore.getState().addNoteOptimistic(payload.new as NoteItem);
          } else if (payload.eventType === 'UPDATE') {
            useNoteStore.getState().updateNoteOptimistic(payload.new.id, payload.new as Partial<NoteItem>);
          } else if (payload.eventType === 'DELETE') {
            useNoteStore.getState().deleteNoteOptimistic(payload.old.id);
          }
        }
      )
      // Sheets (Server-Side Filtered)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sheets', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[SyncEngine] Realtime sheet update received:', payload.eventType);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const currentSheets = useSheetStore.getState().sheets;
            const exists = currentSheets.some((s) => s.id === payload.new.id);
            if (exists) {
              const updated = currentSheets.map((s) => (s.id === payload.new.id ? (payload.new as RecordSheet) : s));
              useSheetStore.getState().setSheets(updated);
            } else {
              useSheetStore.getState().setSheets([...currentSheets, payload.new as RecordSheet]);
            }
          } else if (payload.eventType === 'DELETE') {
            useSheetStore.getState().deleteSheet(payload.old.id);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[SyncEngine] Realtime channel active for workspace:', workspaceId);
          useSessionStore.getState().setSyncStatus('synced');
        }
      });
  }

  // ==========================================
  // UNIFIED INSTANT MUTATION DISPATCHERS
  // 1. Instant local update + 2. Background push + 3. Offline queue
  // ==========================================

  public checkWritePermission(): { allowed: boolean; isOfflineMode: boolean; error?: string } {
    const user = useSessionStore.getState().user;
    if (!user) {
      return { allowed: true, isOfflineMode: true };
    }
    const role = useSessionStore.getState().userRole;
    if (role === 'viewer') {
      return {
        allowed: false,
        isOfflineMode: false,
        error: 'Viewer role has read-only access. Financial modifications cannot be saved to cloud.',
      };
    }
    return { allowed: true, isOfflineMode: false };
  }

  // Ledger
  public async pushLedgerEntry(entry: LedgerEntry) {
    const perm = this.checkWritePermission();
    if (!perm.allowed) {
      useSessionStore.getState().setLastSyncError(perm.error || 'Permission denied');
      throw new Error(perm.error);
    }

    const entryWithMeta: LedgerEntry = {
      ...entry,
      scope: entry.scope || 'business',
      idempotency_key: entry.idempotency_key || crypto.randomUUID(),
    };
    useLedgerStore.getState().addEntryOptimistic(entryWithMeta);

    // Auto-update linked bank account or cash counter balance optimistically
    if (entryWithMeta.cash_location_id) {
      const acc = useAccountStore.getState().accounts.find((a) => a.id === entryWithMeta.cash_location_id);
      if (acc) {
        let newBalance = acc.balance;
        if (entryWithMeta.type === 'cash_in') {
          newBalance += entryWithMeta.amount;
        } else if (
          entryWithMeta.type === 'cash_out' ||
          entryWithMeta.type === 'expense' ||
          entryWithMeta.type === 'bill_payment'
        ) {
          newBalance -= entryWithMeta.amount;
        }
        useAccountStore.getState().updateAccountBalance(entryWithMeta.cash_location_id, newBalance);
      }
    }

    const cleanEntry = sanitizeLedgerPayload(entryWithMeta);

    if (perm.isOfflineMode) {
      useSessionStore.getState().setSyncStatus('offline');
      this.enqueue('ledger_entries', 'upsert', cleanEntry);
      return;
    }

    try {
      // 1. Try atomic RPC transaction in Supabase
      const { error } = await supabase.rpc('record_ledger_entry_and_update_balance', {
        p_entry: cleanEntry,
      });

      if (error) {
        // Fallback to direct upsert if RPC is not yet created in remote DB
        if (error.code === 'PGRST202' || error.message?.includes('function') || error.code === '42883') {
          const { error: upsertErr } = await supabase.from('ledger_entries').upsert(cleanEntry);
          if (upsertErr) throw upsertErr;
        } else {
          throw error;
        }
      }

      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      console.warn('[SyncEngine] Ledger push failed, enqueuing offline:', err);
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Transaction queued offline');
      this.enqueue('ledger_entries', 'upsert', cleanEntry);
    }
  }

  public async updateLedgerEntry(id: string, updates: Partial<LedgerEntry>) {
    useLedgerStore.getState().updateEntryOptimistic(id, updates);
    const cleanUpdates = sanitizeLedgerPayload(updates);
    if (Object.keys(cleanUpdates).length === 0) return;
    try {
      const { error } = await supabase
        .from('ledger_entries')
        .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Update queued offline');
      this.enqueue('ledger_entries', 'upsert', { id, ...cleanUpdates });
    }
  }

  public async deleteLedgerEntry(id: string) {
    // Reverse linked bank account balance if entry was linked
    const existing = useLedgerStore.getState().entries.find((e) => e.id === id);
    if (existing && existing.cash_location_id) {
      const acc = useAccountStore.getState().accounts.find((a) => a.id === existing.cash_location_id);
      if (acc) {
        let restoredBalance = acc.balance;
        if (existing.type === 'cash_in') {
          restoredBalance -= existing.amount;
        } else if (
          existing.type === 'cash_out' ||
          existing.type === 'expense' ||
          existing.type === 'bill_payment'
        ) {
          restoredBalance += existing.amount;
        }
        useAccountStore.getState().updateAccountBalance(existing.cash_location_id, restoredBalance);
      }
    }

    useLedgerStore.getState().removeEntryOptimistic(id);
    try {
      const { error } = await supabase.from('ledger_entries').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Delete queued offline');
      this.enqueue('ledger_entries', 'delete', { id });
    }
  }

  // Bank Accounts
  public async pushAccount(account: BankAccountItem) {
    useAccountStore.getState().addAccount(account);
    const payload = {
      id: account.id,
      workspace_id: account.workspace_id,
      name: account.name,
      balance: account.balance,
      is_default: account.is_default,
      scope: account.scope || 'business',
      account_type: account.account_type || 'savings',
      bank_name: account.bank_name || null,
      account_number_last4: account.account_number_last4 || null,
      ifsc: account.ifsc || null,
      gradient: account.gradient || null,
      icon_color: account.iconColor || null,
    };
    try {
      const { error } = await supabase.from('cash_locations').upsert(payload);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Account queued offline');
      this.enqueue('cash_locations', 'upsert', payload);
    }
  }

  public async updateAccount(id: string, updates: Partial<BankAccountItem>) {
    useAccountStore.getState().updateAccount(id, updates);
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.balance !== undefined) payload.balance = updates.balance;
    if (updates.is_default !== undefined) payload.is_default = updates.is_default;
    if (updates.scope !== undefined) payload.scope = updates.scope;
    if (updates.account_type !== undefined) payload.account_type = updates.account_type;
    if (updates.bank_name !== undefined) payload.bank_name = updates.bank_name;
    if (updates.account_number_last4 !== undefined) payload.account_number_last4 = updates.account_number_last4;
    if (updates.ifsc !== undefined) payload.ifsc = updates.ifsc;
    if (updates.gradient !== undefined) payload.gradient = updates.gradient;
    if (updates.iconColor !== undefined) payload.icon_color = updates.iconColor;

    try {
      const { error } = await supabase
        .from('cash_locations')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Account update queued offline');
      this.enqueue('cash_locations', 'upsert', { id, ...payload });
    }
  }

  public async deleteAccount(id: string) {
    useAccountStore.getState().deleteAccount(id);
    try {
      const { error } = await supabase.from('cash_locations').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Account delete queued offline');
      this.enqueue('cash_locations', 'delete', { id });
    }
  }

  public async updateAccountBalance(id: string, newBalance: number) {
    useAccountStore.getState().updateAccountBalance(id, newBalance);
    try {
      const { error } = await supabase
        .from('cash_locations')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Balance update queued offline');
      this.enqueue('cash_locations', 'upsert', { id, balance: newBalance });
    }
  }

  // Customers & Dues
  public async pushCustomer(customer: Customer) {
    const custWithScope: Customer = {
      ...customer,
      scope: customer.scope || 'business',
    };
    useCustomerStore.getState().addCustomerOptimistic(custWithScope);
    try {
      const { error } = await supabase.from('customers').upsert({
        id: custWithScope.id,
        workspace_id: custWithScope.workspace_id,
        name: custWithScope.name,
        phone: custWithScope.phone,
        address: custWithScope.address,
        type: custWithScope.type,
        scope: custWithScope.scope,
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Customer queued offline');
      this.enqueue('customers', 'upsert', custWithScope);
    }
  }

  public async updateCustomer(id: string, updates: Partial<Customer>) {
    useCustomerStore.getState().updateCustomerOptimistic(id, updates);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Customer update queued offline');
      this.enqueue('customers', 'upsert', { id, ...updates });
    }
  }

  public async deleteCustomer(id: string) {
    useCustomerStore.getState().deleteCustomerOptimistic(id);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Customer delete queued offline');
      this.enqueue('customers', 'delete', { id });
    }
  }

  public async pushDue(due: PeopleDue) {
    const dueWithScope: PeopleDue = {
      ...due,
      scope: due.scope || 'business',
    };
    useCustomerStore.getState().addDueOptimistic(dueWithScope);
    try {
      const { error } = await supabase.from('people_dues').upsert({
        id: dueWithScope.id,
        workspace_id: dueWithScope.workspace_id,
        customer_id: dueWithScope.customer_id,
        direction: dueWithScope.direction,
        amount: dueWithScope.amount,
        due_date: dueWithScope.due_date,
        status: dueWithScope.status,
        scope: dueWithScope.scope,
        notes: dueWithScope.notes,
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Due queued offline');
      this.enqueue('people_dues', 'upsert', dueWithScope);
    }
  }

  public async updateDue(id: string, updates: Partial<PeopleDue>) {
    useCustomerStore.getState().updateDueOptimistic(id, updates);
    try {
      const { error } = await supabase
        .from('people_dues')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Due update queued offline');
      this.enqueue('people_dues', 'upsert', { id, ...updates });
    }
  }

  public async deleteDue(id: string) {
    useCustomerStore.getState().deleteDueOptimistic(id);
    try {
      const { error } = await supabase.from('people_dues').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Due delete queued offline');
      this.enqueue('people_dues', 'delete', { id });
    }
  }

  public async updateDueStatus(id: string, status: DueStatus) {
    useCustomerStore.getState().updateDueStatusOptimistic(id, status);
    try {
      const { error } = await supabase
        .from('people_dues')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Due status update queued offline');
      this.enqueue('people_dues', 'upsert', { id, status });
    }
  }

  public async settleDue(
    dueId: string,
    paidAmountPaise: number,
    paymentMode: PaymentMode,
    cashLocationId?: string,
    remark?: string
  ) {
    const perm = this.checkWritePermission();
    if (!perm.allowed) {
      useSessionStore.getState().setLastSyncError(perm.error || 'Permission denied');
      throw new Error(perm.error);
    }

    const due = useCustomerStore.getState().dues.find((d) => d.id === dueId);
    if (!due) return;

    const isFullSettlement = paidAmountPaise >= due.amount;
    const isReceivable = due.direction === 'you_will_get';
    const customer = useCustomerStore.getState().customers.find((c) => c.id === due.customer_id);

    // 1. Update Due state optimistically
    if (isFullSettlement) {
      useCustomerStore.getState().updateDueStatusOptimistic(dueId, 'settled');
    } else {
      useCustomerStore.getState().partialSettleDueOptimistic(dueId, paidAmountPaise);
    }

    // 2. Prepare Ledger entry
    const ledgerEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: due.workspace_id,
      type: isReceivable ? 'cash_in' : 'cash_out',
      amount: paidAmountPaise,
      mode: paymentMode,
      scope: due.scope || 'business',
      cash_location_id: cashLocationId || undefined,
      customer_id: due.customer_id,
      note: `${isReceivable ? 'Udhar Received' : 'Udhar Paid'} from ${customer?.name || 'Contact'}${
        remark ? ': ' + remark : ''
      }${!isFullSettlement ? ' (Partial Payment)' : ''}`,
      entry_date: new Date().toISOString(),
      idempotency_key: crypto.randomUUID(),
    };

    const cleanLedger = sanitizeLedgerPayload(ledgerEntry);

    if (perm.isOfflineMode) {
      useSessionStore.getState().setSyncStatus('offline');
      this.enqueue('people_dues', 'upsert', {
        id: dueId,
        amount: isFullSettlement ? 0 : due.amount - paidAmountPaise,
        status: isFullSettlement ? 'settled' : 'pending',
      });
      this.enqueue('ledger_entries', 'upsert', cleanLedger);
      return;
    }

    // 3. Persist atomically via RPC (with robust fallback)
    try {
      const { error } = await supabase.rpc('settle_due_atomically', {
        p_due_id: dueId,
        p_paid_amount: paidAmountPaise,
        p_ledger_entry: cleanLedger,
      });

      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('function') || error.code === '42883') {
          await this.pushLedgerEntry(ledgerEntry);
          const updatePayload = isFullSettlement
            ? { status: 'settled', updated_at: new Date().toISOString() }
            : { amount: due.amount - paidAmountPaise, updated_at: new Date().toISOString() };
          const { error: dueErr } = await supabase
            .from('people_dues')
            .update(updatePayload)
            .eq('id', dueId);
          if (dueErr) throw dueErr;
        } else {
          throw error;
        }
      }

      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      console.warn('[SyncEngine] Due settlement cloud push failed, enqueuing offline:', err);
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Settlement queued offline');
      this.enqueue('ledger_entries', 'upsert', cleanLedger);
      if (isFullSettlement) {
        this.enqueue('people_dues', 'upsert', { id: dueId, status: 'settled', scope: due.scope });
      } else {
        this.enqueue('people_dues', 'upsert', { id: dueId, amount: due.amount - paidAmountPaise, scope: due.scope });
      }
    }
  }

  // Cards
  public async pushCard(card: Card) {
    const cardWithScope: Card = {
      ...card,
      scope: card.scope || 'business',
      due_day: card.due_day || 5,
    };
    useCardStore.getState().addCardOptimistic(cardWithScope);
    try {
      const { error } = await supabase.from('cards').upsert({
        id: cardWithScope.id,
        workspace_id: cardWithScope.workspace_id,
        name: cardWithScope.name,
        bank: cardWithScope.bank,
        last4: cardWithScope.last4,
        credit_limit: cardWithScope.credit_limit,
        statement_day: cardWithScope.statement_day,
        due_day: cardWithScope.due_day,
        is_active: cardWithScope.is_active,
        scope: cardWithScope.scope,
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Card queued offline');
      this.enqueue('cards', 'upsert', cardWithScope);
    }
  }

  public async updateCard(cardId: string, updates: Partial<Card>) {
    useCardStore.getState().updateCardOptimistic(cardId, updates);
    try {
      const { error } = await supabase
        .from('cards')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', cardId);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Card update queued offline');
      this.enqueue('cards', 'upsert', { id: cardId, ...updates });
    }
  }

  public async deleteCard(cardId: string) {
    useCardStore.getState().deleteCardOptimistic(cardId);
    try {
      const { error } = await supabase.from('cards').delete().eq('id', cardId);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Card delete queued offline');
      this.enqueue('cards', 'delete', { id: cardId });
    }
  }

  // Notes
  public async pushNote(note: NoteItem) {
    useNoteStore.getState().addNoteOptimistic(note);
    try {
      const { error } = await supabase.from('notes').upsert({
        id: note.id,
        workspace_id: note.workspace_id,
        title: note.title,
        body: note.body,
        color: note.color,
        tags: note.tags,
        is_pinned: note.is_pinned,
        checklist_items: note.checklist_items,
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('notes', 'upsert', note);
    }
  }

  public async updateNote(id: string, updates: Partial<NoteItem>) {
    useNoteStore.getState().updateNoteOptimistic(id, updates);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('notes', 'upsert', { id, ...updates });
    }
  }

  public async deleteNote(id: string) {
    useNoteStore.getState().deleteNoteOptimistic(id);
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('notes', 'delete', { id });
    }
  }

  // Sheets
  public async pushSheet(sheet: RecordSheet) {
    const payload = {
      id: sheet.id,
      workspace_id: sheet.workspace_id || this.currentWorkspaceId,
      title: sheet.title,
      category: sheet.category,
      color: sheet.color,
      scope: sheet.scope || 'business',
      columns: sheet.columns,
      rows: sheet.rows,
      frozen_row_count: sheet.frozenRowCount || 0,
      row_height: sheet.rowHeight || 'normal',
      show_gridlines: sheet.showGridlines ?? true,
      updated_at: new Date().toISOString(),
    };
    try {
      const { error } = await supabase.from('sheets').upsert(payload);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Sheet queued offline');
      this.enqueue('sheets', 'upsert', payload);
    }
  }

  public async deleteSheet(id: string) {
    useSheetStore.getState().deleteSheet(id);
    try {
      const { error } = await supabase.from('sheets').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
      useSessionStore.getState().setLastSyncTime(new Date().toISOString());
      useSessionStore.getState().setLastSyncError(null);
    } catch (err: any) {
      useSessionStore.getState().setSyncStatus('offline');
      useSessionStore.getState().setLastSyncError(err?.message || 'Sheet delete queued offline');
      this.enqueue('sheets', 'delete', { id });
    }
  }

  public destroy() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

export const syncEngine = new SyncEngine();
