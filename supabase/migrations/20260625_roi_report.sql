-- Per-client monthly retainer (what the client pays the agency), used to frame
-- the ROI report as a return multiple: estimated value driven ÷ retainer. Stored
-- in the account's currency (GBP for now). Null = not set, so no multiple is shown.
alter table projects
  add column if not exists monthly_retainer numeric;
