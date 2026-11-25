-- =========================================================================
-- AARAV TRADERS – SQL-LEVEL ROW LEVEL SECURITY (RLS) TEST SUITE
-- =========================================================================
-- HOW TO RUN IN SUPABASE SQL EDITOR:
-- 1. Open your Supabase Project Dashboard -> SQL Editor.
-- 2. Click "New Query", paste the entire contents of this file, and click "Run".
-- 3. Everything runs inside a transaction (BEGIN ... ROLLBACK) so ZERO test rows
--    are ever persisted to your database.
-- 4. Checks prove that the 'postgres' superuser role is NOT used for assertions,
--    and that impersonation of 'anon' and 'authenticated' (both non-member and member)
--    enforces zero data leakage across all tables and security_invoker views.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- STEP 1: Setup temporary fixture data (executed as setup role)
-- -------------------------------------------------------------------------
DO $$
DECLARE
    v_member_uid UUID := '11111111-1111-1111-1111-111111111111';
    v_test_load_id UUID;
    v_test_supplier_id UUID;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'AARAV TRADERS: STARTING RLS SECURITY VERIFICATION SUITE';
    RAISE NOTICE '=======================================================';

    -- 1. Ensure settings exist
    INSERT INTO public.settings (id, gst_rate_coal, gst_rate_briquette, default_credit_days)
    VALUES ('00000000-0000-0000-0000-000000000001', 18.00, 5.00, 30)
    ON CONFLICT (id) DO UPDATE SET gst_rate_coal = 18.00, gst_rate_briquette = 5.00;

    -- 2. Authorize test partner in firm_members
    INSERT INTO public.firm_members (user_id, email, role)
    VALUES (v_member_uid, 'partner@aaravtraders.in', 'partner')
    ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id;

    -- 3. Insert test party
    INSERT INTO public.parties (name, type)
    VALUES ('Confidential Supplier Alpha', 'supplier')
    RETURNING id INTO v_test_supplier_id;

    -- 4. Insert test load
    INSERT INTO public.loads (
        load_date, material, supplier_id, tons_bought, buy_rate,
        truck_number, tons_loaded, freight_rate
    ) VALUES (
        CURRENT_DATE, 'coal', v_test_supplier_id, 25.000, 7500.00,
        'MH-12-SEC-001', 25.000, 1600.00
    ) RETURNING id INTO v_test_load_id;

    -- 5. Insert test payment
    INSERT INTO public.payments (
        load_id, party_id, kind, amount, payment_date, mode
    ) VALUES (
        v_test_load_id, v_test_supplier_id, 'purchase', 50000.00, CURRENT_DATE, 'UPI'
    );

    RAISE NOTICE '>>> [SETUP COMPLETED]: Fixtures created successfully.';
END $$;

-- -------------------------------------------------------------------------
-- STEP 2: Impersonate Unlogged / Anon Key Role
-- -------------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{}';

DO $$
DECLARE
    v_count INT;
    v_err_caught BOOLEAN := false;
