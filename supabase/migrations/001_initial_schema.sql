-- ============================================================
-- Twin Flame Dating App - Complete Database Schema
-- Run this in Supabase SQL Editor to create all tables
-- ============================================================
-- This schema uses Supabase Auth (auth.users) for authentication.
-- The public.users table extends auth.users with app-specific fields.
-- Supabase Auth handles: passwords, OTP, email/phone verify, OAuth.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- The id references auth.users.id — auto-populated via trigger.
-- ============================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_profile_complete BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    face_recognition_enabled BOOLEAN DEFAULT FALSE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PROFILES TABLE
-- ============================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100),
    biography TEXT,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    date_of_birth DATE,
    marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'separated', 'not_disclosed')),
    looking_for VARCHAR(30) CHECK (looking_for IN ('males_for_males', 'males_for_females', 'females_for_females', 'females_for_males', 'group_socials')),
    -- Location (PostGIS point for geospatial queries)
    location GEOGRAPHY(POINT, 4326),
    location_text VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    -- Profile completion tracking
    profile_step INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. PROFILE PHOTOS TABLE
-- ============================================================
CREATE TABLE public.profile_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profile_photos_user ON public.profile_photos(user_id);

-- ============================================================
-- 4. LIFESTYLE CHOICES TABLE
-- ============================================================
CREATE TABLE public.lifestyle_choices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    choice VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, choice)
);

CREATE INDEX idx_lifestyle_user ON public.lifestyle_choices(user_id);

-- ============================================================
-- 5. BELIEFS TABLE
-- ============================================================
CREATE TABLE public.beliefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    earth_controlled VARCHAR(10) DEFAULT 'not_sure' CHECK (earth_controlled IN ('yes', 'no', 'not_sure')),
    earth_controlled_tag VARCHAR(100),
    religious VARCHAR(10) DEFAULT 'not_sure' CHECK (religious IN ('yes', 'no', 'not_sure')),
    religious_tag VARCHAR(100),
    pro_government VARCHAR(10) DEFAULT 'not_sure' CHECK (pro_government IN ('yes', 'no', 'not_sure')),
    pro_government_tag VARCHAR(100),
    aliens VARCHAR(10) DEFAULT 'not_sure' CHECK (aliens IN ('yes', 'no', 'not_sure')),
    aliens_tag VARCHAR(100),
    reincarnation VARCHAR(10) DEFAULT 'not_sure' CHECK (reincarnation IN ('yes', 'no', 'not_sure')),
    reincarnation_tag VARCHAR(100),
    moon_landing VARCHAR(10) DEFAULT 'not_sure' CHECK (moon_landing IN ('yes', 'no', 'not_sure')),
    moon_landing_tag VARCHAR(100),
    matrix VARCHAR(10) DEFAULT 'not_sure' CHECK (matrix IN ('yes', 'no', 'not_sure')),
    matrix_tag VARCHAR(100),
    vaccines VARCHAR(10) DEFAULT 'not_sure' CHECK (vaccines IN ('yes', 'no', 'not_sure')),
    vaccines_tag VARCHAR(100),
    flat_earth VARCHAR(10) DEFAULT 'not_sure' CHECK (flat_earth IN ('yes', 'no', 'not_sure')),
    flat_earth_tag VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. SWIPES TABLE
-- ============================================================
CREATE TABLE public.swipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swiper_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    swiped_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action VARCHAR(10) NOT NULL CHECK (action IN ('like', 'nope', 'superlike')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(swiper_id, swiped_id)
);

CREATE INDEX idx_swipes_swiper ON public.swipes(swiper_id);
CREATE INDEX idx_swipes_swiped ON public.swipes(swiped_id);
CREATE INDEX idx_swipes_action ON public.swipes(action);

-- ============================================================
-- 7. MATCHES TABLE
-- ============================================================
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    matched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user1_id, user2_id),
    CHECK (user1_id < user2_id)
);

CREATE INDEX idx_matches_user1 ON public.matches(user1_id);
CREATE INDEX idx_matches_user2 ON public.matches(user2_id);

-- ============================================================
-- 8. CONVERSATIONS TABLE
-- ============================================================
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_match ON public.conversations(match_id);

-- ============================================================
-- 9. MESSAGES TABLE
-- ============================================================
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(10) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

-- ============================================================
-- 10. FRIENDS TABLE
-- ============================================================
CREATE TABLE public.friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    friends_since TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

CREATE INDEX idx_friends_user ON public.friends(user_id);
CREATE INDEX idx_friends_friend ON public.friends(friend_id);

