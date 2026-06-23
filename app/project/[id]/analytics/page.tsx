'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard, RefreshCw, Eye, Heart, MessageCircle, Share2, TrendingUp, UserRound, type LucideIcon } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

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

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF', border: '1px solid #E8E9E6',
  borderRadius: '12px', color: '#16181A', fontSize: '12px',
};

function StatCard({ label, value, icon: Icon, hero = false }: {
  label: string; value: string; icon: LucideIcon; hero?: boolean;
}) {
  return (
    <div className={`rounded-[20px] p-5 border ${
      hero
        ? 'bg-[#1F4D3A] border-[#1F4D3A] shadow-[0_4px_24px_rgba(31,77,58,0.20)]'
        : 'bg-white border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <p className={`text-[12px] ${hero ? 'text-[#7FBE9A]' : 'text-[#7C8278]'}`}>{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${hero ? 'bg-white/10' : 'bg-[#E8F2EC]'}`}>
          <Icon size={13} className={hero ? 'text-white' : 'text-[#1F4D3A]'} />
        </div>
      </div>
      <p className={`text-[28px] font-bold leading-none ${hero ? 'text-white' : 'text-[#16181A]'}`}>{value}</p>
    </div>
  );
}

// Standard sub-panel / chart heading — matches the dashboard label system.
const SECTION_LABEL = 'text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4';

