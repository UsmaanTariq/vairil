'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard, RefreshCw, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface VideoStat {
  video_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

interface SnapshotTrend {
  id: string;
  fetched_at: string;
  followers: number;
  video_count: number;
  videos?: VideoStat[];
}

interface LatestSnapshot extends SnapshotTrend {
  videos: VideoStat[];
}

interface AccountDetail {
  account: { id: string; handle: string; created_at: string };
  snapshots: SnapshotTrend[];
  latest_snapshot: LatestSnapshot | null;
}

function fmt(n: number | null) {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1E1F23',
  border: '1px solid #2C2D33',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '12px',
};

type SortKey = keyof VideoStat;

export default function AccountDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [data, setData] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  useEffect(() => {
    fetch(`/api/tiktok/accounts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('Failed to load account'))
      .finally(() => setLoading(false));
  }, [id]);

  const snap      = data?.latest_snapshot;
  const videos    = snap?.videos ?? [];
  const snapshots = data?.snapshots ?? [];

  const trendData = snapshots.map((s) => ({
    date: new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: s.followers,
    views: (s.videos ?? []).reduce((acc, v) => acc + v.views, 0),
  }));

  const topByViews = [...videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
    .map((v, i) => ({
      title: v.title ? (v.title.length > 30 ? v.title.slice(0, 30) + '…' : v.title) : `#${i + 1}`,
      views: v.views,
    }));

  const byEngagement = [...videos]
    .sort((a, b) => b.engagement_rate - a.engagement_rate)
    .slice(0, 15)
    .map((v, i) => ({
      title: v.title ? (v.title.length > 18 ? v.title.slice(0, 18) + '…' : v.title) : `#${i + 1}`,
      rate: Math.round(v.engagement_rate * 10000) / 100,
    }));

  const topVideo    = [...videos].sort((a, b) => b.views - a.views)[0] ?? null;
  const totalViews  = videos.reduce((s, v) => s + v.views, 0);
  const totalLikes  = videos.reduce((s, v) => s + v.likes, 0);
  const avgEng      = videos.length
    ? Math.round((videos.reduce((s, v) => s + v.engagement_rate, 0) / videos.length) * 10000) / 100
    : 0;

  return (
    <div className="min-h-screen bg-[#0C0D0F] dot-grid">
      <div className="flex gap-4 p-4 min-h-screen">

        {/* Sidebar */}
        <aside className="w-56 shrink-0 sticky top-4 self-start h-[calc(100vh-32px)] grain bg-[#18191C] rounded-[20px] flex flex-col overflow-hidden border border-[#2C2D33] shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
          <div className="flex flex-col flex-1 p-5">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-8 h-8 rounded-lg bg-[#AAFF00] flex items-center justify-center shrink-0">
                <LayoutDashboard size={16} className="text-black" />
              </div>
              <span className="text-[14px] font-bold text-white tracking-tight">TrendForge</span>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em] px-3 mb-2">
                Workspace
              </p>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-3 h-10 px-3 rounded-xl text-[#8B8C99] hover:bg-[#252629] hover:text-white transition-colors w-full text-left"
              >
                <LayoutDashboard size={16} className="shrink-0" />
                <span className="text-[13px] font-medium">Dashboard</span>
              </button>
              <button
                onClick={() => router.push('/accounts')}
                className="flex items-center gap-3 h-10 px-3 rounded-xl bg-[#AAFF00] shadow-[0_0_20px_rgba(170,255,0,0.25)] w-full text-left"
              >
                <ArrowLeft size={16} className="text-black shrink-0" />
                <span className="text-[13px] font-semibold text-black">Accounts</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">
          {loading ? (
            <div className="bg-[#1E1F23] rounded-[20px] p-6 border border-[#2C2D33]">
              <p className="text-[14px] text-[#8B8C99]">Loading…</p>
            </div>
          ) : error ? (
            <div className="bg-[#1E1F23] rounded-[20px] p-6 border border-[#2C2D33]">
              <p className="text-[14px] text-red-400 mb-3">{error}</p>
              <button onClick={() => router.push('/accounts')} className="text-[13px] text-[#AAFF00] hover:underline">
                Back to accounts
              </button>
            </div>
          ) : data ? (
            <>
              {/* Header */}
              <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                <h1 className="text-[22px] font-bold text-white mb-4">@{data.account.handle}</h1>
                <div className="flex gap-6 flex-wrap">
                  {[
                    { label: 'Followers',     value: fmt(snap?.followers ?? null) },
                    { label: 'Videos',        value: fmt(snap?.video_count ?? null) },
                    { label: 'Last refreshed', value: fmtDate(snap?.fetched_at ?? null) },
                    { label: 'Snapshots',     value: snapshots.length.toString() },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em] mb-1">{label}</p>
                      <p className="text-[20px] font-bold text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend charts */}
              {trendData.length >= 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-[12px] font-semibold text-[#8B8C99] mb-4">Follower trend</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252629" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#4A4B55' }} />
                        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#4A4B55' }} domain={['auto', 'auto']} />
                        <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Followers']} contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="followers" stroke="#AAFF00" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-[12px] font-semibold text-[#8B8C99] mb-4">Total views over time</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252629" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#4A4B55' }} />
                        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#4A4B55' }} domain={['auto', 'auto']} />
                        <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views']} contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="views" stroke="#34D399" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Video charts */}
              {videos.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-[12px] font-semibold text-[#8B8C99] mb-4">Top videos by views</p>
                    <ResponsiveContainer width="100%" height={Math.max(200, topByViews.length * 36)}>
                      <BarChart layout="vertical" data={topByViews}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252629" horizontal={false} />
                        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#4A4B55' }} domain={['auto', 'auto']} />
                        <YAxis type="category" dataKey="title" width={130} tick={{ fontSize: 10, fill: '#4A4B55' }} />
                        <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views']} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="views" fill="#AAFF00" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-[12px] font-semibold text-[#8B8C99] mb-4">Engagement rate (%)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={byEngagement}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252629" />
                        <XAxis dataKey="title" tick={{ fontSize: 10, fill: '#4A4B55' }} interval={0} angle={-30} textAnchor="end" height={60} />
                        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#4A4B55' }} domain={['auto', 'auto']} />
                        <Tooltip formatter={(v) => [typeof v === 'number' ? `${v}%` : '—', 'Engagement']} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="rate" fill="#AAFF00" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Videos table */}
              {videos.length > 0 && (
                <div className="grain bg-[#1E1F23] rounded-[20px] border border-[#2C2D33] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2C2D33]">
                        {([
                          { label: 'Title',      key: 'title' },
                          { label: 'Views',      key: 'views' },
                          { label: 'Likes',      key: 'likes' },
                          { label: 'Comments',   key: 'comments' },
                          { label: 'Shares',     key: 'shares' },
                          { label: 'Engagement', key: 'engagement_rate' },
                        ] as { label: string; key: SortKey }[]).map(({ label, key }) => (
                          <th
                            key={key}
                            onClick={() => toggleSort(key)}
                            className="text-left text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em] px-6 py-4 cursor-pointer select-none hover:text-[#AAFF00] transition-colors"
                          >
                            {label}
                            {sortKey === key && (
                              <span className="ml-1 text-[#AAFF00]">{sortDir === 'desc' ? '↓' : '↑'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...videos]
                        .sort((a, b) => {
                          const av = a[sortKey];
                          const bv = b[sortKey];
                          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                          return sortDir === 'asc' ? cmp : -cmp;
                        })
                        .map((v, i, arr) => (
                          <tr key={v.video_id} className={`hover:bg-[#252629] transition-colors ${i < arr.length - 1 ? 'border-b border-[#2C2D33]' : ''}`}>
                            <td className="px-6 py-3 text-[13px] text-[#C8C9D0] max-w-[240px]">
                              {v.title ? (v.title.length > 60 ? v.title.slice(0, 60) + '…' : v.title) : <span className="text-[#4A4B55]">—</span>}
                            </td>
                            <td className="px-6 py-3 text-[13px] text-[#C8C9D0]">{fmt(v.views)}</td>
                            <td className="px-6 py-3 text-[13px] text-[#C8C9D0]">{fmt(v.likes)}</td>
                            <td className="px-6 py-3 text-[13px] text-[#C8C9D0]">{fmt(v.comments)}</td>
                            <td className="px-6 py-3 text-[13px] text-[#C8C9D0]">{fmt(v.shares)}</td>
                            <td className="px-6 py-3 text-[13px] font-medium text-[#AAFF00]">
                              {(v.engagement_rate * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {snap && videos.length === 0 && (
                <div className="bg-[#1E1F23] rounded-[20px] p-8 border border-[#2C2D33] text-center">
                  <p className="text-[14px] text-[#8B8C99]">No video data in the latest snapshot. Try refreshing.</p>
                </div>
              )}

              {!snap && (
                <div className="bg-[#1E1F23] rounded-[20px] p-8 border border-[#2C2D33] text-center">
                  <p className="text-[15px] font-semibold text-white mb-1">No data yet</p>
                  <p className="text-[14px] text-[#8B8C99]">Go back and hit Refresh to pull analytics for this account.</p>
                </div>
              )}
            </>
          ) : null}
        </main>

        {/* Right panel */}
        <aside className="w-72 shrink-0 hidden xl:flex flex-col gap-4 sticky top-4 self-start">

          {/* Overall stats */}
          {videos.length > 0 && (
            <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em] mb-4">Overall stats</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Total views',   value: fmt(totalViews),  icon: Eye },
                  { label: 'Total likes',   value: fmt(totalLikes),  icon: Heart },
                  { label: 'Avg engagement', value: `${avgEng}%`,    icon: Share2 },
                  { label: 'Videos tracked', value: videos.length.toString(), icon: MessageCircle },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[rgba(170,255,0,0.08)] flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-[#AAFF00]" />
                    </div>
                    <span className="text-[13px] text-[#8B8C99] flex-1">{label}</span>
                    <span className="text-[14px] font-bold text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top video */}
          {topVideo && (
            <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em] mb-3">Top video</p>
              <p className="text-[13px] font-medium text-white leading-snug mb-3">
                {topVideo.title ? (topVideo.title.length > 80 ? topVideo.title.slice(0, 80) + '…' : topVideo.title) : '—'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Views',    value: fmt(topVideo.views) },
                  { label: 'Likes',    value: fmt(topVideo.likes) },
                  { label: 'Comments', value: fmt(topVideo.comments) },
                  { label: 'Shares',   value: fmt(topVideo.shares) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#252629] rounded-xl p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-[10px] text-[#4A4B55] uppercase tracking-wide font-medium mb-1">{label}</p>
                    <p className="text-[15px] font-bold text-[#AAFF00]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refresh info */}
          {snap && (
            <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em] mb-2">Data freshness</p>
              <p className="text-[13px] text-[#8B8C99]">Last updated</p>
              <p className="text-[13px] font-medium text-white mt-0.5">{fmtDate(snap.fetched_at)}</p>
              <p className="text-[12px] text-[#4A4B55] mt-2">
                {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} collected
              </p>
              <button
                onClick={() => router.push('/accounts')}
                className="mt-4 w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-[#2C2D33] hover:border-[#AAFF00]/50 hover:text-[#AAFF00] text-[#8B8C99] text-[12px] font-medium transition-colors"
              >
                <RefreshCw size={12} />
                Refresh from accounts
              </button>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}
