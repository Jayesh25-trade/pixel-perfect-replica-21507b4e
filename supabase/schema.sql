-- =========================================================================
-- AARAV TRADERS – COMPLETE PRODUCTION DATABASE SCHEMA & POLICIES
-- Auto-consolidated from migrations
-- =========================================================================

-- Aarav Traders: Core Schema Migration
-- Migration: 20261122000001_create_schema.sql

-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Settings Table (Holds global rates & defaults)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gst_rate_coal NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    gst_rate_briquette NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    tcs_rate_purchase NUMERIC(5,2) NOT NULL DEFAULT 2.00,
    default_credit_days INT NOT NULL DEFAULT 30,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS tcs_rate_purchase NUMERIC(5,2) NOT NULL DEFAULT 2.00;

-- Allowed Emails for Partner Access
CREATE TABLE IF NOT EXISTS public.allowed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'partner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.allowed_emails ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'partner';

-- Firm Members Table (Authenticated Partners)
CREATE TABLE IF NOT EXISTS public.firm_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'partner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parties Table (Suppliers, Transport Agencies, Buyers)
CREATE TABLE IF NOT EXISTS public.parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('supplier', 'agency', 'buyer')),
    phone TEXT,
    credit_days INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Loads Table
CREATE TABLE IF NOT EXISTS public.loads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_date DATE NOT NULL DEFAULT CURRENT_DATE,
    material TEXT NOT NULL CHECK (material IN ('coal', 'briquette')),
    supplier_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
    tons_bought NUMERIC(10,3) NOT NULL CHECK (tons_bought > 0),
    buy_rate NUMERIC(12,2) NOT NULL CHECK (buy_rate > 0),
    agency_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
    truck_number TEXT NOT NULL,
    tons_loaded NUMERIC(10,3) NOT NULL CHECK (tons_loaded > 0),
    freight_rate NUMERIC(12,2) NOT NULL CHECK (freight_rate >= 0),
    buyer_id UUID REFERENCES public.parties(id) ON DELETE RESTRICT,
    sale_date DATE,
    tons_received NUMERIC(10,3) CHECK (tons_received >= 0),
    sale_rate NUMERIC(12,2) CHECK (sale_rate >= 0),
    credit_days INT DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE RESTRICT,
    party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('purchase', 'freight', 'sale')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mode TEXT NOT NULL CHECK (mode IN ('UPI', 'Cheque')),
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Fast Querying & Joins
CREATE INDEX IF NOT EXISTS idx_loads_load_date ON public.loads(load_date);
CREATE INDEX IF NOT EXISTS idx_loads_sale_date ON public.loads(sale_date);
CREATE INDEX IF NOT EXISTS idx_loads_supplier_id ON public.loads(supplier_id);
CREATE INDEX IF NOT EXISTS idx_loads_agency_id ON public.loads(agency_id);
CREATE INDEX IF NOT EXISTS idx_loads_buyer_id ON public.loads(buyer_id);
CREATE INDEX IF NOT EXISTS idx_loads_deleted_at ON public.loads(deleted_at);

CREATE INDEX IF NOT EXISTS idx_payments_load_id ON public.payments(load_id);
CREATE INDEX IF NOT EXISTS idx_payments_party_id ON public.payments(party_id);
CREATE INDEX IF NOT EXISTS idx_payments_kind ON public.payments(kind);
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON public.payments(deleted_at);

CREATE INDEX IF NOT EXISTS idx_parties_type ON public.parties(type);
CREATE INDEX IF NOT EXISTS idx_parties_deleted_at ON public.parties(deleted_at);

-- Enable Supabase Realtime for loads and payments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'loads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.loads;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;


-- Aarav Traders: Triggers & Constraints
-- Migration: 20261122000002_create_triggers.sql

