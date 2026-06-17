'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line,
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
  tiktok:    { account_id: string; latest_snapshot: TikTokSnapshot | null;    snapshots: TikTokSnapshot[]    } | null;
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

export default function ProjectAnalyticsPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [ttSort, setTtSort]   = useState<TtSortKey>('views');
  const [ttDir, setTtDir]     = useState<'asc' | 'desc'>('desc');
  const [igSort, setIgSort]   = useState<IgSortKey>('views');
  const [igDir, setIgDir]     = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch(`/api/projects/${id}/analytics`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { setError(d.error); return; } setData(d); })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-[#F3F4F2] dot-grid flex items-center justify-center">
      <p className="text-[14px] text-[#7C8278]">Loading…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#F3F4F2] dot-grid flex items-center justify-center">
      <p className="text-[14px] text-red-500">{error}</p>
    </div>
  );

  const ttSnap   = data?.tiktok?.latest_snapshot;
  const ttSnaps  = data?.tiktok?.snapshots ?? [];
  const ttVideos = ttSnap?.videos ?? [];
  const igSnap   = data?.instagram?.latest_snapshot;
  const igSnaps  = data?.instagram?.snapshots ?? [];
  const igPosts  = igSnap?.posts ?? [];

  const ttTotalViews  = ttVideos.reduce((s, v) => s + v.views, 0);
  const igTotalViews  = igPosts.reduce((s, p) => s + (p.views ?? 0), 0);
  const combinedViews = ttTotalViews + igTotalViews;

  const ttAvgEng = ttVideos.length ? ttVideos.reduce((s, v) => s + v.engagement_rate, 0) / ttVideos.length : 0;
  const igAvgEng = igPosts.length  ? igPosts.reduce((s, p)  => s + p.engagement_rate, 0)  / igPosts.length  : 0;
  const engCount = (ttVideos.length > 0 ? 1 : 0) + (igPosts.length > 0 ? 1 : 0);
  const combinedAvgEng = engCount > 0 ? (ttAvgEng + igAvgEng) / engCount : 0;
  const totalFollowers = (ttSnap?.followers ?? 0) + (igSnap?.followers ?? 0);

  const combinedTrend = (() => {
    const byDate: Record<string, number> = {};
    for (const s of ttSnaps) {
      const d = new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      byDate[d] = (byDate[d] ?? 0) + (s.videos ?? []).reduce((acc, v) => acc + v.views, 0);
    }
    for (const s of igSnaps) {
      const d = new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      byDate[d] = (byDate[d] ?? 0) + (s.posts ?? []).reduce((acc, p) => acc + (p.views ?? 0), 0);
    }
    return Object.entries(byDate).map(([date, views]) => ({ date, views }));
  })();

  const ttTrendData = ttSnaps.map((s) => ({
    date:      new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: s.followers,
    views:     (s.videos ?? []).reduce((acc, v) => acc + v.views, 0),
  }));

  const igTrendData = igSnaps.map((s) => ({
    date:      new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: s.followers,
    views:     (s.posts ?? []).reduce((acc, p) => acc + (p.views ?? 0), 0),
  }));

  function toggleTt(key: TtSortKey) {
    if (ttSort === key) setTtDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setTtSort(key); setTtDir('desc'); }
  }
  function toggleIg(key: IgSortKey) {
    if (igSort === key) setIgDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setIgSort(key); setIgDir('desc'); }
  }

  const card = 'bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]';

  return (
    <div className="min-h-screen bg-[#F3F4F2] dot-grid">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">

        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[13px] text-[#7C8278] hover:text-[#16181A] transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="text-[22px] font-bold text-[#16181A]">Analytics</h1>
        </div>

        {/* Combined overview */}
        <div className={card}>
          <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Combined overview</p>
          <div className="flex gap-8 flex-wrap mb-6">
            {[
              { label: 'Total views',     value: fmt(combinedViews || null) },
              { label: 'Total followers', value: fmt(totalFollowers || null) },
              { label: 'Avg engagement', value: `${(combinedAvgEng * 100).toFixed(2)}%` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-1">{label}</p>
                <p className="text-[20px] font-bold text-[#16181A]">{value}</p>
              </div>
            ))}
          </div>
          {combinedTrend.length >= 2 && (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={combinedTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Combined views']} contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="views" stroke="#2E6B4F" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* TikTok section */}
        {data?.tiktok && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[16px] font-bold text-[#16181A]">TikTok</h2>
            <div className={card}>
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: 'Followers',      value: fmt(ttSnap?.followers ?? null) },
                  { label: 'Videos',         value: fmt(ttSnap?.video_count ?? null) },
                  { label: 'Last refreshed', value: fmtDate(ttSnap?.fetched_at ?? null) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-1">{label}</p>
                    <p className="text-[18px] font-bold text-[#16181A]">{value}</p>
                  </div>
                ))}
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
                        <td className="px-5 py-3 text-[13px] text-[#16181A] max-w-[200px]">{v.title ? (v.title.length > 50 ? v.title.slice(0, 50) + '…' : v.title) : <span className="text-[#A9AEA4]">—</span>}</td>
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
          </div>
        )}

        {/* Instagram section */}
        {data?.instagram && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[16px] font-bold text-[#16181A]">Instagram</h2>
            <div className={card}>
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: 'Followers',      value: fmt(igSnap?.followers ?? null) },
                  { label: 'Posts',          value: fmt(igSnap?.post_count ?? null) },
                  { label: 'Last refreshed', value: fmtDate(igSnap?.fetched_at ?? null) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-1">{label}</p>
                    <p className="text-[18px] font-bold text-[#16181A]">{value}</p>
                  </div>
                ))}
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
                        <td className="px-5 py-3 text-[13px] text-[#16181A] max-w-[200px]">{p.caption ? (p.caption.length > 50 ? p.caption.slice(0, 50) + '…' : p.caption) : <span className="text-[#A9AEA4]">—</span>}</td>
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
                <p className="text-[14px] text-[#7C8278]">No post data yet. Refresh the Instagram account to pull the first snapshot.</p>
              </div>
            )}
            {!igSnap && (
              <div className={`${card} text-center`}>
                <p className="text-[14px] text-[#7C8278]">No Instagram data yet. Refresh the account to pull the first snapshot.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
