import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { newContentIds, attributedViews, groupByAccount } from '@/lib/analytics';

// Views from content posted SINCE tracking began, per project (TikTok + Instagram
// combined), for the donut chart — so a client with a huge pre-existing catalogue
// doesn't dominate the share of recent work.
export async function GET() {
  const [projectsRes, ttAccounts, igAccounts, ttSnaps, igSnaps] = await Promise.all([
    supabase.from('projects').select('id, client_name, tiktok_handle, instagram_handle'),
    supabase.from('tiktok_accounts').select('id, handle'),
    supabase.from('instagram_accounts').select('id, handle'),
    supabase.from('tiktok_snapshots').select('account_id, videos, fetched_at').order('fetched_at', { ascending: true }).limit(1000),
    supabase.from('instagram_snapshots').select('account_id, posts, fetched_at').order('fetched_at', { ascending: true }).limit(1000),
  ]);

  const projects = projectsRes.data ?? [];
  const ttIdToProject: Record<string, string> = {};
  const igIdToProject: Record<string, string> = {};
  const ttHandleToId: Record<string, string> = {};
  const igHandleToId: Record<string, string> = {};
  for (const a of ttAccounts.data ?? []) ttHandleToId[a.handle] = a.id;
  for (const a of igAccounts.data ?? []) igHandleToId[a.handle] = a.id;
  for (const p of projects) {
    if (p.tiktok_handle && ttHandleToId[p.tiktok_handle]) ttIdToProject[ttHandleToId[p.tiktok_handle]] = p.id;
    if (p.instagram_handle && igHandleToId[p.instagram_handle]) igIdToProject[igHandleToId[p.instagram_handle]] = p.id;
  }

  const viewsByProject: Record<string, number> = {};

  function accumulate(
    rows: { account_id: string; fetched_at: string }[],
    itemsKey: 'videos' | 'posts',
    idKey: 'video_id' | 'post_id',
    accountToProject: Record<string, string>,
  ) {
    for (const [accountId, snapsAsc] of groupByAccount(rows)) {
      const projectId = accountToProject[accountId];
      if (!projectId) continue;
      const newIds = newContentIds(snapsAsc, itemsKey, idKey);
      const latest = snapsAsc[snapsAsc.length - 1] as Record<string, unknown>;
      const views = attributedViews(latest[itemsKey] as never, newIds, idKey);
      viewsByProject[projectId] = (viewsByProject[projectId] ?? 0) + views;
    }
  }

  accumulate(ttSnaps.data ?? [], 'videos', 'video_id', ttIdToProject);
  accumulate(igSnaps.data ?? [], 'posts', 'post_id', igIdToProject);

  const breakdown = Object.entries(viewsByProject)
    .filter(([, views]) => views > 0)
    .map(([id, views]) => ({
      project_id: id,
      client_name: projects.find((p) => p.id === id)?.client_name ?? 'Unknown',
      views,
    }))
    .sort((a, b) => b.views - a.views);

  return NextResponse.json({ breakdown });
}
