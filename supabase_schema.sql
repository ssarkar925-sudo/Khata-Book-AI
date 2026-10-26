-- ============================================================================
-- RECORD BOOK — SUPABASE CLOUD DATABASE SCHEMA
-- Hybrid Offline-First & Real-time Multi-Device Sync Architecture
-- Compatible with Bypassed Auth (Guest Mode) & Future Cloud Auth
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Primary Record Book',
    currency TEXT NOT NULL DEFAULT 'INR',
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. CASH & BANK ACCOUNTS (Multiple Banks: SBI, HDFC, Cash Drawers, Wallets)
CREATE TABLE IF NOT EXISTS public.cash_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0, -- Stored in Paise
    is_default BOOLEAN NOT NULL DEFAULT false,
    gradient TEXT,
    icon_color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- 3. CUSTOMERS & SUPPLIERS (People for Udhar Khata)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    type TEXT NOT NULL DEFAULT 'customer' CHECK (type IN ('customer', 'supplier')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- 4. PEOPLE DUES (Udhar / Credit Tracking with WhatsApp reminders)
CREATE TABLE IF NOT EXISTS public.people_dues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('you_will_get', 'you_will_give')),
    amount BIGINT NOT NULL, -- Stored in Paise
    due_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- 5. CREDIT CARDS & BILLING
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bank TEXT NOT NULL,
    last4 TEXT NOT NULL CHECK (length(last4) = 4),
    credit_limit BIGINT NOT NULL DEFAULT 0, -- Stored in Paise
    statement_day INT NOT NULL DEFAULT 1 CHECK (statement_day BETWEEN 1 AND 31),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- 6. EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense',
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- 7. FINANCIAL LEDGER ENTRIES (Double-Entry Financial Journal)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'expense', 'bill_payment', 'card_spend')),
    amount BIGINT NOT NULL, -- Stored in Paise
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    cash_location_id UUID REFERENCES public.cash_locations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
    mode TEXT NOT NULL DEFAULT 'cash' CHECK (mode IN ('cash', 'upi', 'bank', 'card')),
    note TEXT,
    entry_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    idempotency_key TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- 8. DAILY NOTES & CHECKLISTS
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    color TEXT DEFAULT '#EEF2FF',
    tags TEXT[] DEFAULT '{}',
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    checklist_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- 9. SHEETS & DOCUMENT REGISTERS (Spreadsheets / Multi-sheet registers)
CREATE TABLE IF NOT EXISTS public.sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT,
    color TEXT,
    columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 10. ZERO-KNOWLEDGE ENCRYPTED VAULT (Passwords & Documents)
CREATE TABLE IF NOT EXISTS public.vault_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'password',
    username TEXT,
    encrypted_password TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- DEFAULT INITIAL SEED DATA (For seamless instant boot)
-- ============================================================================

INSERT INTO public.workspaces (id, name, currency)
VALUES ('00000000-0000-0000-0000-000000000010', 'Primary Record Book', 'INR')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cash_locations (id, workspace_id, name, balance, is_default, gradient, icon_color)
VALUES 
    ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', 'Physical Cash Drawer', 1500000, true, 'from-amber-500/20 via-orange-500/10 to-transparent', 'bg-amber-500 text-white'),
    ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000010', 'SBI Savings Account', 4500000, false, 'from-blue-600/20 via-cyan-500/10 to-transparent', 'bg-blue-600 text-white'),
    ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000010', 'HDFC Business Current', 8200000, false, 'from-indigo-600/20 via-purple-500/10 to-transparent', 'bg-indigo-600 text-white')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Permissive for Guest Mode; Automatically Enforces Auth when Logged In
-- ============================================================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- Dynamic Workspace Policy
DROP POLICY IF EXISTS "Workspaces access policy" ON public.workspaces;
CREATE POLICY "Workspaces access policy" ON public.workspaces FOR ALL
    USING (auth.uid() IS NULL OR owner_id IS NULL OR owner_id = auth.uid())
    WITH CHECK (auth.uid() IS NULL OR owner_id IS NULL OR owner_id = auth.uid());

-- Child Table Helper
CREATE OR REPLACE FUNCTION public.check_user_workspace(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.uid() IS NULL
        OR EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE id = ws_id AND (owner_id IS NULL OR owner_id = auth.uid())
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for Child Tables
DROP POLICY IF EXISTS "Cash locations access policy" ON public.cash_locations;
CREATE POLICY "Cash locations access policy" ON public.cash_locations FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

DROP POLICY IF EXISTS "Customers access policy" ON public.customers;
CREATE POLICY "Customers access policy" ON public.customers FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

DROP POLICY IF EXISTS "People dues access policy" ON public.people_dues;
CREATE POLICY "People dues access policy" ON public.people_dues FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

DROP POLICY IF EXISTS "Cards access policy" ON public.cards;
CREATE POLICY "Cards access policy" ON public.cards FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

DROP POLICY IF EXISTS "Categories access policy" ON public.categories;
CREATE POLICY "Categories access policy" ON public.categories FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

DROP POLICY IF EXISTS "Ledger entries access policy" ON public.ledger_entries;
CREATE POLICY "Ledger entries access policy" ON public.ledger_entries FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

DROP POLICY IF EXISTS "Notes access policy" ON public.notes;
CREATE POLICY "Notes access policy" ON public.notes FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

DROP POLICY IF EXISTS "Sheets access policy" ON public.sheets;
CREATE POLICY "Sheets access policy" ON public.sheets FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

DROP POLICY IF EXISTS "Vault items access policy" ON public.vault_items;
CREATE POLICY "Vault items access policy" ON public.vault_items FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

-- ============================================================================
-- SUPABASE REALTIME REPLICATION
-- ============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.people_dues;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_entries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sheets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- REPLICA IDENTITY FULL (Ensures Full Record Broadcast on Updates/Deletes)
-- ============================================================================
ALTER TABLE public.workspaces REPLICA IDENTITY FULL;
ALTER TABLE public.cash_locations REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.people_dues REPLICA IDENTITY FULL;
ALTER TABLE public.cards REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_entries REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.sheets REPLICA IDENTITY FULL;
ALTER TABLE public.vault_items REPLICA IDENTITY FULL;

-- Optional columns for Billed & Unbilled system
ALTER TABLE public.ledger_entries ADD COLUMN IF NOT EXISTS is_billed BOOLEAN DEFAULT NULL;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS due_day INT DEFAULT 5;
