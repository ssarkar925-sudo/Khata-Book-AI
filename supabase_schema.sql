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
    scope TEXT NOT NULL DEFAULT 'business' CHECK (scope IN ('business', 'personal', 'family')),
    account_type TEXT DEFAULT 'savings',
    bank_name TEXT,
    account_number_last4 TEXT,
    ifsc TEXT,
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
    scope TEXT NOT NULL DEFAULT 'business' CHECK (scope IN ('business', 'personal', 'family')),
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
    scope TEXT NOT NULL DEFAULT 'business' CHECK (scope IN ('business', 'personal', 'family')),
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
    due_day INT NOT NULL DEFAULT 5 CHECK (due_day BETWEEN 1 AND 31),
    is_active BOOLEAN NOT NULL DEFAULT true,
    scope TEXT NOT NULL DEFAULT 'business' CHECK (scope IN ('business', 'personal', 'family')),
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
    scope TEXT NOT NULL DEFAULT 'business' CHECK (scope IN ('business', 'personal', 'family')),
    note TEXT,
    entry_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    is_billed BOOLEAN DEFAULT NULL,
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

-- Workspace Members
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Add member_email column if missing
DO $$
BEGIN
    ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS member_email TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
-- ROLE PERMISSION HELPERS (SECURITY DEFINER with safe search_path)
-- ============================================================================

