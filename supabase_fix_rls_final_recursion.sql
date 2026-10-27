-- ============================================================================
-- FINAL RLS RECURSION FIX (Zero Recursion with row_security = off)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Helper with row_security = off to check membership without triggering workspace_members RLS
CREATE OR REPLACE FUNCTION public.check_user_is_member(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off;

-- 2. Helper with row_security = off to check ownership without triggering workspaces RLS
CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = p_workspace_id AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off;

-- 3. Workspaces SELECT policy (Safe & non-recursive)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspaces select policy" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces access policy" ON public.workspaces;
CREATE POLICY "Workspaces select policy" ON public.workspaces FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            owner_id = auth.uid() OR
            public.check_user_is_member(id)
        )
    );

-- 4. Workspace Members SELECT policy (Safe & non-recursive)
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members select policy" ON public.workspace_members;
CREATE POLICY "Workspace members select policy" ON public.workspace_members FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR
            public.is_workspace_owner(workspace_id)
        )
    );

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_user_is_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(UUID) TO authenticated, service_role;
