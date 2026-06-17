'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Plus, RefreshCw, TrendingUp, Video } from 'lucide-react';

interface Snapshot {
  followers: number | null;
  video_count: number | null;
  fetched_at: string | null;
}

interface Account {
  id: string;
  handle: string;
  created_at: string;
  latest_snapshot: Snapshot | null;
}

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshErrors, setRefreshErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/tiktok/accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    const trimmed = handle.replace(/^@/, '').trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError('');
    const res = await fetch('/api/tiktok/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: trimmed }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setAddError(data.error ?? 'Failed to add account'); return; }
    setHandle('');
    setAccounts((prev) => [{ ...data.account, latest_snapshot: null }, ...prev]);
  }

  async function handleRefresh(id: string) {
    setRefreshingId(id);
    setRefreshErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const res = await fetch(`/api/tiktok/accounts/${id}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setRefreshErrors((prev) => ({ ...prev, [id]: data.error ?? 'Refresh failed' })); return; }
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, latest_snapshot: { followers: data.snapshot.followers, video_count: data.snapshot.video_count, fetched_at: data.snapshot.fetched_at } }
            : a
        )
      );
    } catch {
      setRefreshErrors((prev) => ({ ...prev, [id]: 'Network error' }));
    } finally {
      setRefreshingId(null);
    }
  }

  function fmt(n: number | null) {
    if (n === null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const totalFollowers = accounts.reduce((s, a) => s + (a.latest_snapshot?.followers ?? 0), 0);
  const totalVideos    = accounts.reduce((s, a) => s + (a.latest_snapshot?.video_count ?? 0), 0);
  const recentlyRefreshed = [...accounts]
    .filter((a) => a.latest_snapshot?.fetched_at)
    .sort((a, b) =>
      new Date(b.latest_snapshot!.fetched_at!).getTime() - new Date(a.latest_snapshot!.fetched_at!).getTime()
    )
    .slice(0, 5);

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
              <div className="flex items-center gap-3 h-10 px-3 rounded-xl bg-[#EFF6F2] border-l-4 border-[#1F4D3A] w-full">
                <Users size={16} className="text-[#1F4D3A] shrink-0" />
                <span className="text-[13px] font-semibold text-[#1F4D3A]">Accounts</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-[#16181A]">TikTok Accounts</h1>
            <p className="text-[13px] text-[#7C8278] mt-0.5">Track client performance over time</p>
          </div>

          {/* Add account */}
          <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <p className="text-[12px] font-semibold text-[#A9AEA4] uppercase tracking-[0.08em] mb-3">Add account</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={handle}
                onChange={(e) => { setHandle(e.target.value); setAddError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="@handle or handle"
                className="flex-1 h-10 px-4 rounded-xl bg-[#F3F4F2] border border-[#E8E9E6] text-[14px] text-[#16181A] placeholder-[#A9AEA4] focus:outline-none focus:border-[#2E6B4F]/50 focus:ring-2 focus:ring-[#2E6B4F]/10 transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !handle.trim()}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#1F4D3A] hover:bg-[#183D2E] disabled:opacity-40 text-white text-[13px] font-semibold transition-colors"
              >
                <Plus size={15} />
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
            {addError && <p className="text-[12px] text-red-500 mt-2">{addError}</p>}
          </div>

          {/* Accounts table */}
          <div className="bg-white rounded-[20px] border border-[#E8E9E6] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            {loading ? (
              <p className="text-[14px] text-[#7C8278] p-6">Loading…</p>
            ) : accounts.length === 0 ? (
              <div className="text-center py-16 px-6">
                <p className="text-[15px] font-semibold text-[#16181A] mb-1">No accounts yet</p>
                <p className="text-[13px] text-[#7C8278]">Add a TikTok handle above to start tracking.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8E9E6]">
                    {['Handle', 'Followers', 'Videos', 'Last refreshed', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-6 py-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a, i) => (
                    <tr
                      key={a.id}
                      onClick={() => router.push(`/accounts/${a.id}`)}
                      className={`cursor-pointer hover:bg-[#F3F4F2] transition-colors ${i < accounts.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-semibold text-[#16181A]">@{a.handle}</span>
                      </td>
                      <td className="px-6 py-4 text-[14px] text-[#7C8278]">
                        {fmt(a.latest_snapshot?.followers ?? null)}
                      </td>
                      <td className="px-6 py-4 text-[14px] text-[#7C8278]">
                        {fmt(a.latest_snapshot?.video_count ?? null)}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#A9AEA4]">
                        {fmtDate(a.latest_snapshot?.fetched_at ?? null)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRefresh(a.id); }}
                            disabled={refreshingId === a.id}
                            className="inline-flex items-center gap-2 h-8 px-4 rounded-lg border border-[#E8E9E6] hover:border-[#2E6B4F]/50 hover:text-[#2E6B4F] disabled:opacity-40 text-[#7C8278] text-[12px] font-medium transition-colors"
                          >
                            <RefreshCw size={12} className={refreshingId === a.id ? 'animate-spin' : ''} />
                            {refreshingId === a.id ? 'Refreshing…' : 'Refresh'}
                          </button>
                          {refreshErrors[a.id] && (
                            <p className="text-[11px] text-red-500 max-w-[200px] text-right">{refreshErrors[a.id]}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>

        {/* Right panel */}
        <aside className="w-72 shrink-0 hidden xl:flex flex-col gap-4 sticky top-4 self-start">

          {/* Summary stats */}
          <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Summary</p>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Accounts tracked', value: accounts.length, icon: Users },
                { label: 'Total followers', value: fmt(totalFollowers || null), icon: TrendingUp },
                { label: 'Total videos tracked', value: fmt(totalVideos || null), icon: Video },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E8F2EC] flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-[#1F4D3A]" />
                  </div>
                  <span className="text-[13px] text-[#7C8278] flex-1">{label}</span>
                  <span className="text-[15px] font-bold text-[#16181A]">{loading ? '—' : value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recently refreshed */}
          {recentlyRefreshed.length > 0 && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Recently refreshed</p>
              <div className="flex flex-col">
                {recentlyRefreshed.map((a, i) => (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/accounts/${a.id}`)}
                    className={`flex items-center justify-between py-3 cursor-pointer group ${
                      i < recentlyRefreshed.length - 1 ? 'border-b border-[#E8E9E6]' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#16181A] group-hover:text-[#2E6B4F] transition-colors">
                        @{a.handle}
                      </p>
                      <p className="text-[11px] text-[#A9AEA4] mt-0.5">
                        {fmtDate(a.latest_snapshot?.fetched_at ?? null)}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold text-[#16181A] shrink-0 ml-3">
                      {fmt(a.latest_snapshot?.followers ?? null)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}
