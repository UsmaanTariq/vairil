-- Slice 3: add fields that exist in zod schemas but were missing from the original schema.sql
ALTER TABLE trends ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE ideas  ADD COLUMN IF NOT EXISTS hashtags text[];
