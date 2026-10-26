export type DueStatus = 'pending' | 'settled' | 'cancelled';
export type PaymentMode = 'cash' | 'upi' | 'bank' | 'card';
export type LedgerEntryType = 'cash_in' | 'cash_out' | 'expense' | 'bill_payment' | 'card_spend';
export type DueDirection = 'you_will_get' | 'you_will_give';
export type CustomerType = 'customer' | 'supplier';

export interface Workspace {
  id: string;
  name: string;
  currency: string;
  owner_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface CashLocation {
  id: string;
  workspace_id: string;
  name: string;
  balance: number; // in paise
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Customer {
  id: string;
  workspace_id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  type: CustomerType;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface PeopleDue {
  id: string;
  workspace_id: string;
  customer_id: string;
  direction: DueDirection;
  amount: number; // in paise
  due_date: string;
  status: DueStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Card {
  id: string;
  workspace_id: string;
  name: string;
  bank: string;
  last4: string;
  credit_limit: number; // in paise
  statement_day: number;
  due_day?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  icon?: string | null;
  color?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface LedgerEntry {
  id: string;
  workspace_id: string;
  type: LedgerEntryType;
  amount: number; // in paise
  category_id?: string | null;
  cash_location_id?: string | null;
  customer_id?: string | null;
  card_id?: string | null;
  mode: PaymentMode;
  note?: string | null;
  entry_date: string;
  is_billed?: boolean;
  idempotency_key?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface NoteChecklistItem {
  id: string;
  text: string;
  is_done: boolean;
}

export interface NoteItem {
  id: string;
  workspace_id: string;
  title: string;
  body?: string | null;
  color?: string | null;
  tags: string[];
  is_pinned: boolean;
  checklist_items: NoteChecklistItem[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface VaultItem {
  id: string;
  workspace_id: string;
  title: string;
  item_type: 'password' | 'pin' | 'secure_note' | 'id_card';
  username?: string | null;
  encrypted_password?: string;
  iv?: string;
  salt?: string;
  auth_tag?: string;
  decrypted_password?: string; // in-memory only
  url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SheetColumnType = 'text' | 'number' | 'date' | 'amount' | 'status' | 'phone';

export interface SheetColumn {
  id: string;
  name: string;
  type: SheetColumnType;
}

export interface SheetRow {
  id: string;
  data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface RecordSheet {
  id: string;
  workspace_id: string;
  title: string;
  category?: string;
  color?: string;
  columns: SheetColumn[];
  rows: SheetRow[];
  created_at?: string;
  updated_at?: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
export type TabType = 'dashboard' | 'cash' | 'dues' | 'cards' | 'sheets' | 'notes' | 'vault' | 'reports';
