import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Returns a daily average engagement rate (as a percentage) across all tracked
// accounts. TikTok videos already store engagement_rate; Instagram posts
// compute it from likes+comments / views where available.
export async function GET() {
  const [ttSnaps, igSnaps] = await Promise.all([
    supabase.from('tiktok_snapshots').select('fetched_at, videos').order('fetched_at', { ascending: true }).limit(500),
    supabase.from('instagram_snapshots').select('fetched_at, posts').order('fetched_at', { ascending: true }).limit(500),
  ]);

  const byDay: Record<string, { total: number; count: number }> = {};

  function addRate(fetchedAt: string, rate: number) {
    const day = new Date(fetchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
    byDay[day].total += rate;
    byDay[day].count += 1;
  }

  for (const s of ttSnaps.data ?? []) {
    const vids = (s.videos ?? []) as { views?: number; engagement_rate?: number }[];
    for (const v of vids) {
      if ((v.views ?? 0) > 0 && v.engagement_rate != null) {
        addRate(s.fetched_at, v.engagement_rate);
      }
    }
  }

  for (const s of igSnaps.data ?? []) {
    const posts = (s.posts ?? []) as { views?: number | null; likes?: number; comments?: number; engagement_rate?: number }[];
    for (const p of posts) {
      if (p.engagement_rate != null) {
        addRate(s.fetched_at, p.engagement_rate);
      } else if ((p.views ?? 0) > 0) {
        addRate(s.fetched_at, ((p.likes ?? 0) + (p.comments ?? 0)) / (p.views as number));
      }
    }
  }

  const trend = Object.entries(byDay).map(([date, { total, count }]) => ({
    date,
    rate: Math.round((total / count) * 10000) / 100,
  }));

  return NextResponse.json({ trend });
}
