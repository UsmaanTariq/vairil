import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProfile, getPosts } from '@/lib/instagram';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: account, error: accountError } = await supabase
      .from('instagram_accounts')
      .select('handle')
      .eq('id', id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: `Account not found: ${accountError?.message}` }, { status: 404 });
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

    // Sanitize through JSON round-trip to catch any non-serialisable values
    const safePosts = JSON.parse(JSON.stringify(posts ?? []));

    const { data: snapshot, error: insertError } = await supabase
      .from('instagram_snapshots')
      .insert({
        account_id: id,
        followers:  profile.followers,
        post_count: profile.post_count,
        posts:      safePosts,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: `Insert failed: ${insertError.message} (code: ${insertError.code})` }, { status: 500 });
    }

    return NextResponse.json({ snapshot });
  } catch (err) {
    return NextResponse.json(
      { error: `Unhandled: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