-- 1. Trigger Function to Reject Overpayments against Bill Total
CREATE OR REPLACE FUNCTION public.validate_payment_not_exceeding_bill()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
    v_load RECORD;
    v_gst_rate NUMERIC(5,2);
    v_tcs_rate NUMERIC(5,2) := 2.00;
    v_bill_total NUMERIC(12,2) := 0;
    v_existing_payments NUMERIC(12,2) := 0;
BEGIN
    -- Fetch and row-lock the load to prevent concurrent payment race conditions
    SELECT * INTO v_load FROM public.loads WHERE id = NEW.load_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated load not found or has been deleted.';
    END IF;

    -- Fetch current material GST rate & purchase TCS rate from settings
    SELECT 
        COALESCE(tcs_rate_purchase, 2.00) INTO v_tcs_rate 
    FROM public.settings LIMIT 1;
    v_tcs_rate := COALESCE(v_tcs_rate, 2.00);

    IF v_load.material = 'coal' THEN
        SELECT gst_rate_coal INTO v_gst_rate FROM public.settings LIMIT 1;
        v_gst_rate := COALESCE(v_gst_rate, 18.00);
    ELSE
        SELECT gst_rate_briquette INTO v_gst_rate FROM public.settings LIMIT 1;
        v_gst_rate := COALESCE(v_gst_rate, 5.00);
    END IF;

    -- Determine the bill total based on payment kind
    IF NEW.kind = 'purchase' THEN
        IF v_load.material = 'coal' THEN
            -- Coal purchase includes 18% GST and 2% TCS on invoice total (Base + GST)
            v_bill_total := ROUND((ROUND(v_load.tons_bought * v_load.buy_rate, 2) + ROUND((v_load.tons_bought * v_load.buy_rate) * (v_gst_rate / 100.0), 2)) * (1 + (v_tcs_rate / 100.0)), 2);
        ELSE
            -- Briquette purchase includes 5% GST and strictly NO TCS
            v_bill_total := ROUND((v_load.tons_bought * v_load.buy_rate) * (1 + (v_gst_rate / 100.0)), 2);
        END IF;
    ELSIF NEW.kind = 'freight' THEN
        -- Freight strictly has NO GST and NO TCS
        v_bill_total := ROUND(v_load.tons_loaded * v_load.freight_rate, 2);
    ELSIF NEW.kind = 'sale' THEN
        -- If sale details are not yet entered, reject payment
        IF v_load.sale_date IS NULL OR v_load.tons_received IS NULL OR v_load.sale_rate IS NULL THEN
            RAISE EXCEPTION 'Cannot record sale payment: load has not been marked as sold yet.';
        END IF;
        -- Sale includes GST (18% Coal / 5% Briquette) and strictly NO TCS
        v_bill_total := ROUND((v_load.tons_received * v_load.sale_rate) * (1 + (v_gst_rate / 100.0)), 2);
    ELSE
        RAISE EXCEPTION 'Invalid payment kind: %', NEW.kind;
    END IF;

    -- Calculate existing payments for this load & kind (excluding the current row if updating, and excluding soft-deleted)
    SELECT COALESCE(SUM(amount), 0) INTO v_existing_payments
    FROM public.payments
    WHERE load_id = NEW.load_id
      AND kind = NEW.kind
      AND deleted_at IS NULL
      AND (TG_OP = 'INSERT' OR id <> NEW.id);

    IF (v_existing_payments + NEW.amount) > v_bill_total THEN
        RAISE EXCEPTION 'Payment of ₹% exceeds remaining bill balance. Bill Total: ₹%, Existing Payments: ₹%, Maximum Allowed: ₹%',
            NEW.amount, v_bill_total, v_existing_payments, (v_bill_total - v_existing_payments);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment ON public.payments;
