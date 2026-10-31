-- ============================================
-- Migration: Add Transfer Fields to ledger_entries
-- Purpose: Enable atomic fund transfers with saga pattern compensation
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================

-- Add transfer_id and transfer_direction columns to ledger_entries
ALTER TABLE ledger_entries 
ADD COLUMN IF NOT EXISTS transfer_id UUID,
ADD COLUMN IF NOT EXISTS transfer_direction TEXT 
CHECK (transfer_direction IN ('out', 'in', 'out_compensation', 'in_compensation'));

-- Create index for efficient transfer lookups
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transfer_id 
ON ledger_entries(transfer_id);

-- Add comment for documentation
COMMENT ON COLUMN ledger_entries.transfer_id IS 'UUID linking paired transfer entries (out/in) for atomic fund transfers';
COMMENT ON COLUMN ledger_entries.transfer_direction IS 'Direction of transfer entry: out (source), in (destination), out_compensation (reversal), in_compensation (reversal)';

-- ============================================
-- Migration: Add transfer_id to cash_locations queue items (optional, for sync)
-- ============================================

-- The sync queue already supports arbitrary payload, but ensure it can handle transfer_id
-- No schema changes needed for sync_queue as it uses JSONB payload

-- ============================================
-- Verification Queries
-- ============================================

-- Verify columns added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ledger_entries' 
  AND column_name IN ('transfer_id', 'transfer_direction')
ORDER BY column_name;

-- Verify index created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ledger_entries' 
  AND indexname = 'idx_ledger_entries_transfer_id';

-- Test insert with new fields (optional)
-- INSERT INTO ledger_entries (id, workspace_id, type, amount, mode, scope, note, entry_date, transfer_id, transfer_direction)
-- VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'cash_out', 100000, 'bank', 'business', 'Test transfer out', NOW(), gen_random_uuid(), 'out');