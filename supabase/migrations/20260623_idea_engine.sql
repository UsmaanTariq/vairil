-- supabase/migrations/20260623_idea_engine.sql
alter table ideas add column if not exists created_at timestamptz default now();
alter table ideas add column if not exists feedback_reason text;
-- Remap legacy statuses: draft -> new (approved stays approved)
update ideas set status = 'new' where status = 'draft';

alter table trends add column if not exists created_at timestamptz default now();
alter table trends add column if not exists dismissed boolean default false;
