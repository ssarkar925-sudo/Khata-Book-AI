-- ==============================================================================
-- MIGRATION: Add Persistent Notes / Remarks to Cards and Cash Locations
-- Ensures user remarks on bank accounts and credit cards are preserved in PostgreSQL
-- ==============================================================================

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.cash_locations ADD COLUMN IF NOT EXISTS notes TEXT;
