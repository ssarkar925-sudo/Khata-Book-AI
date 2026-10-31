-- ============================================
-- QUICK REFERENCE: Supabase Migration for Transfer Fields
-- ============================================
-- 
-- COPY-PASTE INTO SUPABASE DASHBOARD > SQL EDITOR
-- ============================================

-- 1. ADD COLUMNS
ALTER TABLE ledger_entries 
ADD COLUMN IF NOT EXISTS transfer_id UUID,
ADD COLUMN IF NOT EXISTS transfer_direction TEXT 
CHECK (transfer_direction IN ('out', 'in', 'out_compensation', 'in_compensation'));

-- 2. ADD INDEX
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transfer_id 
ON ledger_entries(transfer_id);

-- 3. VERIFY
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ledger_entries' 
  AND column_name IN ('transfer_id', 'transfer_direction');

-- Should return 2 rows: transfer_id (uuid), transfer_direction (text)