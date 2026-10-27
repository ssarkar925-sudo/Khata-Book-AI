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
  'note',
  'entry_date',
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

      // Flush any queued offline mutations
      await this.flushQueue();

      useSessionStore.getState().setSyncStatus('synced');
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
  // Listens without fragile server-side filters
  // ==========================================
  public subscribeRealtime(workspaceId: string) {
    if (this.channel) {
      this.channel.unsubscribe();
    }

    this.currentWorkspaceId = workspaceId;

    this.channel = supabase
      .channel(`recordbook-realtime-${workspaceId}`)
      // Ledger Entries
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ledger_entries' },
        (payload) => {
          const item = (payload.new || payload.old) as LedgerEntry;
          if (item?.workspace_id && item.workspace_id !== this.currentWorkspaceId) return;

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
      // Bank Accounts
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_locations' },
        (payload) => {
          const item = (payload.new || payload.old) as CashLocation;
          if (item?.workspace_id && item.workspace_id !== this.currentWorkspaceId) return;

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
      // Customers
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload) => {
          const item = (payload.new || payload.old) as Customer;
          if (item?.workspace_id && item.workspace_id !== this.currentWorkspaceId) return;

          console.log('[SyncEngine] Realtime customer update received:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            useCustomerStore.getState().addCustomerOptimistic(payload.new as Customer);
          }
        }
      )
      // People Dues
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'people_dues' },
        (payload) => {
          const item = (payload.new || payload.old) as PeopleDue;
          if (item?.workspace_id && item.workspace_id !== this.currentWorkspaceId) return;

          console.log('[SyncEngine] Realtime dues update received:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            useCustomerStore.getState().addDueOptimistic(payload.new as PeopleDue);
          } else if (payload.eventType === 'UPDATE') {
            useCustomerStore.getState().updateDueStatusOptimistic(payload.new.id, payload.new.status);
          }
        }
      )
      // Cards
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        (payload) => {
          const item = (payload.new || payload.old) as Card;
          if (item?.workspace_id && item.workspace_id !== this.currentWorkspaceId) return;

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
      // Notes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload) => {
          const item = (payload.new || payload.old) as NoteItem;
          if (item?.workspace_id && item.workspace_id !== this.currentWorkspaceId) return;

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
      // Sheets
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sheets' },
        (payload) => {
          const item = (payload.new || payload.old) as RecordSheet;
          if (item?.workspace_id && item.workspace_id !== this.currentWorkspaceId) return;

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

  // Ledger
  public async pushLedgerEntry(entry: LedgerEntry) {
    useLedgerStore.getState().addEntryOptimistic(entry);

    // Auto-update linked bank account or cash counter balance
    if (entry.cash_location_id) {
      const acc = useAccountStore.getState().accounts.find((a) => a.id === entry.cash_location_id);
      if (acc) {
        let newBalance = acc.balance;
        if (entry.type === 'cash_in') {
          newBalance += entry.amount;
        } else if (
          entry.type === 'cash_out' ||
          entry.type === 'expense' ||
          entry.type === 'bill_payment'
        ) {
          newBalance -= entry.amount;
        }
        this.updateAccountBalance(entry.cash_location_id, newBalance);
      }
    }

    const cleanEntry = sanitizeLedgerPayload(entry);
    try {
      const { error } = await supabase.from('ledger_entries').upsert(cleanEntry);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
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
    } catch {
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
        this.updateAccountBalance(existing.cash_location_id, restoredBalance);
      }
    }

    useLedgerStore.getState().removeEntryOptimistic(id);
    try {
      const { error } = await supabase.from('ledger_entries').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('ledger_entries', 'delete', { id });
    }
  }

  // Bank Accounts
  public async pushAccount(account: BankAccountItem) {
    useAccountStore.getState().addAccount(account);
    try {
      const { error } = await supabase.from('cash_locations').upsert({
        id: account.id,
        workspace_id: account.workspace_id,
        name: account.name,
        balance: account.balance,
        is_default: account.is_default,
        gradient: account.gradient,
        icon_color: account.iconColor,
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('cash_locations', 'upsert', account);
    }
  }

  public async updateAccount(id: string, updates: Partial<BankAccountItem>) {
    useAccountStore.getState().updateAccount(id, updates);
    try {
      const { error } = await supabase
        .from('cash_locations')
        .update({
          name: updates.name,
          balance: updates.balance,
          is_default: updates.is_default,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('cash_locations', 'upsert', { id, ...updates });
    }
  }

  public async deleteAccount(id: string) {
    useAccountStore.getState().deleteAccount(id);
    try {
      const { error } = await supabase.from('cash_locations').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
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
    } catch {
      this.enqueue('cash_locations', 'upsert', { id, balance: newBalance });
    }
  }

  // Customers & Dues
  public async pushCustomer(customer: Customer) {
    useCustomerStore.getState().addCustomerOptimistic(customer);
    try {
      const { error } = await supabase.from('customers').upsert({
        id: customer.id,
        workspace_id: customer.workspace_id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        type: customer.type,
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('customers', 'upsert', customer);
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
    } catch {
      this.enqueue('customers', 'upsert', { id, ...updates });
    }
  }

  public async deleteCustomer(id: string) {
    useCustomerStore.getState().deleteCustomerOptimistic(id);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('customers', 'delete', { id });
    }
  }

  public async pushDue(due: PeopleDue) {
    useCustomerStore.getState().addDueOptimistic(due);
    try {
      const { error } = await supabase.from('people_dues').upsert({
        id: due.id,
        workspace_id: due.workspace_id,
        customer_id: due.customer_id,
        direction: due.direction,
        amount: due.amount,
        due_date: due.due_date,
        status: due.status,
        notes: due.notes,
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('people_dues', 'upsert', due);
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
    } catch {
      this.enqueue('people_dues', 'upsert', { id, ...updates });
    }
  }

  public async deleteDue(id: string) {
    useCustomerStore.getState().deleteDueOptimistic(id);
    try {
      const { error } = await supabase.from('people_dues').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
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
    } catch {
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
    const due = useCustomerStore.getState().dues.find((d) => d.id === dueId);
    if (!due) return;

    const isFullSettlement = paidAmountPaise >= due.amount;
    const isReceivable = due.direction === 'you_will_get';
    const customer = useCustomerStore.getState().customers.find((c) => c.id === due.customer_id);

    // 1. Update Due state
    if (isFullSettlement) {
      useCustomerStore.getState().updateDueStatusOptimistic(dueId, 'settled');
    } else {
      useCustomerStore.getState().partialSettleDueOptimistic(dueId, paidAmountPaise);
    }

    // 2. Record ledger entry (auto-updates linked bank account / till balance!)
    const ledgerEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: due.workspace_id,
      type: isReceivable ? 'cash_in' : 'cash_out',
      amount: paidAmountPaise,
      mode: paymentMode,
      cash_location_id: cashLocationId || undefined,
      customer_id: due.customer_id,
      note: `${isReceivable ? 'Udhar Received' : 'Udhar Paid'} from ${customer?.name || 'Contact'}${
        remark ? ': ' + remark : ''
      }${!isFullSettlement ? ' (Partial Payment)' : ''}`,
      entry_date: new Date().toISOString(),
    };
    await this.pushLedgerEntry(ledgerEntry);

    // 3. Persist due update to cloud/queue
    try {
      if (isFullSettlement) {
        await supabase
          .from('people_dues')
          .update({ status: 'settled', updated_at: new Date().toISOString() })
          .eq('id', dueId);
      } else {
        await supabase
          .from('people_dues')
          .update({ amount: due.amount - paidAmountPaise, updated_at: new Date().toISOString() })
          .eq('id', dueId);
      }
    } catch {
      if (isFullSettlement) {
        this.enqueue('people_dues', 'upsert', { id: dueId, status: 'settled' });
      } else {
        this.enqueue('people_dues', 'upsert', { id: dueId, amount: due.amount - paidAmountPaise });
      }
    }
  }

  // Cards
  public async pushCard(card: Card) {
    useCardStore.getState().addCardOptimistic(card);
    try {
      const { error } = await supabase.from('cards').upsert({
        id: card.id,
        workspace_id: card.workspace_id,
        name: card.name,
        bank: card.bank,
        last4: card.last4,
        credit_limit: card.credit_limit,
        statement_day: card.statement_day,
        is_active: card.is_active,
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('cards', 'upsert', card);
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
    } catch {
      this.enqueue('cards', 'upsert', { id: cardId, ...updates });
    }
  }

  public async deleteCard(cardId: string) {
    useCardStore.getState().deleteCardOptimistic(cardId);
    try {
      const { error } = await supabase.from('cards').delete().eq('id', cardId);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
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
    try {
      const { error } = await supabase.from('sheets').upsert({
        id: sheet.id,
        workspace_id: sheet.workspace_id || this.currentWorkspaceId,
        title: sheet.title,
        category: sheet.category,
        color: sheet.color,
        columns: sheet.columns,
        rows: sheet.rows,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
      this.enqueue('sheets', 'upsert', sheet);
    }
  }

  public async deleteSheet(id: string) {
    useSheetStore.getState().deleteSheet(id);
    try {
      const { error } = await supabase.from('sheets').delete().eq('id', id);
      if (error) throw error;
      useSessionStore.getState().setSyncStatus('synced');
    } catch {
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
