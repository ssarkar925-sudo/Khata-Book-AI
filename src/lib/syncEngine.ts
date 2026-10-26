import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAccountStore, BankAccountItem } from '@/stores/useAccountStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useNoteStore } from '@/stores/useNoteStore';
import { useSheetStore } from '@/stores/useSheetStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { CashLocation, Customer, PeopleDue, Card, LedgerEntry, NoteItem, RecordSheet, VaultItem, DueStatus } from '@/types';

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
  private currentWorkspaceId = '00000000-0000-0000-0000-000000000010';

  constructor() {
    if (typeof window !== 'undefined') {
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

      // 2. Pull Bank Accounts
      const { data: accData } = await supabase
        .from('cash_locations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (accData && accData.length > 0) {
        useAccountStore.getState().setAccounts(accData);
      } else {
        const localAccounts = useAccountStore.getState().accounts;
        if (localAccounts.length > 0) {
          await supabase.from('cash_locations').upsert(
            localAccounts.map((a) => ({
              id: a.id,
              workspace_id: workspaceId,
              name: a.name,
              balance: a.balance,
              is_default: a.is_default,
              gradient: a.gradient,
              icon_color: a.iconColor,
            }))
          );
        }
      }

      // 3. Pull Customers & Dues
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (custData && custData.length > 0) {
        useCustomerStore.getState().setCustomers(custData);
      } else {
        const localCust = useCustomerStore.getState().customers;
        if (localCust.length > 0) {
          await supabase.from('customers').upsert(
            localCust.map((c) => ({
              id: c.id,
              workspace_id: workspaceId,
              name: c.name,
              phone: c.phone,
              address: c.address,
              type: c.type,
            }))
          );
        }
      }

      const { data: duesData } = await supabase
        .from('people_dues')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (duesData && duesData.length > 0) {
        useCustomerStore.getState().setDues(duesData);
      } else {
        const localDues = useCustomerStore.getState().dues;
        if (localDues.length > 0) {
          await supabase.from('people_dues').upsert(
            localDues.map((d) => ({
              id: d.id,
              workspace_id: workspaceId,
              customer_id: d.customer_id,
              direction: d.direction,
              amount: d.amount,
              due_date: d.due_date,
              status: d.status,
              notes: d.notes,
            }))
          );
        }
      }

      // 4. Pull Cards
      const { data: cardData } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (cardData && cardData.length > 0) {
        useCardStore.getState().setCards(cardData);
      } else {
        const localCards = useCardStore.getState().cards;
        if (localCards.length > 0) {
          await supabase.from('cards').upsert(
            localCards.map((c) => ({
              id: c.id,
              workspace_id: workspaceId,
              name: c.name,
              bank: c.bank,
              last4: c.last4,
              credit_limit: c.credit_limit,
              statement_day: c.statement_day,
              is_active: c.is_active,
            }))
          );
        }
      }

      // 5. Pull Ledger Entries
      const { data: ledgerData } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false });

      if (ledgerData && ledgerData.length > 0) {
        useLedgerStore.getState().setEntries(ledgerData);
      } else {
        const localEntries = useLedgerStore.getState().entries;
        if (localEntries.length > 0) {
          await supabase.from('ledger_entries').upsert(
            localEntries.map((e) => ({
              id: e.id,
              workspace_id: workspaceId,
              type: e.type,
              amount: e.amount,
              category_id: e.category_id,
              cash_location_id: e.cash_location_id,
              customer_id: e.customer_id,
              card_id: e.card_id,
              mode: e.mode,
              note: e.note,
              entry_date: e.entry_date,
            }))
          );
        }
      }

      // 6. Pull Notes
      const { data: noteData } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (noteData && noteData.length > 0) {
        useNoteStore.getState().setNotes(noteData);
      } else {
        const localNotes = useNoteStore.getState().notes;
        if (localNotes.length > 0) {
          await supabase.from('notes').upsert(
            localNotes.map((n) => ({
              id: n.id,
              workspace_id: workspaceId,
              title: n.title,
              body: n.body,
              color: n.color,
              tags: n.tags,
              is_pinned: n.is_pinned,
              checklist_items: n.checklist_items,
            }))
          );
        }
      }

      // 7. Pull Sheets
      const { data: sheetData } = await supabase
        .from('sheets')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (sheetData && sheetData.length > 0) {
        useSheetStore.getState().setSheets(sheetData);
      } else {
        const localSheets = useSheetStore.getState().sheets;
        if (localSheets.length > 0) {
          await supabase.from('sheets').upsert(
            localSheets.map((s) => ({
              id: s.id,
              workspace_id: workspaceId,
              title: s.title,
              category: s.category,
              color: s.color,
              columns: s.columns,
              rows: s.rows,
            }))
          );
        }
      }

      // 8. Pull Encrypted Vault Items
      const { data: vaultData } = await supabase
        .from('vault_items')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (vaultData && vaultData.length > 0) {
        useVaultStore.getState().setVaultItems(vaultData);
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
            useAccountStore.getState().updateAccountBalance(payload.new.id, payload.new.balance);
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
