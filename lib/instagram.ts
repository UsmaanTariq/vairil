export interface InstagramProfile {
  followers:  number;
  post_count: number;
  user_id:    string;
}

export interface InstagramPostStat {
  post_id:         string;
  caption:         string;
  views:           number | null;
  likes:           number;
  comments:        number;
  engagement_rate: number;
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
    followers:  (data.edge_followed_by as Record<string, number>)?.count  ?? 0,
    post_count: (data.edge_owner_to_timeline_media as Record<string, number>)?.count ?? 0,
    user_id:    String(data.id ?? userId),
  };
}

export async function getPosts(userId: string): Promise<InstagramPostStat[]> {
  const data  = await fetchProfileData(userId);
  const media = data.edge_owner_to_timeline_media as Record<string, unknown>;
  const edges = (media?.edges ?? []) as Array<{ node: Record<string, unknown> }>;

  return edges.map((edge) => {
    const node     = edge.node;
    const isVideo  = Boolean(node.is_video);
    const views    = isVideo && node.video_view_count != null ? (node.video_view_count as number) : null;
    const likes    = ((node.edge_liked_by as Record<string, number>)?.count
                   ?? (node.edge_media_preview_like as Record<string, number>)?.count
                   ?? 0);
    const comments = (node.edge_media_to_comment as Record<string, number>)?.count ?? 0;
    const captionEdges = ((node.edge_media_to_caption as Record<string, unknown>)?.edges ?? []) as Array<{ node: { text: string } }>;
    const caption  = captionEdges[0]?.node?.text ?? '';

    const engBase  = views ?? 0;
    const engagement_rate = engBase > 0
      ? Math.round(((likes + comments) / engBase) * 10000) / 10000
      : 0;

    return {
      post_id:  String(node.shortcode ?? node.id ?? ''),
      caption:  [...caption].slice(0, 300).join(''),
      views,
      likes,
      comments,
      engagement_rate,
    };
  });
}
