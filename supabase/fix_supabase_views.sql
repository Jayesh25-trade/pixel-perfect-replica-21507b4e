-- ============================================================================
-- AARAV TRADERS: FIX VIEWS (Resolves Supabase Error 42P16 cleanly)
-- ============================================================================
-- Description: Drops existing views CASCADE before recreating them, allowing
-- column reordering and the new TCS column without 42P16 error.
-- ============================================================================

-- Step 1: Drop views with CASCADE so dependent views are cleanly removed first
DROP VIEW IF EXISTS public.monthly_reports_view CASCADE;
DROP VIEW IF EXISTS public.unsold_stock_view CASCADE;
DROP VIEW IF EXISTS public.party_balances_view CASCADE;
DROP VIEW IF EXISTS public.load_details_view CASCADE;

-- Step 2: Ensure TCS column exists in settings table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS tcs_rate_purchase NUMERIC(5,2) NOT NULL DEFAULT 2.00;
UPDATE public.settings SET tcs_rate_purchase = 2.00 WHERE tcs_rate_purchase IS NULL;

-- Step 3: Recreate 1. Detailed Loads View with Coal 2% TCS and Briquette 0% TCS
CREATE OR REPLACE VIEW public.load_details_view
WITH (security_invoker = true) AS
WITH settings_data AS (
    SELECT 
        COALESCE(gst_rate_coal, 18.00) AS gst_rate_coal,
        COALESCE(gst_rate_briquette, 5.00) AS gst_rate_briquette,
        COALESCE(tcs_rate_purchase, 2.00) AS tcs_rate_purchase,
        COALESCE(default_credit_days, 30) AS default_credit_days
    FROM public.settings
    LIMIT 1
),
payment_aggregates AS (
    SELECT 
        load_id,
        COALESCE(SUM(CASE WHEN kind = 'purchase' THEN amount ELSE 0 END), 0) AS purchase_paid,
        COALESCE(SUM(CASE WHEN kind = 'freight' THEN amount ELSE 0 END), 0) AS freight_paid,
        COALESCE(SUM(CASE WHEN kind = 'sale' THEN amount ELSE 0 END), 0) AS sale_paid
    FROM public.payments
    WHERE deleted_at IS NULL
    GROUP BY load_id
)
SELECT
    l.id,
    l.load_date,
    l.material,
    l.supplier_id,
    p_sup.name AS supplier_name,
    l.tons_bought,
    l.buy_rate,
    l.agency_id,
    p_ag.name AS agency_name,
    l.truck_number,
    l.tons_loaded,
    l.freight_rate,
    l.buyer_id,
    p_buy.name AS buyer_name,
    l.sale_date,
    l.tons_received,
    l.sale_rate,
    COALESCE(l.credit_days, s.default_credit_days) AS credit_days,
    l.created_at,
    l.updated_at,
    l.deleted_at,

    -- Dynamic GST Rate (Coal 18% / Briquette 5%)
    CASE WHEN l.material = 'coal' THEN s.gst_rate_coal ELSE s.gst_rate_briquette END AS gst_rate,
    -- TCS Rate: Coal has 2% TCS on purchase; Briquette has 0% TCS
    CASE WHEN l.material = 'coal' THEN s.tcs_rate_purchase ELSE 0.00 END AS tcs_rate,

    -- Purchase Computations
    ROUND(l.tons_bought * l.buy_rate, 2) AS purchase_amount,
    ROUND((l.tons_bought * l.buy_rate) * ((CASE WHEN l.material = 'coal' THEN s.gst_rate_coal ELSE s.gst_rate_briquette END) / 100.0), 2) AS purchase_gst,
    CASE 
        WHEN l.material = 'coal'
        THEN ROUND((ROUND(l.tons_bought * l.buy_rate, 2) + ROUND((l.tons_bought * l.buy_rate) * (s.gst_rate_coal / 100.0), 2)) * (s.tcs_rate_purchase / 100.0), 2)
        ELSE 0.00 
    END AS purchase_tcs,
    CASE 
        WHEN l.material = 'coal'
        THEN ROUND((ROUND(l.tons_bought * l.buy_rate, 2) + ROUND((l.tons_bought * l.buy_rate) * (s.gst_rate_coal / 100.0), 2)) * (1 + (s.tcs_rate_purchase / 100.0)), 2)
        ELSE ROUND((l.tons_bought * l.buy_rate) * (1 + (s.gst_rate_briquette / 100.0)), 2)
    END AS purchase_total,

    -- Freight Computation (No GST, No TCS)
    ROUND(l.tons_loaded * l.freight_rate, 2) AS freight_amount,

    -- Sale Computations (No TCS on Sale)
    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL AND l.sale_rate IS NOT NULL
        THEN ROUND(l.tons_received * l.sale_rate, 2)
        ELSE NULL 
    END AS sale_amount,

    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL AND l.sale_rate IS NOT NULL
        THEN ROUND((l.tons_received * l.sale_rate) * ((CASE WHEN l.material = 'coal' THEN s.gst_rate_coal ELSE s.gst_rate_briquette END) / 100.0), 2)
        ELSE NULL 
    END AS sale_gst,

    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL AND l.sale_rate IS NOT NULL
        THEN ROUND((l.tons_received * l.sale_rate) * (1 + ((CASE WHEN l.material = 'coal' THEN s.gst_rate_coal ELSE s.gst_rate_briquette END) / 100.0)), 2)
        ELSE NULL 
    END AS sale_total,

    -- Shortage Tons: tons_bought - tons_received
    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL
        THEN (l.tons_bought - l.tons_received)
        ELSE NULL 
    END AS shortage_tons,

    -- Profit (before GST) = sale_amount - purchase_amount - freight_amount
    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL AND l.sale_rate IS NOT NULL
        THEN ROUND((l.tons_received * l.sale_rate) - (l.tons_bought * l.buy_rate) - (l.tons_loaded * l.freight_rate), 2)
        ELSE NULL 
    END AS profit,

    -- Profit per ton
    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL AND l.tons_received > 0 AND l.sale_rate IS NOT NULL
        THEN ROUND(((l.tons_received * l.sale_rate) - (l.tons_bought * l.buy_rate) - (l.tons_loaded * l.freight_rate)) / l.tons_received, 2)
        ELSE NULL 
    END AS profit_per_ton,

    -- Due Date
    CASE 
        WHEN l.sale_date IS NOT NULL
        THEN (l.sale_date + (COALESCE(l.credit_days, s.default_credit_days) * INTERVAL '1 day'))::DATE
        ELSE NULL 
    END AS due_date,

    -- Payments Received & Pending
    COALESCE(pa.purchase_paid, 0) AS purchase_paid,
    (CASE 
        WHEN l.material = 'coal'
        THEN ROUND((ROUND(l.tons_bought * l.buy_rate, 2) + ROUND((l.tons_bought * l.buy_rate) * (s.gst_rate_coal / 100.0), 2)) * (1 + (s.tcs_rate_purchase / 100.0)), 2)
        ELSE ROUND((l.tons_bought * l.buy_rate) * (1 + (s.gst_rate_briquette / 100.0)), 2)
    END) - COALESCE(pa.purchase_paid, 0) AS purchase_pending,

    COALESCE(pa.freight_paid, 0) AS freight_paid,
    ROUND((l.tons_loaded * l.freight_rate) - COALESCE(pa.freight_paid, 0), 2) AS freight_pending,

    COALESCE(pa.sale_paid, 0) AS sale_paid,
    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL AND l.sale_rate IS NOT NULL
        THEN ROUND(((l.tons_received * l.sale_rate) * (1 + ((CASE WHEN l.material = 'coal' THEN s.gst_rate_coal ELSE s.gst_rate_briquette END) / 100.0))) - COALESCE(pa.sale_paid, 0), 2)
        ELSE NULL 
    END AS sale_pending,

    -- Overdue Check
    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL AND l.sale_rate IS NOT NULL
        THEN (
            ROUND(((l.tons_received * l.sale_rate) * (1 + ((CASE WHEN l.material = 'coal' THEN s.gst_rate_coal ELSE s.gst_rate_briquette END) / 100.0))) - COALESCE(pa.sale_paid, 0), 2) > 0
            AND (l.sale_date + (COALESCE(l.credit_days, s.default_credit_days) * INTERVAL '1 day'))::DATE < CURRENT_DATE
        )
        ELSE false 
    END AS is_overdue

