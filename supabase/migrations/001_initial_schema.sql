-- =============================================================
-- SYNDICHECK INITIAL SCHEMA
-- Run this in your Supabase SQL editor or via supabase db push
-- =============================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- =============================================================
-- ENUM TYPES
-- =============================================================
CREATE TYPE user_role AS ENUM ('lp', 'gp', 'admin');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'verified', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');
CREATE TYPE filing_type AS ENUM ('form_d', 'form_d_a', 'other');
CREATE TYPE exemption_type AS ENUM ('506b', '506c', 'other');
CREATE TYPE enforcement_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE claim_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE alert_type AS ENUM ('new_filing', 'enforcement_action', 'new_review', 'score_change');

-- =============================================================
-- PROFILES (extends Supabase auth.users)
-- =============================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'lp',
    avatar_url TEXT,
    is_accredited_investor BOOLEAN DEFAULT FALSE,
    company_name TEXT,
    -- Subscription info (denormalized for fast access)
    subscription_tier subscription_tier NOT NULL DEFAULT 'free',
    subscription_status subscription_status DEFAULT 'active',
    stripe_customer_id TEXT UNIQUE,
    -- Usage tracking
    monthly_searches_used INTEGER NOT NULL DEFAULT 0,
    monthly_searches_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to reset monthly search count
CREATE OR REPLACE FUNCTION reset_monthly_searches()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.monthly_searches_reset_at < NOW() - INTERVAL '30 days' THEN
        NEW.monthly_searches_used := 0;
        NEW.monthly_searches_reset_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reset_searches
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION reset_monthly_searches();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- SUBSCRIPTIONS
-- =============================================================
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_price_id TEXT NOT NULL,
    tier subscription_tier NOT NULL,
    status subscription_status NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON public.subscriptions(stripe_subscription_id);

-- =============================================================
-- SPONSORS
-- =============================================================
CREATE TABLE public.sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Identity
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    normalized_name TEXT NOT NULL,
    -- SEC identifiers
    cik TEXT,
    sec_file_number TEXT,
    ein TEXT,
    -- Location
    state TEXT,
    city TEXT,
    zip_code TEXT,
    address TEXT,
    -- Profile info
    description TEXT,
    website TEXT,
    logo_url TEXT,
    year_founded INTEGER,
    -- Aggregated stats
    total_offerings INTEGER NOT NULL DEFAULT 0,
    total_amount_raised BIGINT NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    average_rating NUMERIC(3,2) DEFAULT 0,
    -- Trust score
    trust_score INTEGER,
    trust_score_computed_at TIMESTAMPTZ,
    -- Flags
    has_enforcement_actions BOOLEAN NOT NULL DEFAULT FALSE,
    has_finra_flags BOOLEAN NOT NULL DEFAULT FALSE,
    is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_by UUID REFERENCES public.profiles(id),
    -- Timestamps
    first_filing_date TIMESTAMPTZ,
    latest_filing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sponsors_slug ON public.sponsors(slug);
CREATE INDEX idx_sponsors_name_trgm ON public.sponsors USING GIN (normalized_name gin_trgm_ops);
CREATE INDEX idx_sponsors_cik ON public.sponsors(cik);
CREATE INDEX idx_sponsors_trust_score ON public.sponsors(trust_score DESC NULLS LAST);
CREATE INDEX idx_sponsors_state ON public.sponsors(state);
CREATE INDEX idx_sponsors_total_raised ON public.sponsors(total_amount_raised DESC);

-- =============================================================
-- FILINGS (SEC Form D data)
-- =============================================================
CREATE TABLE public.filings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    -- SEC filing identifiers
    accession_number TEXT UNIQUE NOT NULL,
    sec_url TEXT,
    -- Filing details
    filing_type filing_type NOT NULL DEFAULT 'form_d',
    filed_at TIMESTAMPTZ NOT NULL,
    -- Offering details
    issuer_name TEXT NOT NULL,
    entity_type TEXT,
    industry_group TEXT,
    exemption exemption_type,
    -- Financial data (in cents)
    total_offering_amount BIGINT,
    total_amount_sold BIGINT,
    total_remaining BIGINT,
    minimum_investment_amount BIGINT,
    total_number_already_invested INTEGER,
    -- Sales compensation
    has_sales_compensation BOOLEAN DEFAULT FALSE,
    sales_compensation_amount BIGINT,
    -- Investor types
    has_non_accredited_investors BOOLEAN DEFAULT FALSE,
    number_non_accredited INTEGER DEFAULT 0,
    -- Related persons
    related_persons JSONB DEFAULT '[]',
    -- Raw data
    raw_data JSONB,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_filings_sponsor ON public.filings(sponsor_id);
