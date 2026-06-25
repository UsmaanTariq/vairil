// Shared ROI computation, used by both the in-app ROI dashboard and the
// client-facing PDF report so the two never disagree. Frameworkless + pure so it
// runs in a client component and in a server component alike.
//
// The model converts tracked views into estimated £ value at a per-client
// `value_per_1k_views` rate, scoped to a [from, to] reporting window, and frames
// it against the client's monthly retainer as a return multiple.

// ── Shapes we consume from /api/projects/[id]/analytics ──────────────────────
export interface AnalyticsItem {
  video_id?: string;
  post_id?: string;
  title?: string;
  caption?: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  thumbnail_url?: string | null;
}
export interface TrendPoint {
  fetched_at: string;
  followers?: number | null;
  views?: number;
  views_since_tracking?: number; // views from content posted since tracking began
}
export interface HistoryPoint {
  fetched_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}
export interface PlatformData {
  handle?: string;
  latest_snapshot: { videos?: AnalyticsItem[]; posts?: AnalyticsItem[] } | null;
  snapshots: TrendPoint[];
  history: Record<string, HistoryPoint[]>;
  new_ids?: string[]; // ids of content posted since tracking began; restricts ROI to the manager's own work
}
export interface AnalyticsData {
  tiktok: PlatformData | null;
  instagram: PlatformData | null;
}

export type Platform = "TikTok" | "Instagram";

export interface RoiInput {
  rate: number;
  retainer: number | null;
  from: string | null; // 'YYYY-MM-DD' inclusive, or null for all-time
  to: string | null;   // 'YYYY-MM-DD' inclusive, or null for "latest"
}

export interface TopItem {
  id: string;
  label: string;
  platform: Platform;
  views: number; // view gain within the window
  value: number; // £
  likes: number;
  comments: number;
  shares: number;
  thumbnail_url: string | null;
}

export interface RoiModel {
  rate: number;
  retainer: number | null;
  hasData: boolean;
  // headline
  totalValue: number;
  totalViews: number;
  roiMultiple: number | null;
  contentCount: number;
  avgValue: number;
  topEarner: TopItem | null;
  // platform split (£ in window)
  ttValue: number;
  igValue: number;
  // series
  valueSeries: { date: string; value: number }[];   // cumulative £ generated within the window
  perPeriod: { date: string; value: number }[];      // £ generated between snapshots
  followerSeries: { date: string; tiktok: number | null; instagram: number | null }[];
  // follower growth across the window
  ttFollowerGrowth: number | null;
  igFollowerGrowth: number | null;
  // engagement totals (gains within the window)
  engagement: { likes: number; comments: number; shares: number; total: number };
  // top content within the window
  topContent: TopItem[];
}

// ── Formatting (exported so dashboard + report render identically) ───────────
export const gbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: n < 100 ? 2 : 0 });
export const gbpCompact = (n: number) =>
  n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `£${(n / 1_000).toFixed(1)}K` : `£${Math.round(n)}`;
export const fmtViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toLocaleString("en-GB");
export const dayLabel = (day: string) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// ── Internal helpers ─────────────────────────────────────────────────────────
const day = (iso: string) => iso.slice(0, 10);

// Latest cumulative value per calendar day for a metric (snapshots are ascending,
// so the last write for a given day wins — collapses multiple daily snapshots).
function dailyBy<T extends keyof TrendPoint>(snaps: TrendPoint[], field: T): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of snaps) m.set(day(s.fetched_at), Number(s[field] ?? 0));
  return m;
}

// Per-day attributed views — content posted since tracking began. Falls back to
// the full `views` when attribution data is absent (older payloads).
function dailyAttributed(snaps: TrendPoint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of snaps) m.set(day(s.fetched_at), Number(s.views_since_tracking ?? s.views ?? 0));
  return m;
}

// For each day, the value that day or the last known one carried forward (cumulative
// metrics only grow, so a gap shouldn't read as a drop).
function carryForward(daily: Map<string, number>, days: string[]): number[] {
  let last = 0;
  return days.map((d) => (daily.has(d) ? (last = daily.get(d)!) : last));
}