FROM public.loads l
CROSS JOIN settings_data s
LEFT JOIN public.parties p_sup ON l.supplier_id = p_sup.id
LEFT JOIN public.parties p_ag ON l.agency_id = p_ag.id
LEFT JOIN public.parties p_buy ON l.buyer_id = p_buy.id
LEFT JOIN payment_aggregates pa ON l.id = pa.load_id
WHERE l.deleted_at IS NULL;

-- Step 4: Recreate 2. Monthly Reports View
CREATE OR REPLACE VIEW public.monthly_reports_view
WITH (security_invoker = true) AS
SELECT
    TO_CHAR(sale_date, 'YYYY-MM') AS sale_month,
    DATE_TRUNC('month', sale_date)::DATE AS month_start,
    COUNT(id) AS loads_count,
    SUM(tons_bought) AS tons_bought,
    SUM(tons_received) AS tons_sold,
    SUM(shortage_tons) AS shortage_tons,
    SUM(purchase_amount) AS purchase_amount,
    SUM(freight_amount) AS freight_amount,
    SUM(sale_amount) AS sale_amount,
    SUM(profit) AS profit,
    SUM(purchase_gst) AS gst_paid,
    SUM(sale_gst) AS gst_collected,
    SUM(sale_gst - purchase_gst) AS net_gst
