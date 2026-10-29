-- ==============================================================================
-- MIGRATION: Add Variant and Network to Credit Cards Table
-- Allows storing Card Variant (e.g. Pinnacle World, Regalia Gold, Infinia, Coral)
-- and Card Network (e.g. Visa, Mastercard, RuPay, Amex, Diners Club)
-- ==============================================================================

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS variant TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS network TEXT DEFAULT 'visa';
