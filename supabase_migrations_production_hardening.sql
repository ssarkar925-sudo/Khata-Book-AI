-- ============================================================================
-- RECORD BOOK AI — PRODUCTION HARDENING & SECURITY MIGRATION
-- Idempotent Migration: RLS Enforcement, Scope Column Additions,
-- Atomic Financial Transactions, and Idempotency Constraints
-- ============================================================================

-- 1. ADD REQUIRED 'scope' AND FINANCE COLUMNS TO ALL TABLES
-- ----------------------------------------------------------------------------
-- Cash Locations (Accounts)
ALTER TABLE public.cash_locations ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'business';
DO $$ BEGIN
    ALTER TABLE public.cash_locations ADD CONSTRAINT chk_cash_locations_scope CHECK (scope IN ('business', 'personal', 'family'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cash_locations ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'savings';
ALTER TABLE public.cash_locations ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.cash_locations ADD COLUMN IF NOT EXISTS account_number_last4 TEXT;
ALTER TABLE public.cash_locations ADD COLUMN IF NOT EXISTS ifsc TEXT;

-- Customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'business';
DO $$ BEGIN
    ALTER TABLE public.customers ADD CONSTRAINT chk_customers_scope CHECK (scope IN ('business', 'personal', 'family'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- People Dues
ALTER TABLE public.people_dues ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'business';
DO $$ BEGIN
    ALTER TABLE public.people_dues ADD CONSTRAINT chk_people_dues_scope CHECK (scope IN ('business', 'personal', 'family'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cards
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'business';
DO $$ BEGIN
    ALTER TABLE public.cards ADD CONSTRAINT chk_cards_scope CHECK (scope IN ('business', 'personal', 'family'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS due_day INT DEFAULT 5;

-- Ledger Entries
ALTER TABLE public.ledger_entries ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'business';
DO $$ BEGIN
    ALTER TABLE public.ledger_entries ADD CONSTRAINT chk_ledger_entries_scope CHECK (scope IN ('business', 'personal', 'family'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.ledger_entries ADD COLUMN IF NOT EXISTS is_billed BOOLEAN DEFAULT NULL;
ALTER TABLE public.ledger_entries ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Sheets
ALTER TABLE public.sheets ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'business';
DO $$ BEGIN
    ALTER TABLE public.sheets ADD CONSTRAINT chk_sheets_scope CHECK (scope IN ('business', 'personal', 'family'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.sheets ADD COLUMN IF NOT EXISTS frozen_row_count INT DEFAULT 0;
ALTER TABLE public.sheets ADD COLUMN IF NOT EXISTS row_height TEXT DEFAULT 'normal';
ALTER TABLE public.sheets ADD COLUMN IF NOT EXISTS show_gridlines BOOLEAN DEFAULT true;

-- 2. IDEMPOTENCY CONSTRAINT ON LEDGER ENTRIES
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency 
ON public.ledger_entries(workspace_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 3. WORKSPACE MEMBERSHIP TABLE (Multi-user & ownership support)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 4. STRICT ROW LEVEL SECURITY (RLS) FUNCTIONS AND POLICIES
-- Prohibits unauthenticated/anonymous access across all tables
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_user_workspace(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Strict security: anonymous / unauthenticated users are rejected
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Workspaces Policies
DROP POLICY IF EXISTS "Workspaces access policy" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces select policy" ON public.workspaces;
CREATE POLICY "Workspaces select policy" ON public.workspaces FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            owner_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = id AND user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Workspaces insert policy" ON public.workspaces;
CREATE POLICY "Workspaces insert policy" ON public.workspaces FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS "Workspaces update policy" ON public.workspaces;
CREATE POLICY "Workspaces update policy" ON public.workspaces FOR UPDATE
    USING (auth.uid() IS NOT NULL AND owner_id = auth.uid())
    WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS "Workspaces delete policy" ON public.workspaces;
CREATE POLICY "Workspaces delete policy" ON public.workspaces FOR DELETE
    USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Workspace Members Policy
DROP POLICY IF EXISTS "Workspace members select policy" ON public.workspace_members;
CREATE POLICY "Workspace members select policy" ON public.workspace_members FOR SELECT
    USING (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR check_user_workspace(workspace_id)));

-- Child Tables Policies
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

-- 5. ATOMIC DATABASE RPC: Write Ledger Entry & Adjust Balance in Single Transaction
-- ----------------------------------------------------------------------------
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
    IF NOT public.check_user_workspace(v_workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: user does not have access to workspace %', v_workspace_id;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ATOMIC DUE SETTLEMENT RPC
-- ----------------------------------------------------------------------------
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

    IF NOT public.check_user_workspace(v_due.workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: user does not have access to workspace %', v_due.workspace_id;
    END IF;

    -- Record ledger entry atomically
    v_ledger_result := public.record_ledger_entry_and_update_balance(p_ledger_entry);

    -- Update Due
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