FROM public.load_details_view
WHERE sale_date IS NOT NULL
GROUP BY TO_CHAR(sale_date, 'YYYY-MM'), DATE_TRUNC('month', sale_date)::DATE
ORDER BY sale_month DESC;

-- Step 5: Recreate 3. Unsold Stock Summary View
CREATE OR REPLACE VIEW public.unsold_stock_view
WITH (security_invoker = true) AS
SELECT
    COUNT(id) AS unsold_loads,
    COALESCE(SUM(tons_bought), 0) AS unsold_tons,
    COALESCE(SUM(purchase_amount), 0) AS unsold_purchase_cost,
    COALESCE(SUM(purchase_total), 0) AS unsold_purchase_total_with_gst,
    COALESCE(SUM(freight_amount), 0) AS unsold_freight_cost,
    COALESCE(SUM(purchase_amount + freight_amount), 0) AS total_unsold_cost_basis
FROM public.load_details_view
WHERE sale_date IS NULL;

-- Step 6: Recreate 4. Party Balances View
CREATE OR REPLACE VIEW public.party_balances_view
WITH (security_invoker = true) AS
WITH party_purchase AS (
    SELECT 
        supplier_id AS party_id, 
        SUM(purchase_total) AS total_billed, 
        SUM(purchase_paid) AS total_paid,
        SUM(purchase_pending) AS total_pending
    FROM public.load_details_view
    GROUP BY supplier_id
),
party_freight AS (
    SELECT 
        agency_id AS party_id, 
        SUM(freight_amount) AS total_billed, 
        SUM(freight_paid) AS total_paid,
        SUM(freight_pending) AS total_pending
    FROM public.load_details_view
    GROUP BY agency_id
),
party_sale AS (
    SELECT 
        buyer_id AS party_id, 
        SUM(sale_total) AS total_billed, 
        SUM(sale_paid) AS total_paid,
        SUM(sale_pending) AS total_pending
    FROM public.load_details_view
    WHERE buyer_id IS NOT NULL
    GROUP BY buyer_id
)
SELECT 
    p.id AS party_id,
    p.name AS party_name,
    p.type AS party_type,
    p.phone,
    p.credit_days,
    CASE 
        WHEN p.type = 'supplier' THEN COALESCE(pp.total_billed, 0)
        WHEN p.type = 'agency' THEN COALESCE(pf.total_billed, 0)
        WHEN p.type = 'buyer' THEN COALESCE(ps.total_billed, 0)
        ELSE 0
    END AS total_billed,
    CASE 
        WHEN p.type = 'supplier' THEN COALESCE(pp.total_paid, 0)
        WHEN p.type = 'agency' THEN COALESCE(pf.total_paid, 0)
        WHEN p.type = 'buyer' THEN COALESCE(ps.total_paid, 0)
        ELSE 0
    END AS total_paid,
    CASE 
        WHEN p.type = 'supplier' THEN COALESCE(pp.total_pending, 0)
        WHEN p.type = 'agency' THEN COALESCE(pf.total_pending, 0)
        WHEN p.type = 'buyer' THEN COALESCE(ps.total_pending, 0)
        ELSE 0
    END AS pending_balance
FROM public.parties p
LEFT JOIN party_purchase pp ON p.id = pp.party_id
LEFT JOIN party_freight pf ON p.id = pf.party_id
LEFT JOIN party_sale ps ON p.id = ps.party_id
WHERE p.deleted_at IS NULL;

-- Step 7: Re-grant permissions
GRANT SELECT ON public.load_details_view TO authenticated;
GRANT SELECT ON public.monthly_reports_view TO authenticated;
GRANT SELECT ON public.unsold_stock_view TO authenticated;
GRANT SELECT ON public.party_balances_view TO authenticated;

-- Step 8: Notify PostgREST to reload schema
DO $$
BEGIN
    PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;
