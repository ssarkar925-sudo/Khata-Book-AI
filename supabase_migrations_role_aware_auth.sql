-- ============================================================================
-- RECORD BOOK — MIGRATION: ROLE-AWARE WORKSPACE MEMBERSHIP & SECURE AUTH
-- ============================================================================
-- 1. Enforces strict authentication (no anonymous access)
-- 2. Implements role-aware workspace membership (owner, admin, member, viewer)
-- 3. Viewer role is strictly read-only across all financial tables
-- 4. Owners cannot be removed or demoted; admins cannot alter owner protections
-- 5. Atomic RPCs (record_ledger_entry_and_update_balance, settle_due_atomically)
--    enforce write permissions with explicit search_path
-- 6. Helper function to safely auto-provision exactly one owned workspace per user
-- ============================================================================

-- Workspace Members Table (Ensure exists with proper constraints)
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_email TEXT,
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

-- Helper macro applied to all 9 financial entities:
-- 1. cash_locations
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

-- 2. customers
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

-- 3. people_dues
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

-- 4. cards
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

-- 5. categories
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

-- 6. ledger_entries
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

-- 7. notes
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

-- 8. sheets
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

-- 9. vault_items
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
-- HARDENED RPC: Write Ledger Entry & Adjust Balance in Single ACID Transaction
-- ============================================================================
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

    -- Check idempotency key to prevent double posting
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

    -- Atomically adjust linked cash_location balance
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

-- ============================================================================
-- HARDENED RPC: Atomic Due Settlement
-- ============================================================================
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

-- ============================================================================
-- HELPER RPC: Safely Auto-Provision Exactly One Workspace for Authenticated User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_default_workspace()
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_ws RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 1. Check if user already owns any workspace
    SELECT w.* INTO v_ws
    FROM public.workspaces w
    WHERE w.owner_id = v_user_id
    ORDER BY w.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN to_jsonb(v_ws);
    END IF;

    -- 2. Check if user belongs to any workspace as a member
    SELECT w.* INTO v_ws
    FROM public.workspaces w
    JOIN public.workspace_members m ON m.workspace_id = w.id
    WHERE m.user_id = v_user_id
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN to_jsonb(v_ws);
    END IF;

    -- 3. If none exists, create exactly one workspace owned by the authenticated user
    INSERT INTO public.workspaces (name, currency, owner_id)
    VALUES ('Personal Record Book', 'INR', v_user_id)
    RETURNING * INTO v_ws;

    RETURN to_jsonb(v_ws);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
