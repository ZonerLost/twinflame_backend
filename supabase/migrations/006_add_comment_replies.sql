-- Migration: Add reply support to post_comments
-- Description: Adds parent_id column so comments can be replies to other comments

ALTER TABLE post_comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_id);
