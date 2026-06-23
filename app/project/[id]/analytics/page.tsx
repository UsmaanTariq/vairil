'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefreshCw, Eye, Heart, MessageCircle, Share2, TrendingUp, UserRound, type LucideIcon } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

import { AppShell } from '@/components/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PostStat {
  post_id:         string;
  caption:         string;
  views:           number | null;
  likes:           number;
  comments:        number;
  engagement_rate: number;
  thumbnail_url:   string | null;
}

interface VideoStat {
  video_id:        string;
  title:           string;
  views:           number;
  likes:           number;
  comments:        number;
  shares:          number;
  engagement_rate: number;
  thumbnail_url:   string | null;
}

interface SnapshotBase { id: string; fetched_at: string; followers: number; views?: number }
interface TikTokSnapshotTrend    extends SnapshotBase { video_count: number }
interface InstagramSnapshotTrend extends SnapshotBase { post_count:  number }
interface TikTokSnapshot    extends TikTokSnapshotTrend    { videos?: VideoStat[] }
interface InstagramSnapshot extends InstagramSnapshotTrend { posts?:  PostStat[]  }

interface AnalyticsData {
  tiktok:    { account_id: string; handle: string | null; latest_snapshot: TikTokSnapshot | null;    snapshots: TikTokSnapshotTrend[]    } | null;
  instagram: { account_id: string; latest_snapshot: InstagramSnapshot | null; snapshots: InstagramSnapshotTrend[] } | null;
  handles:   { tiktok: string | null; instagram: string | null };
}

function fmt(n: number | null) {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Y-axis domain padded around the data's actual min/max so small variation in
// large values (e.g. follower counts, cumulative views) stays visible.
function paddedDomain(values: number[], padRatio = 0.2): [number, number] | ['auto', 'auto'] {
  if (!values.length) return ['auto', 'auto'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    return [Math.max(0, min - pad), max + pad];
  }
  const pad = (max - min) * padRatio;
  return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
}

// Theme-aware recharts styling — adapts to the active (dark) theme via CSS variables.
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--popover)', border: '1px solid var(--border)',
  borderRadius: '12px', color: 'var(--popover-foreground)', fontSize: '12px',
};
const AXIS = { tickLine: false, axisLine: false } as const;
const TICK = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
const GRID_H = { strokeDasharray: '4 4', stroke: 'var(--border)', vertical: false } as const;
const GRID_V = { strokeDasharray: '4 4', stroke: 'var(--border)', horizontal: false } as const;
const BAR_CURSOR = { fill: 'color-mix(in srgb, var(--foreground) 8%, transparent)' } as const;
const LINE_CURSOR = { stroke: 'var(--border)', strokeWidth: 1 } as const;