CREATE INDEX idx_filings_filed_at ON public.filings(filed_at DESC);
CREATE INDEX idx_filings_accession ON public.filings(accession_number);
CREATE INDEX idx_filings_exemption ON public.filings(exemption);

-- =============================================================
-- ENFORCEMENT ACTIONS
-- =============================================================
CREATE TABLE public.enforcement_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL,
    sec_action_id TEXT,
    sec_url TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    respondent_names TEXT[] NOT NULL DEFAULT '{}',
    severity enforcement_severity NOT NULL DEFAULT 'medium',
    action_date TIMESTAMPTZ,
    resolution_date TIMESTAMPTZ,
    disgorgement_amount BIGINT,
    penalty_amount BIGINT,
    matched_automatically BOOLEAN NOT NULL DEFAULT TRUE,
    match_confidence NUMERIC(3,2),
    reviewed_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enforcement_sponsor ON public.enforcement_actions(sponsor_id);
CREATE INDEX idx_enforcement_date ON public.enforcement_actions(action_date DESC);
CREATE INDEX idx_enforcement_respondent ON public.enforcement_actions USING GIN (respondent_names);

-- =============================================================
-- BROKER RECORDS (FINRA BrokerCheck)
-- =============================================================
CREATE TABLE public.broker_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL,
    finra_crd_number TEXT,
    individual_name TEXT NOT NULL,
    is_currently_registered BOOLEAN DEFAULT FALSE,
    registration_status TEXT,
    total_disclosures INTEGER NOT NULL DEFAULT 0,
    customer_disputes INTEGER NOT NULL DEFAULT 0,
    regulatory_actions INTEGER NOT NULL DEFAULT 0,
    criminal_records INTEGER NOT NULL DEFAULT 0,
    current_employer TEXT,
    employment_history JSONB DEFAULT '[]',
    match_confidence NUMERIC(3,2),
    raw_data JSONB,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_broker_sponsor ON public.broker_records(sponsor_id);
CREATE INDEX idx_broker_crd ON public.broker_records(finra_crd_number);

-- =============================================================
-- PROPERTY CLAIMS
-- =============================================================
CREATE TABLE public.property_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    filing_id UUID REFERENCES public.filings(id) ON DELETE SET NULL,
    address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    property_type TEXT,
    claimed_acquisition_date TIMESTAMPTZ,
    claimed_purchase_price BIGINT,
    claimed_unit_count INTEGER,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_owner_name TEXT,
    verified_sale_date TIMESTAMPTZ,
    verified_sale_price BIGINT,
    verification_source TEXT,
    has_discrepancy BOOLEAN DEFAULT FALSE,
    discrepancy_notes TEXT,
    raw_verification_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_property_sponsor ON public.property_claims(sponsor_id);
CREATE INDEX idx_property_verified ON public.property_claims(verified);

-- =============================================================
-- TRUST SCORES
-- =============================================================
CREATE TABLE public.trust_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL,
    filing_compliance_score INTEGER NOT NULL,
    enforcement_score INTEGER NOT NULL,
    broker_record_score INTEGER NOT NULL,
    property_verification_score INTEGER NOT NULL,
    community_sentiment_score INTEGER NOT NULL,
    filing_consistency_score INTEGER NOT NULL,
    factors JSONB NOT NULL DEFAULT '{}',
    data_completeness NUMERIC(3,2),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_scores_sponsor ON public.trust_scores(sponsor_id);
CREATE INDEX idx_trust_scores_computed ON public.trust_scores(computed_at DESC);

