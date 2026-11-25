-- =========================================================================
-- AARAV TRADERS – SQL-LEVEL BUSINESS LOGIC & INTEGRITY TEST SUITE
-- Executes inside a transaction (BEGIN ... ROLLBACK)
-- Can be run directly in the Supabase SQL Editor.
-- =========================================================================

BEGIN;

DO $$
DECLARE
    v_supplier_id UUID;
    v_agency_id UUID;
    v_buyer_id UUID;
    v_load1_id UUID;
    v_load2_id UUID;
    v_load3_id UUID;
    v_load1_view RECORD;
    v_load2_view RECORD;
    v_load3_view RECORD;
    v_monthly_view RECORD;
    v_err_caught BOOLEAN := false;
BEGIN
    RAISE NOTICE '>>> [1/7] Seeding configuration and test parties...';

    -- Ensure settings exist with Coal 18% GST + 2% TCS, and Briquette 5% GST (No TCS)
    INSERT INTO public.settings (id, gst_rate_coal, gst_rate_briquette, tcs_rate_purchase, default_credit_days)
    VALUES ('00000000-0000-0000-0000-000000000001', 18.00, 5.00, 2.00, 30)
    ON CONFLICT (id) DO UPDATE 
    SET gst_rate_coal = 18.00, gst_rate_briquette = 5.00, tcs_rate_purchase = 2.00, default_credit_days = 30;

    -- Create temporary test parties
    INSERT INTO public.parties (name, type, credit_days)
    VALUES ('Test Mining Corp', 'supplier', 15)
    RETURNING id INTO v_supplier_id;

    INSERT INTO public.parties (name, type)
    VALUES ('Test Logistics Ltd', 'agency')
    RETURNING id INTO v_agency_id;

    INSERT INTO public.parties (name, type, credit_days)
    VALUES ('Test Steel Mills', 'buyer', 30)
    RETURNING id INTO v_buyer_id;

    -- =====================================================================
    -- TEST CASE 1: Standard Coal Load (22 t @ ₹7,000 / ₹1,600 / ₹9,000)
    -- =====================================================================
    RAISE NOTICE '>>> [2/7] Running Test Case 1: Standard Coal Load...';
    INSERT INTO public.loads (
        load_date, material, supplier_id, tons_bought, buy_rate,
        agency_id, truck_number, tons_loaded, freight_rate,
        buyer_id, sale_date, tons_received, sale_rate, credit_days
    ) VALUES (
        '2026-11-01', 'coal', v_supplier_id, 22.000, 7000.00,
        v_agency_id, 'MH-12-AB-1234', 22.000, 1600.00,
        v_buyer_id, '2026-11-05', 22.000, 9000.00, 30
    ) RETURNING id INTO v_load1_id;

    SELECT * INTO v_load1_view FROM public.load_details_view WHERE id = v_load1_id;

    ASSERT v_load1_view.purchase_amount = 154000.00, 
        format('TC1 Purchase Amount mismatch: expected 154000.00, got %s', v_load1_view.purchase_amount);
    ASSERT v_load1_view.purchase_gst = 27720.00, 
        format('TC1 Purchase GST (18%%) mismatch: expected 27720.00, got %s', v_load1_view.purchase_gst);
    ASSERT v_load1_view.purchase_tcs = 3634.40, 
        format('TC1 Purchase TCS (2%% on Coal) mismatch: expected 3634.40, got %s', v_load1_view.purchase_tcs);
    ASSERT v_load1_view.purchase_total = 185354.40, 
        format('TC1 Purchase Total (with GST and 2%% TCS) mismatch: expected 185354.40, got %s', v_load1_view.purchase_total);
    ASSERT v_load1_view.freight_amount = 35200.00, 
        format('TC1 Freight Amount mismatch: expected 35200.00, got %s', v_load1_view.freight_amount);
    ASSERT v_load1_view.sale_amount = 198000.00, 
        format('TC1 Sale Amount mismatch: expected 198000.00, got %s', v_load1_view.sale_amount);
    ASSERT v_load1_view.sale_gst = 35640.00, 
        format('TC1 Sale GST mismatch: expected 35640.00, got %s', v_load1_view.sale_gst);
    ASSERT v_load1_view.sale_total = 233640.00, 
        format('TC1 Sale Total mismatch: expected 233640.00, got %s', v_load1_view.sale_total);
    ASSERT v_load1_view.profit = 8800.00, 
        format('TC1 Profit mismatch: expected 8800.00, got %s', v_load1_view.profit);
    ASSERT v_load1_view.profit_per_ton = 400.00, 
        format('TC1 Profit Per Ton mismatch: expected 400.00, got %s', v_load1_view.profit_per_ton);
    ASSERT v_load1_view.shortage_tons = 0.000, 
        format('TC1 Shortage Tons mismatch: expected 0.000, got %s', v_load1_view.shortage_tons);

    RAISE NOTICE '    PASS: TC1 returned exact profit ₹8,800.00 and 0 shortage.';

    -- =====================================================================
    -- TEST CASE 2: Shortage Load (21.5 t received vs 22 t bought)
    -- =====================================================================
    RAISE NOTICE '>>> [3/7] Running Test Case 2: Shortage Load (21.5 t received)...';
    INSERT INTO public.loads (
        load_date, material, supplier_id, tons_bought, buy_rate,
        agency_id, truck_number, tons_loaded, freight_rate,
        buyer_id, sale_date, tons_received, sale_rate, credit_days
    ) VALUES (
        '2026-11-02', 'coal', v_supplier_id, 22.000, 7000.00,
        v_agency_id, 'MH-12-CD-5678', 22.000, 1600.00,
        v_buyer_id, '2026-11-06', 21.500, 9000.00, 30
    ) RETURNING id INTO v_load2_id;

    SELECT * INTO v_load2_view FROM public.load_details_view WHERE id = v_load2_id;

    ASSERT v_load2_view.sale_amount = 193500.00, 
        format('TC2 Sale Amount mismatch: expected 193500.00, got %s', v_load2_view.sale_amount);
    ASSERT v_load2_view.profit = 4300.00, 
        format('TC2 Profit mismatch: expected 4300.00, got %s', v_load2_view.profit);
    ASSERT v_load2_view.shortage_tons = 0.500, 
        format('TC2 Shortage Tons mismatch: expected 0.500, got %s', v_load2_view.shortage_tons);
    ASSERT v_load2_view.profit_per_ton = 200.00, 
        format('TC2 Profit Per Ton mismatch: expected 200.00, got %s', v_load2_view.profit_per_ton);

    RAISE NOTICE '    PASS: TC2 returned exact sale ₹1,93,500.00, profit ₹4,300.00, shortage 0.500 t.';

    -- =====================================================================
    -- TEST CASE 3: Briquette 5% vs Coal 18% GST Differential
    -- =====================================================================
    RAISE NOTICE '>>> [4/7] Running Test Case 3: Briquette 5% GST Differential...';
    INSERT INTO public.loads (
        load_date, material, supplier_id, tons_bought, buy_rate,
        agency_id, truck_number, tons_loaded, freight_rate
    ) VALUES (
        '2026-11-03', 'briquette', v_supplier_id, 22.000, 7000.00,
        v_agency_id, 'MH-12-EF-9999', 22.000, 1600.00
    ) RETURNING id INTO v_load3_id;

    SELECT * INTO v_load3_view FROM public.load_details_view WHERE id = v_load3_id;

    ASSERT v_load3_view.purchase_amount = 154000.00, 
        format('TC3 Briquette Purchase Amount mismatch: expected 154000.00, got %s', v_load3_view.purchase_amount);
    ASSERT v_load3_view.purchase_gst = 7700.00, 
        format('TC3 Briquette GST (5%%) mismatch: expected 7700.00, got %s', v_load3_view.purchase_gst);
    ASSERT v_load3_view.purchase_tcs = 0.00, 
        format('TC3 Briquette TCS mismatch: expected 0.00, got %s', v_load3_view.purchase_tcs);
    ASSERT v_load3_view.purchase_total = 161700.00, 
        format('TC3 Briquette Total mismatch: expected 161700.00, got %s', v_load3_view.purchase_total);

    -- Contrast with Coal from TC1
    ASSERT v_load1_view.purchase_gst = 27720.00, 
        format('TC3 Coal GST (18%%) mismatch: expected 27720.00, got %s', v_load1_view.purchase_gst);
    ASSERT v_load1_view.purchase_tcs = 3634.40, 
        format('TC3 Coal TCS (2%%) mismatch: expected 3634.40, got %s', v_load1_view.purchase_tcs);
    ASSERT v_load1_view.purchase_total = 185354.40, 
        format('TC3 Coal Total mismatch: expected 185354.40, got %s', v_load1_view.purchase_total);

    RAISE NOTICE '    PASS: TC3 Briquette GST is 5%% (₹7,700.00, total ₹1,61,700.00 with 0%% TCS) vs Coal GST 18%% + 2%% TCS (₹27,720.00 + ₹3,634.40 = ₹1,85,354.40).';

    -- =====================================================================
    -- TEST CASE 4: Overpayment Rejection Trigger
    -- =====================================================================
    RAISE NOTICE '>>> [5/7] Testing Overpayment Rejection Trigger...';
    
    -- Valid partial payment
    INSERT INTO public.payments (load_id, party_id, kind, amount, payment_date, mode)
    VALUES (v_load1_id, v_agency_id, 'freight', 20000.00, '2026-11-06', 'UPI');

    -- Attempt overpayment on freight (bill is 35,200.00, remaining is 15,200.00)
    BEGIN
        INSERT INTO public.payments (load_id, party_id, kind, amount, payment_date, mode)
        VALUES (v_load1_id, v_agency_id, 'freight', 16000.00, '2026-11-07', 'UPI');
        v_err_caught := false;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    ASSERT v_err_caught = true, 'Overpayment trigger failed to reject freight payment of 16000 against 15200 balance';

    -- Attempt sale payment on unsold load 3
    BEGIN
        INSERT INTO public.payments (load_id, party_id, kind, amount, payment_date, mode)
        VALUES (v_load3_id, v_buyer_id, 'sale', 1000.00, '2026-11-07', 'UPI');
        v_err_caught := false;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    ASSERT v_err_caught = true, 'Overpayment trigger failed to reject sale payment on an unsold load';

    RAISE NOTICE '    PASS: Overpayment trigger properly rejects overpayments and unsold sale payments.';

    -- =====================================================================
    -- TEST CASE 5: Load Update Protection Trigger
    -- =====================================================================
    RAISE NOTICE '>>> [6/7] Testing Load Update Protection Trigger...';
    
    -- Record purchase payment of ₹1,00,000 on load 1 (bill is 181,720.00)
    INSERT INTO public.payments (load_id, party_id, kind, amount, payment_date, mode)
    VALUES (v_load1_id, v_supplier_id, 'purchase', 100000.00, '2026-11-06', 'Cheque');

    -- Attempt to edit load buy_rate to ₹3,000 (making purchase total 22 * 3000 * 1.18 = 77,880 < 100,000)
    BEGIN
        UPDATE public.loads
        SET buy_rate = 3000.00
        WHERE id = v_load1_id;
        v_err_caught := false;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    ASSERT v_err_caught = true, 'Load update trigger failed to prevent lowering bill below already paid amount';

    RAISE NOTICE '    PASS: Load update trigger properly prevents bill reduction below paid amounts.';

    -- =====================================================================
    -- TEST CASE 6: Monthly Reports View Aggregations
    -- =====================================================================
    RAISE NOTICE '>>> [7/7] Testing Monthly Reports View...';
    SELECT * INTO v_monthly_view FROM public.monthly_reports_view WHERE sale_month = '2026-11';

    ASSERT v_monthly_view.loads_count = 2, 
        format('Monthly report loads_count expected 2, got %s', v_monthly_view.loads_count);
    ASSERT v_monthly_view.profit = 13100.00, -- 8800 + 4300
        format('Monthly report profit expected 13100.00, got %s', v_monthly_view.profit);
    ASSERT v_monthly_view.tons_sold = 43.500, -- 22 + 21.5
        format('Monthly report tons_sold expected 43.500, got %s', v_monthly_view.tons_sold);
    ASSERT v_monthly_view.shortage_tons = 0.500,
        format('Monthly report shortage_tons expected 0.500, got %s', v_monthly_view.shortage_tons);

    RAISE NOTICE '    PASS: Monthly Reports View aggregates match exactly.';
    RAISE NOTICE '>>> ALL SQL-LEVEL TESTS PASSED WITH ZERO ERRORS.';

END $$;

ROLLBACK;
-- Transaction rolled back: zero rows persisted in database.