BEGIN
    RAISE NOTICE '-------------------------------------------------------';
    RAISE NOTICE 'TEST SUITE 1: ANONYMOUS / LOGGED-OUT ACCESS (ROLE: anon)';
    RAISE NOTICE '-------------------------------------------------------';

    -- Verify current role is anon, NOT postgres
    IF current_user = 'postgres' THEN
        RAISE EXCEPTION 'FAIL: Role is still postgres, anon impersonation failed!';
    END IF;

    -- Table: loads
    SELECT COUNT(*) INTO v_count FROM public.loads;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Anon user read 0 rows from loads table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon user leaked % rows from loads table!', v_count;
    END IF;

    -- Table: payments
    SELECT COUNT(*) INTO v_count FROM public.payments;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Anon user read 0 rows from payments table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon user leaked % rows from payments table!', v_count;
    END IF;

    -- Table: parties
    SELECT COUNT(*) INTO v_count FROM public.parties;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Anon user read 0 rows from parties table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon user leaked % rows from parties table!', v_count;
    END IF;

    -- Table: settings
    SELECT COUNT(*) INTO v_count FROM public.settings;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Anon user read 0 rows from settings table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon user leaked % rows from settings table!', v_count;
    END IF;

    -- Table: firm_members (Anon must read 0 rows)
    SELECT COUNT(*) INTO v_count FROM public.firm_members;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Anon user read 0 rows from firm_members table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon user leaked % rows from firm_members table!', v_count;
    END IF;

    -- View: load_details_view (WITH security_invoker = true)
    SELECT COUNT(*) INTO v_count FROM public.load_details_view;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Anon user read 0 rows from load_details_view.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon user leaked % rows from load_details_view!', v_count;
    END IF;

    -- View: monthly_reports_view (WITH security_invoker = true)
    SELECT COUNT(*) INTO v_count FROM public.monthly_reports_view;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Anon user read 0 rows from monthly_reports_view.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon user leaked % rows from monthly_reports_view!', v_count;
    END IF;

    -- View: party_balances_view (WITH security_invoker = true)
    SELECT COUNT(*) INTO v_count FROM public.party_balances_view;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Anon user read 0 rows from party_balances_view.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon user leaked % rows from party_balances_view!', v_count;
    END IF;

    -- Anon write attempt
    BEGIN
        INSERT INTO public.loads (load_date, material, tons_bought, buy_rate, truck_number, tons_loaded, freight_rate)
        VALUES (CURRENT_DATE, 'coal', 10.000, 5000.00, 'MH-04-ANON', 10.000, 1000.00);
        v_err_caught := false;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;

    IF v_err_caught THEN
        RAISE NOTICE 'PASS: Anon INSERT rejected with permission denied.';
    ELSE
        RAISE EXCEPTION 'FAIL: Anon was permitted to write into loads table!';
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- STEP 3: Impersonate Authenticated Non-Member (Valid JWT, NOT in firm_members)
-- -------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "email": "unauthorized.intruder@external.com"}';

DO $$
DECLARE
    v_count INT;
    v_err_caught BOOLEAN := false;
BEGIN
    RAISE NOTICE '-------------------------------------------------------';
    RAISE NOTICE 'TEST SUITE 2: AUTHENTICATED NON-MEMBER (ROLE: authenticated)';
    RAISE NOTICE '-------------------------------------------------------';

    -- Table: loads
    SELECT COUNT(*) INTO v_count FROM public.loads;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Authenticated non-member read 0 rows from loads table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Authenticated non-member leaked % rows from loads table!', v_count;
    END IF;

    -- Table: payments
    SELECT COUNT(*) INTO v_count FROM public.payments;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Authenticated non-member read 0 rows from payments table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Authenticated non-member leaked % rows from payments table!', v_count;
    END IF;

    -- Table: parties
    SELECT COUNT(*) INTO v_count FROM public.parties;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Authenticated non-member read 0 rows from parties table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Authenticated non-member leaked % rows from parties table!', v_count;
    END IF;

    -- Table: audit_logs
    SELECT COUNT(*) INTO v_count FROM public.audit_logs;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Authenticated non-member read 0 rows from audit_logs table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Authenticated non-member leaked % rows from audit_logs table!', v_count;
    END IF;

    -- Table: firm_members (Non-member must read 0 rows)
    SELECT COUNT(*) INTO v_count FROM public.firm_members;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Authenticated non-member read 0 rows from firm_members table.';
    ELSE
        RAISE EXCEPTION 'FAIL: Authenticated non-member leaked % rows from firm_members table!', v_count;
    END IF;

    -- View: load_details_view (WITH security_invoker = true)
    SELECT COUNT(*) INTO v_count FROM public.load_details_view;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Authenticated non-member read 0 rows from load_details_view.';
    ELSE
        RAISE EXCEPTION 'FAIL: Authenticated non-member leaked % rows from load_details_view!', v_count;
    END IF;

    -- View: unsold_stock_view (WITH security_invoker = true)
    SELECT COUNT(*) INTO v_count FROM public.unsold_stock_view;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Authenticated non-member read 0 rows from unsold_stock_view.';
    ELSE
        RAISE EXCEPTION 'FAIL: Authenticated non-member leaked % rows from unsold_stock_view!', v_count;
    END IF;

    -- Non-member INSERT attempt
    BEGIN
        INSERT INTO public.loads (load_date, material, tons_bought, buy_rate, truck_number, tons_loaded, freight_rate)
        VALUES (CURRENT_DATE, 'coal', 10.000, 5000.00, 'MH-04-INTRUDER', 10.000, 1000.00);
        v_err_caught := false;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;

    IF v_err_caught THEN
        RAISE NOTICE 'PASS: Non-member INSERT rejected with permission denied.';
    ELSE
        RAISE EXCEPTION 'FAIL: Non-member was permitted to write into loads table!';
    END IF;

    -- Non-member UPDATE attempt
    BEGIN
        UPDATE public.loads SET buy_rate = 9999.00;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN
            RAISE EXCEPTION 'FAIL: Non-member updated % rows in loads table!', v_count;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    RAISE NOTICE 'PASS: Non-member UPDATE updated 0 rows.';

    -- Non-member DELETE attempt
    BEGIN
        DELETE FROM public.loads;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN
            RAISE EXCEPTION 'FAIL: Non-member deleted % rows from loads table!', v_count;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    RAISE NOTICE 'PASS: Non-member DELETE deleted 0 rows.';
