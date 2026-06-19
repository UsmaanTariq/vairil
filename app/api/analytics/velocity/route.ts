import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const [projectsRes, ttSnaps, igSnaps, ttAccounts, igAccounts] = await Promise.all([
    supabase.from('projects').select('id, tiktok_handle, instagram_handle'),
    supabase.from('tiktok_snapshots').select('account_id, fetched_at, videos').order('fetched_at', { ascending: false }).limit(500),
    supabase.from('instagram_snapshots').select('account_id, fetched_at, posts').order('fetched_at', { ascending: false }).limit(500),
    supabase.from('tiktok_accounts').select('id, handle'),
    supabase.from('instagram_accounts').select('id, handle'),
  ]);

  const projects = projectsRes.data ?? [];
  const ttHandleToId: Record<string, string> = {};
  const igHandleToId: Record<string, string> = {};

  for (const a of ttAccounts.data ?? []) ttHandleToId[a.handle] = a.id;
  for (const a of igAccounts.data ?? []) igHandleToId[a.handle] = a.id;

  // project_id → day-string → total views
  const byProjectDay: Record<string, Record<string, number>> = {};

  function addViews(projectId: string, fetchedAt: string, views: number) {
    const day = new Date(fetchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (!byProjectDay[projectId]) byProjectDay[projectId] = {};
    byProjectDay[projectId][day] = (byProjectDay[projectId][day] ?? 0) + views;
  }

  for (const s of ttSnaps.data ?? []) {
    const project = projects.find((p) => p.tiktok_handle && ttHandleToId[p.tiktok_handle] === s.account_id);
    if (!project) continue;
    const vids = (s.videos ?? []) as { views?: number }[];
    const total = vids.reduce((a, v) => a + (v.views ?? 0), 0);
    addViews(project.id, s.fetched_at, total);
  }

  for (const s of igSnaps.data ?? []) {
    const project = projects.find((p) => p.instagram_handle && igHandleToId[p.instagram_handle] === s.account_id);
    if (!project) continue;
    const posts = (s.posts ?? []) as { views?: number | null }[];
    const total = posts.reduce((a, p) => a + (p.views ?? 0), 0);
    addViews(project.id, s.fetched_at, total);
  }

  const velocity: Record<string, { trend: number[]; delta_pct: number | null }> = {};

  for (const project of projects) {
    const days = byProjectDay[project.id];
    if (!days) continue;

    // Sort days chronologically and take last 7
    const sorted = Object.keys(days).sort((a, b) => {
      return new Date(`${a} 2024`).getTime() - new Date(`${b} 2024`).getTime();
    }).slice(-7);

    const trend = sorted.map((d) => days[d]);

    let delta_pct: number | null = null;
    if (trend.length >= 2) {
      const prev = trend[trend.length - 2];
      const curr = trend[trend.length - 1];
      if (prev > 0) delta_pct = Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    velocity[project.id] = { trend, delta_pct };
  }

  return NextResponse.json({ velocity });
}
