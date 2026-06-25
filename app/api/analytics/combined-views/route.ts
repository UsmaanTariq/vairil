import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { newContentIds, attributedViews, groupByAccount } from '@/lib/analytics';

// Combined views from content posted SINCE tracking began, per day, across all
// accounts. Each account only counts videos/posts published on/after its first
// snapshot date, so a years-old back catalogue (which the API pulls in gradually)
// never masquerades as new views. Carried forward so a day where only some
// accounts refreshed doesn't read as a drop.
export async function GET() {
  const [ttResult, igResult] = await Promise.all([
    supabase.from('tiktok_snapshots').select('account_id, fetched_at, videos').order('fetched_at', { ascending: true }).limit(1000),
    supabase.from('instagram_snapshots').select('account_id, posts, fetched_at').order('fetched_at', { ascending: true }).limit(1000),
  ]);

  const dayKey = (iso: string) => iso.slice(0, 10);
  const labelByDay = new Map<string, string>();
  const noteDay = (iso: string) =>
    labelByDay.set(dayKey(iso), new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

  for (const s of ttResult.data ?? []) noteDay(s.fetched_at);
  for (const s of igResult.data ?? []) noteDay(s.fetched_at);
  const allDays = [...labelByDay.keys()].sort();

  const combined = new Map<string, number>(); // day → summed attributed views

  function accumulate(
    rows: { account_id: string; fetched_at: string }[],
    itemsKey: 'videos' | 'posts',
    idKey: 'video_id' | 'post_id',
  ) {
    for (const [, snapsAsc] of groupByAccount(rows)) {
      const newIds = newContentIds(snapsAsc, itemsKey, idKey);
      const byDay = new Map<string, number>(); // last snapshot of a day wins
      for (const snap of snapsAsc) {
        const items = (snap as Record<string, unknown>)[itemsKey] as never;
        byDay.set(dayKey(snap.fetched_at), attributedViews(items, newIds, idKey));
      }
      const firstDay = [...byDay.keys()].sort()[0];
      let last = 0;
      for (const dk of allDays) {
        if (dk < firstDay) continue; // account wasn't tracked yet
        if (byDay.has(dk)) last = byDay.get(dk)!;
        combined.set(dk, (combined.get(dk) ?? 0) + last);
      }
    }
  }

  accumulate(ttResult.data ?? [], 'videos', 'video_id');
  accumulate(igResult.data ?? [], 'posts', 'post_id');

  const trend = allDays
    .filter((dk) => combined.has(dk))
    .map((dk) => ({ date: labelByDay.get(dk)!, views: combined.get(dk)! }));

  return NextResponse.json({ trend });
}