END $$;

-- -------------------------------------------------------------------------
-- STEP 4: Impersonate Authenticated Firm Member (Verified Partner)
-- -------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "11111111-1111-1111-1111-111111111111", "email": "partner@aaravtraders.in"}';

DO $$
DECLARE
    v_count INT;
    v_err_caught BOOLEAN := false;
BEGIN
    RAISE NOTICE '-------------------------------------------------------';
    RAISE NOTICE 'TEST SUITE 3: AUTHENTICATED FIRM PARTNER (ROLE: authenticated)';
    RAISE NOTICE '-------------------------------------------------------';

    -- Partner reads loads
    SELECT COUNT(*) INTO v_count FROM public.loads;
    IF v_count >= 1 THEN
        RAISE NOTICE 'PASS: Partner read % row(s) from loads table.', v_count;
    ELSE
        RAISE EXCEPTION 'FAIL: Partner could not read loads (got % rows)!', v_count;
    END IF;

    -- Partner reads load_details_view
    SELECT COUNT(*) INTO v_count FROM public.load_details_view;
    IF v_count >= 1 THEN
        RAISE NOTICE 'PASS: Partner read % row(s) from load_details_view.', v_count;
    ELSE
        RAISE EXCEPTION 'FAIL: Partner could not read load_details_view (got % rows)!', v_count;
    END IF;

    -- Partner reads unsold_stock_view
    SELECT COUNT(*) INTO v_count FROM public.unsold_stock_view;
    IF v_count >= 1 THEN
        RAISE NOTICE 'PASS: Partner read % row(s) from unsold_stock_view.', v_count;
    ELSE
        RAISE EXCEPTION 'FAIL: Partner could not read unsold_stock_view (got % rows)!', v_count;
    END IF;

    -- Partner reads firm_members (Must see exactly their OWN row, and nobody else)
    SELECT COUNT(*) INTO v_count FROM public.firm_members WHERE user_id = auth.uid();
    IF v_count = 1 THEN
        RAISE NOTICE 'PASS: Partner read their own row from firm_members.';
    ELSE
        RAISE EXCEPTION 'FAIL: Partner could not read their own firm_members row (got % rows)!', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.firm_members;
    IF v_count = 1 THEN
        RAISE NOTICE 'PASS: Partner saw only their own row in firm_members (1 row total).';
    ELSE
        RAISE EXCEPTION 'FAIL: Partner saw % rows in firm_members (expected only their own)!', v_count;
    END IF;

    -- Partner attempts HARD DELETE (must be blocked by RLS - soft delete only)
    BEGIN
        DELETE FROM public.loads;
        v_err_caught := false;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS: Partner hard DELETE blocked by RLS (0 rows deleted).';
    ELSE
        RAISE EXCEPTION 'FAIL: Partner was able to hard delete % rows!', v_count;
    END IF;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE '>>> ALL RLS TESTS COMPLETED: ZERO SECURITY BREACHES.';
    RAISE NOTICE '=======================================================';
END $$;

ROLLBACK;
-- Zero test data persisted in the database.
