-- Add handle columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS tiktok_handle text,
  ADD COLUMN IF NOT EXISTS instagram_handle text;

-- Link existing tiktok_accounts to projects (nullable)
ALTER TABLE tiktok_accounts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Instagram accounts
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  handle      text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Instagram snapshots
CREATE TABLE IF NOT EXISTS instagram_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  followers   integer NOT NULL DEFAULT 0,
  post_count  integer NOT NULL DEFAULT 0,
  posts       jsonb NOT NULL DEFAULT '[]',
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast account → snapshot lookups
CREATE INDEX IF NOT EXISTS instagram_snapshots_account_id_idx
  ON instagram_snapshots(account_id, fetched_at DESC);
