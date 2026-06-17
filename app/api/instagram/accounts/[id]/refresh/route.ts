import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProfile, getPosts } from '@/lib/instagram';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: account, error: accountError } = await supabase
    .from('instagram_accounts')
    .select('handle')
    .eq('id', id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  let profile, posts;
  try {
    profile = await getProfile(account.handle);
    posts   = await getPosts(profile.user_id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Instagram API request failed' },
      { status: 502 }
    );
  }

  const { data: snapshot, error: insertError } = await supabase
    .from('instagram_snapshots')
    .insert({
      account_id: id,
      followers:  profile.followers,
      post_count: profile.post_count,
      posts,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ snapshot });
}
