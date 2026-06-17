-- Add profile picture URL columns to account tables
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS profile_pic_url text;
ALTER TABLE tiktok_accounts    ADD COLUMN IF NOT EXISTS profile_pic_url text;