-- 1. Check if user is the direct owner of the workspace
CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = ws_id AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- 2. Read permission: Owner or any workspace member (owner, admin, member, viewer)
CREATE OR REPLACE FUNCTION public.check_user_workspace_read(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = ws_id AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- 3. Write permission: Owner, Admin, or Member. Viewer is strictly excluded!
CREATE OR REPLACE FUNCTION public.check_user_workspace_write(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = ws_id AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- 4. Admin permission: Owner or Admin
CREATE OR REPLACE FUNCTION public.check_user_workspace_admin(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = ws_id AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- 5. Backward compatibility for legacy check_user_workspace calls
CREATE OR REPLACE FUNCTION public.check_user_workspace(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.check_user_workspace_read(ws_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- ============================================================================
-- WORKSPACES RLS POLICIES
-- ============================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspaces access policy" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces select policy" ON public.workspaces;
CREATE POLICY "Workspaces select policy" ON public.workspaces FOR SELECT
    USING (public.check_user_workspace_read(id));

DROP POLICY IF EXISTS "Workspaces insert policy" ON public.workspaces;
CREATE POLICY "Workspaces insert policy" ON public.workspaces FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS "Workspaces update policy" ON public.workspaces;
CREATE POLICY "Workspaces update policy" ON public.workspaces FOR UPDATE
    USING (
        auth.uid() IS NOT NULL AND (
            owner_id = auth.uid() OR public.check_user_workspace_admin(id)
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            (owner_id = auth.uid()) OR
            (public.check_user_workspace_admin(id) AND owner_id = (SELECT w.owner_id FROM public.workspaces w WHERE w.id = id))
        )
    );

DROP POLICY IF EXISTS "Workspaces delete policy" ON public.workspaces;
CREATE POLICY "Workspaces delete policy" ON public.workspaces FOR DELETE
    USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- ============================================================================
-- WORKSPACE MEMBERS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Workspace members select policy" ON public.workspace_members;
CREATE POLICY "Workspace members select policy" ON public.workspace_members FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR public.check_user_workspace_read(workspace_id)
        )
    );

DROP POLICY IF EXISTS "Workspace members insert policy" ON public.workspace_members;
CREATE POLICY "Workspace members insert policy" ON public.workspace_members FOR INSERT
    WITH CHECK (
        public.check_user_workspace_admin(workspace_id)
        AND role IN ('admin', 'member', 'viewer')
        AND user_id <> (SELECT w.owner_id FROM public.workspaces w WHERE w.id = workspace_id)
    );

DROP POLICY IF EXISTS "Workspace members update policy" ON public.workspace_members;
CREATE POLICY "Workspace members update policy" ON public.workspace_members FOR UPDATE
    USING (
        public.check_user_workspace_admin(workspace_id)
        AND user_id <> (SELECT w.owner_id FROM public.workspaces w WHERE w.id = workspace_id)
        AND (
            public.is_workspace_owner(workspace_id)
            OR (
                public.check_user_workspace_admin(workspace_id)
                AND (SELECT m.role FROM public.workspace_members m WHERE m.id = id) IN ('member', 'viewer')
            )
        )
    )
    WITH CHECK (
        role IN ('admin', 'member', 'viewer')
        AND (
            public.is_workspace_owner(workspace_id)
            OR (
                public.check_user_workspace_admin(workspace_id)
                AND role IN ('member', 'viewer')
            )
        )
    );

DROP POLICY IF EXISTS "Workspace members delete policy" ON public.workspace_members;
CREATE POLICY "Workspace members delete policy" ON public.workspace_members FOR DELETE
    USING (
        -- User can leave their own membership (unless owner)
        (
            user_id = auth.uid()
            AND NOT public.is_workspace_owner(workspace_id)
        )
        OR
        -- Owner can delete any non-owner member
        (
            public.is_workspace_owner(workspace_id)
            AND user_id <> (SELECT w.owner_id FROM public.workspaces w WHERE w.id = workspace_id)
        )
        OR
        -- Admin can delete members or viewers
        (
            public.check_user_workspace_admin(workspace_id)
            AND role IN ('member', 'viewer')
            AND user_id <> (SELECT w.owner_id FROM public.workspaces w WHERE w.id = workspace_id)
        )
    );

-- ============================================================================
-- FINANCIAL TABLES RLS POLICIES (Viewer is Read-Only, Member has CRUD)
-- ============================================================================

-- 1. Cash locations
DROP POLICY IF EXISTS "Cash locations access policy" ON public.cash_locations;
DROP POLICY IF EXISTS "Cash locations select policy" ON public.cash_locations;
DROP POLICY IF EXISTS "Cash locations insert policy" ON public.cash_locations;
DROP POLICY IF EXISTS "Cash locations update policy" ON public.cash_locations;
DROP POLICY IF EXISTS "Cash locations delete policy" ON public.cash_locations;
CREATE POLICY "Cash locations select policy" ON public.cash_locations FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "Cash locations insert policy" ON public.cash_locations FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Cash locations update policy" ON public.cash_locations FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Cash locations delete policy" ON public.cash_locations FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

-- 2. Customers
DROP POLICY IF EXISTS "Customers access policy" ON public.customers;
DROP POLICY IF EXISTS "Customers select policy" ON public.customers;
DROP POLICY IF EXISTS "Customers insert policy" ON public.customers;
DROP POLICY IF EXISTS "Customers update policy" ON public.customers;
DROP POLICY IF EXISTS "Customers delete policy" ON public.customers;
CREATE POLICY "Customers select policy" ON public.customers FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "Customers insert policy" ON public.customers FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Customers update policy" ON public.customers FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Customers delete policy" ON public.customers FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

-- 3. People dues
DROP POLICY IF EXISTS "People dues access policy" ON public.people_dues;
DROP POLICY IF EXISTS "People dues select policy" ON public.people_dues;
DROP POLICY IF EXISTS "People dues insert policy" ON public.people_dues;
DROP POLICY IF EXISTS "People dues update policy" ON public.people_dues;
DROP POLICY IF EXISTS "People dues delete policy" ON public.people_dues;
CREATE POLICY "People dues select policy" ON public.people_dues FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "People dues insert policy" ON public.people_dues FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "People dues update policy" ON public.people_dues FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "People dues delete policy" ON public.people_dues FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

-- 4. Cards
DROP POLICY IF EXISTS "Cards access policy" ON public.cards;
DROP POLICY IF EXISTS "Cards select policy" ON public.cards;
DROP POLICY IF EXISTS "Cards insert policy" ON public.cards;
DROP POLICY IF EXISTS "Cards update policy" ON public.cards;
DROP POLICY IF EXISTS "Cards delete policy" ON public.cards;
CREATE POLICY "Cards select policy" ON public.cards FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "Cards insert policy" ON public.cards FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Cards update policy" ON public.cards FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Cards delete policy" ON public.cards FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

-- 5. Categories
DROP POLICY IF EXISTS "Categories access policy" ON public.categories;
DROP POLICY IF EXISTS "Categories select policy" ON public.categories;
DROP POLICY IF EXISTS "Categories insert policy" ON public.categories;
DROP POLICY IF EXISTS "Categories update policy" ON public.categories;
DROP POLICY IF EXISTS "Categories delete policy" ON public.categories;
CREATE POLICY "Categories select policy" ON public.categories FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "Categories insert policy" ON public.categories FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Categories update policy" ON public.categories FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Categories delete policy" ON public.categories FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

-- 6. Ledger entries
DROP POLICY IF EXISTS "Ledger entries access policy" ON public.ledger_entries;
DROP POLICY IF EXISTS "Ledger entries select policy" ON public.ledger_entries;
DROP POLICY IF EXISTS "Ledger entries insert policy" ON public.ledger_entries;
DROP POLICY IF EXISTS "Ledger entries update policy" ON public.ledger_entries;
DROP POLICY IF EXISTS "Ledger entries delete policy" ON public.ledger_entries;
CREATE POLICY "Ledger entries select policy" ON public.ledger_entries FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "Ledger entries insert policy" ON public.ledger_entries FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Ledger entries update policy" ON public.ledger_entries FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Ledger entries delete policy" ON public.ledger_entries FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

-- 7. Notes
DROP POLICY IF EXISTS "Notes access policy" ON public.notes;
DROP POLICY IF EXISTS "Notes select policy" ON public.notes;
DROP POLICY IF EXISTS "Notes insert policy" ON public.notes;
DROP POLICY IF EXISTS "Notes update policy" ON public.notes;
DROP POLICY IF EXISTS "Notes delete policy" ON public.notes;
CREATE POLICY "Notes select policy" ON public.notes FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "Notes insert policy" ON public.notes FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Notes update policy" ON public.notes FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Notes delete policy" ON public.notes FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

-- 8. Sheets
DROP POLICY IF EXISTS "Sheets access policy" ON public.sheets;
DROP POLICY IF EXISTS "Sheets select policy" ON public.sheets;
DROP POLICY IF EXISTS "Sheets insert policy" ON public.sheets;
DROP POLICY IF EXISTS "Sheets update policy" ON public.sheets;
DROP POLICY IF EXISTS "Sheets delete policy" ON public.sheets;
CREATE POLICY "Sheets select policy" ON public.sheets FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "Sheets insert policy" ON public.sheets FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Sheets update policy" ON public.sheets FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Sheets delete policy" ON public.sheets FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

-- 9. Vault items
DROP POLICY IF EXISTS "Vault items access policy" ON public.vault_items;
DROP POLICY IF EXISTS "Vault items select policy" ON public.vault_items;
DROP POLICY IF EXISTS "Vault items insert policy" ON public.vault_items;
DROP POLICY IF EXISTS "Vault items update policy" ON public.vault_items;
DROP POLICY IF EXISTS "Vault items delete policy" ON public.vault_items;
CREATE POLICY "Vault items select policy" ON public.vault_items FOR SELECT
    USING (public.check_user_workspace_read(workspace_id));
CREATE POLICY "Vault items insert policy" ON public.vault_items FOR INSERT
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Vault items update policy" ON public.vault_items FOR UPDATE
    USING (public.check_user_workspace_write(workspace_id))
    WITH CHECK (public.check_user_workspace_write(workspace_id));
CREATE POLICY "Vault items delete policy" ON public.vault_items FOR DELETE
    USING (public.check_user_workspace_write(workspace_id));

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

-- Idempotency Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency 
ON public.ledger_entries(workspace_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Atomic RPC: Write Ledger Entry & Adjust Balance in Single ACID Transaction
CREATE OR REPLACE FUNCTION public.record_ledger_entry_and_update_balance(
    p_entry jsonb
)
RETURNS jsonb AS $$
DECLARE
    v_entry_id UUID;
    v_workspace_id UUID;
    v_location_id UUID;
    v_type TEXT;
    v_amount BIGINT;
    v_idempotency_key TEXT;
    v_existing_id UUID;
    v_delta BIGINT := 0;
    v_new_balance BIGINT := 0;
    v_result jsonb;
BEGIN
    v_workspace_id := (p_entry->>'workspace_id')::UUID;
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace ID is required';
    END IF;

    -- Strict WRITE authorization check (Viewer is rejected)
    IF NOT public.check_user_workspace_write(v_workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: User does not have write access to workspace %', v_workspace_id;
    END IF;

    -- Check idempotency
    v_idempotency_key := p_entry->>'idempotency_key';
    IF v_idempotency_key IS NOT NULL AND v_idempotency_key <> '' THEN
        SELECT id INTO v_existing_id
        FROM public.ledger_entries
        WHERE workspace_id = v_workspace_id AND idempotency_key = v_idempotency_key
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            SELECT to_jsonb(l.*) INTO v_result
            FROM public.ledger_entries l
            WHERE id = v_existing_id;
            RETURN jsonb_build_object('status', 'duplicate_ignored', 'entry', v_result);
        END IF;
    END IF;

    v_entry_id := COALESCE((p_entry->>'id')::UUID, uuid_generate_v4());
    v_type := p_entry->>'type';
    v_amount := (p_entry->>'amount')::BIGINT;
    v_location_id := (p_entry->>'cash_location_id')::UUID;

    -- Insert ledger entry
    INSERT INTO public.ledger_entries (
        id,
        workspace_id,
        type,
        amount,
        category_id,
        cash_location_id,
        customer_id,
        card_id,
        mode,
        scope,
        note,
        entry_date,
        is_billed,
        idempotency_key,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        v_entry_id,
        v_workspace_id,
        v_type,
        v_amount,
        (p_entry->>'category_id')::UUID,
        v_location_id,
        (p_entry->>'customer_id')::UUID,
        (p_entry->>'card_id')::UUID,
        COALESCE(p_entry->>'mode', 'cash'),
        COALESCE(p_entry->>'scope', 'business'),
        p_entry->>'note',
        COALESCE((p_entry->>'entry_date')::TIMESTAMPTZ, timezone('utc', now())),
        (p_entry->>'is_billed')::BOOLEAN,
        v_idempotency_key,
        auth.uid(),
        timezone('utc', now()),
        timezone('utc', now())
    );

    -- Atomically update linked cash_location balance
    IF v_location_id IS NOT NULL THEN
        IF v_type = 'cash_in' THEN
            v_delta := v_amount;
        ELSIF v_type IN ('cash_out', 'expense', 'bill_payment') THEN
            v_delta := -v_amount;
        END IF;

        IF v_delta <> 0 THEN
            UPDATE public.cash_locations
            SET balance = balance + v_delta,
                updated_at = timezone('utc', now())
            WHERE id = v_location_id AND workspace_id = v_workspace_id
            RETURNING balance INTO v_new_balance;
        END IF;
    END IF;

    SELECT to_jsonb(l.*) INTO v_result
    FROM public.ledger_entries l
    WHERE id = v_entry_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'entry', v_result,
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Atomic Due Settlement RPC
CREATE OR REPLACE FUNCTION public.settle_due_atomically(
    p_due_id UUID,
    p_paid_amount BIGINT,
    p_ledger_entry jsonb
)
RETURNS jsonb AS $$
DECLARE
    v_due RECORD;
    v_new_amount BIGINT;
    v_new_status TEXT;
    v_ledger_result jsonb;
BEGIN
    SELECT * INTO v_due
    FROM public.people_dues
    WHERE id = p_due_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Due not found with id %', p_due_id;
    END IF;

    -- Strict WRITE authorization check (Viewer is rejected)
    IF NOT public.check_user_workspace_write(v_due.workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: User does not have write access to workspace %', v_due.workspace_id;
    END IF;

    v_ledger_result := public.record_ledger_entry_and_update_balance(p_ledger_entry);

    IF p_paid_amount >= v_due.amount THEN
        v_new_amount := 0;
        v_new_status := 'settled';
    ELSE
        v_new_amount := v_due.amount - p_paid_amount;
        v_new_status := 'pending';
    END IF;

    UPDATE public.people_dues
    SET amount = v_new_amount,
        status = v_new_status,
        updated_at = timezone('utc', now())
    WHERE id = p_due_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'due_id', p_due_id,
        'new_due_status', v_new_status,
        'new_due_amount', v_new_amount,
        'ledger_result', v_ledger_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Add is_default column if missing
DO $$
BEGIN
    ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Database-backed uniqueness guarantee: only one default workspace per owner
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner_default 
ON public.workspaces(owner_id) 
WHERE is_default = true;

-- Helper RPC: Concurrency-Safe Workspace Provisioning
CREATE OR REPLACE FUNCTION public.get_or_create_default_workspace()
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_ws RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Concurrency Lock: Transaction-level advisory lock serializes workspace initialization per user
    PERFORM pg_advisory_xact_lock(hashtext('workspace_prov_' || v_user_id::text));

    -- 1. Check if user already owns any workspace (default or regular)
    SELECT w.* INTO v_ws
    FROM public.workspaces w
    WHERE w.owner_id = v_user_id
    ORDER BY (w.is_default IS TRUE) DESC, w.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN to_jsonb(v_ws);
    END IF;

    -- 2. Preserve existing membership: if user is already a member of another workspace, return that workspace
    -- DO NOT create an unnecessary owned workspace if the user is already collaborating!
    SELECT w.* INTO v_ws
    FROM public.workspaces w
    JOIN public.workspace_members m ON m.workspace_id = w.id
    WHERE m.user_id = v_user_id
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN to_jsonb(v_ws);
    END IF;

    -- 3. Check if user has pending invitations by email in workspace_members
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    IF v_user_email IS NOT NULL AND v_user_email <> '' THEN
        -- Claim pending invitation
        UPDATE public.workspace_members
        SET user_id = v_user_id
        WHERE member_email = lower(v_user_email) AND user_id <> v_user_id;

        SELECT w.* INTO v_ws
        FROM public.workspaces w
        JOIN public.workspace_members m ON m.workspace_id = w.id
        WHERE m.user_id = v_user_id
        ORDER BY m.created_at ASC
        LIMIT 1;

        IF FOUND THEN
            RETURN to_jsonb(v_ws);
        END IF;
    END IF;

    -- 4. User neither owns any workspace nor is a member of any workspace.
    -- Atomically insert exactly one default workspace with ON CONFLICT guard.
    INSERT INTO public.workspaces (name, currency, owner_id, is_default)
    VALUES ('Personal Record Book', 'INR', v_user_id, true)
    ON CONFLICT (owner_id) WHERE is_default = true
    DO NOTHING
    RETURNING * INTO v_ws;

    -- If concurrent insert succeeded in another transaction before lock, select it
    IF v_ws IS NULL THEN
        SELECT w.* INTO v_ws
        FROM public.workspaces w
        WHERE w.owner_id = v_user_id AND w.is_default = true
        LIMIT 1;
    END IF;

    RETURN to_jsonb(v_ws);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
