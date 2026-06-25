export interface InstagramProfile {
  followers:       number;
  post_count:      number;
  user_id:         string;
  profile_pic_url: string | null;
}

export interface InstagramPostStat {
  post_id:         string;
  caption:         string;
  views:           number | null;
  likes:           number;
  comments:        number;
  engagement_rate: number;
  thumbnail_url:   string | null;
  created_at:      number | null; // unix seconds the post was published
}

const BASE = `https://${process.env.RAPIDAPI_INSTAGRAM_HOST}`;
const HEADERS = {
  'x-rapidapi-key':  process.env.RAPIDAPI_KEY!,
  'x-rapidapi-host': process.env.RAPIDAPI_INSTAGRAM_HOST!,
};

async function fetchNumericId(handle: string): Promise<string> {
  const res = await fetch(`${BASE}/search?query=${encodeURIComponent(handle)}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Instagram search failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const users: Array<{ user: { username: string; pk: string } }> = json.users ?? [];
  const match = users.find((u) => u.user.username.toLowerCase() === handle.toLowerCase());
  if (!match) throw new Error(`Instagram user not found: ${handle}`);
  return match.user.pk;
}

async function fetchProfileData(userId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/profile?id=${encodeURIComponent(userId)}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Instagram profile fetch failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function getProfile(handle: string): Promise<InstagramProfile> {
  const userId = await fetchNumericId(handle);
  const data   = await fetchProfileData(userId);
  return {
    followers:       (data.edge_followed_by as Record<string, number>)?.count  ?? 0,
    post_count:      (data.edge_owner_to_timeline_media as Record<string, number>)?.count ?? 0,
    user_id:         String(data.id ?? userId),
    profile_pic_url: (data.profile_pic_url_hd ?? data.profile_pic_url ?? null) as string | null,
  };
}

// The /profile endpoint only returns the first ~12 posts. The /user-feeds endpoint
// is paginated via `next_max_id` (passed back as `max_id`) — page through it to get
// the full post history. Each page returns ~12 items, so MAX_PAGES caps both the
// post total and the number of upstream API calls per refresh.
const MAX_PAGES = 20;

export async function getPosts(userId: string): Promise<InstagramPostStat[]> {
  const allItems: Record<string, unknown>[] = [];
  let maxId = '';

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${BASE}/user-feeds?id=${encodeURIComponent(userId)}&count=50` +
                (maxId ? `&max_id=${encodeURIComponent(maxId)}` : '');
    const res = await fetch(url, { headers: HEADERS });
    // On a bad page, keep whatever we've collected rather than discarding everything.
    if (!res.ok) break;
    const json = await res.json();
    const items: Record<string, unknown>[] = json.items ?? [];
    allItems.push(...items);
    if (!json.more_available || items.length === 0 || !json.next_max_id) break;
    maxId = String(json.next_max_id);
  }

  return allItems.map((item) => {
    const isVideo  = Number(item.media_type) === 2;
    const views    = isVideo ? ((item.play_count ?? item.ig_play_count ?? null) as number | null) : null;
    const likes    = (item.like_count    as number) ?? 0;
    const comments = (item.comment_count as number) ?? 0;
    const caption  = ((item.caption as { text?: string } | null)?.text) ?? '';
    const candidates = ((item.image_versions2 as { candidates?: Array<{ url?: string }> } | null)?.candidates) ?? [];

    const engBase  = views ?? 0;
    const engagement_rate = engBase > 0
      ? Math.round(((likes + comments) / engBase) * 10000) / 10000
      : 0;

    return {
      post_id:       String(item.code ?? item.pk ?? ''),
      caption:       [...caption].slice(0, 300).join(''),
      views,
      likes,
      comments,
      engagement_rate,
      thumbnail_url: (candidates[0]?.url ?? null) as string | null,
      created_at: typeof item.taken_at === 'number' ? item.taken_at
                : typeof item.taken_at === 'string' ? Number(item.taken_at) || null
                : null,
    };
  });
}
