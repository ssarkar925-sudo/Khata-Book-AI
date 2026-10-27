// Whitelist of columns physically present in public.ledger_entries Supabase table
export const LEDGER_ENTRY_VALID_COLUMNS = new Set([
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

export function sanitizeLedgerPayload(obj: any): any {
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
