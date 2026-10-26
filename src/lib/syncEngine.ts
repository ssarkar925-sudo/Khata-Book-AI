import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useNoteStore } from '@/stores/useNoteStore';
import { useSheetStore } from '@/stores/useSheetStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { CashLocation, Customer, PeopleDue, Card, LedgerEntry, NoteItem, RecordSheet, VaultItem } from '@/types';

class SyncEngine {
  private isSyncing = false;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private listenersAttached = false;

  public async pullAll(workspaceId: string): Promise<boolean> {
    if (this.isSyncing) return false;
    this.isSyncing = true;
    useSessionStore.getState().setSyncStatus('syncing');

    try {
      // 1. Check or register Workspace
      const { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();

      if (wsError && wsError.code === 'PGRST116') {
        // Table doesn't exist yet or 404
        console.warn('[SyncEngine] Cloud tables not found or offline. Running locally.');
        useSessionStore.getState().setSyncStatus('offline');
        this.isSyncing = false;
        return false;
      }

      if (!wsData) {
        // Create initial workspace record in Supabase
        await supabase.from('workspaces').upsert({
          id: workspaceId,
          name: 'Primary Record Book',
          currency: 'INR',
        });
      }

      // 2. Sync Bank Accounts
      const { data: accData, error: accError } = await supabase
        .from('cash_locations')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (!accError && accData) {
        if (accData.length > 0) {
          useAccountStore.getState().setAccounts(accData);
        } else {
          // Push local accounts to cloud
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
      }

      // 3. Sync Customers & Dues
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('workspace_id', workspaceId);

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
        .eq('workspace_id', workspaceId);

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

      // 4. Sync Credit Cards
      const { data: cardData } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', workspaceId);

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

      // 5. Sync Ledger Entries (Transactions)
      const { data: ledgerData } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('workspace_id', workspaceId)
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

      // 6. Sync Notes
      const { data: noteData } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspaceId);

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

      // 7. Sync Sheets (Spreadsheets)
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

      // 8. Sync Encrypted Vault Items
      const { data: vaultData } = await supabase
        .from('vault_items')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (vaultData && vaultData.length > 0) {
        useVaultStore.getState().setVaultItems(vaultData);
      } else {
        const localVault = useVaultStore.getState().vaultItems;
        if (localVault.length > 0) {
          await supabase.from('vault_items').upsert(
            localVault.map((v: VaultItem) => ({
              id: v.id,
              workspace_id: workspaceId,
              title: v.title,
              item_type: v.item_type,
              username: v.username,
              encrypted_password: v.encrypted_password,
              iv: v.iv,
              salt: v.salt,
              auth_tag: v.auth_tag,
              url: v.url,
              notes: v.notes,
            }))
          );
        }
      }

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

  public subscribeRealtime(workspaceId: string) {
    if (this.channel) {
      this.channel.unsubscribe();
    }

    this.channel = supabase
      .channel(`rb-realtime-${workspaceId}`)
      // Ledger Entries
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ledger_entries', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            useLedgerStore.getState().addEntryOptimistic(payload.new as LedgerEntry);
          } else if (payload.eventType === 'DELETE') {
            useLedgerStore.getState().removeEntryOptimistic(payload.old.id);
          }
        }
      )
      // Bank Accounts
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_locations', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            useAccountStore.getState().addAccount(payload.new as CashLocation);
          } else if (payload.eventType === 'UPDATE') {
            useAccountStore.getState().updateAccountBalance(payload.new.id, payload.new.balance);
          }
        }
      )
      // People Dues
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'people_dues', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
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
        { event: '*', schema: 'public', table: 'cards', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            useCardStore.getState().addCardOptimistic(payload.new as Card);
          } else if (payload.eventType === 'UPDATE') {
            useCardStore.getState().updateCardOptimistic(payload.new.id, payload.new as Partial<Card>);
          }
        }
      )
      // Notes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            useNoteStore.getState().addNoteOptimistic(payload.new as NoteItem);
          } else if (payload.eventType === 'UPDATE') {
            useNoteStore.getState().updateNoteOptimistic(payload.new.id, payload.new as Partial<NoteItem>);
          } else if (payload.eventType === 'DELETE') {
            useNoteStore.getState().deleteNoteOptimistic(payload.old.id);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[SyncEngine] Realtime channel active for workspace:', workspaceId);
        }
      });
  }

  public destroy() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

export const syncEngine = new SyncEngine();
