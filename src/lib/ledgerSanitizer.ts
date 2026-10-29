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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTIONAL_UUID_COLUMNS = new Set([
  'category_id',
  'cash_location_id',
  'customer_id',
  'card_id',
  'created_by',
]);

export function sanitizeLedgerPayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeLedgerPayload);
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (LEDGER_ENTRY_VALID_COLUMNS.has(k) && v !== undefined) {
      // Validate UUID columns to avoid Postgres 22P02 invalid input syntax for type uuid
      if (OPTIONAL_UUID_COLUMNS.has(k)) {
        if (typeof v === 'string' && UUID_REGEX.test(v)) {
          clean[k] = v;
        } else {
          clean[k] = null;
        }
      } else {
        clean[k] = v;
      }
    }
  }
  return clean;
}
