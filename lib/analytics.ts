// Server-side analytics aggregation for a project. Extracted so both the
// /api/projects/[id]/analytics route and the server-rendered ROI report can read
// the same shape without an internal HTTP round-trip (and the auth it would need).
import { supabase } from '@/lib/db';

interface MetricItem {
  views?:           number | null;
  likes?:           number | null;
  comments?:        number | null;
  shares?:          number | null;
  engagement_rate?: number | null;
  [key: string]:    unknown;
}
interface MetricSnapshot { fetched_at: string; [key: string]: unknown }
export interface HistoryPoint {
  fetched_at:      string;
  views:           number;
  likes:           number;
  comments:        number;
  shares:          number;
  engagement_rate: number;
}

// Walk every snapshot (chronological) and group each item's metrics by its id,
// so a single item can render its own metric history over time. itemsKey is the
// snapshot's array field ('videos' | 'posts'); idKey is the per-item id field.
function buildVideoHistory(
  snapshots: MetricSnapshot[],
  itemsKey: string,
  idKey: string,
): Record<string, HistoryPoint[]> {
  const history: Record<string, HistoryPoint[]> = {};
  for (const snap of snapshots) {
    const items = (snap[itemsKey] as MetricItem[] | null) ?? [];
    for (const item of items) {
      const id = item[idKey] as string | undefined;
      if (!id) continue;
      (history[id] ??= []).push({
        fetched_at:      snap.fetched_at,
        views:           item.views           ?? 0,
        likes:           item.likes           ?? 0,
        comments:        item.comments        ?? 0,
        shares:          item.shares          ?? 0,
        engagement_rate: item.engagement_rate ?? 0,
      });
    }
  }
  return history;
}

export interface ProjectAnalytics {
  tiktok: Awaited<ReturnType<typeof getTikTokData>>;
  instagram: Awaited<ReturnType<typeof getInstagramData>>;
  handles: { tiktok: string | null; instagram: string | null };
}

async function getTikTokData(handle: string | null) {
  if (!handle) return null;
  const { data: account } = await supabase
    .from('tiktok_accounts')
    .select('id')
    .eq('handle', handle)
    .maybeSingle();
  if (!account) return null;

  const [{ data: snapshots }, { data: latestSnapshot }] = await Promise.all([
    supabase
      .from('tiktok_snapshots')
      .select('id, fetched_at, followers, video_count, videos')
      .eq('account_id', account.id)
      .order('fetched_at', { ascending: true }),
    supabase
      .from('tiktok_snapshots')
      .select('id, fetched_at, followers, video_count, videos')
      .eq('account_id', account.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Content posted since tracking began — used so ROI/value views the manager's
  // own work, not a years-old back catalogue (see newContentIds).
  const newIds = newContentIds(snapshots ?? [], 'videos', 'video_id');

  const trend = (snapshots ?? []).map((s) => ({
    id: s.id,
    fetched_at: s.fetched_at,
    followers: s.followers,
    video_count: s.video_count,
    views: sumViews(s.videos),
    views_since_tracking: attributedViews(s.videos as never, newIds, 'video_id'),
  }));
  const history = buildVideoHistory(snapshots ?? [], 'videos', 'video_id');

  return { account_id: account.id, handle, latest_snapshot: latestSnapshot ?? null, snapshots: trend, history, new_ids: [...newIds] };
}

async function getInstagramData(handle: string | null) {
  if (!handle) return null;
  const { data: account } = await supabase
    .from('instagram_accounts')
    .select('id')
    .eq('handle', handle)
    .maybeSingle();
  if (!account) return null;

  const [{ data: snapshots }, { data: latestSnapshot }] = await Promise.all([
    supabase
      .from('instagram_snapshots')
      .select('id, fetched_at, followers, post_count, posts')
      .eq('account_id', account.id)
      .order('fetched_at', { ascending: true }),
    supabase
      .from('instagram_snapshots')
      .select('id, fetched_at, followers, post_count, posts')
      .eq('account_id', account.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const newIds = newContentIds(snapshots ?? [], 'posts', 'post_id');

  const trend = (snapshots ?? []).map((s) => ({
    id: s.id,
    fetched_at: s.fetched_at,
    followers: s.followers,
    post_count: s.post_count,
    views: sumViews(s.posts),
    views_since_tracking: attributedViews(s.posts as never, newIds, 'post_id'),
  }));
  const history = buildVideoHistory(snapshots ?? [], 'posts', 'post_id');

  return { account_id: account.id, latest_snapshot: latestSnapshot ?? null, snapshots: trend, history, new_ids: [...newIds] };
}

/** Sum the `views` across a snapshot's videos/posts array. */
export function sumViews(items: unknown): number {
  return ((items ?? []) as { views?: number | null }[]).reduce((a, v) => a + (v?.views ?? 0), 0);
}

interface DatedSnapshot { fetched_at: string; [k: string]: unknown }
interface DatedItem { views?: number | null; created_at?: number | null; [k: string]: unknown }

/**
 * The set of content ids that count as "made since the manager started" — items
 * posted on/after the account's first snapshot date (when tracking began).
 *
 * This is the honest signal for attribution: a back-catalogue video posted years
 * ago is excluded by its publish date no matter when pagination first pulled it
 * into a snapshot — which is what made the naive "lifetime total" approach wrong
 * (the API surfaces the old catalogue gradually, looking like millions of new
 * views). `created_at` is read from whichever snapshot carries it (newest wins),
 * so a single refresh after this ships reclassifies all of history correctly.
 *
 * Empty until the first post-upgrade refresh populates `created_at`.
 */
export function newContentIds(snapsAsc: DatedSnapshot[], itemsKey: string, idKey: string): Set<string> {
  if (!snapsAsc.length) return new Set();
  const startUnix = Math.floor(new Date(snapsAsc[0].fetched_at).getTime() / 1000);
  const createdById = new Map<string, number>();
  for (const snap of snapsAsc) {
    for (const it of ((snap[itemsKey] as DatedItem[]) ?? [])) {
      const id = it[idKey] as string | undefined;
      if (id && typeof it.created_at === 'number') createdById.set(id, it.created_at);
    }
  }
  const ids = new Set<string>();
  for (const [id, created] of createdById) if (created >= startUnix) ids.add(id);
  return ids;
}

/** Sum views over only the items whose id is in `ids` (content made since tracking started). */
export function attributedViews(items: DatedItem[] | null | undefined, ids: Set<string>, idKey: string): number {
  let total = 0;
  for (const it of items ?? []) {
    const id = it[idKey] as string | undefined;
    if (id && ids.has(id)) total += it.views ?? 0;
  }
  return total;
}

/** Group snapshot rows by account_id, preserving input (ascending) order. */
export function groupByAccount<T extends { account_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    let arr = m.get(r.account_id);
    if (!arr) m.set(r.account_id, (arr = []));
    arr.push(r);
  }
  return m;
}

/** Aggregate a project's TikTok + Instagram analytics, or null if the project is missing. */
export async function getProjectAnalytics(id: string): Promise<ProjectAnalytics | null> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('tiktok_handle, instagram_handle')
    .eq('id', id)
    .single();
  if (error || !project) return null;

  const [tiktok, instagram] = await Promise.all([
    getTikTokData(project.tiktok_handle),
    getInstagramData(project.instagram_handle),
  ]);

  return {
    tiktok,
    instagram,
    handles: { tiktok: project.tiktok_handle ?? null, instagram: project.instagram_handle ?? null },
  };
}
