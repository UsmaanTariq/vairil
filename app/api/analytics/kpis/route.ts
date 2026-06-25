import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { newContentIds, attributedViews, groupByAccount } from '@/lib/analytics';

// Headline KPIs. Views and "videos posted" count only content published since
// tracking began (per-account first snapshot date) so a client's pre-existing
// back catalogue doesn't inflate the numbers. Followers stay absolute.
export async function GET() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [ttAll, igAll, projectsResult] = await Promise.all([
    supabase.from('tiktok_snapshots').select('followers, videos, account_id, fetched_at').order('fetched_at', { ascending: true }).limit(1000),
    supabase.from('instagram_snapshots').select('followers, posts, account_id, fetched_at').order('fetched_at', { ascending: true }).limit(1000),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
  ]);

  let todayViews = 0, todayFollowers = 0, totalVideos = 0;
  let yesterdayViews = 0, yesterdayFollowers = 0;
  let hasYesterdayData = false;

  // Per account: attribute the latest snapshot (today) and the latest snapshot
  // before today (yesterday) to content posted since tracking started.
  function process(
    rows: ({ account_id: string; fetched_at: string; followers: number | null } & Record<string, unknown>)[],
    itemsKey: 'videos' | 'posts',
    idKey: 'video_id' | 'post_id',
  ) {
    for (const [, snapsAsc] of groupByAccount(rows)) {
      const newIds = newContentIds(snapsAsc, itemsKey, idKey);
      const latest = snapsAsc[snapsAsc.length - 1];
      const latestItems = (latest[itemsKey] as { [k: string]: unknown }[]) ?? [];

      todayFollowers += latest.followers ?? 0;
      todayViews += attributedViews(latestItems as never, newIds, idKey);
      totalVideos += latestItems.filter((it) => newIds.has(it[idKey] as string)).length;

      const beforeToday = [...snapsAsc].reverse().find((s) => s.fetched_at < todayIso);
      if (beforeToday) {
        hasYesterdayData = true;
        yesterdayFollowers += beforeToday.followers ?? 0;
        yesterdayViews += attributedViews((beforeToday[itemsKey] as never) ?? [], newIds, idKey);
      }
    }
  }

  process(ttAll.data ?? [], 'videos', 'video_id');
  process(igAll.data ?? [], 'posts', 'post_id');

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
