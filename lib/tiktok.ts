export interface TikTokProfile {
  followers: number;
  video_count: number;
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
  const res = await fetch(`${BASE}/user/info?unique_id=${encodeURIComponent(handle)}`, {
    headers: HEADERS,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TikTok profile fetch failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const stats = json.data?.stats ?? json.userInfo?.stats ?? {};
  return {
    followers: stats.followerCount ?? 0,
    video_count: stats.videoCount ?? 0,
  };
}

export async function getVideos(handle: string): Promise<TikTokVideoStat[]> {
  const res = await fetch(
    `${BASE}/user/posts?unique_id=${encodeURIComponent(handle)}&count=30`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`TikTok videos fetch failed: ${res.statusText}`);
  const json = await res.json();
  const videos: Record<string, unknown>[] = json.data?.videos ?? json.data?.itemList ?? [];
  return videos.map((v) => {
    const views    = (v.play ?? v.playCount ?? 0) as number;
    const likes    = (v.digg_count ?? v.diggCount ?? 0) as number;
    const comments = (v.comment_count ?? v.commentCount ?? 0) as number;
    const shares   = (v.share_count ?? v.shareCount ?? 0) as number;
    return {
      video_id: (v.video_id ?? v.id ?? '') as string,
      title: (v.title ?? v.desc ?? '') as string,
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
