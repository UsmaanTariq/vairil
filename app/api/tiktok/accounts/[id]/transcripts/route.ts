import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getTranscript } from '@/lib/supadata';

const TOP_N = 5;
// Supadata is rate-limited to 1 request/second, so we serialize the pulls and
// wait between each one that actually hits the API.
const RATE_LIMIT_MS = 1_100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SnapshotVideo {
  video_id: string;
  title: string;
  views: number;
  likes: number;
}

// GET the transcripts of this account's top-N videos (by views) from the latest
// snapshot. Cached transcripts are served from tiktok_transcripts; misses are
// fetched from Supadata and persisted. Pass ?refresh=1 to force a re-pull.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const refresh = new URL(req.url).searchParams.get('refresh') === '1';

  const { data: account, error: accountError } = await supabase
    .from('tiktok_accounts')
    .select('handle')
    .eq('id', id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const { data: snapshot } = await supabase
    .from('tiktok_snapshots')
    .select('videos')
    .eq('account_id', id)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const videos = ((snapshot?.videos as SnapshotVideo[] | null) ?? [])
    .filter((v) => v.video_id)
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_N);

  if (videos.length === 0) {
    return NextResponse.json({ transcripts: [] });
  }

  // Load whatever's already cached for these videos.
  const ids = videos.map((v) => v.video_id);
  const { data: cachedRows } = await supabase
    .from('tiktok_transcripts')
    .select('video_id, content')
    .in('video_id', ids);
  const cached = new Map((cachedRows ?? []).map((r) => [r.video_id as string, r.content as string]));

  // Serial, not parallel — Supadata allows 1 req/sec. Cached hits skip the API
  // (and the delay); only live pulls are throttled.
  const transcripts = [];
  let apiCalls = 0;
  for (const v of videos) {
    const url = `https://www.tiktok.com/@${account.handle}/video/${v.video_id}`;
    const base = { video_id: v.video_id, title: v.title, url, views: v.views, likes: v.likes };

    if (!refresh && cached.has(v.video_id)) {
      transcripts.push({ ...base, transcript: cached.get(v.video_id)!, cached: true });
      continue;
    }

    if (apiCalls > 0) await sleep(RATE_LIMIT_MS);
    apiCalls++;

    try {
      const transcript = await getTranscript(url, { mode: 'auto' });
      await supabase
        .from('tiktok_transcripts')
        .upsert({ video_id: v.video_id, account_id: id, url, content: transcript }, { onConflict: 'video_id' });
      transcripts.push({ ...base, transcript, cached: false });
    } catch (err) {
      transcripts.push({ ...base, transcript: null, error: err instanceof Error ? err.message : 'Transcript failed' });
    }
  }

  return NextResponse.json({ transcripts });
}
