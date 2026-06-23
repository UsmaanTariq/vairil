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
  backgroundColor: '#FFFFFF',
  border: '1px solid #E8E9E6',
  borderRadius: '12px',
  color: '#16181A',
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
  const [tablePage, setTablePage] = useState(0);
  const PAGE_SIZE = 50;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setTablePage(0);
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
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-3 mb-2">
                Workspace
              </p>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-3 h-10 px-3 rounded-xl text-[#7C8278] hover:bg-[#F3F4F2] hover:text-[#16181A] transition-colors w-full text-left"
              >
                <LayoutDashboard size={16} className="shrink-0" />
                <span className="text-[13px] font-medium">Dashboard</span>
              </button>
              <button
                onClick={() => router.push('/accounts')}
                className="flex items-center gap-3 h-10 px-3 rounded-xl bg-[#EFF6F2] border-l-4 border-[#1F4D3A] w-full text-left"
              >
                <ArrowLeft size={16} className="text-[#1F4D3A] shrink-0" />
                <span className="text-[13px] font-semibold text-[#1F4D3A]">Accounts</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">
          {loading ? (
            <div className="bg-white rounded-[20px] p-6 border border-[#E8E9E6]">
              <p className="text-[14px] text-[#7C8278]">Loading…</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-[20px] p-6 border border-[#E8E9E6]">
              <p className="text-[14px] text-red-500 mb-3">{error}</p>
              <button onClick={() => router.push('/accounts')} className="text-[13px] text-[#2E6B4F] hover:underline">
                Back to accounts
              </button>
            </div>
          ) : data ? (
            <>
              {/* Header */}
              <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                <h1 className="text-[22px] font-bold text-[#16181A] mb-4">@{data.account.handle}</h1>
                <div className="flex gap-6 flex-wrap">
                  {[
                    { label: 'Followers',     value: fmt(snap?.followers ?? null) },
                    { label: 'Videos',        value: fmt(snap?.video_count ?? null) },
                    { label: 'Last refreshed', value: fmtDate(snap?.fetched_at ?? null) },
                    { label: 'Snapshots',     value: snapshots.length.toString() },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-1">{label}</p>
                      <p className="text-[20px] font-bold text-[#16181A]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend chart */}
              {trendData.length >= 2 && (
                <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                  <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Follower trend</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Followers']} contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="followers" stroke="#2E6B4F" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Video charts */}
              {videos.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Top videos by views</p>
                    <ResponsiveContainer width="100%" height={Math.max(200, topByViews.length * 36)}>
                      <BarChart layout="vertical" data={topByViews}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" horizontal={false} />
                        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                        <YAxis type="category" dataKey="title" width={130} tick={{ fontSize: 10, fill: '#7C8278' }} />
                        <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views']} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="views" fill="#2E6B4F" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Engagement rate (%)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={byEngagement}>
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

              {/* Videos table */}
              {videos.length > 0 && (
                <div className="bg-white rounded-[20px] border border-[#E8E9E6] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E8E9E6]">
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
                            className="text-left text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-6 py-4 cursor-pointer select-none hover:text-[#1F4D3A] transition-colors"
                          >
                            {label}
                            {sortKey === key && (
                              <span className="ml-1 text-[#2E6B4F]">{sortDir === 'desc' ? '↓' : '↑'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sorted = [...videos].sort((a, b) => {
                          const av = a[sortKey];
                          const bv = b[sortKey];
                          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                          return sortDir === 'asc' ? cmp : -cmp;
                        });
                        const page = sorted.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);
                        return page.map((v, i) => (
                          <tr key={v.video_id} className={`hover:bg-[#F3F4F2] transition-colors ${i < page.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}>
                            <td className="px-6 py-3 text-[13px] text-[#16181A] max-w-[240px]">
                              {v.title ? (v.title.length > 60 ? v.title.slice(0, 60) + '…' : v.title) : <span className="text-[#A9AEA4]">—</span>}
                            </td>
                            <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(v.views)}</td>
                            <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(v.likes)}</td>
                            <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(v.comments)}</td>
                            <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(v.shares)}</td>
                            <td className="px-6 py-3 text-[13px] font-medium text-[#2E6B4F]">
                              {(v.engagement_rate * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                  {videos.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-[#E8E9E6]">
                      <span className="text-[12px] text-[#A9AEA4]">
                        {tablePage * PAGE_SIZE + 1}–{Math.min((tablePage + 1) * PAGE_SIZE, videos.length)} of {videos.length}
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={tablePage === 0}
                          onClick={() => setTablePage((p) => p - 1)}
                          className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Prev
                        </button>
                        <button
                          disabled={(tablePage + 1) * PAGE_SIZE >= videos.length}
                          onClick={() => setTablePage((p) => p + 1)}
                          className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E8E9E6] text-[#7C8278] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {snap && videos.length === 0 && (
                <div className="bg-white rounded-[20px] p-8 border border-[#E8E9E6] text-center">
                  <p className="text-[14px] text-[#7C8278]">No video data in the latest snapshot. Try refreshing.</p>
                </div>
              )}

              {!snap && (
                <div className="bg-white rounded-[20px] p-8 border border-[#E8E9E6] text-center">
                  <p className="text-[15px] font-semibold text-[#16181A] mb-1">No data yet</p>
                  <p className="text-[14px] text-[#7C8278]">Go back and hit Refresh to pull analytics for this account.</p>
                </div>
              )}
            </>
          ) : null}
        </main>

        {/* Right panel */}
        <aside className="w-72 shrink-0 hidden xl:flex flex-col gap-4 sticky top-4 self-start">

          {/* Overall stats */}
          {videos.length > 0 && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Overall stats</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Total views',    value: fmt(totalViews),            icon: Eye },
                  { label: 'Total likes',    value: fmt(totalLikes),            icon: Heart },
                  { label: 'Avg engagement', value: `${avgEng}%`,              icon: Share2 },
                  { label: 'Videos tracked', value: videos.length.toString(),  icon: MessageCircle },
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

          {/* Top video */}
          {topVideo && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-3">Top video</p>
              <p className="text-[13px] font-medium text-[#16181A] leading-snug mb-3">
                {topVideo.title ? (topVideo.title.length > 80 ? topVideo.title.slice(0, 80) + '…' : topVideo.title) : '—'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Views',    value: fmt(topVideo.views) },
                  { label: 'Likes',    value: fmt(topVideo.likes) },
                  { label: 'Comments', value: fmt(topVideo.comments) },
                  { label: 'Shares',   value: fmt(topVideo.shares) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F3F4F2] rounded-xl p-3">
                    <p className="text-[10px] text-[#A9AEA4] uppercase tracking-wide font-medium mb-1">{label}</p>
                    <p className="text-[15px] font-bold text-[#1F4D3A]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refresh info */}
          {snap && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-2">Data freshness</p>
              <p className="text-[13px] text-[#7C8278]">Last updated</p>
              <p className="text-[13px] font-medium text-[#16181A] mt-0.5">{fmtDate(snap.fetched_at)}</p>
              <p className="text-[12px] text-[#A9AEA4] mt-2">
                {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} collected
              </p>
              <button
                onClick={() => router.push('/accounts')}
                className="mt-4 w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-[#E8E9E6] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] text-[#7C8278] text-[12px] font-medium transition-colors"
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