// The metric value at the snapshot just before `fromDay` — the baseline already
// accumulated before the window opens. -1 / 0 when nothing precedes the window.
function baselineIndex(days: string[], fromDay: string | null): number {
  if (!fromDay) return -1;
  let idx = -1;
  for (let i = 0; i < days.length; i++) if (days[i] < fromDay) idx = i;
  return idx;
}

// A single item's metric values at the window edges, via its snapshot history.
function itemDelta(points: HistoryPoint[], fromDay: string | null, toDay: string | null) {
  const end = [...points].reverse().find((p) => !toDay || day(p.fetched_at) <= toDay);
  if (!end) return null;
  const start = fromDay ? [...points].reverse().find((p) => day(p.fetched_at) < fromDay) : undefined;
  const base = start ?? { views: 0, likes: 0, comments: 0, shares: 0 };
  return {
    views: Math.max(0, end.views - base.views),
    likes: Math.max(0, end.likes - base.likes),
    comments: Math.max(0, end.comments - base.comments),
    shares: Math.max(0, end.shares - base.shares),
  };
}

function platformItems(
  pd: PlatformData | null,
  platform: Platform,
  rate: number,
  fromDay: string | null,
  toDay: string | null,
): TopItem[] {
  if (!pd) return [];
  const idKey = platform === "TikTok" ? "video_id" : "post_id";
  const labelKey = platform === "TikTok" ? "title" : "caption";
  const latest = (platform === "TikTok" ? pd.latest_snapshot?.videos : pd.latest_snapshot?.posts) ?? [];
  const metaById = new Map(latest.map((it) => [it[idKey] as string, it]));
  // Only credit content the manager posted since tracking began (excludes the
  // client's pre-existing back catalogue). When new_ids is absent, don't filter.
  const newIds = pd.new_ids ? new Set(pd.new_ids) : null;

  const items: TopItem[] = [];
  for (const [id, points] of Object.entries(pd.history)) {
    if (newIds && !newIds.has(id)) continue;
    const d = itemDelta(points, fromDay, toDay);
    if (!d || d.views <= 0) continue;
    const meta = metaById.get(id);
    const label = (meta?.[labelKey] as string | undefined)?.trim() || id;
    items.push({
      id,
      label,
      platform,
      views: d.views,
      value: (d.views / 1000) * rate,
      likes: d.likes,
      comments: d.comments,
      shares: d.shares,
      thumbnail_url: meta?.thumbnail_url ?? null,
    });
  }
  return items;
}

/**
 * Compute the full ROI model for a project over a reporting window.
 * `from`/`to` are inclusive 'YYYY-MM-DD' day strings; null = open-ended.
 */
