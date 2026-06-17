export interface TikTokProfile {
  followers: number;
  video_count: number;
  sec_uid: string;
}

export interface TikTokVideoStat {
  video_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

const BASE = `https://${process.env.RAPIDAPI_TIKTOK_HOST}`;
const HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
  'x-rapidapi-host': process.env.RAPIDAPI_TIKTOK_HOST!,
};

export async function getProfile(handle: string): Promise<TikTokProfile> {
  const res = await fetch(`${BASE}/api/user/info?uniqueId=${encodeURIComponent(handle)}`, {
    headers: HEADERS,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TikTok profile fetch failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const user  = json.data?.user  ?? {};
  const stats = json.data?.stats ?? {};
  return {
    followers:   stats.followerCount ?? 0,
    video_count: stats.videoCount    ?? 0,
    sec_uid:     user.secUid         ?? '',
  };
}

export async function getVideos(secUid: string): Promise<TikTokVideoStat[]> {
  const res = await fetch(
    `${BASE}/api/user/posts?secUid=${encodeURIComponent(secUid)}&count=30&cursor=0`,
    { headers: HEADERS }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TikTok videos fetch failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const items: Record<string, unknown>[] = json.data?.itemList ?? [];
  return items.map((v) => {
    const s        = (v.stats ?? {}) as Record<string, number>;
    const views    = s.playCount    ?? 0;
    const likes    = s.diggCount    ?? 0;
    const comments = s.commentCount ?? 0;
    const shares   = s.shareCount   ?? 0;
    return {
      video_id:        (v.id   ?? '') as string,
      title:           (v.desc ?? '') as string,
      views,
      likes,
      comments,
      shares,
      engagement_rate: views > 0
        ? Math.round(((likes + comments + shares) / views) * 10000) / 10000
        : 0,
    };
  });
}
