create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_name text,
  niche text,
  platforms text[],            -- ['tiktok','instagram']
  status text default 'intake',-- intake|interview|synthesis|research|ideas|done
  created_at timestamptz default now()
);

create table if not exists briefs (
  project_id uuid references projects(id) on delete cascade,
  raw_text text,
  file_refs text[],
  parsed_text text
);

create table if not exists answers (
  project_id uuid references projects(id) on delete cascade,
  qa jsonb                     -- [{question, answer}]
);

create table if not exists synthesis (
  project_id uuid references projects(id) on delete cascade,
  profile jsonb,               -- confirmed business profile
  confirmed boolean default false
);

create table if not exists trends (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text, platform text, format text, audio text,
  relevance text, source_url text, trend_date text, confidence text
);

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text, trend_ref text, hook text, script text,
  shot_list jsonb, audio text, caption text, hashtags text[], why text,
  status text default 'draft'  -- draft|approved
);
