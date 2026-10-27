-- ============================================================================
-- ALL-IN-ONE FIX: AUTH RECURSION, USER CONFIRMATION & PASSWORD SET
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- Step 1: Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Auto-confirm all users and sync password for saikat@sc.in
UPDATE auth.users
SET 
    encrypted_password = crypt('Saikat925@', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'saikat@sc.in';

-- Confirm any other user accounts
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- Step 3: Fix Workspaces RLS: Non-recursive SELECT policy (solves 42P17 recursion)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspaces select policy" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces access policy" ON public.workspaces;
CREATE POLICY "Workspaces select policy" ON public.workspaces FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            owner_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.workspace_members
                WHERE workspace_id = workspaces.id AND user_id = auth.uid()
            )
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

-- Step 4: Fix Workspace Members RLS: Non-recursive SELECT policy
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members select policy" ON public.workspace_members;
CREATE POLICY "Workspace members select policy" ON public.workspace_members FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.workspaces
                WHERE id = workspace_members.workspace_id AND owner_id = auth.uid()
            )
        )
    );

-- Step 5: Replace get_or_create_default_workspace with hardened zero-dependency version
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

    -- Concurrency Lock: Transaction-level advisory lock per user
    PERFORM pg_advisory_xact_lock(hashtext('workspace_prov_' || v_user_id::text));

    -- 1. Check if user already owns any workspace
    SELECT w.* INTO v_ws
    FROM public.workspaces w
    WHERE w.owner_id = v_user_id
    ORDER BY (w.is_default IS TRUE) DESC, w.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN to_jsonb(v_ws);
    END IF;

    -- 2. Member check
    SELECT w.* INTO v_ws
    FROM public.workspaces w
    JOIN public.workspace_members m ON m.workspace_id = w.id
    WHERE m.user_id = v_user_id
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN to_jsonb(v_ws);
    END IF;

    -- 3. Claim pending invitation if email matches JWT session
    v_user_email := auth.jwt() ->> 'email';
    IF v_user_email IS NOT NULL AND v_user_email <> '' THEN
        UPDATE public.workspace_members
        SET user_id = v_user_id
        WHERE member_email = lower(v_user_email) AND user_id <> v_user_id;

        SELECT w.* INTO v_ws
        FROM public.workspaces w
        JOIN public.workspace_members m ON m.workspace_id = w.id
        WHERE m.user_id = v_user_id
        LIMIT 1;

        IF FOUND THEN
            RETURN to_jsonb(v_ws);
        END IF;
    END IF;

    -- 4. Atomically insert exactly one default workspace
    INSERT INTO public.workspaces (name, currency, owner_id, is_default)
    VALUES ('Personal Record Book', 'INR', v_user_id, true)
    ON CONFLICT (owner_id) WHERE is_default = true
    DO NOTHING
    RETURNING * INTO v_ws;

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

-- Step 6: Grant Execution Permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_default_workspace() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_user_workspace_read(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_user_workspace_write(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_user_workspace_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_ledger_entry_and_update_balance(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_due_atomically(UUID, BIGINT, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_historical_ledger_entry(jsonb) TO authenticated, service_role;

-- Step 7: Output users list to verify email and confirmed status
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users;
