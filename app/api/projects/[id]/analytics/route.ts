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

    const { data: snapshots } = await supabase
      .from('tiktok_snapshots')
      .select('id, fetched_at, followers, video_count, videos')
      .eq('account_id', account.id)
      .order('fetched_at', { ascending: true });

    const latest = snapshots?.at(-1) ?? null;
    return { account_id: account.id, handle: project!.tiktok_handle, latest_snapshot: latest, snapshots: snapshots ?? [] };
  }

  async function getInstagramData() {
    if (!project!.instagram_handle) return null;
    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('handle', project!.instagram_handle)
      .maybeSingle();
    if (!account) return null;

    const { data: snapshots } = await supabase
      .from('instagram_snapshots')
      .select('id, fetched_at, followers, post_count, posts')
      .eq('account_id', account.id)
      .order('fetched_at', { ascending: true });

    const latest = snapshots?.at(-1) ?? null;
    return { account_id: account.id, latest_snapshot: latest, snapshots: snapshots ?? [] };
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
