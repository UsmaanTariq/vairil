import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

interface MetricItem {
  views?:           number | null;
  likes?:           number | null;
  comments?:        number | null;
  shares?:          number | null;
  engagement_rate?: number | null;
  [key: string]:    unknown;
}
interface MetricSnapshot { fetched_at: string; [key: string]: unknown }
export interface HistoryPoint {
  fetched_at:      string;
  views:           number;
  likes:           number;
  comments:        number;
  shares:          number;
  engagement_rate: number;
}

// Walk every snapshot (chronological) and group each item's metrics by its id,
// so a single table row can render its own metric history over time. itemsKey is
// the snapshot's array field ('videos' | 'posts'); idKey is the per-item id field.
function buildVideoHistory(
  snapshots: MetricSnapshot[],
  itemsKey: string,
  idKey: string,
): Record<string, HistoryPoint[]> {
  const history: Record<string, HistoryPoint[]> = {};
  for (const snap of snapshots) {
    const items = (snap[itemsKey] as MetricItem[] | null) ?? [];
    for (const item of items) {
      const id = item[idKey] as string | undefined;
      if (!id) continue;
      (history[id] ??= []).push({
        fetched_at:      snap.fetched_at,
        views:           item.views           ?? 0,
        likes:           item.likes           ?? 0,
        comments:        item.comments        ?? 0,
        shares:          item.shares          ?? 0,
        engagement_rate: item.engagement_rate ?? 0,
      });
    }
  }
  return history;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('tiktok_handle, instagram_handle')
    .eq('id', id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  async function getTikTokData() {
    if (!project!.tiktok_handle) return null;
    const { data: account } = await supabase
      .from('tiktok_accounts')
      .select('id')
      .eq('handle', project!.tiktok_handle)
      .maybeSingle();
    if (!account) return null;

    const [{ data: snapshots }, { data: latestSnapshot }] = await Promise.all([
      supabase
        .from('tiktok_snapshots')
        .select('id, fetched_at, followers, video_count, videos')
        .eq('account_id', account.id)
        .order('fetched_at', { ascending: true }),
      supabase
        .from('tiktok_snapshots')
        .select('id, fetched_at, followers, video_count, videos')
        .eq('account_id', account.id)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Sum lifetime views at each snapshot, then drop the heavy videos array from the trend payload.
    const trend = (snapshots ?? []).map((s) => ({
      id: s.id,
      fetched_at: s.fetched_at,
      followers: s.followers,
      video_count: s.video_count,
      views: ((s.videos ?? []) as { views: number | null }[]).reduce((acc, v) => acc + (v.views ?? 0), 0),
    }));

    // Per-video metric history across all snapshots, keyed by video_id, so each
    // table row can expand into a time-series of its own views/likes/etc.
    const history = buildVideoHistory(snapshots ?? [], 'videos', 'video_id');

    return { account_id: account.id, handle: project!.tiktok_handle, latest_snapshot: latestSnapshot ?? null, snapshots: trend, history };
  }

  async function getInstagramData() {
    if (!project!.instagram_handle) return null;
    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('handle', project!.instagram_handle)
      .maybeSingle();
    if (!account) return null;

    const [{ data: snapshots }, { data: latestSnapshot }] = await Promise.all([
      supabase
        .from('instagram_snapshots')
        .select('id, fetched_at, followers, post_count, posts')
        .eq('account_id', account.id)
        .order('fetched_at', { ascending: true }),
      supabase
        .from('instagram_snapshots')
        .select('id, fetched_at, followers, post_count, posts')
        .eq('account_id', account.id)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Sum lifetime views at each snapshot, then drop the heavy posts array from the trend payload.
    const trend = (snapshots ?? []).map((s) => ({
      id: s.id,
      fetched_at: s.fetched_at,
      followers: s.followers,
      post_count: s.post_count,
      views: ((s.posts ?? []) as { views: number | null }[]).reduce((acc, p) => acc + (p.views ?? 0), 0),
    }));

    // Per-post metric history across all snapshots, keyed by post_id.
    const history = buildVideoHistory(snapshots ?? [], 'posts', 'post_id');

    return { account_id: account.id, latest_snapshot: latestSnapshot ?? null, snapshots: trend, history };
  }

  const [tiktok, instagram] = await Promise.all([getTikTokData(), getInstagramData()]);

  return NextResponse.json({
    tiktok,
    instagram,
    handles: {
      tiktok:    project.tiktok_handle    ?? null,
      instagram: project.instagram_handle ?? null,
    },
  });
}