CREATE TRIGGER trg_validate_payment
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW
    WHEN (NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.validate_payment_not_exceeding_bill();

-- 1b. Trigger Function on Loads: Prevent Editing Load Below Already Paid Amounts
CREATE OR REPLACE FUNCTION public.validate_load_update_not_below_paid()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
    v_gst_rate NUMERIC(5,2);
    v_tcs_rate NUMERIC(5,2) := 2.00;
    v_new_purchase_total NUMERIC(12,2) := 0;
    v_new_freight_total NUMERIC(12,2) := 0;
    v_new_sale_total NUMERIC(12,2) := 0;
    v_paid_purchase NUMERIC(12,2) := 0;
    v_paid_freight NUMERIC(12,2) := 0;
    v_paid_sale NUMERIC(12,2) := 0;
BEGIN
    -- If marking as soft-deleted, do not validate bill thresholds
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;
    -- Fetch GST rate and purchase TCS rate from settings
    SELECT COALESCE(tcs_rate_purchase, 2.00) INTO v_tcs_rate FROM public.settings LIMIT 1;
    v_tcs_rate := COALESCE(v_tcs_rate, 2.00);

    IF NEW.material = 'coal' THEN
        SELECT COALESCE(gst_rate_coal, 18.00) INTO v_gst_rate FROM public.settings LIMIT 1;
    ELSE
        SELECT COALESCE(gst_rate_briquette, 5.00) INTO v_gst_rate FROM public.settings LIMIT 1;
    END IF;
    v_gst_rate := COALESCE(v_gst_rate, 18.00);

    -- Compute new bill totals: Coal purchase has 2% TCS; Briquette purchase has 0% TCS; Freight and Sale have 0% TCS
    IF NEW.material = 'coal' THEN
        v_new_purchase_total := ROUND((ROUND(NEW.tons_bought * NEW.buy_rate, 2) + ROUND((NEW.tons_bought * NEW.buy_rate) * (v_gst_rate / 100.0), 2)) * (1 + (v_tcs_rate / 100.0)), 2);
    ELSE
        v_new_purchase_total := ROUND((NEW.tons_bought * NEW.buy_rate) * (1 + (v_gst_rate / 100.0)), 2);
    END IF;
    v_new_freight_total := ROUND(NEW.tons_loaded * NEW.freight_rate, 2);

    IF NEW.sale_date IS NOT NULL AND NEW.tons_received IS NOT NULL AND NEW.sale_rate IS NOT NULL THEN
        v_new_sale_total := ROUND((NEW.tons_received * NEW.sale_rate) * (1 + (v_gst_rate / 100.0)), 2);
    END IF;

    -- Aggregate already paid non-deleted payments
    SELECT
        COALESCE(SUM(CASE WHEN kind = 'purchase' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN kind = 'freight' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN kind = 'sale' THEN amount ELSE 0 END), 0)
    INTO v_paid_purchase, v_paid_freight, v_paid_sale
    FROM public.payments
    WHERE load_id = NEW.id AND deleted_at IS NULL;

    IF v_new_purchase_total < v_paid_purchase THEN
        RAISE EXCEPTION 'Cannot update load: new purchase bill (₹%) is less than already paid amount (₹%).',
            v_new_purchase_total, v_paid_purchase;
    END IF;

    IF v_new_freight_total < v_paid_freight THEN
        RAISE EXCEPTION 'Cannot update load: new freight bill (₹%) is less than already paid amount (₹%).',
            v_new_freight_total, v_paid_freight;
    END IF;

    IF v_new_sale_total < v_paid_sale THEN
        RAISE EXCEPTION 'Cannot update load: new sale bill (₹%) is less than already paid amount (₹%).',
            v_new_sale_total, v_paid_sale;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_load_update ON public.loads;
CREATE TRIGGER trg_validate_load_update
    BEFORE UPDATE ON public.loads
    FOR EACH ROW
    WHEN (NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.validate_load_update_not_below_paid();

-- 2. Audit Logging Trigger Function
CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID;
    v_record_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF TG_OP = 'INSERT' THEN
        v_record_id := NEW.id;
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
        VALUES (v_user_id, TG_OP, TG_TABLE_NAME, v_record_id, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_record_id := NEW.id;
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
        VALUES (v_user_id, TG_OP, TG_TABLE_NAME, v_record_id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
        VALUES (v_user_id, TG_OP, TG_TABLE_NAME, v_record_id, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Apply Audit Log Trigger to Tables
DROP TRIGGER IF EXISTS trg_audit_loads ON public.loads;
CREATE TRIGGER trg_audit_loads
    AFTER INSERT OR UPDATE OR DELETE ON public.loads
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_parties ON public.parties;
CREATE TRIGGER trg_audit_parties
    AFTER INSERT OR UPDATE OR DELETE ON public.parties
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_settings ON public.settings;
CREATE TRIGGER trg_audit_settings
    AFTER INSERT OR UPDATE OR DELETE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

-- 3. Signup Trigger on auth.users for Invite-Only Partner Verification
CREATE OR REPLACE FUNCTION public.handle_partner_signup()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
    v_allowed BOOLEAN;
    v_role TEXT;
BEGIN
    -- Case-insensitive whitelist verification
    SELECT EXISTS (
        SELECT 1 FROM public.allowed_emails WHERE LOWER(email) = LOWER(NEW.email)
    ), COALESCE((
        SELECT role FROM public.allowed_emails WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1
    ), 'partner')
    INTO v_allowed, v_role;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Access denied. % is not authorized as an Aarav Traders partner.', NEW.email;
    END IF;

    INSERT INTO public.firm_members (user_id, email, role)
    VALUES (NEW.id, LOWER(NEW.email), v_role)
    ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, role = EXCLUDED.role;

    RETURN NEW;
END;
$$;

-- Attach trigger to auth.users if permissions allow
DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_partner_signup();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping on_auth_user_created trigger on auth.users (requires superuser or supabase_admin): %', SQLERRM;
END $$;

-- 4. Trigger on allowed_emails INSERT: Auto-grant firm membership if user has already signed up
CREATE OR REPLACE FUNCTION public.handle_allowed_email_inserted()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
    v_existing_user_id UUID;
BEGIN
    -- Check if a user with this email has already registered in auth.users
    SELECT id INTO v_existing_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;

    IF v_existing_user_id IS NOT NULL THEN
        INSERT INTO public.firm_members (user_id, email, role)
        VALUES (v_existing_user_id, LOWER(NEW.email), COALESCE(NEW.role, 'partner'))
        ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, role = EXCLUDED.role;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_allowed_email_inserted ON public.allowed_emails;
CREATE TRIGGER trg_on_allowed_email_inserted
    AFTER INSERT ON public.allowed_emails
    FOR EACH ROW EXECUTE FUNCTION public.handle_allowed_email_inserted();


-- Aarav Traders: Authoritative Business Calculation Views
-- Migration: 20261122000003_create_views.sql

-- Drop dependent views first to allow clean column modifications without 42P16 error
DROP VIEW IF EXISTS public.monthly_reports_view CASCADE;
DROP VIEW IF EXISTS public.unsold_stock_view CASCADE;
DROP VIEW IF EXISTS public.party_balances_view CASCADE;
DROP VIEW IF EXISTS public.load_details_view CASCADE;

-- 1. Detailed Loads View: Contains all exact formula computations
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

    -- Dynamic GST Rate applicable to this load's material (Coal 18% / Briquette 5%)
    CASE WHEN l.material = 'coal' THEN s.gst_rate_coal ELSE s.gst_rate_briquette END AS gst_rate,
    CASE WHEN l.material = 'coal' THEN s.tcs_rate_purchase ELSE 0.00 END AS tcs_rate,

    -- Purchase Computations (Coal has 18% GST + 2% TCS; Briquette has 5% GST and NO TCS)
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

    -- Sale Computations (Only when sold; No TCS)
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

    -- Profit per ton = profit / tons_received
    CASE 
        WHEN l.sale_date IS NOT NULL AND l.tons_received IS NOT NULL AND l.tons_received > 0 AND l.sale_rate IS NOT NULL
        THEN ROUND(((l.tons_received * l.sale_rate) - (l.tons_bought * l.buy_rate) - (l.tons_loaded * l.freight_rate)) / l.tons_received, 2)
        ELSE NULL 
    END AS profit_per_ton,

    -- Due Date = sale_date + credit_days
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

    -- Overdue Check: sale_pending > 0 and due_date < today
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

-- 2. Monthly Reports View: Grouped by month of SALE date
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

-- 3. Unsold Stock Summary View: Loads not yet sold
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

-- 4. Party Balances View: Summarizes pending money per party
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


-- Aarav Traders: Initial Configuration Only (NO FAKE / DEMO DATA)
-- Migration: 20261122000004_initial_config.sql

-- Insert sole settings configuration row if not present
INSERT INTO public.settings (gst_rate_coal, gst_rate_briquette, tcs_rate_purchase, default_credit_days)
SELECT 18.00, 5.00, 2.00, 30
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- Authorize initial firm partner
INSERT INTO public.allowed_emails (email, role)
VALUES ('aaravtraders81@gmail.com', 'partner')
ON CONFLICT (email) DO NOTHING;

-- Link auth user to firm members if user already exists in auth.users
INSERT INTO public.firm_members (user_id, email, role)
SELECT id, email, 'partner'
FROM auth.users
WHERE LOWER(email) = LOWER('aaravtraders81@gmail.com')
ON CONFLICT (email) DO UPDATE 
SET user_id = EXCLUDED.user_id, role = 'partner';


-- Aarav Traders: Row Level Security (RLS) & Access Hardening
-- Migration: 20261122000005_create_rls_policies.sql

-- Helper function to check if the current user is a firm member
CREATE OR REPLACE FUNCTION public.is_firm_member()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.firm_members
        WHERE user_id = auth.uid()
    );
END;
$$;

-- 1. Settings Table RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Firm members can view settings" ON public.settings;
CREATE POLICY "Firm members can view settings"
    ON public.settings FOR SELECT
    TO authenticated
    USING (public.is_firm_member());

DROP POLICY IF EXISTS "Firm members can update settings" ON public.settings;
CREATE POLICY "Firm members can update settings"
    ON public.settings FOR UPDATE
    TO authenticated
    USING (public.is_firm_member())
    WITH CHECK (public.is_firm_member());

-- 2. Allowed Emails RLS
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Firm members can view allowed emails" ON public.allowed_emails;
CREATE POLICY "Firm members can view allowed emails"
    ON public.allowed_emails FOR SELECT
    TO authenticated
    USING (public.is_firm_member());

-- 3. Firm Members RLS
ALTER TABLE public.firm_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Firm members can view all firm members" ON public.firm_members;
DROP POLICY IF EXISTS "Users can view own firm membership" ON public.firm_members;
CREATE POLICY "Users can view own firm membership"
    ON public.firm_members FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 4. Parties Table RLS
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Firm members can view parties" ON public.parties;
CREATE POLICY "Firm members can view parties"
    ON public.parties FOR SELECT
    TO authenticated
    USING (public.is_firm_member());

DROP POLICY IF EXISTS "Firm members can insert parties" ON public.parties;
CREATE POLICY "Firm members can insert parties"
    ON public.parties FOR INSERT
    TO authenticated
    WITH CHECK (public.is_firm_member());

DROP POLICY IF EXISTS "Firm members can update parties" ON public.parties;
CREATE POLICY "Firm members can update parties"
    ON public.parties FOR UPDATE
    TO authenticated
    USING (public.is_firm_member())
    WITH CHECK (public.is_firm_member());

-- Hard deletes are strictly disallowed (soft delete via deleted_at only)
-- No DELETE policy is created for public.parties.

-- 5. Loads Table RLS
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Firm members can view loads" ON public.loads;
CREATE POLICY "Firm members can view loads"
    ON public.loads FOR SELECT
    TO authenticated
    USING (public.is_firm_member());

DROP POLICY IF EXISTS "Firm members can insert loads" ON public.loads;
CREATE POLICY "Firm members can insert loads"
    ON public.loads FOR INSERT
    TO authenticated
    WITH CHECK (public.is_firm_member());

DROP POLICY IF EXISTS "Firm members can update loads" ON public.loads;
CREATE POLICY "Firm members can update loads"
    ON public.loads FOR UPDATE
    TO authenticated
    USING (public.is_firm_member())
    WITH CHECK (public.is_firm_member());

-- Hard deletes are strictly disallowed (soft delete via deleted_at only)
-- No DELETE policy is created for public.loads.

-- 6. Payments Table RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Firm members can view payments" ON public.payments;
CREATE POLICY "Firm members can view payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (public.is_firm_member());

DROP POLICY IF EXISTS "Firm members can insert payments" ON public.payments;
CREATE POLICY "Firm members can insert payments"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (public.is_firm_member());

DROP POLICY IF EXISTS "Firm members can update payments" ON public.payments;
CREATE POLICY "Firm members can update payments"
    ON public.payments FOR UPDATE
    TO authenticated
    USING (public.is_firm_member())
    WITH CHECK (public.is_firm_member());

-- Hard deletes are strictly disallowed (soft delete via deleted_at only)
-- No DELETE policy is created for public.payments.

-- 7. Audit Logs RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Firm members can view audit logs" ON public.audit_logs;
CREATE POLICY "Firm members can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_firm_member());

-- Audit logs are inserted by DB triggers only. No client INSERT/UPDATE/DELETE allowed.

-- 8. Least-Privilege Table & View Grants
-- Revoke all table/view privileges from public and anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public, anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM public, anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM public, anon;

-- Anon role: ZERO table or view access (only usage on schema for connection)
GRANT USAGE ON SCHEMA public TO anon;

-- Authenticated role: strictly scoped to business operations (NO DELETE on loads, payments, parties)
GRANT USAGE ON SCHEMA public TO authenticated;

-- Settings: view and update configuration
GRANT SELECT, UPDATE ON public.settings TO authenticated;

-- Allowed emails & members: view whitelist
GRANT SELECT ON public.allowed_emails TO authenticated;
GRANT SELECT ON public.firm_members TO authenticated;

-- Parties: view, create, and update (NO DELETE - soft delete via deleted_at only)
GRANT SELECT, INSERT, UPDATE ON public.parties TO authenticated;

-- Loads: view, create, and update (NO DELETE - soft delete via deleted_at only)
GRANT SELECT, INSERT, UPDATE ON public.loads TO authenticated;

-- Payments: view, create, and update (NO DELETE - soft delete via deleted_at only)
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;

-- Audit logs: read-only for authenticated partners (inserts handled by DB triggers only)
GRANT SELECT ON public.audit_logs TO authenticated;

-- Authoritative calculation views: SELECT only
GRANT SELECT ON public.load_details_view TO authenticated;
GRANT SELECT ON public.monthly_reports_view TO authenticated;
GRANT SELECT ON public.unsold_stock_view TO authenticated;
GRANT SELECT ON public.party_balances_view TO authenticated;

-- Sequences: authenticated role may read sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Routines & Functions:
-- 1. Strip execute on all routines from public, anon, and authenticated
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM public, anon, authenticated;

-- 2. Explicitly grant EXECUTE only on helper functions needed by RLS policies
GRANT EXECUTE ON FUNCTION public.is_firm_member() TO authenticated;

-- 3. Lock down default privileges on future objects created in schema public
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM public, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM public, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM public, anon;

-- Notify PostgREST to reload the schema cache immediately
DO $$
BEGIN
    PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

