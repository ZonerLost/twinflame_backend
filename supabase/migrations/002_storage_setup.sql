-- ============================================================
-- Storage bucket for profile photos
-- Run this in Supabase SQL Editor AFTER running 001_initial_schema.sql
-- ============================================================

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to profile photos
CREATE POLICY "Public read access for profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

-- Allow authenticated uploads to profile photos
CREATE POLICY "Authenticated users can upload profile photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-photos');
