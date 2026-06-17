'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, RefreshCw, LayoutDashboard } from 'lucide-react';

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
    if (!res.ok) {
      setAddError(data.error ?? 'Failed to add account');
      return;
    }
    setHandle('');
    setAccounts((prev) => [{ ...data.account, latest_snapshot: null }, ...prev]);
  }

  async function handleRefresh(id: string) {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/tiktok/accounts/${id}/refresh`, { method: 'POST' });
      const data = await res.json();
      setRefreshingId(null);
      if (!res.ok) return;
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                latest_snapshot: {
                  followers: data.snapshot.followers,
                  video_count: data.snapshot.video_count,
                  fetched_at: data.snapshot.fetched_at,
                },
              }
            : a
        )
      );
    } catch {
      // network error or non-JSON response — spinner still stops
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
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-[#E9EBF0]">
      <div className="flex gap-6 p-6 min-h-screen">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 sticky top-6 self-start h-[calc(100vh-48px)] bg-white rounded-[24px] shadow-[0_8px_24px_rgba(27,27,47,0.05)] flex flex-col overflow-hidden">
          <div className="flex flex-col flex-1 p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-xl bg-[#EEEBFC] flex items-center justify-center shrink-0">
                <LayoutDashboard size={18} className="text-[#6C5CE7]" />
              </div>
              <span className="text-[15px] font-bold text-[#6C5CE7] tracking-tight">TrendForge</span>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] px-3 mb-2">
                Workspace
              </p>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-3 h-11 px-3 rounded-xl text-[#6B6B80] hover:bg-[#F5F6FA] transition-colors w-full text-left"
              >
                <LayoutDashboard size={20} className="shrink-0" />
                <span className="text-[13px] font-medium">Dashboard</span>
              </button>
              <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-[#EEEBFC] w-full">
                <ArrowLeft size={20} className="text-[#6C5CE7] shrink-0" />
                <span className="text-[13px] font-semibold text-[#6C5CE7]">Accounts</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[#1B1B2F]">TikTok Accounts</h1>
              <p className="text-[14px] text-[#9A9AAE] mt-0.5">Track client performance over time</p>
            </div>
          </div>

          {/* Add account */}
          <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_24px_rgba(27,27,47,0.05)]">
            <p className="text-[13px] font-semibold text-[#1B1B2F] mb-3">Add account</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={handle}
                onChange={(e) => { setHandle(e.target.value); setAddError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="@handle or handle"
                className="flex-1 h-10 px-4 rounded-xl border border-[#ECEDF2] text-[14px] text-[#1B1B2F] placeholder-[#9A9AAE] focus:outline-none focus:border-[#6C5CE7] focus:ring-2 focus:ring-[#6C5CE7]/10 transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !handle.trim()}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4BD6] disabled:opacity-50 text-white text-[13px] font-medium transition-colors"
              >
                <Plus size={15} />
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
            {addError && (
              <p className="text-[13px] text-red-500 mt-2">{addError}</p>
            )}
          </div>

          {/* Accounts table */}
          <div className="bg-white rounded-[24px] shadow-[0_8px_24px_rgba(27,27,47,0.05)] overflow-hidden">
            {loading ? (
              <p className="text-[14px] text-[#9A9AAE] p-6">Loading…</p>
            ) : accounts.length === 0 ? (
              <div className="text-center py-16 px-6">
                <p className="text-[15px] font-semibold text-[#1B1B2F] mb-1">No accounts yet</p>
                <p className="text-[14px] text-[#9A9AAE]">Add a TikTok handle above to start tracking.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0F1F5]">
                    {['Handle', 'Followers', 'Videos', 'Last refreshed', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] px-6 py-4 first:pl-6"
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
                      className={`${i < accounts.length - 1 ? 'border-b border-[#F0F1F5]' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-semibold text-[#1B1B2F]">@{a.handle}</span>
                      </td>
                      <td className="px-6 py-4 text-[14px] text-[#1B1B2F]">
                        {fmt(a.latest_snapshot?.followers ?? null)}
                      </td>
                      <td className="px-6 py-4 text-[14px] text-[#1B1B2F]">
                        {fmt(a.latest_snapshot?.video_count ?? null)}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#9A9AAE]">
                        {fmtDate(a.latest_snapshot?.fetched_at ?? null)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRefresh(a.id)}
                          disabled={refreshingId === a.id}
                          className="inline-flex items-center gap-2 h-8 px-4 rounded-lg border border-[#ECEDF2] hover:border-[#6C5CE7] hover:text-[#6C5CE7] disabled:opacity-50 text-[#6B6B80] text-[12px] font-medium transition-colors"
                        >
                          <RefreshCw size={13} className={refreshingId === a.id ? 'animate-spin' : ''} />
                          {refreshingId === a.id ? 'Refreshing…' : 'Refresh'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
