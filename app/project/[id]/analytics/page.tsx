'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard, RefreshCw, Eye, Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface PostStat {
  post_id:         string;
  caption:         string;
  views:           number | null;
  likes:           number;
  comments:        number;
  engagement_rate: number;
}

interface VideoStat {
  video_id:        string;
  title:           string;
  views:           number;
  likes:           number;
  comments:        number;
  shares:          number;
  engagement_rate: number;
}

interface SnapshotBase { id: string; fetched_at: string; followers: number }
interface TikTokSnapshot    extends SnapshotBase { video_count: number; videos?: VideoStat[] }
interface InstagramSnapshot extends SnapshotBase { post_count:  number; posts?:  PostStat[]  }

interface AnalyticsData {
  tiktok:    { account_id: string; handle: string | null; latest_snapshot: TikTokSnapshot | null;    snapshots: TikTokSnapshot[]    } | null;
  instagram: { account_id: string; latest_snapshot: InstagramSnapshot | null; snapshots: InstagramSnapshot[] } | null;
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
  const [ttRefreshing, setTtRefreshing] = useState(false);
  const [igRefreshing, setIgRefreshing] = useState(false);
  const [ttRefreshErr, setTtRefreshErr] = useState('');
  const [igRefreshErr, setIgRefreshErr] = useState('');

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

