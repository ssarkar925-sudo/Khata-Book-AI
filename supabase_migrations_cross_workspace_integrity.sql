-- ============================================================================
-- MIGRATION: CROSS-WORKSPACE REFERENTIAL INTEGRITY (MULTI-TENANT ISOLATION)
-- Idempotent script to enforce tenant boundaries across all relational write paths
-- ============================================================================

-- 1. Trigger function for public.ledger_entries cross-workspace boundary enforcement
CREATE OR REPLACE FUNCTION public.check_ledger_entry_same_workspace()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace ID is required for ledger entries' USING ERRCODE = '23502';
    END IF;

    -- Validate cash_location_id belongs to the same workspace
    IF NEW.cash_location_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.cash_locations
            WHERE id = NEW.cash_location_id AND workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: cash_location % does not belong to workspace %', 
                NEW.cash_location_id, NEW.workspace_id 
                USING ERRCODE = '23503';
        END IF;
    END IF;

    -- Validate customer_id belongs to the same workspace
    IF NEW.customer_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: customer % does not belong to workspace %', 
                NEW.customer_id, NEW.workspace_id 
                USING ERRCODE = '23503';
        END IF;
    END IF;

    -- Validate card_id belongs to the same workspace
    IF NEW.card_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.cards
            WHERE id = NEW.card_id AND workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: card % does not belong to workspace %', 
                NEW.card_id, NEW.workspace_id 
                USING ERRCODE = '23503';
        END IF;
    END IF;

    -- Validate category_id belongs to the same workspace
    IF NEW.category_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.categories
            WHERE id = NEW.category_id AND workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: category % does not belong to workspace %', 
                NEW.category_id, NEW.workspace_id 
                USING ERRCODE = '23503';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Attach trigger to ledger_entries
DROP TRIGGER IF EXISTS trg_ledger_entry_same_workspace ON public.ledger_entries;
CREATE TRIGGER trg_ledger_entry_same_workspace
BEFORE INSERT OR UPDATE ON public.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION public.check_ledger_entry_same_workspace();

-- 2. Trigger function for public.people_dues cross-workspace boundary enforcement
CREATE OR REPLACE FUNCTION public.check_due_same_workspace()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace ID is required for due records' USING ERRCODE = '23502';
    END IF;

    -- Validate customer_id belongs to the same workspace
    IF NEW.customer_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: customer % does not belong to workspace %', 
                NEW.customer_id, NEW.workspace_id 
                USING ERRCODE = '23503';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Attach trigger to people_dues
DROP TRIGGER IF EXISTS trg_due_same_workspace ON public.people_dues;
CREATE TRIGGER trg_due_same_workspace
BEFORE INSERT OR UPDATE ON public.people_dues
FOR EACH ROW
EXECUTE FUNCTION public.check_due_same_workspace();

-- 3. Hardened Atomic RPC: record_ledger_entry_and_update_balance
CREATE OR REPLACE FUNCTION public.record_ledger_entry_and_update_balance(
    p_entry jsonb
)
RETURNS jsonb AS $$
DECLARE
    v_entry_id UUID;
    v_workspace_id UUID;
    v_location_id UUID;
    v_customer_id UUID;
    v_card_id UUID;
    v_category_id UUID;
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
        RAISE EXCEPTION 'Workspace ID is required' USING ERRCODE = '23502';
    END IF;

    -- Strict WRITE authorization check (Viewer is rejected)
    IF NOT public.check_user_workspace_write(v_workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: User does not have write access to workspace %', v_workspace_id
            USING ERRCODE = '42501';
    END IF;

    v_location_id := (p_entry->>'cash_location_id')::UUID;
    v_customer_id := (p_entry->>'customer_id')::UUID;
    v_card_id := (p_entry->>'card_id')::UUID;
    v_category_id := (p_entry->>'category_id')::UUID;

    -- Cross-workspace boundary checks
    IF v_location_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.cash_locations WHERE id = v_location_id AND workspace_id = v_workspace_id) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: cash_location % does not belong to workspace %', 
                v_location_id, v_workspace_id USING ERRCODE = '23503';
        END IF;
    END IF;

    IF v_customer_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer_id AND workspace_id = v_workspace_id) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: customer % does not belong to workspace %', 
                v_customer_id, v_workspace_id USING ERRCODE = '23503';
        END IF;
    END IF;

    IF v_card_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.cards WHERE id = v_card_id AND workspace_id = v_workspace_id) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: card % does not belong to workspace %', 
                v_card_id, v_workspace_id USING ERRCODE = '23503';
        END IF;
    END IF;

    IF v_category_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = v_category_id AND workspace_id = v_workspace_id) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: category % does not belong to workspace %', 
                v_category_id, v_workspace_id USING ERRCODE = '23503';
        END IF;
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
        v_category_id,
        v_location_id,
        v_customer_id,
        v_card_id,
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

