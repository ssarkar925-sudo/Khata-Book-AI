'use client';

import {
  CashLocation,
  Card,
  Customer,
  PeopleDue,
  LedgerEntry,
  NoteItem,
  RecordSheet,
  VaultItem,
} from '@/types';
import { useAccountStore } from '@/stores/useAccountStore';
import { useCardStore } from '@/stores/useCardStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useNoteStore } from '@/stores/useNoteStore';
import { useSheetStore } from '@/stores/useSheetStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { syncEngine } from '@/lib/syncEngine';

export const SYSTEM_SNAPSHOT_TAG = '__system_cloud_snapshot__';
const STORAGE_KEY = 'rb_cloud_snapshots';
const LAST_AUTO_TIME_KEY = 'rb_last_auto_snapshot_time';
const AUTO_BACKUP_ENABLED_KEY = 'rb_auto_backup_enabled';

export interface CloudSnapshot {
  id: string;
  workspace_id: string;
  created_at: string;
  device_name: string;
  label: string;
  is_auto: boolean;
  total_records: number;
  data: {
    accounts: CashLocation[];
    cards: Card[];
    customers: Customer[];
    dues: PeopleDue[];
    ledger: LedgerEntry[];
    notes: NoteItem[];
    sheets: RecordSheet[];
    vaultItems: VaultItem[];
  };
}

function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Server';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android Device';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS Device';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh|mac os x/i.test(ua)) return 'Mac OS';
  if (/linux/i.test(ua)) return 'Linux Device';
  return 'Web Client';
}

export class CloudSnapshotEngine {
  private static instance: CloudSnapshotEngine;

  public static getInstance(): CloudSnapshotEngine {
    if (!CloudSnapshotEngine.instance) {
      CloudSnapshotEngine.instance = new CloudSnapshotEngine();
    }
    return CloudSnapshotEngine.instance;
  }

  public isAutoBackupEnabled(): boolean {
    if (typeof localStorage === 'undefined') return true;
    const val = localStorage.getItem(AUTO_BACKUP_ENABLED_KEY);
    return val === null ? true : val === 'true';
  }

