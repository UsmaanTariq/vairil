-- Per-client revenue assumption used for rough ROI tracking: how much money the
-- manager estimates each 1,000 views is worth to this client's business. Stored
-- in the account's currency (GBP for now). Null = not set, so no ROI is shown.
alter table projects
  add column if not exists value_per_1k_views numeric;