function StatCard({ label, value, icon: Icon }: {
  label: string; value: string; icon: LucideIcon;
}) {
  return (
    <Card className="dark:bg-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardDescription className="flex items-center gap-2">
            <Icon className="size-4" />
            {label}
          </CardDescription>
          <CardTitle className="font-mono text-3xl tabular-nums">{value}</CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

function ChartCard({ title, children, className }: {
  title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={`dark:bg-transparent ${className ?? ''}`}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type TtSortKey = 'views' | 'likes' | 'comments' | 'shares' | 'engagement_rate';
type IgSortKey = 'views' | 'likes' | 'comments' | 'engagement_rate';
type Tab = 'tiktok' | 'instagram';

export default function ProjectAnalyticsPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<Tab>('tiktok');
  const [ttSort, setTtSort]   = useState<TtSortKey>('views');
  const [ttDir, setTtDir]     = useState<'asc' | 'desc'>('desc');
  const [igSort, setIgSort]   = useState<IgSortKey>('likes');
  const [igDir, setIgDir]     = useState<'asc' | 'desc'>('desc');
  const [ttPage, setTtPage] = useState(0);
  const [igPage, setIgPage] = useState(0);
  const PAGE_SIZE = 20;
  const [ttRefreshing, setTtRefreshing] = useState(false);
  const [igRefreshing, setIgRefreshing] = useState(false);
  const [ttRefreshErr, setTtRefreshErr] = useState('');
  const [igRefreshErr, setIgRefreshErr] = useState('');
  const [ttHandle, setTtHandle]         = useState('');
  const [igHandle, setIgHandle]         = useState('');
  const [ttLinking, setTtLinking]       = useState(false);
  const [igLinking, setIgLinking]       = useState(false);
  const [ttLinkErr, setTtLinkErr]       = useState('');
  const [igLinkErr, setIgLinkErr]       = useState('');

  useEffect(() => {
    fetch(`/api/projects/${id}/analytics`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        // default to whichever tab has data
        if (!d.tiktok && d.instagram) setTab('instagram');
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [id]);

  async function refreshTikTok() {
    const accountId = data?.tiktok?.account_id;
    if (!accountId) return;
    setTtRefreshing(true); setTtRefreshErr('');
    try {
      const res = await fetch(`/api/tiktok/accounts/${accountId}/refresh`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setTtRefreshErr(d.error ?? 'Refresh failed'); return; }
      const refreshed = await fetch(`/api/projects/${id}/analytics`).then((r) => r.json());
      if (!refreshed.error) setData(refreshed);
    } catch { setTtRefreshErr('Network error'); }
    finally { setTtRefreshing(false); }
  }

  async function refreshInstagram() {
    const accountId = data?.instagram?.account_id;
    if (!accountId) return;
    setIgRefreshing(true); setIgRefreshErr('');
    try {
      const res = await fetch(`/api/instagram/accounts/${accountId}/refresh`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setIgRefreshErr(d.error ?? 'Refresh failed'); return; }
      const refreshed = await fetch(`/api/projects/${id}/analytics`).then((r) => r.json());
      if (!refreshed.error) setData(refreshed);
    } catch { setIgRefreshErr('Network error'); }
    finally { setIgRefreshing(false); }
  }

  async function linkTikTok() {
    const handle = ttHandle.replace(/^@/, '').trim();
    if (!handle) return;
    setTtLinking(true); setTtLinkErr('');
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktok_handle: handle }),
      });
      if (!res.ok) { setTtLinkErr('Failed to save handle'); return; }
      const refreshed = await fetch(`/api/projects/${id}/analytics`).then((r) => r.json());
      if (!refreshed.error) { setData(refreshed); setTtHandle(''); }
    } catch { setTtLinkErr('Network error'); }
    finally { setTtLinking(false); }
  }

  async function linkInstagram() {
    const handle = igHandle.replace(/^@/, '').trim();
    if (!handle) return;
    setIgLinking(true); setIgLinkErr('');
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram_handle: handle }),
      });
      if (!res.ok) { setIgLinkErr('Failed to save handle'); return; }
      const refreshed = await fetch(`/api/projects/${id}/analytics`).then((r) => r.json());
      if (!refreshed.error) { setData(refreshed); setIgHandle(''); }
    } catch { setIgLinkErr('Network error'); }
    finally { setIgLinking(false); }
  }

  function toggleTt(key: TtSortKey) {
    if (ttSort === key) setTtDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setTtSort(key); setTtDir('desc'); }
    setTtPage(0);
  }
  function toggleIg(key: IgSortKey) {
    if (igSort === key) setIgDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setIgSort(key); setIgDir('desc'); }
    setIgPage(0);
  }

  const ttSnap   = data?.tiktok?.latest_snapshot;
  const ttSnaps  = data?.tiktok?.snapshots ?? [];
  const ttVideos = ttSnap?.videos ?? [];
  const igSnap   = data?.instagram?.latest_snapshot;
  const igSnaps  = data?.instagram?.snapshots ?? [];
  const igPosts  = igSnap?.posts ?? [];

  const ttTotalViews   = ttVideos.reduce((s, v) => s + v.views, 0);
  const igTotalViews   = igPosts.reduce((s, p) => s + (p.views ?? 0), 0);
  const ttTotalLikes   = ttVideos.reduce((s, v) => s + v.likes, 0);
  const igTotalLikes   = igPosts.reduce((s, p) => s + p.likes, 0);
  const totalFollowers = (ttSnap?.followers ?? 0) + (igSnap?.followers ?? 0);
  const ttAvgEng       = ttVideos.length ? ttVideos.reduce((s, v) => s + v.engagement_rate, 0) / ttVideos.length : 0;
  const igAvgEng       = igPosts.length  ? igPosts.reduce((s, p)  => s + p.engagement_rate, 0)  / igPosts.length  : 0;
  const engCount       = (ttVideos.length > 0 ? 1 : 0) + (igPosts.length > 0 ? 1 : 0);
  const combinedAvgEng = engCount > 0 ? (ttAvgEng + igAvgEng) / engCount : 0;
  const combinedViews  = ttTotalViews + igTotalViews;

  const ttTrendData = ttSnaps.map((s) => ({
    date: new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: s.followers,
  }));

  const igTrendData = igSnaps.map((s) => ({
    date: new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: s.followers,
  }));

  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  // Cumulative = total lifetime views at each snapshot. Per-day = day-over-day gain (clamped at 0).
  const ttViewsCumulative = ttSnaps.map((s) => ({ date: shortDate(s.fetched_at), views: s.views ?? 0 }));
  const ttViewsPerDay = ttSnaps.slice(1).map((s, i) => ({
    date: shortDate(s.fetched_at),
    views: Math.max(0, (s.views ?? 0) - (ttSnaps[i].views ?? 0)),
  }));
  const igViewsCumulative = igSnaps.map((s) => ({ date: shortDate(s.fetched_at), views: s.views ?? 0 }));
  const igViewsPerDay = igSnaps.slice(1).map((s, i) => ({
    date: shortDate(s.fetched_at),
    views: Math.max(0, (s.views ?? 0) - (igSnaps[i].views ?? 0)),
  }));

  const ttTopByViews = [...ttVideos].sort((a, b) => b.views - a.views).slice(0, 10).map((v, i) => ({
    title: v.title ? (v.title.length > 28 ? v.title.slice(0, 28) + '…' : v.title) : `#${i + 1}`,
    views: v.views,
  }));
  const ttByEngagement = [...ttVideos].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, 12).map((v, i) => ({
    title: v.title ? (v.title.length > 16 ? v.title.slice(0, 16) + '…' : v.title) : `#${i + 1}`,
    rate: Math.round(v.engagement_rate * 10000) / 100,
  }));

  const igTopByLikes = [...igPosts].sort((a, b) => b.likes - a.likes).slice(0, 10).map((p, i) => ({
    title: p.caption ? (p.caption.length > 28 ? p.caption.slice(0, 28) + '…' : p.caption) : `#${i + 1}`,
    likes: p.likes,
  }));
  const igByEngagement = [...igPosts].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, 12).map((p, i) => ({
    title: p.caption ? (p.caption.length > 16 ? p.caption.slice(0, 16) + '…' : p.caption) : `#${i + 1}`,
    rate: Math.round(p.engagement_rate * 10000) / 100,
  }));

  const topTtVideo = [...ttVideos].sort((a, b) => b.views - a.views)[0] ?? null;
  const topIgPost  = [...igPosts].sort((a, b) => b.likes - a.likes)[0] ?? null;

  // Padded Y-axis domains so the time-series area charts show real variation.
  const ttFollowerDomain = paddedDomain(ttTrendData.map((d) => d.followers));
  const ttViewsDomain    = paddedDomain(ttViewsCumulative.map((d) => d.views));
  const igFollowerDomain = paddedDomain(igTrendData.map((d) => d.followers));
  const igViewsDomain    = paddedDomain(igViewsCumulative.map((d) => d.views));

  // "Linked" means a real account record exists — a leftover handle string with no
  // account row (e.g. the row was deleted in the DB) must still expose the Add form.
  const hasTikTok    = Boolean(data?.tiktok);
  const hasInstagram = Boolean(data?.instagram);

  return (
    <AppShell>
      {loading ? (
        <Card className="dark:bg-transparent"><CardContent className="py-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : error ? (
        <Card className="dark:bg-transparent">
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => router.push('/accounts')}>Back to accounts</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <Button variant="ghost" size="sm" onClick={() => router.push('/accounts')}>Back to accounts</Button>
          </div>

          {/* Top KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Combined views"  value={fmt(combinedViews || null)}              icon={Eye} />
            <StatCard label="Total followers" value={fmt(totalFollowers || null)}             icon={UserRound} />
            <StatCard label="Avg engagement"  value={`${(combinedAvgEng * 100).toFixed(2)}%`} icon={TrendingUp} />
          </div>

          {/* Platform tabs */}
          <div className="flex gap-2">
            {([
              { key: 'tiktok'    as Tab, label: 'TikTok',    linked: hasTikTok },
              { key: 'instagram' as Tab, label: 'Instagram', linked: hasInstagram },
            ]).map(({ key, label, linked }) => (
              <Button
                key={key}
                variant={tab === key ? 'default' : 'outline'}
                onClick={() => setTab(key)}
              >
                {label}
                {!linked && <Badge variant="secondary" className="ml-1">+ Add</Badge>}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Main column */}
            <div className="flex min-w-0 flex-col gap-4">
              {/* TikTok tab */}
              {tab === 'tiktok' && hasTikTok && data?.tiktok && (
                <div className="flex flex-col gap-4">
                  <Card className="dark:bg-transparent">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                      <div className="flex flex-wrap gap-8">
                        {[
                          { label: 'Followers',      value: fmt(ttSnap?.followers ?? null) },
                          { label: 'Videos',         value: fmt(ttSnap?.video_count ?? null) },
                          { label: 'Last refreshed', value: fmtDate(ttSnap?.fetched_at ?? null) },
                          { label: 'Snapshots',      value: ttSnaps.length.toString() },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="font-mono text-base font-semibold tabular-nums">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {ttRefreshErr && <p className="text-xs text-destructive">{ttRefreshErr}</p>}
                        <Button variant="outline" size="sm" onClick={refreshTikTok} disabled={ttRefreshing}>
                          <RefreshCw className={`size-3.5 ${ttRefreshing ? 'animate-spin' : ''}`} />
                          {ttRefreshing ? 'Refreshing…' : 'Refresh'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {ttTrendData.length > 0 && (
                    <ChartCard title="Follower trend">
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={ttTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="ttFollowers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...GRID_H} />
                          <XAxis dataKey="date" tick={TICK} {...AXIS} />
                          <YAxis tickFormatter={fmt} tick={TICK} domain={ttFollowerDomain} width={44} {...AXIS} />
                          <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Followers']} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
                          <Area type="monotone" dataKey="followers" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#ttFollowers)" dot={false} activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--background)', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  {ttViewsCumulative.some((d) => d.views > 0) && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <ChartCard title="Cumulative views">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={ttViewsCumulative} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="ttViewsCum" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_H} />
                            <XAxis dataKey="date" tick={TICK} {...AXIS} />
                            <YAxis tickFormatter={fmt} tick={TICK} domain={ttViewsDomain} width={44} {...AXIS} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Total views']} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
                            <Area type="monotone" dataKey="views" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#ttViewsCum)" dot={false} activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--background)', strokeWidth: 2 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartCard>
                      <ChartCard title="Views per day">
                        {ttViewsPerDay.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={ttViewsPerDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid {...GRID_H} />
                              <XAxis dataKey="date" tick={TICK} {...AXIS} />
                              <YAxis tickFormatter={fmt} tick={TICK} domain={['auto', 'auto']} width={44} {...AXIS} />
                              <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views gained']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                              <Bar dataKey="views" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-[200px] items-center justify-center">
                            <p className="text-sm text-muted-foreground">Need at least two snapshots to show daily change.</p>
                          </div>
                        )}
                      </ChartCard>
                    </div>
                  )}

                  {ttVideos.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <ChartCard title="Top videos by views">
                        <ResponsiveContainer width="100%" height={Math.max(200, ttTopByViews.length * 38)}>
                          <BarChart layout="vertical" data={ttTopByViews} margin={{ left: 0, right: 12 }}>
                            <CartesianGrid {...GRID_V} />
                            <XAxis type="number" tickFormatter={fmt} tick={TICK} {...AXIS} />
                            <YAxis type="category" dataKey="title" width={130} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} {...AXIS} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                            <Bar dataKey="views" fill="var(--chart-1)" radius={[0, 6, 6, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                      <ChartCard title="Engagement rate (%)">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={ttByEngagement} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid {...GRID_H} />
                            <XAxis dataKey="title" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval={0} angle={-30} textAnchor="end" height={60} {...AXIS} />
                            <YAxis tickFormatter={(v) => `${v}%`} tick={TICK} domain={['auto', 'auto']} {...AXIS} />
                            <Tooltip formatter={(v) => [typeof v === 'number' ? `${v}%` : '—', 'Engagement']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                            <Bar dataKey="rate" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    </div>
                  )}

                  {ttVideos.length > 0 && (
                    <Card className="dark:bg-transparent">
                      <CardContent className="p-0 pb-2">
                        <Table className="border-t">
                          <TableHeader>
                            <TableRow>
                              {(['title', 'views', 'likes', 'comments', 'shares', 'engagement_rate'] as const).map((key) => (
                                <TableHead key={key} onClick={() => key !== 'title' && toggleTt(key as TtSortKey)}
                                  className={`${key === 'title' ? 'pl-6' : 'cursor-pointer select-none hover:text-foreground'}`}>
                                  {key === 'engagement_rate' ? 'Engagement' : key.charAt(0).toUpperCase() + key.slice(1)}
                                  {ttSort === key && <span className="ml-1">{ttDir === 'desc' ? '↓' : '↑'}</span>}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const sorted = [...ttVideos].sort((a, b) => {
                                const av = a[ttSort], bv = b[ttSort];
                                return (ttDir === 'asc' ? 1 : -1) * (av < bv ? -1 : av > bv ? 1 : 0);
                              });
                              const page = sorted.slice(ttPage * PAGE_SIZE, (ttPage + 1) * PAGE_SIZE);
                              return page.map((v) => (
                                <TableRow key={v.video_id}>
                                  <TableCell className="max-w-[220px] truncate pl-6 font-medium">
                                    {v.title && data?.tiktok?.handle
                                      ? <a href={`https://www.tiktok.com/@${data.tiktok.handle}/video/${v.video_id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{v.title.length > 50 ? v.title.slice(0, 50) + '…' : v.title}</a>
                                      : v.title ? (v.title.length > 50 ? v.title.slice(0, 50) + '…' : v.title) : <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="text-xs tabular-nums text-muted-foreground">{fmt(v.views)}</TableCell>
                                  <TableCell className="text-xs tabular-nums text-muted-foreground">{fmt(v.likes)}</TableCell>
                                  <TableCell className="text-xs tabular-nums text-muted-foreground">{fmt(v.comments)}</TableCell>
                                  <TableCell className="text-xs tabular-nums text-muted-foreground">{fmt(v.shares)}</TableCell>
                                  <TableCell className="text-xs font-medium tabular-nums">{(v.engagement_rate * 100).toFixed(2)}%</TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                        {ttVideos.length > PAGE_SIZE && (
                          <div className="flex items-center justify-between px-6 py-3">
                            <span className="text-xs text-muted-foreground">
                              {ttPage * PAGE_SIZE + 1}–{Math.min((ttPage + 1) * PAGE_SIZE, ttVideos.length)} of {ttVideos.length}
                            </span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" disabled={ttPage === 0} onClick={() => setTtPage((p) => p - 1)}>Prev</Button>
                              <Button size="sm" variant="outline" disabled={(ttPage + 1) * PAGE_SIZE >= ttVideos.length} onClick={() => setTtPage((p) => p + 1)}>Next</Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {!ttSnap && (
                    <Card className="dark:bg-transparent"><CardContent className="py-6 text-center text-sm text-muted-foreground">No TikTok data yet. Hit Refresh to pull the first snapshot.</CardContent></Card>
                  )}
                </div>
              )}

              {/* Instagram tab */}
              {tab === 'instagram' && hasInstagram && data?.instagram && (
                <div className="flex flex-col gap-4">
                  <Card className="dark:bg-transparent">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                      <div className="flex flex-wrap gap-8">
                        {[
                          { label: 'Followers',      value: fmt(igSnap?.followers ?? null) },
                          { label: 'Posts',          value: fmt(igSnap?.post_count ?? null) },
                          { label: 'Last refreshed', value: fmtDate(igSnap?.fetched_at ?? null) },
                          { label: 'Snapshots',      value: igSnaps.length.toString() },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="font-mono text-base font-semibold tabular-nums">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {igRefreshErr && <p className="text-xs text-destructive">{igRefreshErr}</p>}
                        <Button variant="outline" size="sm" onClick={refreshInstagram} disabled={igRefreshing}>
                          <RefreshCw className={`size-3.5 ${igRefreshing ? 'animate-spin' : ''}`} />
                          {igRefreshing ? 'Refreshing…' : 'Refresh'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {igTrendData.length > 0 && (
                    <ChartCard title="Follower trend">
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={igTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="igFollowers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...GRID_H} />
                          <XAxis dataKey="date" tick={TICK} {...AXIS} />
                          <YAxis tickFormatter={fmt} tick={TICK} domain={igFollowerDomain} width={44} {...AXIS} />
                          <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Followers']} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
                          <Area type="monotone" dataKey="followers" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#igFollowers)" dot={false} activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--background)', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  {igViewsCumulative.some((d) => d.views > 0) && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <ChartCard title="Cumulative views">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={igViewsCumulative} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="igViewsCum" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_H} />
                            <XAxis dataKey="date" tick={TICK} {...AXIS} />
                            <YAxis tickFormatter={fmt} tick={TICK} domain={igViewsDomain} width={44} {...AXIS} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Total views']} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
                            <Area type="monotone" dataKey="views" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#igViewsCum)" dot={false} activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--background)', strokeWidth: 2 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartCard>
                      <ChartCard title="Views per day">
                        {igViewsPerDay.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={igViewsPerDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid {...GRID_H} />
                              <XAxis dataKey="date" tick={TICK} {...AXIS} />
                              <YAxis tickFormatter={fmt} tick={TICK} domain={['auto', 'auto']} width={44} {...AXIS} />
                              <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views gained']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                              <Bar dataKey="views" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-[200px] items-center justify-center">
                            <p className="text-sm text-muted-foreground">Need at least two snapshots to show daily change.</p>
                          </div>
                        )}
                      </ChartCard>
                    </div>
                  )}

                  {igPosts.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <ChartCard title="Top posts by likes">
                        <ResponsiveContainer width="100%" height={Math.max(200, igTopByLikes.length * 38)}>
                          <BarChart layout="vertical" data={igTopByLikes} margin={{ left: 0, right: 12 }}>
                            <CartesianGrid {...GRID_V} />
                            <XAxis type="number" tickFormatter={fmt} tick={TICK} {...AXIS} />
                            <YAxis type="category" dataKey="title" width={130} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} {...AXIS} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Likes']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                            <Bar dataKey="likes" fill="var(--chart-1)" radius={[0, 6, 6, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                      <ChartCard title="Engagement rate (%)">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={igByEngagement} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid {...GRID_H} />
                            <XAxis dataKey="title" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval={0} angle={-30} textAnchor="end" height={60} {...AXIS} />
                            <YAxis tickFormatter={(v) => `${v}%`} tick={TICK} domain={['auto', 'auto']} {...AXIS} />
                            <Tooltip formatter={(v) => [typeof v === 'number' ? `${v}%` : '—', 'Engagement']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                            <Bar dataKey="rate" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    </div>
                  )}

                  {igPosts.length > 0 && (
                    <Card className="dark:bg-transparent">
                      <CardContent className="p-0 pb-2">
                        <Table className="border-t">
                          <TableHeader>
                            <TableRow>
                              {(['caption', 'views', 'likes', 'comments', 'engagement_rate'] as const).map((key) => (
                                <TableHead key={key} onClick={() => key !== 'caption' && toggleIg(key as IgSortKey)}
                                  className={`${key === 'caption' ? 'pl-6' : 'cursor-pointer select-none hover:text-foreground'}`}>
                                  {key === 'engagement_rate' ? 'Engagement' : key.charAt(0).toUpperCase() + key.slice(1)}
                                  {igSort === key && <span className="ml-1">{igDir === 'desc' ? '↓' : '↑'}</span>}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const sorted = [...igPosts].sort((a, b) => {
                                const av = igSort === 'views' ? (a.views ?? -1) : a[igSort];
                                const bv = igSort === 'views' ? (b.views ?? -1) : b[igSort];
                                return (igDir === 'asc' ? 1 : -1) * (av < bv ? -1 : av > bv ? 1 : 0);
                              });
                              const page = sorted.slice(igPage * PAGE_SIZE, (igPage + 1) * PAGE_SIZE);
                              return page.map((p) => (
                                <TableRow key={p.post_id}>
                                  <TableCell className="max-w-[220px] truncate pl-6 font-medium">
                                    {p.caption && p.post_id
                                      ? <a href={`https://www.instagram.com/p/${p.post_id}/`} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.caption.length > 50 ? p.caption.slice(0, 50) + '…' : p.caption}</a>
                                      : p.caption ? (p.caption.length > 50 ? p.caption.slice(0, 50) + '…' : p.caption) : <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="text-xs tabular-nums text-muted-foreground">{p.views !== null ? fmt(p.views) : '—'}</TableCell>
                                  <TableCell className="text-xs tabular-nums text-muted-foreground">{fmt(p.likes)}</TableCell>
                                  <TableCell className="text-xs tabular-nums text-muted-foreground">{fmt(p.comments)}</TableCell>
                                  <TableCell className="text-xs font-medium tabular-nums">{(p.engagement_rate * 100).toFixed(2)}%</TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                        {igPosts.length > PAGE_SIZE && (
                          <div className="flex items-center justify-between px-6 py-3">
                            <span className="text-xs text-muted-foreground">
                              {igPage * PAGE_SIZE + 1}–{Math.min((igPage + 1) * PAGE_SIZE, igPosts.length)} of {igPosts.length}
                            </span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" disabled={igPage === 0} onClick={() => setIgPage((p) => p - 1)}>Prev</Button>
                              <Button size="sm" variant="outline" disabled={(igPage + 1) * PAGE_SIZE >= igPosts.length} onClick={() => setIgPage((p) => p + 1)}>Next</Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {igSnap && igPosts.length === 0 && (
                    <Card className="dark:bg-transparent"><CardContent className="py-6 text-center text-sm text-muted-foreground">No post data in the latest snapshot. Try refreshing.</CardContent></Card>
                  )}
                  {!igSnap && (
                    <Card className="dark:bg-transparent"><CardContent className="py-6 text-center text-sm text-muted-foreground">No Instagram data yet. Hit Refresh to pull the first snapshot.</CardContent></Card>
                  )}
                </div>
              )}

              {/* TikTok tab — handle not yet set */}
              {tab === 'tiktok' && !data?.tiktok && (
                <Card className="dark:bg-transparent">
                  <CardHeader>
                    <CardTitle>No TikTok account linked</CardTitle>
                    <CardDescription>
                      {data?.handles?.tiktok
                        ? <>Handle <span className="font-semibold text-foreground">@{data.handles.tiktok}</span> is set but no account is being tracked. Enter the correct handle to relink.</>
                        : 'Add a handle to start tracking.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input value={ttHandle} onChange={(e) => setTtHandle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && linkTikTok()} placeholder="@handle" />
                      <Button onClick={linkTikTok} disabled={ttLinking || !ttHandle.trim()}>{ttLinking ? 'Saving…' : 'Link'}</Button>
                    </div>
                    {ttLinkErr && <p className="mt-2 text-xs text-destructive">{ttLinkErr}</p>}
                  </CardContent>
                </Card>
              )}

              {/* Instagram tab — no account record */}
              {tab === 'instagram' && !data?.instagram && (
                <Card className="dark:bg-transparent">
                  <CardHeader>
                    <CardTitle>No Instagram account linked</CardTitle>
                    <CardDescription>
                      {data?.handles?.instagram
                        ? <>Handle <span className="font-semibold text-foreground">@{data.handles.instagram}</span> is set but no account is being tracked. Enter the correct handle to relink.</>
                        : 'Add a handle to start tracking.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input value={igHandle} onChange={(e) => setIgHandle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && linkInstagram()} placeholder="@handle" />
                      <Button onClick={linkInstagram} disabled={igLinking || !igHandle.trim()}>{igLinking ? 'Saving…' : 'Link'}</Button>
                    </div>
                    {igLinkErr && <p className="mt-2 text-xs text-destructive">{igLinkErr}</p>}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right rail */}
            <aside className="flex flex-col gap-4">
              {(ttVideos.length > 0 || igPosts.length > 0) && (
                <Card className="dark:bg-transparent">
                  <CardHeader><CardTitle className="text-sm">Overall stats</CardTitle></CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {[
                      { label: 'Combined views',  value: fmt(combinedViews || null),                 icon: Eye },
                      { label: 'Total likes',     value: fmt((ttTotalLikes + igTotalLikes) || null), icon: Heart },
                      { label: 'Avg engagement',  value: `${(combinedAvgEng * 100).toFixed(2)}%`,    icon: TrendingUp },
                      { label: 'Total followers', value: fmt(totalFollowers || null),                icon: Share2 },
                      { label: 'Content tracked', value: `${ttVideos.length + igPosts.length}`,      icon: MessageCircle },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          <Icon className="size-4 text-muted-foreground" />
                        </div>
                        <span className="flex-1 text-sm text-muted-foreground">{label}</span>
                        <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {topTtVideo && (
                <Card className="dark:bg-transparent">
                  <CardHeader><CardTitle className="text-sm">Top TikTok video</CardTitle></CardHeader>
                  <CardContent>
                    {topTtVideo.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={topTtVideo.thumbnail_url} alt="" className="mb-3 h-36 w-full rounded-xl object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                    <p className="mb-3 text-sm font-medium leading-snug">
                      {topTtVideo.title ? (topTtVideo.title.length > 80 ? topTtVideo.title.slice(0, 80) + '…' : topTtVideo.title) : '—'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Views',    value: fmt(topTtVideo.views) },
                        { label: 'Likes',    value: fmt(topTtVideo.likes) },
                        { label: 'Comments', value: fmt(topTtVideo.comments) },
                        { label: 'Shares',   value: fmt(topTtVideo.shares) },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl bg-muted p-3">
                          <p className="mb-1 text-xs text-muted-foreground">{label}</p>
                          <p className="font-mono text-base font-semibold tabular-nums">{value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {topIgPost && (
                <Card className="dark:bg-transparent">
                  <CardHeader><CardTitle className="text-sm">Top Instagram post</CardTitle></CardHeader>
                  <CardContent>
                    {topIgPost.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={topIgPost.thumbnail_url} alt="" className="mb-3 h-36 w-full rounded-xl object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                    <p className="mb-3 text-sm font-medium leading-snug">
                      {topIgPost.caption ? (topIgPost.caption.length > 80 ? topIgPost.caption.slice(0, 80) + '…' : topIgPost.caption) : '—'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Views',      value: topIgPost.views !== null ? fmt(topIgPost.views) : '—' },
                        { label: 'Likes',      value: fmt(topIgPost.likes) },
                        { label: 'Comments',   value: fmt(topIgPost.comments) },
                        { label: 'Engagement', value: `${(topIgPost.engagement_rate * 100).toFixed(2)}%` },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl bg-muted p-3">
                          <p className="mb-1 text-xs text-muted-foreground">{label}</p>
                          <p className="font-mono text-base font-semibold tabular-nums">{value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(ttSnap || igSnap) && (
                <Card className="dark:bg-transparent">
                  <CardHeader><CardTitle className="text-sm">Data freshness</CardTitle></CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {ttSnap && (
                      <div>
                        <p className="text-xs text-muted-foreground">TikTok</p>
                        <p className="text-sm font-medium">{fmtDate(ttSnap.fetched_at)}</p>
                      </div>
                    )}
                    {igSnap && (
                      <div>
                        <p className="text-xs text-muted-foreground">Instagram</p>
                        <p className="text-sm font-medium">{fmtDate(igSnap.fetched_at)}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
        </div>
      )}
    </AppShell>
  );
}
