'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, TrendingUp, Layers } from 'lucide-react';

interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  tiktok_handle: string | null;
  instagram_handle: string | null;
  status: string;
  created_at: string;
  ideas_count: number;
  approved_count: number;
}

export default function AccountsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const withTikTok    = projects.filter((p) => p.tiktok_handle);
  const withInstagram = projects.filter((p) => p.instagram_handle);

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
            <h1 className="text-[22px] font-bold text-[#16181A]">Accounts</h1>
            <p className="text-[13px] text-[#7C8278] mt-0.5">Click a project to view its analytics</p>
          </div>

          <div className="bg-white rounded-[20px] border border-[#E8E9E6] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            {loading ? (
              <p className="text-[14px] text-[#7C8278] p-6">Loading…</p>
            ) : projects.length === 0 ? (
              <div className="text-center py-16 px-6">
                <p className="text-[15px] font-semibold text-[#16181A] mb-1">No projects yet</p>
                <p className="text-[13px] text-[#7C8278]">Create a project from the dashboard to start tracking analytics.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8E9E6]">
                    {['Project', 'Platforms', 'Status', 'Created'].map((h) => (
                      <th key={h} className="text-left text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-6 py-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/project/${p.id}/analytics`)}
                      className={`cursor-pointer hover:bg-[#F3F4F2] transition-colors ${i < projects.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <p className="text-[14px] font-semibold text-[#16181A]">{p.client_name}</p>
                        {p.niche && <p className="text-[12px] text-[#A9AEA4] mt-0.5">{p.niche}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {p.tiktok_handle && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E8F2EC] text-[#1F4D3A] text-[11px] font-semibold">
                              TikTok
                            </span>
                          )}
                          {p.instagram_handle && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EEF2FD] text-[#4B6EC8] text-[11px] font-semibold">
                              Instagram
                            </span>
                          )}
                          {!p.tiktok_handle && !p.instagram_handle && (
                            <span className="text-[12px] text-[#A9AEA4]">None linked</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#F3F4F2] text-[#7C8278] text-[11px] font-medium capitalize">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#A9AEA4]">
                        {fmtDate(p.created_at)}
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
          <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Summary</p>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Projects',            value: projects.length,          icon: Layers },
                { label: 'With TikTok',         value: withTikTok.length,        icon: TrendingUp },
                { label: 'With Instagram',      value: withInstagram.length,     icon: Users },
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

          {projects.length > 0 && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Recent projects</p>
              <div className="flex flex-col">
                {projects.slice(0, 5).map((p, i) => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/project/${p.id}/analytics`)}
                    className={`flex items-center justify-between py-3 cursor-pointer group ${i < Math.min(projects.length, 5) - 1 ? 'border-b border-[#E8E9E6]' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#16181A] group-hover:text-[#2E6B4F] transition-colors truncate">
                        {p.client_name}
                      </p>
                      <p className="text-[11px] text-[#A9AEA4] mt-0.5">{fmtDate(p.created_at)}</p>
                    </div>
                    <div className="flex gap-1 ml-3 shrink-0">
                      {p.tiktok_handle    && <span className="w-2 h-2 rounded-full bg-[#2E6B4F]" />}
                      {p.instagram_handle && <span className="w-2 h-2 rounded-full bg-[#4B6EC8]" />}
                    </div>
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
