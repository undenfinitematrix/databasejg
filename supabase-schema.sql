-- =============================================
-- AeroChat Dashboard - Supabase Schema
-- =============================================

-- Main signups table (mirrors your dashboard columns)
CREATE TABLE signups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Contact info
    email TEXT NOT NULL UNIQUE,
    contact_number TEXT,
    business_name TEXT,
    country TEXT,
    
    -- Links
    website_url TEXT,                -- Customer's store/website URL
    admin_url TEXT,                  -- AeroChat backend admin link for this account
    
    -- Timestamps
    signup_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    churned_date TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    activation_date TIMESTAMPTZ,
    first_chat_date TIMESTAMPTZ,
    
    -- Plan & Type
    current_plan TEXT DEFAULT 'free' CHECK (current_plan IN ('free', 'free_trial', 'pro', 'enterprise', 'churned')),
    type TEXT CHECK (type IN ('shopify', 'direct', 'enterprise')),
    
    -- Attribution
    source TEXT CHECK (source IN ('app_store', 'google_search', 'direct', 'referral', 'paid_ads', 'other')),
    utm_campaign TEXT,
    referred_by TEXT,
    
    -- Metrics (updated via sync)
    num_chats INTEGER DEFAULT 0,
    num_customers INTEGER DEFAULT 0,
    num_kb_docs INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_signups_signup_date ON signups(signup_date DESC);
CREATE INDEX idx_signups_activation_date ON signups(activation_date);
CREATE INDEX idx_signups_current_plan ON signups(current_plan);
CREATE INDEX idx_signups_source ON signups(source);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signups_updated_at
    BEFORE UPDATE ON signups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();


-- =============================================
-- Views for Dashboard Metrics
-- =============================================

-- Summary metrics view (for the top cards)
CREATE VIEW dashboard_metrics AS
SELECT
    -- Current period (last 30 days)
    COUNT(*) FILTER (WHERE signup_date >= NOW() - INTERVAL '30 days') AS signups_30d,
    COUNT(*) FILTER (WHERE activation_date >= NOW() - INTERVAL '30 days') AS activated_30d,
    COUNT(*) FILTER (WHERE current_plan IN ('pro', 'enterprise') AND signup_date >= NOW() - INTERVAL '30 days') AS converted_30d,
    
    -- Previous period (30-60 days ago)
    COUNT(*) FILTER (WHERE signup_date >= NOW() - INTERVAL '60 days' AND signup_date < NOW() - INTERVAL '30 days') AS signups_prev_30d,
    COUNT(*) FILTER (WHERE activation_date >= NOW() - INTERVAL '60 days' AND activation_date < NOW() - INTERVAL '30 days') AS activated_prev_30d,
    COUNT(*) FILTER (WHERE current_plan IN ('pro', 'enterprise') AND signup_date >= NOW() - INTERVAL '60 days' AND signup_date < NOW() - INTERVAL '30 days') AS converted_prev_30d,
    
    -- Activation rate
    ROUND(
        (COUNT(*) FILTER (WHERE activation_date IS NOT NULL AND signup_date >= NOW() - INTERVAL '30 days')::NUMERIC / 
        NULLIF(COUNT(*) FILTER (WHERE signup_date >= NOW() - INTERVAL '30 days'), 0)) * 100, 
        1
    ) AS activation_rate_30d,
    
    -- Avg time to activation (in days)
    ROUND(
        AVG(EXTRACT(EPOCH FROM (activation_date - signup_date)) / 86400) FILTER (WHERE activation_date IS NOT NULL AND signup_date >= NOW() - INTERVAL '30 days'),
        1
    ) AS avg_time_to_activation_days
    
FROM signups;


-- Metrics by date range (parameterized via RPC function)
CREATE OR REPLACE FUNCTION get_metrics(
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_signups BIGINT,
    total_activated BIGINT,
    total_converted BIGINT,
    activation_rate NUMERIC,
    avg_time_to_activation NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_signups,
        COUNT(*) FILTER (WHERE activation_date BETWEEN start_date AND end_date)::BIGINT AS total_activated,
        COUNT(*) FILTER (WHERE current_plan IN ('pro', 'enterprise'))::BIGINT AS total_converted,
        ROUND(
            (COUNT(*) FILTER (WHERE activation_date IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
            1
        ) AS activation_rate,
        ROUND(
            AVG(EXTRACT(EPOCH FROM (activation_date - signup_date)) / 86400) FILTER (WHERE activation_date IS NOT NULL),
            1
        ) AS avg_time_to_activation
    FROM signups
    WHERE signup_date BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- Row Level Security (optional but recommended)
-- =============================================

-- Enable RLS
ALTER TABLE signups ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access for authenticated users (your dashboard)
CREATE POLICY "Allow read access for authenticated users" ON signups
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow insert/update from service role only (your backend sync)
CREATE POLICY "Allow write access for service role" ON signups
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- =============================================
-- Sample Data Insert (for testing)
-- =============================================

INSERT INTO signups (email, business_name, country, website_url, admin_url, signup_date, current_plan, type, source, activation_date, first_chat_date, num_chats, num_customers) VALUES
('hello@letscrackle.com', 'My Store', NULL, 'https://letscrackle.com', 'https://app.aerochat.ai/admin/acc_123', '2026-01-18 17:36:00+08', 'free', 'shopify', 'app_store', NULL, NULL, 0, 0),
('fivestarparts1@gmail.com', 'Five Star Cycles', 'United States', 'https://fivestarcycles.com', 'https://app.aerochat.ai/admin/acc_124', '2026-01-18 03:26:00+08', 'free', 'shopify', 'app_store', '2026-01-18 16:12:00+08', '2026-01-18 18:30:00+08', 3, 2),
('jenny.tran@outlook.com', 'Tran Cosmetics', 'Vietnam', 'https://trancosmetics.vn', 'https://app.aerochat.ai/admin/acc_125', '2026-01-15 08:15:00+08', 'pro', 'shopify', 'app_store', '2026-01-15 10:00:00+08', '2026-01-15 11:45:00+08', 47, 23),
('marcus.weber@gmail.com', 'Weber Electronics', 'Germany', 'https://weber-electronics.de', 'https://app.aerochat.ai/admin/acc_126', '2026-01-14 15:45:00+08', 'pro', 'shopify', 'google_search', '2026-01-14 17:30:00+08', '2026-01-14 19:00:00+08', 89, 41),
('lisa.nguyen@gmail.com', 'Nguyen Home Decor', 'Australia', 'https://nguyenhomedecor.com.au', 'https://app.aerochat.ai/admin/acc_127', '2026-01-12 10:00:00+08', 'churned', 'shopify', 'google_search', '2026-01-12 12:00:00+08', '2026-01-12 13:30:00+08', 8, 3);


-- =============================================
-- Useful Queries for Dashboard
-- =============================================

-- Get all signups for table (paginated)
-- SELECT * FROM signups ORDER BY signup_date DESC LIMIT 25 OFFSET 0;

-- Get metrics for specific date range
-- SELECT * FROM get_metrics('2026-01-01'::timestamptz, '2026-01-31'::timestamptz);

-- Get signups by source (for pie chart)
-- SELECT source, COUNT(*) FROM signups GROUP BY source;

-- Get daily signup trend (for line chart)
-- SELECT DATE(signup_date) as date, COUNT(*) as signups 
-- FROM signups 
-- WHERE signup_date >= NOW() - INTERVAL '30 days'
-- GROUP BY DATE(signup_date) 
-- ORDER BY date;
