import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const [ttResult, igResult] = await Promise.all([
    supabase.from('tiktok_snapshots').select('fetched_at, videos').order('fetched_at', { ascending: true }).limit(200),
    supabase.from('instagram_snapshots').select('fetched_at, posts').order('fetched_at', { ascending: true }).limit(200),
  ]);

  const byDate: Record<string, number> = {};

  for (const s of ttResult.data ?? []) {
    const d = new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const views = ((s.videos ?? []) as { views: number }[]).reduce((acc, v) => acc + (v.views ?? 0), 0);
    byDate[d] = (byDate[d] ?? 0) + views;
  }

  for (const s of igResult.data ?? []) {
    const d = new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const views = ((s.posts ?? []) as { views: number | null }[]).reduce((acc, p) => acc + (p.views ?? 0), 0);
    byDate[d] = (byDate[d] ?? 0) + views;
  }

  const trend = Object.entries(byDate).map(([date, views]) => ({ date, views }));

  return NextResponse.json({ trend });
}
