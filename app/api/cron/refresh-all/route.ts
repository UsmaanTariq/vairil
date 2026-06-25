import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProfile as getTikTokProfile, getVideos }   from '@/lib/tiktok';
import { getProfile as getInstagramProfile, getPosts } from '@/lib/instagram';

// Each account does up to ~30 (TikTok) / ~20 (Instagram) sequential paginated
// API calls, so the whole refresh can run for minutes. Give it room — without
// this the function was being killed mid-run, and because the work was chained
// (all TikTok, then all Instagram) Instagram, being last, got dropped first.
export const maxDuration = 300;

interface Account { id: string; handle: string }

async function refreshTikTok(account: Account) {
  const profile = await getTikTokProfile(account.handle);
  const videos  = await getVideos(profile.sec_uid);
  if (profile.profile_pic_url) {
    await supabase.from('tiktok_accounts').update({ profile_pic_url: profile.profile_pic_url }).eq('id', account.id);
  }
  const { error } = await supabase.from('tiktok_snapshots').insert({
    account_id:  account.id,
    followers:   profile.followers,
    video_count: profile.video_count,
    videos,
  });
  if (error) throw new Error(error.message);
}

async function refreshInstagram(account: Account) {
  const profile = await getInstagramProfile(account.handle);
  const posts   = await getPosts(profile.user_id);
  const safePosts = JSON.parse(JSON.stringify(posts ?? []));
  if (profile.profile_pic_url) {
    await supabase.from('instagram_accounts').update({ profile_pic_url: profile.profile_pic_url }).eq('id', account.id);
  }
  const { error } = await supabase.from('instagram_snapshots').insert({
    account_id: account.id,
    followers:  profile.followers,
    post_count: profile.post_count,
    posts:      safePosts,
  });
  if (error) throw new Error(error.message);
}

// Run every account for one platform concurrently, collecting per-account
// results so one slow/failing account can't starve the rest.
async function refreshAll(accounts: Account[], refresh: (a: Account) => Promise<void>) {
  const results = await Promise.allSettled(accounts.map(refresh));
  const errors = results
    .map((r, i) => (r.status === 'rejected' ? `${accounts[i].handle}: ${r.reason instanceof Error ? r.reason.message : 'unknown'}` : null))
    .filter((e): e is string => e !== null);
  return { refreshed: results.length - errors.length, failed: errors.length, errors };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [{ data: tiktokAccounts }, { data: igAccounts }] = await Promise.all([
    supabase.from('tiktok_accounts').select('id, handle'),
    supabase.from('instagram_accounts').select('id, handle'),
  ]);

  // Both platforms run concurrently — Instagram no longer waits behind the
  // entire TikTok loop, so a slow TikTok refresh can't time out Instagram.
  const [tiktok, instagram] = await Promise.all([
    refreshAll((tiktokAccounts ?? []) as Account[], refreshTikTok),
    refreshAll((igAccounts ?? []) as Account[], refreshInstagram),
  ]);

  return NextResponse.json({ tiktok, instagram });
}
