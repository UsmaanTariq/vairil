import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProfile, getVideos } from '@/lib/tiktok';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: account, error: accountError } = await supabase
    .from('tiktok_accounts')
    .select('handle')
    .eq('id', id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const [profile, videos] = await Promise.all([
    getProfile(account.handle),
    getVideos(account.handle),
  ]);

  const { data: snapshot, error: insertError } = await supabase
    .from('tiktok_snapshots')
    .insert({
      account_id: id,
      followers: profile.followers,
      video_count: profile.video_count,
      videos,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ snapshot });
}