-- 4. Hardened Atomic RPC: settle_due_atomically
CREATE OR REPLACE FUNCTION public.settle_due_atomically(
    p_due_id UUID,
    p_paid_amount BIGINT,
    p_ledger_entry jsonb
)
RETURNS jsonb AS $$
DECLARE
    v_due RECORD;
    v_ledger_ws UUID;
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
        RAISE EXCEPTION 'Unauthorized: User does not have write access to workspace %', v_due.workspace_id
            USING ERRCODE = '42501';
    END IF;

    -- Cross-workspace check: p_ledger_entry must target the due's workspace
    v_ledger_ws := (p_ledger_entry->>'workspace_id')::UUID;
    IF v_ledger_ws IS NOT NULL AND v_ledger_ws <> v_due.workspace_id THEN
        RAISE EXCEPTION 'Cross-workspace reference error: ledger entry workspace % does not match due workspace %',
            v_ledger_ws, v_due.workspace_id USING ERRCODE = '23503';
    END IF;

    -- Force ledger entry workspace to due workspace for safety
    p_ledger_entry := jsonb_set(p_ledger_entry, '{workspace_id}', to_jsonb(v_due.workspace_id::text));

    -- If customer_id provided on ledger entry, must match due customer
    IF (p_ledger_entry->>'customer_id') IS NOT NULL AND (p_ledger_entry->>'customer_id')::UUID <> v_due.customer_id THEN
        RAISE EXCEPTION 'Cross-entity reference error: ledger customer % does not match due customer %',
            (p_ledger_entry->>'customer_id')::UUID, v_due.customer_id USING ERRCODE = '23503';
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

-- 5. Hardened Historical Import RPC: import_historical_ledger_entry
CREATE OR REPLACE FUNCTION public.import_historical_ledger_entry(
    p_entry jsonb
)
RETURNS jsonb AS $$
DECLARE
    v_entry_id UUID;
    v_workspace_id UUID;
    v_location_id UUID;
    v_customer_id UUID;
    v_card_id UUID;
    v_category_id UUID;
    v_idempotency_key TEXT;
    v_existing_id UUID;
    v_result jsonb;
BEGIN
    v_workspace_id := (p_entry->>'workspace_id')::UUID;
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace ID is required' USING ERRCODE = '23502';
    END IF;

    -- Strict WRITE authorization check (Viewer is rejected)
    IF NOT public.check_user_workspace_write(v_workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: User does not have write access to workspace %', v_workspace_id
            USING ERRCODE = '42501';
    END IF;

    v_location_id := (p_entry->>'cash_location_id')::UUID;
    v_customer_id := (p_entry->>'customer_id')::UUID;
    v_card_id := (p_entry->>'card_id')::UUID;
    v_category_id := (p_entry->>'category_id')::UUID;

    -- Cross-workspace boundary checks
    IF v_location_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.cash_locations WHERE id = v_location_id AND workspace_id = v_workspace_id) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: cash_location % does not belong to workspace %', 
                v_location_id, v_workspace_id USING ERRCODE = '23503';
        END IF;
    END IF;

    IF v_customer_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer_id AND workspace_id = v_workspace_id) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: customer % does not belong to workspace %', 
                v_customer_id, v_workspace_id USING ERRCODE = '23503';
        END IF;
    END IF;

    IF v_card_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.cards WHERE id = v_card_id AND workspace_id = v_workspace_id) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: card % does not belong to workspace %', 
                v_card_id, v_workspace_id USING ERRCODE = '23503';
        END IF;
    END IF;

    IF v_category_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = v_category_id AND workspace_id = v_workspace_id) THEN
            RAISE EXCEPTION 'Cross-workspace reference error: category % does not belong to workspace %', 
                v_category_id, v_workspace_id USING ERRCODE = '23503';
        END IF;
    END IF;

    -- 1. Check idempotency key if present
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

    -- 2. Check primary key ID if present
    v_entry_id := COALESCE((p_entry->>'id')::UUID, uuid_generate_v4());
    SELECT id INTO v_existing_id
    FROM public.ledger_entries
    WHERE id = v_entry_id;

    IF v_existing_id IS NOT NULL THEN
        SELECT to_jsonb(l.*) INTO v_result
        FROM public.ledger_entries l
        WHERE id = v_existing_id;
        RETURN jsonb_build_object('status', 'duplicate_ignored', 'entry', v_result);
    END IF;

    -- 3. Insert historical ledger entry WITHOUT updating cash_locations.balance
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
        p_entry->>'type',
        (p_entry->>'amount')::BIGINT,
        v_category_id,
        v_location_id,
        v_customer_id,
        v_card_id,
        COALESCE(p_entry->>'mode', 'cash'),
        COALESCE(p_entry->>'scope', 'business'),
        p_entry->>'note',
        COALESCE((p_entry->>'entry_date')::TIMESTAMPTZ, timezone('utc', now())),
        (p_entry->>'is_billed')::BOOLEAN,
        v_idempotency_key,
        auth.uid(),
        COALESCE((p_entry->>'created_at')::TIMESTAMPTZ, timezone('utc', now())),
        COALESCE((p_entry->>'updated_at')::TIMESTAMPTZ, timezone('utc', now()))
    );

    SELECT to_jsonb(l.*) INTO v_result
    FROM public.ledger_entries l
    WHERE id = v_entry_id;

    RETURN jsonb_build_object('status', 'success', 'entry', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
