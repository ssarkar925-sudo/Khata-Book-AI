export type DueStatus = 'pending' | 'settled' | 'cancelled';
export type PaymentMode = 'cash' | 'upi' | 'bank' | 'card';
export type LedgerEntryType = 'cash_in' | 'cash_out' | 'expense' | 'bill_payment' | 'card_spend';
export type DueDirection = 'you_will_get' | 'you_will_give';
export type CustomerType = 'customer' | 'supplier';
export type EntityScope = 'business' | 'personal' | 'family';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  member_email?: string;
  role: WorkspaceRole;
  created_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  currency: string;
  owner_id: string;
  is_local?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type MigrationErrorCategory =
  | 'rpc_unavailable'
  | 'authorization'
  | 'validation'
  | 'network_connectivity'
  | 'server_error'
  | 'reconciliation_mismatch';

export interface MigrationFailure {
  entity: string;
  id: string;
  error: string;
  errorCategory?: MigrationErrorCategory;
  isRetryable?: boolean;
}

export interface AccountReconciliationFailure {
  accountId: string;
  accountName: string;
  expectedBalance: number;
  actualBalance: number | null;
  error: string;
}

export interface ReconciliationReport {
  passed: boolean;
  failures: AccountReconciliationFailure[];
  timestamp?: string;
}

export interface MigrationProgress {
  status: 'idle' | 'backing_up' | 'uploading' | 'reconciling' | 'verifying' | 'completed' | 'partial_failure' | 'error';
  currentStep: string;
  progressPercent: number;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: MigrationFailure[];
  backupKey?: string;
  errorMessage?: string;
  reconciliation?: ReconciliationReport;
}

export interface MigrationResult {
  success: boolean;
  total: number;
  migrated: number;
  failed: MigrationFailure[];
  backupKey?: string;
  error?: string;
  reconciliation?: ReconciliationReport;
}

export type AccountType = 'savings' | 'current' | 'cash_counter' | 'wallet' | 'od_cc';

export interface CashLocation {
  id: string;
  workspace_id: string;
  name: string;
  balance: number; // in paise
  is_default: boolean;
  scope?: EntityScope;
  account_type?: AccountType;
  bank_name?: string;
  account_number_last4?: string;
  ifsc?: string;
  notes?: string | null;
  color_theme?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CashCount {
  id: string;
  workspace_id: string;
  location_id: string;
  denominations: Record<string, number>;
  loose_amount: number; // in paise
  total_counted: number; // in paise
  expected_amount: number; // in paise
  difference: number; // in paise
  counted_at: string;
  notes?: string | null;
}

export interface Customer {
  id: string;
  workspace_id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  type: CustomerType;
  scope?: EntityScope;
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
  scope?: EntityScope;
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
  variant?: string;
  network?: string;
  last4: string;
  credit_limit: number; // in paise
  statement_day: number;
  due_day?: number;
  is_active: boolean;
  scope?: EntityScope;
  notes?: string | null;
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
  scope?: EntityScope;
  note?: string | null;
  entry_date: string;
  is_billed?: boolean;
  idempotency_key?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  transfer_id?: string;
  transfer_direction?: 'out' | 'in' | 'out_compensation' | 'in_compensation';
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
  content?: string | null; // Legacy alias for body
  color?: string | null;
  tags: string[];
  is_pinned: boolean;
  pinned?: boolean; // Legacy alias for is_pinned
  checklist_items: NoteChecklistItem[];
  scope?: EntityScope;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface VaultSecretField {
  id: string;
  label: string;
  value: string;
}

export interface VaultItem {
  id: string;
  workspace_id: string;
  title: string;
  item_type: 'password' | 'pin' | 'secure_note' | 'id_card';
  category?: string;
  color?: string;
  username?: string | null;
  encrypted_password?: string;
  secrets?: VaultSecretField[];
  iv?: string;
  salt?: string;
  auth_tag?: string;
  verificationToken?: string;
  decrypted_password?: string; // in-memory only
  url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export type SheetColumnType = 'text' | 'number' | 'date' | 'amount' | 'status' | 'phone' | 'select';

export interface SheetColumn {
  id: string;
  name: string;
  type: SheetColumnType;
  width?: number;
  options?: string[];
  isPinned?: boolean;
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
  scope?: EntityScope;
  columns: SheetColumn[];
  rows: SheetRow[];
  frozenRowCount?: number;
  rowHeight?: 'compact' | 'normal' | 'relaxed';
  showGridlines?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
export type TabType = 'dashboard' | 'cash' | 'expenses' | 'dues' | 'cards' | 'sheets' | 'notes' | 'vault' | 'reports';