-- =============================================================
-- REVIEWS
-- =============================================================
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    transparency_rating INTEGER CHECK (transparency_rating BETWEEN 1 AND 5),
    returns_accuracy_rating INTEGER CHECK (returns_accuracy_rating BETWEEN 1 AND 5),
    title TEXT,
    body TEXT NOT NULL,
    investment_amount_range TEXT,
    investment_year INTEGER,
    deal_type TEXT,
    is_verified_investor BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_reason TEXT,
    gp_response TEXT,
    gp_response_at TIMESTAMPTZ,
    gp_responded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_sponsor ON public.reviews(sponsor_id);
CREATE INDEX idx_reviews_user ON public.reviews(user_id);
CREATE INDEX idx_reviews_rating ON public.reviews(overall_rating);
CREATE UNIQUE INDEX idx_reviews_unique_user_sponsor ON public.reviews(user_id, sponsor_id);

-- =============================================================
-- WATCHLIST
-- =============================================================
CREATE TABLE public.watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    alert_on_new_filing BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_enforcement BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_new_review BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_score_change BOOLEAN NOT NULL DEFAULT TRUE,
    personal_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_watchlist_unique ON public.watchlist_items(user_id, sponsor_id);
CREATE INDEX idx_watchlist_user ON public.watchlist_items(user_id);

-- =============================================================
-- ALERTS
-- =============================================================
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL,
    type alert_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_emailed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON public.alerts(user_id);
CREATE INDEX idx_alerts_unread ON public.alerts(user_id) WHERE is_read = FALSE;

-- =============================================================
-- SEARCH LOGS
-- =============================================================
CREATE TABLE public.search_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,
    sponsor_clicked UUID REFERENCES public.sponsors(id),
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_logs_user ON public.search_logs(user_id);
CREATE INDEX idx_search_logs_date ON public.search_logs(created_at DESC);

-- =============================================================
-- SPONSOR CLAIMS
-- =============================================================
CREATE TABLE public.sponsor_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status claim_status NOT NULL DEFAULT 'pending',
    verification_method TEXT,
    verification_document_url TEXT,
    admin_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_sponsor ON public.sponsor_claims(sponsor_id);
CREATE INDEX idx_claims_status ON public.sponsor_claims(status);

-- =============================================================
-- ADMIN SETTINGS (non-secret platform configuration)
-- =============================================================
CREATE TABLE public.admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default settings
INSERT INTO public.admin_settings (key, value, description) VALUES
    ('free_tier_monthly_search_limit', '3', 'Max searches per month for free tier users'),
    ('maintenance_mode', 'false', 'Put the app in maintenance mode'),
    ('new_signups_enabled', 'true', 'Allow new user registrations'),
    ('review_moderation_enabled', 'true', 'Require admin approval for new reviews'),
    ('trust_score_cache_hours', '24', 'How long to cache trust scores before recomputing'),
    ('ai_reports_enabled', 'true', 'Enable AI-generated sponsor reports'),
    ('support_email', 'support@syndicheck.com', 'Support email shown to users');

-- =============================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Sponsors: publicly readable
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sponsors are publicly readable" ON public.sponsors FOR SELECT USING (true);

-- Filings: publicly readable
ALTER TABLE public.filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Filings are publicly readable" ON public.filings FOR SELECT USING (true);

-- Enforcement actions: publicly readable
ALTER TABLE public.enforcement_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enforcement actions are publicly readable" ON public.enforcement_actions FOR SELECT USING (true);

-- Broker records: publicly readable
ALTER TABLE public.broker_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Broker records are publicly readable" ON public.broker_records FOR SELECT USING (true);

-- Trust scores: publicly readable
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trust scores are publicly readable" ON public.trust_scores FOR SELECT USING (true);

-- Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published reviews are publicly readable" ON public.reviews FOR SELECT USING (is_published = true);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);

-- Watchlist: private to user
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own watchlist" ON public.watchlist_items FOR ALL USING (auth.uid() = user_id);

-- Alerts: private to user
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own alerts" ON public.alerts FOR ALL USING (auth.uid() = user_id);

-- Search logs
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own searches" ON public.search_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can log searches" ON public.search_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscriptions: private to user
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Admin settings: publicly readable (non-secret config only)
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin settings are publicly readable" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can modify settings" ON public.admin_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
