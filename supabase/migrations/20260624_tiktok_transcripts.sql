-- Cache of Supadata transcripts for TikTok videos. Keyed by video_id (globally
-- unique per TikTok video) so we never pay to transcribe the same video twice.
create table if not exists tiktok_transcripts (
  video_id   text primary key,
  account_id uuid references tiktok_accounts(id) on delete cascade,
  url        text,
  content    text,
  lang       text,
  fetched_at timestamptz default now()
);

create index if not exists tiktok_transcripts_account_idx
  on tiktok_transcripts (account_id);
