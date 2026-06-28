export interface TikTokProfile {
  followers:       number;
  video_count:     number;
  sec_uid:         string;
  profile_pic_url: string | null;
}

export interface TikTokVideoStat {
  video_id:        string;
  title:           string;
  views:           number;
  likes:           number;
  comments:        number;
  shares:          number;
  engagement_rate: number;
  thumbnail_url:   string | null;
  created_at:      number | null; // unix seconds the video was posted
}

import { fetchJsonWithRetry } from './rapidapi';

const BASE = `https://${process.env.RAPIDAPI_TIKTOK_HOST}`;
const HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
  'x-rapidapi-host': process.env.RAPIDAPI_TIKTOK_HOST!,
};

export async function getProfile(handle: string): Promise<TikTokProfile> {
  const json = await fetchJsonWithRetry(
    `${BASE}/api/user/info?uniqueId=${encodeURIComponent(handle)}`,
    HEADERS,
    { label: `TikTok profile ${handle}` },
  );
  const user  = json.userInfo?.user  ?? {};
  const stats = json.userInfo?.stats ?? {};
  return {
    followers:       stats.followerCount ?? 0,
    video_count:     stats.videoCount    ?? 0,
    sec_uid:         user.secUid         ?? '',
    profile_pic_url: (user.avatarMedium ?? user.avatarThumb ?? null) as string | null,
  };
}

export async function getVideos(secUid: string): Promise<TikTokVideoStat[]> {
  const allItems: Record<string, unknown>[] = [];
  let cursor: string | number = 0;
  const MAX_PAGES = 30;

  for (let page = 0; page < MAX_PAGES; page++) {
    let json;
    try {
      json = await fetchJsonWithRetry(
        `${BASE}/api/user/posts?secUid=${encodeURIComponent(secUid)}&count=35&cursor=${cursor}`,
        HEADERS,
        { label: 'TikTok posts' },
      );
    } catch (err) {
      // Page 0 failing means we have nothing — surface it so no empty snapshot is
      // stored. Later pages failing: keep what we already collected.
      if (page === 0) throw err;
      break;
    }
    const items: Record<string, unknown>[] = json.data?.itemList ?? [];
    allItems.push(...items);
    if (!json.data?.hasMore || items.length === 0) break;
    cursor = json.data.cursor as string | number;
  }

  return allItems.map((v) => {
    const s          = (v.stats ?? {}) as Record<string, number>;
    const views      = s.playCount    ?? 0;
    const likes      = s.diggCount    ?? 0;
    const comments   = s.commentCount ?? 0;
    const shares     = s.shareCount   ?? 0;
    const desc       = (v.desc ?? '') as string;
    const contents   = (v.contents as Array<{ desc?: string }> | undefined) ?? [];
    const contentsDesc = contents[0]?.desc ?? '';
    const challenges = (v.challenges as Array<{ title: string }> | undefined) ?? [];
    const title      = desc || contentsDesc || challenges.slice(0, 4).map((c) => `#${c.title}`).join(' ');
    const vid = (v.video ?? {}) as Record<string, unknown>;
    return {
      video_id:        (v.id ?? '') as string,
      title,
      views,
      likes,
      comments,
      shares,
      engagement_rate: views > 0
        ? Math.round(((likes + comments + shares) / views) * 10000) / 10000
        : 0,
      thumbnail_url: (vid.originCover ?? vid.cover ?? null) as string | null,
      created_at: typeof v.createTime === 'number' ? v.createTime
                : typeof v.createTime === 'string' ? Number(v.createTime) || null
                : null,
    };
  });
}
