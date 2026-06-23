import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: account, error: accountError } = await supabase
    .from('tiktok_accounts')
    .select('id, handle, created_at')
    .eq('id', id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const { data: snapshots } = await supabase
    .from('tiktok_snapshots')
    .select('id, fetched_at, followers, video_count')
    .eq('account_id', id)
    .order('fetched_at', { ascending: true });

  const { data: latestSnapshot } = await supabase
    .from('tiktok_snapshots')
    .select('id, fetched_at, followers, video_count, videos')
    .eq('account_id', id)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    account,
    snapshots: snapshots ?? [],
    latest_snapshot: latestSnapshot ?? null,
  });
}
