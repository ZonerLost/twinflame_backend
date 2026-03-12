-- ============================================================
-- 007: Flames, Moderation, Location, Friend Requests
-- ============================================================

-- 1. FLAMES TABLE
CREATE TABLE public.flames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    remaining_flames INTEGER DEFAULT 0,
    last_daily_grant TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_flames_user ON public.flames(user_id);

-- 2. FLAME PURCHASES TABLE
CREATE TABLE public.flame_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    package_name VARCHAR(50) NOT NULL,
    flame_count INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stripe_payment_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_flame_purchases_user ON public.flame_purchases(user_id);

-- 3. FRIEND REQUESTS TABLE
CREATE TABLE public.friend_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    request_type VARCHAR(20) DEFAULT 'like' CHECK (request_type IN ('like', 'superlike', 'message')),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sender_id, receiver_id)
);
CREATE INDEX idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_status ON public.friend_requests(status);

-- 4. REPORTS TABLE
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('harassment', 'spam', 'fake_profile', 'inappropriate_content', 'other')),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX idx_reports_reported ON public.reports(reported_user_id);

-- 5. MODERATION LOGS TABLE
CREATE TABLE public.moderation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    moderator_id UUID REFERENCES public.users(id),
    action VARCHAR(50) NOT NULL CHECK (action IN ('content_approved', 'content_rejected', 'user_reported', 'account_suspended', 'account_banned', 'account_reactivated', 'content_removed')),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_moderation_logs_user ON public.moderation_logs(user_id);

-- 6. USER ADDRESSES TABLE
CREATE TABLE public.user_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL DEFAULT 'Home',
    address_text VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_user_addresses_user ON public.user_addresses(user_id);

-- 7. BANNED WORDS TABLE
CREATE TABLE public.banned_words (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    word VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.banned_words (word) VALUES
    ('porn'), ('nude'), ('escort'), ('sex'), ('drugs'), ('violence'),
    ('xxx'), ('naked'), ('abuse'), ('trafficking');

-- 8. ADD ACCOUNT STATUS TO USERS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned'));

-- 9. ADD MODERATION STATUS TO PHOTOS
ALTER TABLE public.profile_photos ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending_review' CHECK (moderation_status IN ('pending_review', 'approved', 'rejected'));
ALTER TABLE public.profile_photos ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 10. ADD MODERATION STATUS TO PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_moderation_status VARCHAR(20) DEFAULT 'approved' CHECK (bio_moderation_status IN ('pending_review', 'approved', 'rejected'));

-- 11. ADD DAILY FLAMES TO SUBSCRIPTION PLANS
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS daily_flames INTEGER DEFAULT 0;
UPDATE public.subscription_plans SET daily_flames = 0 WHERE name = 'FREE PACKAGE';
UPDATE public.subscription_plans SET daily_flames = 1 WHERE name = 'RECOMMENDED';
UPDATE public.subscription_plans SET daily_flames = 3 WHERE name = 'PREMIUM PACKAGE';

-- 12. UPDATE handle_new_user to create flames row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id) VALUES (NEW.id);
    INSERT INTO public.profiles (user_id) VALUES (NEW.id);
    INSERT INTO public.beliefs (user_id) VALUES (NEW.id);
    INSERT INTO public.flames (user_id, remaining_flames) VALUES (NEW.id, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE public.flames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flame_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.flames FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.flame_purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.friend_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.moderation_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.user_addresses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.banned_words FOR ALL USING (true) WITH CHECK (true);

-- Triggers
CREATE TRIGGER tr_flames_updated_at BEFORE UPDATE ON public.flames FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_friend_requests_updated_at BEFORE UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_user_addresses_updated_at BEFORE UPDATE ON public.user_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