export function computeRoi(data: AnalyticsData | null, input: RoiInput): RoiModel {
  const { rate, retainer, from: fromDay, to: toDay } = input;
  const toMoney = (views: number) => (views / 1000) * rate;

  const tt = data?.tiktok ?? null;
  const ig = data?.instagram ?? null;
  const ttSnaps = tt?.snapshots ?? [];
  const igSnaps = ig?.snapshots ?? [];

  // Cumulative views (attributed to content posted since tracking began) +
  // followers per day across both platforms.
  const ttViewDaily = dailyAttributed(ttSnaps);
  const igViewDaily = dailyAttributed(igSnaps);
  const ttFollDaily = dailyBy(ttSnaps, "followers");
  const igFollDaily = dailyBy(igSnaps, "followers");

  const allDays = Array.from(
    new Set([...ttViewDaily.keys(), ...igViewDaily.keys()]),
  ).sort();

  const ttViews = carryForward(ttViewDaily, allDays);
  const igViews = carryForward(igViewDaily, allDays);
  const ttFoll = carryForward(ttFollDaily, allDays);
  const igFoll = carryForward(igFollDaily, allDays);

  const inWindow = (d: string) => (!fromDay || d >= fromDay) && (!toDay || d <= toDay);
  const windowIdx = allDays.map((_, i) => i).filter((i) => inWindow(allDays[i]));

  const baseI = baselineIndex(allDays, fromDay);
  const ttBase = baseI >= 0 ? ttViews[baseI] : 0;
  const igBase = baseI >= 0 ? igViews[baseI] : 0;

  // Cumulative £ generated *within* the window (rebased so it starts near zero).
  const valueSeries = windowIdx.map((i) => ({
    date: dayLabel(allDays[i]),
    value: toMoney(ttViews[i] - ttBase + (igViews[i] - igBase)),
  }));
  const perPeriod = valueSeries.slice(1).map((p, i) => ({
    date: p.date,
    value: Math.max(0, p.value - valueSeries[i].value),
  }));

  const lastI = windowIdx.at(-1);
  const firstI = windowIdx[0];
  const ttViewGain = lastI !== undefined ? ttViews[lastI] - ttBase : 0;
  const igViewGain = lastI !== undefined ? igViews[lastI] - igBase : 0;
  const ttValue = toMoney(ttViewGain);
  const igValue = toMoney(igViewGain);
  const totalValue = ttValue + igValue;
  const totalViews = ttViewGain + igViewGain;

  // Follower trend + growth across the window.
  const followerSeries = windowIdx.map((i) => ({
    date: dayLabel(allDays[i]),
    tiktok: ttFoll[i] || null,
    instagram: igFoll[i] || null,
  }));
  const follGrowth = (foll: number[]): number | null => {
    if (lastI === undefined) return null;
    const start = baseI >= 0 ? foll[baseI] : foll[firstI];
    if (!start && !foll[lastI]) return null;
    return foll[lastI] - (start ?? foll[lastI]);
  };
  const ttFollowerGrowth = ttSnaps.length ? follGrowth(ttFoll) : null;
  const igFollowerGrowth = igSnaps.length ? follGrowth(igFoll) : null;

  // Per-item performance within the window (drives top content + engagement).
  const allItems = [
    ...platformItems(tt, "TikTok", rate, fromDay, toDay),
    ...platformItems(ig, "Instagram", rate, fromDay, toDay),
  ].sort((a, b) => b.value - a.value);

  const engagement = allItems.reduce(
    (acc, it) => {
      acc.likes += it.likes;
      acc.comments += it.comments;
      acc.shares += it.shares;
      return acc;
    },
    { likes: 0, comments: 0, shares: 0 },
  );

  const contentCount = allItems.length;
  const avgValue = contentCount ? totalValue / contentCount : 0;
  const topContent = allItems.slice(0, 10);
  const topEarner = allItems[0] ?? null;

  const roiMultiple =
    retainer && retainer > 0 && totalValue > 0 ? totalValue / retainer : null;

  return {
    rate,
    retainer,
    hasData: allDays.length > 0,
    totalValue,
    totalViews,
    roiMultiple,
    contentCount,
    avgValue,
    topEarner,
    ttValue,
    igValue,
    valueSeries,
    perPeriod,
    followerSeries,
    ttFollowerGrowth,
    igFollowerGrowth,
    engagement: { ...engagement, total: engagement.likes + engagement.comments + engagement.shares },
    topContent,
  };
}

// ── Reporting-period presets ─────────────────────────────────────────────────
export type PeriodKey = "30d" | "month" | "90d" | "all";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "30d": "Last 30 days",
  month: "This month",
  "90d": "Last 3 months",
  all: "All time",
};

// Resolve a preset to inclusive 'YYYY-MM-DD' bounds (today as `to`).
export function periodRange(key: PeriodKey, now = new Date()): { from: string | null; to: string | null } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const to = iso(now);
  if (key === "all") return { from: null, to: null };
  if (key === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  const days = key === "30d" ? 30 : 90;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from: iso(from), to };
}

// Human label for a resolved window, for report headers / filenames.
export function periodDescription(key: PeriodKey, range: { from: string | null; to: string | null }): string {
  if (key === "all" || !range.from) return "All time";
  const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(range.from)} – ${fmt(range.to ?? range.from)}`;
}
