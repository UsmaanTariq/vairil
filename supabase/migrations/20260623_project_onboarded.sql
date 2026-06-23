alter table projects add column if not exists onboarded boolean default false;

-- Backfill: a project is onboarded if it already has a synthesis profile
-- or already progressed to research/ideas/done under the old status model.
update projects p
set onboarded = true
where p.onboarded is not true
  and (
    exists (select 1 from synthesis s where s.project_id = p.id)
    or p.status in ('research', 'ideas', 'done')
  );