-- ============================================================
-- 11. SUBSCRIPTION PLANS TABLE
-- ============================================================
CREATE TABLE public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration_days INTEGER NOT NULL,
    description TEXT,
    is_recommended BOOLEAN DEFAULT FALSE,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. USER SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_subs_user ON public.user_subscriptions(user_id);

-- ============================================================
-- 13. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    type VARCHAR(30) DEFAULT 'general' CHECK (type IN ('general', 'match', 'message', 'subscription', 'system')),
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- ============================================================
-- SEED: Default Subscription Plans
-- ============================================================
INSERT INTO public.subscription_plans (name, price, duration_days, description, is_recommended, features) VALUES
    ('FREE PACKAGE', 0.00, 30, 'Basic free plan', FALSE, '["Unlimited Messaging", "Daily Flames to send friend requests", "Ads inside swipe feed"]'::jsonb),
    ('RECOMMENDED', 39.99, 90, 'Best value plan', TRUE, '["Unlimited Messaging", "Daily Flames to send friend requests", "No Ads"]'::jsonb),
    ('PREMIUM PACKAGE', 99.99, 365, 'Early access premium plan', FALSE, '["Unlimited Messaging", "Unlimited Flames", "No Ads", "Priority Matching", "Early Access Features"]'::jsonb);

-- ============================================================
-- SPATIAL INDEX for location-based queries
-- ============================================================
CREATE INDEX idx_profiles_location ON public.profiles USING GIST(location);

-- ============================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_beliefs_updated_at
    BEFORE UPDATE ON public.beliefs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: Auto-create public.users + profile + beliefs
-- when a new user signs up via Supabase Auth.
-- This trigger fires on auth.users INSERT.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id)
    VALUES (NEW.id);

    INSERT INTO public.profiles (user_id)
    VALUES (NEW.id);

    INSERT INTO public.beliefs (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: Check for mutual match after swipe
-- ============================================================
CREATE OR REPLACE FUNCTION check_match()
RETURNS TRIGGER AS $$
DECLARE
    mutual_exists BOOLEAN;
    u1 UUID;
    u2 UUID;
    new_match_id UUID;
BEGIN
    IF NEW.action IN ('like', 'superlike') THEN
        SELECT EXISTS(
            SELECT 1 FROM public.swipes
            WHERE swiper_id = NEW.swiped_id
              AND swiped_id = NEW.swiper_id
              AND action IN ('like', 'superlike')
        ) INTO mutual_exists;

        IF mutual_exists THEN
            IF NEW.swiper_id < NEW.swiped_id THEN
                u1 := NEW.swiper_id;
                u2 := NEW.swiped_id;
            ELSE
                u1 := NEW.swiped_id;
                u2 := NEW.swiper_id;
            END IF;

            INSERT INTO public.matches (user1_id, user2_id)
            VALUES (u1, u2)
            ON CONFLICT (user1_id, user2_id) DO NOTHING
            RETURNING id INTO new_match_id;

            IF new_match_id IS NOT NULL THEN
                INSERT INTO public.conversations (match_id)
                VALUES (new_match_id);

                INSERT INTO public.friends (user_id, friend_id)
                VALUES (NEW.swiper_id, NEW.swiped_id)
                ON CONFLICT (user_id, friend_id) DO NOTHING;

                INSERT INTO public.friends (user_id, friend_id)
                VALUES (NEW.swiped_id, NEW.swiper_id)
                ON CONFLICT (user_id, friend_id) DO NOTHING;

                INSERT INTO public.notifications (user_id, title, subtitle, type, metadata)
                VALUES
                    (NEW.swiper_id, 'It''s a Match!', 'You have a new match! Start a conversation now.', 'match', json_build_object('match_id', new_match_id, 'matched_user_id', NEW.swiped_id)::jsonb),
                    (NEW.swiped_id, 'It''s a Match!', 'You have a new match! Start a conversation now.', 'match', json_build_object('match_id', new_match_id, 'matched_user_id', NEW.swiper_id)::jsonb);
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_match_after_swipe
    AFTER INSERT ON public.swipes
    FOR EACH ROW EXECUTE FUNCTION check_match();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifestyle_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beliefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Service role bypass (our Express backend uses the service role key)
CREATE POLICY "Service role full access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.profile_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.lifestyle_choices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.beliefs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.swipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.friends FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.user_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.subscription_plans FOR ALL USING (true) WITH CHECK (true);
