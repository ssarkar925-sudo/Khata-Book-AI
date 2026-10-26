-- ============================================================================
-- KHATA BOOK AI — CLEAN SUPABASE CLOUD DATABASE SCHEMA
-- Zero Legacy, Normalized Architecture with Row Level Security (RLS)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Personal Khata & Records',
    currency TEXT NOT NULL DEFAULT 'INR',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
    due_date TIMESTAMPTZ NOT NULL,
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
    created_by UUID NOT NULL REFERENCES auth.users(id),
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

-- 9. ZERO-KNOWLEDGE ENCRYPTED VAULT (Passwords & Personal Documents)
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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict isolation: users only see and manage their own workspaces & records
-- ============================================================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- Workspaces Policy
CREATE POLICY "Users can manage their own workspaces"
    ON public.workspaces FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Child Table Helper: workspace member check
CREATE OR REPLACE FUNCTION public.check_user_workspace(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = ws_id AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for Child Tables
CREATE POLICY "Workspace isolation for cash_locations" ON public.cash_locations FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

CREATE POLICY "Workspace isolation for customers" ON public.customers FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

CREATE POLICY "Workspace isolation for people_dues" ON public.people_dues FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

CREATE POLICY "Workspace isolation for cards" ON public.cards FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

CREATE POLICY "Workspace isolation for categories" ON public.categories FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

CREATE POLICY "Workspace isolation for ledger_entries" ON public.ledger_entries FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

CREATE POLICY "Workspace isolation for notes" ON public.notes FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

CREATE POLICY "Workspace isolation for vault_items" ON public.vault_items FOR ALL
    USING (check_user_workspace(workspace_id)) WITH CHECK (check_user_workspace(workspace_id));

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_entries, public.people_dues, public.cash_locations, public.cards, public.notes;