// Shared recharts styling for a calm, consistent look across every chart.
const AXIS = { tickLine: false, axisLine: false } as const;
const GRID_H = { strokeDasharray: '4 4', stroke: '#EEF0ED', vertical: false } as const;
const GRID_V = { strokeDasharray: '4 4', stroke: '#EEF0ED', horizontal: false } as const;
const BAR_CURSOR = { fill: 'rgba(46,107,79,0.06)' } as const;
const LINE_CURSOR = { stroke: '#C9CEC4', strokeWidth: 1 } as const;

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

  const card = 'bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]';

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

  // "Linked" means a real account record exists — a leftover handle string with no
  // account row (e.g. the row was deleted in the DB) must still expose the Add form.
  const hasTikTok    = Boolean(data?.tiktok);
  const hasInstagram = Boolean(data?.instagram);

  return (
    <div className="min-h-screen bg-[#F3F4F2] dot-grid">
      <div className="flex gap-4 p-4 min-h-screen">

        {/* Sidebar */}
        <aside className="w-56 shrink-0 sticky top-4 self-start h-[calc(100vh-32px)] bg-white rounded-[20px] flex flex-col overflow-hidden border border-[#E8E9E6] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col flex-1 p-5">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-[#1F4D3A] flex items-center justify-center shrink-0">
                <LayoutDashboard size={20} className="text-white" />
              </div>
              <span className="text-[16px] font-bold text-[#16181A] tracking-tight">TrendForge</span>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-3 mb-2">Workspace</p>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-3 h-10 px-3 rounded-xl text-[#7C8278] hover:bg-[#F3F4F2] hover:text-[#16181A] transition-colors w-full text-left"
              >
                <LayoutDashboard size={16} className="shrink-0" />
                <span className="text-[13px] font-medium">Dashboard</span>
              </button>
              <button
                onClick={() => router.push('/accounts')}
                className="flex items-center gap-3 h-10 px-3 rounded-xl text-[#7C8278] hover:bg-[#F3F4F2] hover:text-[#16181A] transition-colors w-full text-left"
              >
                <ArrowLeft size={16} className="shrink-0" />
                <span className="text-[13px] font-medium">Accounts</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">
          {loading ? (
            <div className={card}><p className="text-[14px] text-[#7C8278]">Loading…</p></div>
          ) : error ? (
            <div className={card}>
              <p className="text-[14px] text-red-500 mb-3">{error}</p>
              <button onClick={() => router.push('/accounts')} className="text-[13px] text-[#2E6B4F] hover:underline">Back to accounts</button>
            </div>
          ) : (
            <>
              {/* Header */}
              <h1 className="text-[22px] font-bold text-[#16181A] tracking-tight">Analytics</h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Combined views"  value={fmt(combinedViews || null)}             icon={Eye}        hero />
                <StatCard label="Total followers" value={fmt(totalFollowers || null)}            icon={UserRound} />
                <StatCard label="Avg engagement"  value={`${(combinedAvgEng * 100).toFixed(2)}%`} icon={TrendingUp} />
              </div>

              {/* Platform tabs — both always shown so an unlinked platform can be added */}
              {(
                <div className="flex gap-2">
                  {([
                    { key: 'tiktok'    as Tab, label: 'TikTok',    linked: hasTikTok },
                    { key: 'instagram' as Tab, label: 'Instagram', linked: hasInstagram },
                  ]).map(({ key, label, linked }) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`h-10 px-6 rounded-xl text-[13px] font-semibold transition-colors inline-flex items-center gap-2 ${
                        tab === key
                          ? 'bg-[#1F4D3A] text-white shadow-sm'
                          : 'bg-white border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F]'
                      }`}
                    >
                      {label}
                      {!linked && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          tab === key ? 'bg-white/15 text-white/80' : 'bg-[#F0F1EE] text-[#A9AEA4]'
                        }`}>
                          + Add
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* TikTok tab */}
              {tab === 'tiktok' && hasTikTok && data?.tiktok && (
                <div className="flex flex-col gap-4">
                  <div className={`${card} flex items-center justify-between gap-4 flex-wrap`}>
                    <div className="flex gap-8 flex-wrap">
                      {[
                        { label: 'Followers',      value: fmt(ttSnap?.followers ?? null) },
                        { label: 'Videos',         value: fmt(ttSnap?.video_count ?? null) },
                        { label: 'Last refreshed', value: fmtDate(ttSnap?.fetched_at ?? null) },
                        { label: 'Snapshots',      value: ttSnaps.length.toString() },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-0.5">{label}</p>
                          <p className="text-[16px] font-bold text-[#16181A]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ttRefreshErr && <p className="text-[12px] text-red-500">{ttRefreshErr}</p>}
                      <button onClick={refreshTikTok} disabled={ttRefreshing}
                        className="inline-flex items-center gap-2 h-8 px-4 rounded-lg border border-[#E8E9E6] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 text-[#7C8278] text-[12px] font-medium transition-colors">
                        <RefreshCw size={12} className={ttRefreshing ? 'animate-spin' : ''} />
                        {ttRefreshing ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                  </div>

                  {ttTrendData.length > 0 && (
                    <div className={card}>
                      <p className={SECTION_LABEL}>Follower trend</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={ttTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="ttFollowers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2E6B4F" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="#2E6B4F" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...GRID_H} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A9AEA4' }} {...AXIS} />
                          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#A9AEA4' }} domain={['auto', 'auto']} width={44} {...AXIS} />
                          <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Followers']} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
                          <Area type="monotone" dataKey="followers" stroke="#2E6B4F" strokeWidth={2.5} fill="url(#ttFollowers)" dot={false} activeDot={{ r: 4, fill: '#2E6B4F', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {ttViewsCumulative.some((d) => d.views > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={card}>
                        <p className={SECTION_LABEL}>Cumulative views</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={ttViewsCumulative} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="ttViewsCum" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2E6B4F" stopOpacity={0.22} />
                                <stop offset="100%" stopColor="#2E6B4F" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_H} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A9AEA4' }} {...AXIS} />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#A9AEA4' }} domain={['auto', 'auto']} width={44} {...AXIS} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Total views']} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
                            <Area type="monotone" dataKey="views" stroke="#2E6B4F" strokeWidth={2.5} fill="url(#ttViewsCum)" dot={false} activeDot={{ r: 4, fill: '#2E6B4F', stroke: '#fff', strokeWidth: 2 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={card}>
                        <p className={SECTION_LABEL}>Views per day</p>
                        {ttViewsPerDay.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={ttViewsPerDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="ttViewsDay" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3F8F62" stopOpacity={1} />
                                  <stop offset="100%" stopColor="#3F8F62" stopOpacity={0.5} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid {...GRID_H} />
                              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A9AEA4' }} {...AXIS} />
                              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#A9AEA4' }} domain={['auto', 'auto']} width={44} {...AXIS} />
                              <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views gained']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                              <Bar dataKey="views" fill="url(#ttViewsDay)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[200px] flex items-center justify-center">
                            <p className="text-[13px] text-[#A9AEA4]">Need at least two snapshots to show daily change.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {ttVideos.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={card}>
                        <p className={SECTION_LABEL}>Top videos by views</p>
                        <ResponsiveContainer width="100%" height={Math.max(200, ttTopByViews.length * 38)}>
                          <BarChart layout="vertical" data={ttTopByViews} margin={{ left: 0, right: 12 }}>
                            <defs>
                              <linearGradient id="ttBar" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#2E6B4F" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#3F8F62" stopOpacity={1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_V} />
                            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#A9AEA4' }} {...AXIS} />
                            <YAxis type="category" dataKey="title" width={130} tick={{ fontSize: 10, fill: '#7C8278' }} {...AXIS} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                            <Bar dataKey="views" fill="url(#ttBar)" radius={[0, 6, 6, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={card}>
                        <p className={SECTION_LABEL}>Engagement rate (%)</p>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={ttByEngagement} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="ttEng" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3F8F62" stopOpacity={1} />
                                <stop offset="100%" stopColor="#3F8F62" stopOpacity={0.5} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_H} />
                            <XAxis dataKey="title" tick={{ fontSize: 10, fill: '#A9AEA4' }} interval={0} angle={-30} textAnchor="end" height={60} {...AXIS} />
                            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#A9AEA4' }} domain={['auto', 'auto']} {...AXIS} />
                            <Tooltip formatter={(v) => [typeof v === 'number' ? `${v}%` : '—', 'Engagement']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                            <Bar dataKey="rate" fill="url(#ttEng)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {ttVideos.length > 0 && (
                    <div className="bg-white rounded-[20px] border border-[#E8E9E6] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#E8E9E6]">
                            {(['title', 'views', 'likes', 'comments', 'shares', 'engagement_rate'] as const).map((key) => (
                              <th key={key} onClick={() => key !== 'title' && toggleTt(key as TtSortKey)}
                                className="text-left text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-5 py-4 cursor-pointer select-none hover:text-[#1F4D3A] transition-colors">
                                {key === 'engagement_rate' ? 'Engagement' : key.charAt(0).toUpperCase() + key.slice(1)}
                                {ttSort === key && <span className="ml-1 text-[#2E6B4F]">{ttDir === 'desc' ? '↓' : '↑'}</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const sorted = [...ttVideos].sort((a, b) => {
                              const av = a[ttSort], bv = b[ttSort];
                              return (ttDir === 'asc' ? 1 : -1) * (av < bv ? -1 : av > bv ? 1 : 0);
                            });
                            const page = sorted.slice(ttPage * PAGE_SIZE, (ttPage + 1) * PAGE_SIZE);
                            return page.map((v, i) => (
                              <tr key={v.video_id} className={`hover:bg-[#F3F4F2] transition-colors ${i < page.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}>
                                <td className="px-5 py-3 text-[13px] text-[#16181A] max-w-[200px]">
                                  {v.title && data?.tiktok?.handle
                                    ? <a href={`https://www.tiktok.com/@${data.tiktok.handle}/video/${v.video_id}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#2E6B4F] hover:underline">{v.title.length > 50 ? v.title.slice(0, 50) + '…' : v.title}</a>
                                    : v.title ? (v.title.length > 50 ? v.title.slice(0, 50) + '…' : v.title) : <span className="text-[#A9AEA4]">—</span>}
                                </td>
                                <td className="px-5 py-3 text-[13px] text-[#7C8278]">{fmt(v.views)}</td>
                                <td className="px-5 py-3 text-[13px] text-[#7C8278]">{fmt(v.likes)}</td>
                                <td className="px-5 py-3 text-[13px] text-[#7C8278]">{fmt(v.comments)}</td>
                                <td className="px-5 py-3 text-[13px] text-[#7C8278]">{fmt(v.shares)}</td>
                                <td className="px-5 py-3 text-[13px] font-medium text-[#2E6B4F]">{(v.engagement_rate * 100).toFixed(2)}%</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                      {ttVideos.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E8E9E6]">
                          <span className="text-[12px] text-[#A9AEA4]">
                            {ttPage * PAGE_SIZE + 1}–{Math.min((ttPage + 1) * PAGE_SIZE, ttVideos.length)} of {ttVideos.length}
                          </span>
                          <div className="flex gap-2">
                            <button disabled={ttPage === 0} onClick={() => setTtPage((p) => p - 1)}
                              className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                            <button disabled={(ttPage + 1) * PAGE_SIZE >= ttVideos.length} onClick={() => setTtPage((p) => p + 1)}
                              className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!ttSnap && (
                    <div className={`${card} text-center`}>
                      <p className="text-[14px] text-[#7C8278]">No TikTok data yet. Hit Refresh to pull the first snapshot.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Instagram tab */}
              {tab === 'instagram' && hasInstagram && data?.instagram && (
                <div className="flex flex-col gap-4">
                  <div className={`${card} flex items-center justify-between gap-4 flex-wrap`}>
                    <div className="flex gap-8 flex-wrap">
                      {[
                        { label: 'Followers',      value: fmt(igSnap?.followers ?? null) },
                        { label: 'Posts',          value: fmt(igSnap?.post_count ?? null) },
                        { label: 'Last refreshed', value: fmtDate(igSnap?.fetched_at ?? null) },
                        { label: 'Snapshots',      value: igSnaps.length.toString() },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-0.5">{label}</p>
                          <p className="text-[16px] font-bold text-[#16181A]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {igRefreshErr && <p className="text-[12px] text-red-500">{igRefreshErr}</p>}
                      <button onClick={refreshInstagram} disabled={igRefreshing}
                        className="inline-flex items-center gap-2 h-8 px-4 rounded-lg border border-[#E8E9E6] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 text-[#7C8278] text-[12px] font-medium transition-colors">
                        <RefreshCw size={12} className={igRefreshing ? 'animate-spin' : ''} />
                        {igRefreshing ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                  </div>

                  {igTrendData.length > 0 && (
                    <div className={card}>
                      <p className={SECTION_LABEL}>Follower trend</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={igTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="igFollowers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2E6B4F" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="#2E6B4F" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...GRID_H} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A9AEA4' }} {...AXIS} />
                          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#A9AEA4' }} domain={['auto', 'auto']} width={44} {...AXIS} />
                          <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Followers']} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
                          <Area type="monotone" dataKey="followers" stroke="#2E6B4F" strokeWidth={2.5} fill="url(#igFollowers)" dot={false} activeDot={{ r: 4, fill: '#2E6B4F', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {igViewsCumulative.some((d) => d.views > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={card}>
                        <p className={SECTION_LABEL}>Cumulative views</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={igViewsCumulative} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="igViewsCum" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2E6B4F" stopOpacity={0.22} />
                                <stop offset="100%" stopColor="#2E6B4F" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_H} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A9AEA4' }} {...AXIS} />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#A9AEA4' }} domain={['auto', 'auto']} width={44} {...AXIS} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Total views']} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
                            <Area type="monotone" dataKey="views" stroke="#2E6B4F" strokeWidth={2.5} fill="url(#igViewsCum)" dot={false} activeDot={{ r: 4, fill: '#2E6B4F', stroke: '#fff', strokeWidth: 2 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={card}>
                        <p className={SECTION_LABEL}>Views per day</p>
                        {igViewsPerDay.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={igViewsPerDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="igViewsDay" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3F8F62" stopOpacity={1} />
                                  <stop offset="100%" stopColor="#3F8F62" stopOpacity={0.5} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid {...GRID_H} />
                              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A9AEA4' }} {...AXIS} />
                              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#A9AEA4' }} domain={['auto', 'auto']} width={44} {...AXIS} />
                              <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views gained']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                              <Bar dataKey="views" fill="url(#igViewsDay)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[200px] flex items-center justify-center">
                            <p className="text-[13px] text-[#A9AEA4]">Need at least two snapshots to show daily change.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {igPosts.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={card}>
                        <p className={SECTION_LABEL}>Top posts by likes</p>
                        <ResponsiveContainer width="100%" height={Math.max(200, igTopByLikes.length * 38)}>
                          <BarChart layout="vertical" data={igTopByLikes} margin={{ left: 0, right: 12 }}>
                            <defs>
                              <linearGradient id="igBar" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#2E6B4F" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#3F8F62" stopOpacity={1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_V} />
                            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#A9AEA4' }} {...AXIS} />
                            <YAxis type="category" dataKey="title" width={130} tick={{ fontSize: 10, fill: '#7C8278' }} {...AXIS} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Likes']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                            <Bar dataKey="likes" fill="url(#igBar)" radius={[0, 6, 6, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={card}>
                        <p className={SECTION_LABEL}>Engagement rate (%)</p>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={igByEngagement} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="igEng" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3F8F62" stopOpacity={1} />
                                <stop offset="100%" stopColor="#3F8F62" stopOpacity={0.5} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_H} />
                            <XAxis dataKey="title" tick={{ fontSize: 10, fill: '#A9AEA4' }} interval={0} angle={-30} textAnchor="end" height={60} {...AXIS} />
                            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#A9AEA4' }} domain={['auto', 'auto']} {...AXIS} />
                            <Tooltip formatter={(v) => [typeof v === 'number' ? `${v}%` : '—', 'Engagement']} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                            <Bar dataKey="rate" fill="url(#igEng)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {igPosts.length > 0 && (
                    <div className="bg-white rounded-[20px] border border-[#E8E9E6] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#E8E9E6]">
                            {(['caption', 'views', 'likes', 'comments', 'engagement_rate'] as const).map((key) => (
                              <th key={key} onClick={() => key !== 'caption' && toggleIg(key as IgSortKey)}
                                className="text-left text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-5 py-4 cursor-pointer select-none hover:text-[#1F4D3A] transition-colors">
                                {key === 'engagement_rate' ? 'Engagement' : key.charAt(0).toUpperCase() + key.slice(1)}
                                {igSort === key && <span className="ml-1 text-[#2E6B4F]">{igDir === 'desc' ? '↓' : '↑'}</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const sorted = [...igPosts].sort((a, b) => {
                              const av = igSort === 'views' ? (a.views ?? -1) : a[igSort];
                              const bv = igSort === 'views' ? (b.views ?? -1) : b[igSort];
                              return (igDir === 'asc' ? 1 : -1) * (av < bv ? -1 : av > bv ? 1 : 0);
                            });
                            const page = sorted.slice(igPage * PAGE_SIZE, (igPage + 1) * PAGE_SIZE);
                            return page.map((p, i) => (
                              <tr key={p.post_id} className={`hover:bg-[#F3F4F2] transition-colors ${i < page.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}>
                                <td className="px-5 py-3 text-[13px] text-[#16181A] max-w-[200px]">
                                  {p.caption && p.post_id
                                    ? <a href={`https://www.instagram.com/p/${p.post_id}/`} target="_blank" rel="noopener noreferrer" className="hover:text-[#2E6B4F] hover:underline">{p.caption.length > 50 ? p.caption.slice(0, 50) + '…' : p.caption}</a>
                                    : p.caption ? (p.caption.length > 50 ? p.caption.slice(0, 50) + '…' : p.caption) : <span className="text-[#A9AEA4]">—</span>}
                                </td>
                                <td className="px-5 py-3 text-[13px] text-[#7C8278]">{p.views !== null ? fmt(p.views) : '—'}</td>
                                <td className="px-5 py-3 text-[13px] text-[#7C8278]">{fmt(p.likes)}</td>
                                <td className="px-5 py-3 text-[13px] text-[#7C8278]">{fmt(p.comments)}</td>
                                <td className="px-5 py-3 text-[13px] font-medium text-[#2E6B4F]">{(p.engagement_rate * 100).toFixed(2)}%</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                      {igPosts.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E8E9E6]">
                          <span className="text-[12px] text-[#A9AEA4]">
                            {igPage * PAGE_SIZE + 1}–{Math.min((igPage + 1) * PAGE_SIZE, igPosts.length)} of {igPosts.length}
                          </span>
                          <div className="flex gap-2">
                            <button disabled={igPage === 0} onClick={() => setIgPage((p) => p - 1)}
                              className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                            <button disabled={(igPage + 1) * PAGE_SIZE >= igPosts.length} onClick={() => setIgPage((p) => p + 1)}
                              className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {igSnap && igPosts.length === 0 && (
                    <div className={`${card} text-center`}>
                      <p className="text-[14px] text-[#7C8278]">No post data in the latest snapshot. Try refreshing.</p>
                    </div>
                  )}
                  {!igSnap && (
                    <div className={`${card} text-center`}>
                      <p className="text-[14px] text-[#7C8278]">No Instagram data yet. Hit Refresh to pull the first snapshot.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TikTok tab — handle not yet set */}
              {tab === 'tiktok' && !data?.tiktok && (
                <div className={card}>
                  <p className="text-[15px] font-semibold text-[#16181A] mb-1">No TikTok account linked</p>
                  <p className="text-[13px] text-[#7C8278] mb-4">
                    {data?.handles?.tiktok
                      ? <>Handle <span className="font-semibold text-[#16181A]">@{data.handles.tiktok}</span> is set but no account is being tracked. Enter the correct handle to relink.</>
                      : 'Add a handle to start tracking.'}
                  </p>
                  <div className="flex gap-2">
                    <input value={ttHandle} onChange={(e) => setTtHandle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && linkTikTok()} placeholder="@handle" className="flex-1 h-10 px-4 rounded-xl bg-[#F3F4F2] border border-[#E8E9E6] text-[14px] text-[#16181A] placeholder-[#A9AEA4] focus:outline-none focus:border-[#2E6B4F]/50 transition-colors" />
                    <button onClick={linkTikTok} disabled={ttLinking || !ttHandle.trim()} className="h-10 px-5 rounded-xl bg-[#1F4D3A] hover:bg-[#183D2E] disabled:opacity-40 text-white text-[13px] font-semibold transition-colors">{ttLinking ? 'Saving…' : 'Link'}</button>
                  </div>
                  {ttLinkErr && <p className="text-[12px] text-red-500 mt-2">{ttLinkErr}</p>}
                </div>
              )}

              {/* Instagram tab — no account record (handle unset, or set but the row is gone) */}
              {tab === 'instagram' && !data?.instagram && (
                <div className={card}>
                  <p className="text-[15px] font-semibold text-[#16181A] mb-1">No Instagram account linked</p>
                  <p className="text-[13px] text-[#7C8278] mb-4">
                    {data?.handles?.instagram
                      ? <>Handle <span className="font-semibold text-[#16181A]">@{data.handles.instagram}</span> is set but no account is being tracked. Enter the correct handle to relink.</>
                      : 'Add a handle to start tracking.'}
                  </p>
                  <div className="flex gap-2">
                    <input value={igHandle} onChange={(e) => setIgHandle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && linkInstagram()} placeholder="@handle" className="flex-1 h-10 px-4 rounded-xl bg-[#F3F4F2] border border-[#E8E9E6] text-[14px] text-[#16181A] placeholder-[#A9AEA4] focus:outline-none focus:border-[#2E6B4F]/50 transition-colors" />
                    <button onClick={linkInstagram} disabled={igLinking || !igHandle.trim()} className="h-10 px-5 rounded-xl bg-[#1F4D3A] hover:bg-[#183D2E] disabled:opacity-40 text-white text-[13px] font-semibold transition-colors">{igLinking ? 'Saving…' : 'Link'}</button>
                  </div>
                  {igLinkErr && <p className="text-[12px] text-red-500 mt-2">{igLinkErr}</p>}
                </div>
              )}

            </>
          )}
        </main>

        {/* Right panel */}
        <aside className="w-72 shrink-0 hidden xl:flex flex-col gap-4 sticky top-4 self-start">

          {(ttVideos.length > 0 || igPosts.length > 0) && (
            <div className={card}>
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Overall stats</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Combined views',  value: fmt(combinedViews || null),                   icon: Eye },
                  { label: 'Total likes',     value: fmt((ttTotalLikes + igTotalLikes) || null),   icon: Heart },
                  { label: 'Avg engagement',  value: `${(combinedAvgEng * 100).toFixed(2)}%`,     icon: TrendingUp },
                  { label: 'Total followers', value: fmt(totalFollowers || null),                   icon: Share2 },
                  { label: 'Content tracked', value: `${ttVideos.length + igPosts.length}`,        icon: MessageCircle },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E8F2EC] flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-[#1F4D3A]" />
                    </div>
                    <span className="text-[13px] text-[#7C8278] flex-1">{label}</span>
                    <span className="text-[14px] font-bold text-[#16181A]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topTtVideo && (
            <div className={card}>
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-3">Top TikTok video</p>
              {topTtVideo.thumbnail_url && (
                <img
                  src={topTtVideo.thumbnail_url}
                  alt=""
                  className="w-full h-36 object-cover rounded-xl mb-3"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <p className="text-[13px] font-medium text-[#16181A] leading-snug mb-3">
                {topTtVideo.title ? (topTtVideo.title.length > 80 ? topTtVideo.title.slice(0, 80) + '…' : topTtVideo.title) : '—'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Views',    value: fmt(topTtVideo.views) },
                  { label: 'Likes',    value: fmt(topTtVideo.likes) },
                  { label: 'Comments', value: fmt(topTtVideo.comments) },
                  { label: 'Shares',   value: fmt(topTtVideo.shares) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F3F4F2] rounded-xl p-3">
                    <p className="text-[10px] text-[#A9AEA4] uppercase tracking-wide font-medium mb-1">{label}</p>
                    <p className="text-[15px] font-bold text-[#1F4D3A]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topIgPost && (
            <div className={card}>
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-3">Top Instagram post</p>
              {topIgPost.thumbnail_url && (
                <img
                  src={topIgPost.thumbnail_url}
                  alt=""
                  className="w-full h-36 object-cover rounded-xl mb-3"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <p className="text-[13px] font-medium text-[#16181A] leading-snug mb-3">
                {topIgPost.caption ? (topIgPost.caption.length > 80 ? topIgPost.caption.slice(0, 80) + '…' : topIgPost.caption) : '—'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Views',      value: topIgPost.views !== null ? fmt(topIgPost.views) : '—' },
                  { label: 'Likes',      value: fmt(topIgPost.likes) },
                  { label: 'Comments',   value: fmt(topIgPost.comments) },
                  { label: 'Engagement', value: `${(topIgPost.engagement_rate * 100).toFixed(2)}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F3F4F2] rounded-xl p-3">
                    <p className="text-[10px] text-[#A9AEA4] uppercase tracking-wide font-medium mb-1">{label}</p>
                    <p className="text-[15px] font-bold text-[#1F4D3A]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(ttSnap || igSnap) && (
            <div className={card}>
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-3">Data freshness</p>
              {ttSnap && (
                <div className="mb-3">
                  <p className="text-[12px] text-[#A9AEA4] mb-0.5">TikTok</p>
                  <p className="text-[13px] font-medium text-[#16181A]">{fmtDate(ttSnap.fetched_at)}</p>
                </div>
              )}
              {igSnap && (
                <div>
                  <p className="text-[12px] text-[#A9AEA4] mb-0.5">Instagram</p>
                  <p className="text-[13px] font-medium text-[#16181A]">{fmtDate(igSnap.fetched_at)}</p>
                </div>
              )}
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}
