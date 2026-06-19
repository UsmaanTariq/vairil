import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProfile as getTikTokProfile, getVideos }        from '@/lib/tiktok';
import { getProfile as getInstagramProfile, getPosts }      from '@/lib/instagram';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TikTok
  const { data: tiktokAccounts } = await supabase.from('tiktok_accounts').select('id, handle');

  let ttSucceeded = 0, ttFailed = 0;
  const ttErrors: string[] = [];

  for (const account of tiktokAccounts ?? []) {
    try {
      const profile = await getTikTokProfile(account.handle);
      const videos  = await getVideos(profile.sec_uid);
      if (profile.profile_pic_url) {
        await supabase.from('tiktok_accounts').update({ profile_pic_url: profile.profile_pic_url }).eq('id', account.id);
      }
      await supabase.from('tiktok_snapshots').insert({
        account_id:  account.id,
        followers:   profile.followers,
        video_count: profile.video_count,
        videos,
      });
      ttSucceeded++;
    } catch (err) {
      ttFailed++;
      ttErrors.push(`${account.handle}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // Instagram
  const { data: igAccounts } = await supabase.from('instagram_accounts').select('id, handle');

  let igSucceeded = 0, igFailed = 0;
  const igErrors: string[] = [];

  for (const account of igAccounts ?? []) {
    try {
      const profile = await getInstagramProfile(account.handle);
      const posts   = await getPosts(profile.user_id);
      const safePosts = JSON.parse(JSON.stringify(posts ?? []));
      if (profile.profile_pic_url) {
        await supabase.from('instagram_accounts').update({ profile_pic_url: profile.profile_pic_url }).eq('id', account.id);
      }
      await supabase.from('instagram_snapshots').insert({
        account_id: account.id,
        followers:  profile.followers,
        post_count: profile.post_count,
        posts:      safePosts,
      });
      igSucceeded++;
    } catch (err) {
      igFailed++;
      igErrors.push(`${account.handle}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return NextResponse.json({
    tiktok:    { refreshed: ttSucceeded, failed: ttFailed, errors: ttErrors },
    instagram: { refreshed: igSucceeded, failed: igFailed, errors: igErrors },
  });
}