  public setAutoBackupEnabled(enabled: boolean): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, String(enabled));
  }

  public listSnapshots(): CloudSnapshot[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      // 1. Gather from local snapshot storage
      const localRaw = localStorage.getItem(STORAGE_KEY);
      const localSnapshots: CloudSnapshot[] = localRaw ? JSON.parse(localRaw) : [];
      const map = new Map<string, CloudSnapshot>();

      localSnapshots.forEach((s) => {
        if (s && s.id) map.set(s.id, s);
      });

      // 2. Discover snapshots synced through Cloud Notes
      const notes = useNoteStore.getState().notes;
      notes.forEach((n) => {
        if (n.tags && n.tags.includes(SYSTEM_SNAPSHOT_TAG) && n.body) {
          try {
            const parsed = JSON.parse(n.body) as CloudSnapshot;
            if (parsed && parsed.id && !map.has(parsed.id)) {
              map.set(parsed.id, parsed);
            }
          } catch {}
        }
      });

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (err) {
      console.warn('[CloudSnapshotEngine] listSnapshots error:', err);
      return [];
    }
  }

  public async takeSnapshot(label?: string, isAuto = false): Promise<CloudSnapshot> {
    const wsId = useSessionStore.getState().activeWorkspaceId || 'default';
    const accounts = useAccountStore.getState().accounts;
    const cards = useCardStore.getState().cards;
    const customers = useCustomerStore.getState().customers;
    const dues = useCustomerStore.getState().dues;
    const ledger = useLedgerStore.getState().entries;
    const sheets = useSheetStore.getState().sheets;
    const vaultItems = useVaultStore.getState().vaultItems;

    // Filter out previous snapshot notes from the user's saved notes
    const notes = useNoteStore.getState().notes.filter(
      (n) => !n.tags || !n.tags.includes(SYSTEM_SNAPSHOT_TAG)
    );

    const totalRecords =
      accounts.length +
      cards.length +
      customers.length +
      dues.length +
      ledger.length +
      sheets.length +
      notes.length +
      vaultItems.length;

    const device = getDeviceName();
    const defaultLabel = isAuto
      ? `Daily Auto-Backup (${device})`
      : label || `Manual Snapshot (${device})`;

    const snapshot: CloudSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      workspace_id: wsId,
      created_at: new Date().toISOString(),
      device_name: device,
      label: defaultLabel,
      is_auto: isAuto,
      total_records: totalRecords,
      data: {
        accounts,
        cards,
        customers,
        dues,
        ledger,
        notes,
        sheets,
        vaultItems,
      },
    };

    // Save locally
    this.saveSnapshotLocally(snapshot);

    // Sync snapshot payload across devices via Cloud Note
    try {
      const snapshotNote: NoteItem = {
        id: `note-snap-${snapshot.id}`,
        workspace_id: wsId,
        title: `[Cloud Snapshot] ${defaultLabel} - ${snapshot.created_at.slice(0, 10)}`,
        body: JSON.stringify(snapshot),
        color: '#10B981',
        tags: [SYSTEM_SNAPSHOT_TAG],
        is_pinned: false,
        checklist_items: [],
        created_at: snapshot.created_at,
        updated_at: snapshot.created_at,
      };

      await syncEngine.pushNote(snapshotNote);
    } catch (err) {
      console.warn('[CloudSnapshotEngine] Cloud note sync queued offline:', err);
    }

    if (isAuto && typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_AUTO_TIME_KEY, String(Date.now()));
    }

    return snapshot;
  }

  public async restoreSnapshot(snapshotId: string): Promise<boolean> {
    const snapshots = this.listSnapshots();
    const target = snapshots.find((s) => s.id === snapshotId);
    if (!target) return false;

    try {
      const d = target.data;
      if (Array.isArray(d.accounts)) useAccountStore.getState().setAccounts(d.accounts);
      if (Array.isArray(d.cards)) useCardStore.getState().setCards(d.cards);
      if (Array.isArray(d.customers)) useCustomerStore.getState().setCustomers(d.customers);
      if (Array.isArray(d.dues)) useCustomerStore.getState().setDues(d.dues);
      if (Array.isArray(d.ledger)) useLedgerStore.getState().setEntries(d.ledger);
      if (Array.isArray(d.sheets)) useSheetStore.getState().setSheets(d.sheets);
      if (Array.isArray(d.notes)) useNoteStore.getState().setNotes(d.notes);
      if (Array.isArray(d.vaultItems)) useVaultStore.getState().setVaultItems(d.vaultItems);

      return true;
    } catch (err) {
      console.error('[CloudSnapshotEngine] Error restoring snapshot:', err);
      return false;
    }
  }

  public async deleteSnapshot(snapshotId: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      const list = this.listSnapshots().filter((s) => s.id !== snapshotId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    // Also delete linked cloud note if exists
    try {
      await syncEngine.deleteNote(`note-snap-${snapshotId}`);
    } catch {}
  }

  public async checkAndRunAutoDailySnapshot(): Promise<void> {
    if (typeof localStorage === 'undefined' || !this.isAutoBackupEnabled()) return;
    try {
      const lastRaw = localStorage.getItem(LAST_AUTO_TIME_KEY);
      const lastTime = lastRaw ? parseInt(lastRaw, 10) : 0;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (Date.now() - lastTime > twentyFourHours) {
        console.log('[CloudSnapshotEngine] Triggering scheduled daily auto-snapshot...');
        await this.takeSnapshot(undefined, true);
      }
    } catch (err) {
      console.warn('[CloudSnapshotEngine] checkAndRunAutoDailySnapshot failed:', err);
    }
  }

  private saveSnapshotLocally(snapshot: CloudSnapshot) {
    if (typeof localStorage === 'undefined') return;
    try {
      const existing = this.listSnapshots();
      // Keep at most 20 recent snapshots
      const updated = [snapshot, ...existing.filter((s) => s.id !== snapshot.id)].slice(0, 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
}

export const cloudSnapshotEngine = CloudSnapshotEngine.getInstance();