  function toggleTt(key: TtSortKey) {
    if (ttSort === key) setTtDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setTtSort(key); setTtDir('desc'); }
  }
  function toggleIg(key: IgSortKey) {
    if (igSort === key) setIgDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setIgSort(key); setIgDir('desc'); }
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
    views: (s.videos ?? []).reduce((acc, v) => acc + v.views, 0),
  }));

  const igTrendData = igSnaps.map((s) => ({
    date: new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: s.followers,
    views: (s.posts ?? []).reduce((acc, p) => acc + (p.views ?? 0), 0),
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

  const hasTikTok    = Boolean(data?.tiktok);
  const hasInstagram = Boolean(data?.instagram);

  return (
    <div className="min-h-screen bg-[#F3F4F2] dot-grid">
      <div className="flex gap-4 p-4 min-h-screen">

        {/* Sidebar */}
        <aside className="w-56 shrink-0 sticky top-4 self-start h-[calc(100vh-32px)] bg-white rounded-[20px] flex flex-col overflow-hidden border border-[#E8E9E6] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col flex-1 p-5">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-8 h-8 rounded-lg bg-[#1F4D3A] flex items-center justify-center shrink-0">
                <LayoutDashboard size={16} className="text-white" />
              </div>
              <span className="text-[14px] font-bold text-[#16181A] tracking-tight">TrendForge</span>
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
              <div className={card}>
                <h1 className="text-[22px] font-bold text-[#16181A] mb-4">Analytics</h1>
                <div className="flex gap-8 flex-wrap">
                  {[
                    { label: 'Combined views',  value: fmt(combinedViews || null) },
                    { label: 'Total followers', value: fmt(totalFollowers || null) },
                    { label: 'Avg engagement',  value: `${(combinedAvgEng * 100).toFixed(2)}%` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-1">{label}</p>
                      <p className="text-[20px] font-bold text-[#16181A]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Platform tabs */}
              {(hasTikTok || hasInstagram) && (
                <div className="flex gap-2">
                  {hasTikTok && (
                    <button
                      onClick={() => setTab('tiktok')}
                      className={`h-10 px-6 rounded-xl text-[13px] font-semibold transition-colors ${
                        tab === 'tiktok'
                          ? 'bg-[#1F4D3A] text-white shadow-sm'
                          : 'bg-white border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F]'
                      }`}
                    >
                      TikTok
                    </button>
                  )}
                  {hasInstagram && (
                    <button
                      onClick={() => setTab('instagram')}
                      className={`h-10 px-6 rounded-xl text-[13px] font-semibold transition-colors ${
                        tab === 'instagram'
                          ? 'bg-[#1F4D3A] text-white shadow-sm'
                          : 'bg-white border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F]'
                      }`}
                    >
                      Instagram
                    </button>
                  )}
                </div>
              )}

              {/* TikTok tab */}
              {tab === 'tiktok' && hasTikTok && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-6 flex-wrap">
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

                  {ttTrendData.length >= 2 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {[
                        { title: 'Follower trend', key: 'followers' as const, label: 'Followers', color: '#2E6B4F' },
                        { title: 'Total views over time', key: 'views' as const, label: 'Views', color: '#3F8F62' },
                      ].map(({ title, key, label, color }) => (
                        <div key={key} className={card}>
                          <p className="text-[12px] font-semibold text-[#7C8278] mb-4">{title}</p>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={ttTrendData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                              <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), label]} contentStyle={TOOLTIP_STYLE} />
                              <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ))}
                    </div>
                  )}

                  {ttVideos.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={card}>
                        <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Top videos by views</p>
                        <ResponsiveContainer width="100%" height={Math.max(200, ttTopByViews.length * 36)}>
                          <BarChart layout="vertical" data={ttTopByViews}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" horizontal={false} />
                            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} />
                            <YAxis type="category" dataKey="title" width={130} tick={{ fontSize: 10, fill: '#7C8278' }} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views']} contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="views" fill="#2E6B4F" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={card}>
                        <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Engagement rate (%)</p>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={ttByEngagement}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                            <XAxis dataKey="title" tick={{ fontSize: 10, fill: '#7C8278' }} interval={0} angle={-30} textAnchor="end" height={60} />
                            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                            <Tooltip formatter={(v) => [typeof v === 'number' ? `${v}%` : '—', 'Engagement']} contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="rate" fill="#3F8F62" radius={[4, 4, 0, 0]} />
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
                          {[...ttVideos].sort((a, b) => {
                            const av = a[ttSort], bv = b[ttSort];
                            return (ttDir === 'asc' ? 1 : -1) * (av < bv ? -1 : av > bv ? 1 : 0);
                          }).map((v, i, arr) => (
                            <tr key={v.video_id} className={`hover:bg-[#F3F4F2] transition-colors ${i < arr.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}>
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
                          ))}
                        </tbody>
                      </table>
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
              {tab === 'instagram' && hasInstagram && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-6 flex-wrap">
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

                  {igTrendData.length >= 2 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {[
                        { title: 'Follower trend', key: 'followers' as const, label: 'Followers', color: '#2E6B4F' },
                        { title: 'Total views over time', key: 'views' as const, label: 'Views', color: '#3F8F62' },
                      ].map(({ title, key, label, color }) => (
                        <div key={key} className={card}>
                          <p className="text-[12px] font-semibold text-[#7C8278] mb-4">{title}</p>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={igTrendData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                              <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), label]} contentStyle={TOOLTIP_STYLE} />
                              <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ))}
                    </div>
                  )}

                  {igPosts.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={card}>
                        <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Top posts by likes</p>
                        <ResponsiveContainer width="100%" height={Math.max(200, igTopByLikes.length * 36)}>
                          <BarChart layout="vertical" data={igTopByLikes}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" horizontal={false} />
                            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} />
                            <YAxis type="category" dataKey="title" width={130} tick={{ fontSize: 10, fill: '#7C8278' }} />
                            <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Likes']} contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="likes" fill="#2E6B4F" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={card}>
                        <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Engagement rate (%)</p>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={igByEngagement}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                            <XAxis dataKey="title" tick={{ fontSize: 10, fill: '#7C8278' }} interval={0} angle={-30} textAnchor="end" height={60} />
                            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                            <Tooltip formatter={(v) => [typeof v === 'number' ? `${v}%` : '—', 'Engagement']} contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="rate" fill="#3F8F62" radius={[4, 4, 0, 0]} />
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
                          {[...igPosts].sort((a, b) => {
                            const av = igSort === 'views' ? (a.views ?? -1) : a[igSort];
                            const bv = igSort === 'views' ? (b.views ?? -1) : b[igSort];
                            return (igDir === 'asc' ? 1 : -1) * (av < bv ? -1 : av > bv ? 1 : 0);
                          }).map((p, i, arr) => (
                            <tr key={p.post_id} className={`hover:bg-[#F3F4F2] transition-colors ${i < arr.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}>
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
                          ))}
                        </tbody>
                      </table>
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

              {!hasTikTok && !hasInstagram && (
                <div className={`${card} text-center`}>
                  <p className="text-[15px] font-semibold text-[#16181A] mb-1">No accounts linked</p>
                  <p className="text-[14px] text-[#7C8278]">Add TikTok or Instagram handles in the project intake to start tracking analytics.</p>
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
