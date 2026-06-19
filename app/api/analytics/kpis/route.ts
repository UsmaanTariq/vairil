import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [ttLatest, igLatest, ttYesterday, igYesterday, projectsResult] = await Promise.all([
    supabase.from('tiktok_snapshots').select('followers, videos, account_id, fetched_at').order('fetched_at', { ascending: false }).limit(200),
    supabase.from('instagram_snapshots').select('followers, posts, account_id, fetched_at').order('fetched_at', { ascending: false }).limit(200),
    supabase.from('tiktok_snapshots').select('followers, videos, account_id, fetched_at').lt('fetched_at', todayStart.toISOString()).order('fetched_at', { ascending: false }).limit(200),
    supabase.from('instagram_snapshots').select('followers, posts, account_id, fetched_at').lt('fetched_at', todayStart.toISOString()).order('fetched_at', { ascending: false }).limit(200),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
  ]);

  // Latest snapshot per account
  const ttSeen = new Set<string>();
  const igSeen = new Set<string>();
  let todayViews = 0, todayFollowers = 0, totalVideos = 0;

  for (const s of ttLatest.data ?? []) {
    if (ttSeen.has(s.account_id)) continue;
    ttSeen.add(s.account_id);
    todayFollowers += s.followers ?? 0;
    const vids = (s.videos ?? []) as { views?: number }[];
    todayViews += vids.reduce((a, v) => a + (v.views ?? 0), 0);
    totalVideos += vids.length;
  }
  for (const s of igLatest.data ?? []) {
    if (igSeen.has(s.account_id)) continue;
    igSeen.add(s.account_id);
    todayFollowers += s.followers ?? 0;
    const posts = (s.posts ?? []) as { views?: number | null }[];
    todayViews += posts.reduce((a, p) => a + (p.views ?? 0), 0);
    totalVideos += posts.length;
  }

  // Previous-day snapshot per account
  const ttYestSeen = new Set<string>();
  const igYestSeen = new Set<string>();
  let yesterdayViews = 0, yesterdayFollowers = 0;
  let hasYesterdayData = false;

  for (const s of ttYesterday.data ?? []) {
    if (ttYestSeen.has(s.account_id)) continue;
    ttYestSeen.add(s.account_id);
    yesterdayFollowers += s.followers ?? 0;
    const vids = (s.videos ?? []) as { views?: number }[];
    yesterdayViews += vids.reduce((a, v) => a + (v.views ?? 0), 0);
    hasYesterdayData = true;
  }
  for (const s of igYesterday.data ?? []) {
    if (igYestSeen.has(s.account_id)) continue;
    igYestSeen.add(s.account_id);
    yesterdayFollowers += s.followers ?? 0;
    const posts = (s.posts ?? []) as { views?: number | null }[];
    yesterdayViews += posts.reduce((a, p) => a + (p.views ?? 0), 0);
    hasYesterdayData = true;
  }

  function pct(today: number, yesterday: number): number | null {
    if (!hasYesterdayData || yesterday === 0) return null;
    return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
  }

  return NextResponse.json({
    views:     { today: todayViews,     delta_pct: pct(todayViews, yesterdayViews) },
    followers: { total: todayFollowers, delta_pct: pct(todayFollowers, yesterdayFollowers) },
    videos:    { total: totalVideos },
    clients:   { total: projectsResult.count ?? 0 },
  });
}
