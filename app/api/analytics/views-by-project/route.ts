import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Returns latest total views per project (TikTok + Instagram combined) for the
// donut chart. Mirrors the account-linking logic in /api/analytics/velocity.
export async function GET() {
  const [projectsRes, ttAccounts, igAccounts, ttSnaps, igSnaps] = await Promise.all([
    supabase.from('projects').select('id, client_name, tiktok_handle, instagram_handle'),
    supabase.from('tiktok_accounts').select('id, handle'),
    supabase.from('instagram_accounts').select('id, handle'),
    supabase.from('tiktok_snapshots').select('account_id, videos, fetched_at').order('fetched_at', { ascending: false }).limit(200),
    supabase.from('instagram_snapshots').select('account_id, posts, fetched_at').order('fetched_at', { ascending: false }).limit(200),
  ]);

  const projects = projectsRes.data ?? [];
  const ttHandleToId: Record<string, string> = {};
  const igHandleToId: Record<string, string> = {};
  for (const a of ttAccounts.data ?? []) ttHandleToId[a.handle] = a.id;
  for (const a of igAccounts.data ?? []) igHandleToId[a.handle] = a.id;

  const viewsByProject: Record<string, number> = {};

  const ttSeen = new Set<string>();
  for (const s of ttSnaps.data ?? []) {
    if (ttSeen.has(s.account_id)) continue;
    ttSeen.add(s.account_id);
    const project = projects.find((p) => p.tiktok_handle && ttHandleToId[p.tiktok_handle] === s.account_id);
    if (!project) continue;
    const views = ((s.videos ?? []) as { views?: number }[]).reduce((sum, v) => sum + (v.views ?? 0), 0);
    viewsByProject[project.id] = (viewsByProject[project.id] ?? 0) + views;
  }

  const igSeen = new Set<string>();
  for (const s of igSnaps.data ?? []) {
    if (igSeen.has(s.account_id)) continue;
    igSeen.add(s.account_id);
    const project = projects.find((p) => p.instagram_handle && igHandleToId[p.instagram_handle] === s.account_id);
    if (!project) continue;
    const views = ((s.posts ?? []) as { views?: number | null }[]).reduce((sum, p) => sum + (p.views ?? 0), 0);
    viewsByProject[project.id] = (viewsByProject[project.id] ?? 0) + views;
  }

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
