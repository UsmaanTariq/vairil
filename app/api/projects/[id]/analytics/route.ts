import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

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

    return { account_id: account.id, handle: project!.tiktok_handle, latest_snapshot: latestSnapshot ?? null, snapshots: trend };
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

    return { account_id: account.id, latest_snapshot: latestSnapshot ?? null, snapshots: trend };
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
