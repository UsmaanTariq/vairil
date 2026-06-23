'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pencil,
  Trash2,
  Layers,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  Users,
  LayoutDashboard,
  Plus,
  Eye,
  UserRound,
  Video,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  tiktok_handle: string | null;
  instagram_handle: string | null;
  tiktok_followers: number | null;
  instagram_followers: number | null;
  tiktok_profile_pic_url: string | null;
  instagram_profile_pic_url: string | null;
  status: string;
  created_at: string;
  ideas_count: number;
  approved_count: number;
  trends_count: number;
}

function fmt(n: number | null) {
  if (n === null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const STAGE_LABELS: Record<string, string> = {
  intake:    'Brief',
  interview: 'Questions',
  synthesis: 'Profile',
  research:  'Research',
  ideas:     'Ideas',
  done:      'Export',
};

const STAGES = ['intake', 'interview', 'synthesis', 'research', 'ideas', 'done'];

const STATUS_STYLES: Record<string, string> = {
  intake:    'bg-[#F0F1EE] text-[#7C8278]',
  interview: 'bg-[#FDF4DC] text-[#C47F0A]',
  synthesis: 'bg-[#FDF4DC] text-[#C47F0A]',
  research:  'bg-[#EAF0FB] text-[#3B82C4]',
  ideas:     'bg-[#E8F2EC] text-[#2E6B4F]',
  done:      'bg-[#1F4D3A] text-white',
};

// Stage accent bar colour — runs down the left edge of each project card.
const STATUS_ACCENTS: Record<string, string> = {
  intake:    'bg-[#C9CEC4]',
  interview: 'bg-[#E5B84B]',
  synthesis: 'bg-[#E5B84B]',
  research:  'bg-[#6BA3D6]',
  ideas:     'bg-[#5AA77B]',
  done:      'bg-[#1F4D3A]',
};

function StageProgress({ status }: { status: string }) {
  const currentIdx = STAGES.indexOf(status);
  return (
    <div className="flex items-center gap-0.5 mt-3">
      {STAGES.map((s, i) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition-all ${
            i < currentIdx  ? 'bg-[#7FBE9A]' :
            i === currentIdx ? 'bg-[#1F4D3A]' :
                               'bg-[#E8E9E6]'
          }`}
        />
      ))}
    </div>
  );
}

function MiniSparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const w = 80, h = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={up ? '#2E6B4F' : '#EF4444'} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  deltaPct,
  icon: Icon,
  hero = false,
  loading,
}: {
  label: string;
  value: string | null;
  deltaPct: number | null;
  icon: React.ElementType;
  hero?: boolean;
  loading: boolean;
}) {
  const up = deltaPct !== null && deltaPct >= 0;
  return (
    <div
      className={`rounded-[20px] p-5 border ${
        hero
          ? 'bg-[#1F4D3A] border-[#1F4D3A] shadow-[0_4px_24px_rgba(31,77,58,0.20)]'
          : 'bg-white border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <p className={`text-[12px] ${hero ? 'text-[#7FBE9A]' : 'text-[#7C8278]'}`}>{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${hero ? 'bg-white/10' : 'bg-[#E8F2EC]'}`}>
          <Icon size={13} className={hero ? 'text-white' : 'text-[#1F4D3A]'} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-[32px] font-bold leading-none ${hero ? 'text-white' : 'text-[#16181A]'}`}>
          {loading ? '—' : (value ?? '—')}
        </p>
        {!loading && deltaPct !== null && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold mb-1 px-1.5 py-0.5 rounded-full ${
            up
              ? hero ? 'bg-white/15 text-white' : 'bg-[#E8F2EC] text-[#2E6B4F]'
              : hero ? 'bg-white/15 text-red-300' : 'bg-red-50 text-red-500'
          }`}>
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(deltaPct)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  interface RecentIdea {
    id: string;
    title: string;
    hook: string;
    status: 'draft' | 'approved';
    project_id: string;
    client_name: string;
  }
  const [recentIdeas, setRecentIdeas] = useState<RecentIdea[]>([]);
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editNiche, setEditNiche] = useState('');
  const [editPlatforms, setEditPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [combinedTrend, setCombinedTrend] = useState<{ date: string; views: number }[]>([]);

  interface Kpis {
    views:     { today: number; delta_pct: number | null };
    followers: { total: number; delta_pct: number | null };
    videos:    { total: number };
    clients:   { total: number };
  }
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [velocity, setVelocity] = useState<Record<string, { trend: number[]; delta_pct: number | null }>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/ideas/recent').then((r) => r.json()),
      fetch('/api/analytics/combined-views').then((r) => r.json()),
      fetch('/api/analytics/kpis').then((r) => r.json()),
      fetch('/api/analytics/velocity').then((r) => r.json()),
    ]).then(([projectsData, ideasData, trendData, kpisData, velocityData]) => {
      setProjects(projectsData.projects ?? []);
      setRecentIdeas(ideasData.ideas ?? []);
      setCombinedTrend(trendData.trend ?? []);
      setKpis(kpisData);
      setVelocity(velocityData.velocity ?? {});
    }).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!clientName.trim()) return;
    setCreating(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: clientName.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    setOpen(false);
    setClientName('');
    if (data.project) router.push(`/project/${data.project.id}`);
  }

  function openEdit(p: Project) {
    setEditingProject(p);
    setEditName(p.client_name);
    setEditNiche(p.niche ?? '');
    setEditPlatforms(p.platforms ?? []);
  }

  function toggleEditPlatform(pl: string) {
    setEditPlatforms((prev) =>
      prev.includes(pl) ? prev.filter((x) => x !== pl) : [...prev, pl]
    );
  }

  async function handleSaveClient() {
    if (!editingProject || !editName.trim()) return;
    setSaving(true);
    await fetch(`/api/projects/${editingProject.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: editName.trim(),
        niche: editNiche.trim() || null,
        platforms: editPlatforms,
      }),
    });
    setProjects((prev) =>
      prev.map((p) =>
        p.id === editingProject.id
          ? { ...p, client_name: editName.trim(), niche: editNiche.trim() || null, platforms: editPlatforms }
          : p
      )
    );
    setSaving(false);
    setEditingProject(null);
  }

  async function handleDelete() {
    if (!deletingProject) return;
    setDeleting(true);
    await fetch(`/api/projects/${deletingProject.id}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
    setDeleting(false);
    setDeletingProject(null);
  }

  // Per-day combined views = the day-over-day gain between cumulative snapshots (clamped at 0).
  const combinedPerDay = combinedTrend.slice(1).map((d, i) => ({
    date: d.date,
    views: Math.max(0, d.views - combinedTrend[i].views),
  }));

  const totalIdeas  = projects.reduce((s, p) => s + p.ideas_count, 0);
  const totalTrends = projects.reduce((s, p) => s + p.trends_count, 0);
  const activeCount = projects.filter((p) => p.status !== 'done').length;
  const doneCount   = projects.filter((p) => p.status === 'done').length;

  const overviewStats = [
    { value: projects.length, label: 'Clients',           icon: Users },
    { value: activeCount,     label: 'In progress',       icon: Layers },
    { value: doneCount,       label: 'Completed',         icon: CheckCircle2 },
    { value: totalIdeas,      label: 'Ideas generated',   icon: Lightbulb },
    { value: totalTrends,     label: 'Trends researched', icon: TrendingUp },
  ];

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
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-3 mb-2">
                Workspace
              </p>
              <div className="flex items-center gap-3 h-10 px-3 rounded-xl bg-[#EFF6F2] border-l-4 border-[#1F4D3A]">
                <LayoutDashboard size={16} className="text-[#1F4D3A] shrink-0" />
                <span className="text-[13px] font-semibold text-[#1F4D3A]">Dashboard</span>
              </div>
              <button
                onClick={() => router.push('/accounts')}
                className="flex items-center gap-3 h-10 px-3 rounded-xl text-[#7C8278] hover:bg-[#F3F4F2] hover:text-[#16181A] transition-colors w-full text-left"
              >
                <Users size={16} className="shrink-0" />
                <span className="text-[13px] font-medium">Accounts</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#E8E9E6]">
              <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#1F4D3A] hover:bg-[#183D2E] text-white text-[13px] font-semibold transition-colors"
              >
                <Plus size={15} />
                New project
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Combined Views */}
            <KpiCard
              label="Combined views"
              value={kpis ? fmt(kpis.views.today) ?? String(kpis.views.today) : null}
              deltaPct={kpis?.views.delta_pct ?? null}
              icon={Eye}
              hero
              loading={loading}
            />
            {/* Total Followers */}
            <KpiCard
              label="Total followers"
              value={kpis ? fmt(kpis.followers.total) ?? String(kpis.followers.total) : null}
              deltaPct={kpis?.followers.delta_pct ?? null}
              icon={UserRound}
              loading={loading}
            />
            {/* Videos posted */}
            <KpiCard
              label="Videos posted"
              value={kpis ? String(kpis.videos.total) : null}
              deltaPct={null}
              icon={Video}
              loading={loading}
            />
            {/* Clients */}
            <KpiCard
              label="Clients"
              value={kpis ? String(kpis.clients.total) : null}
              deltaPct={null}
              icon={Users}
              loading={loading}
            />
          </div>

          {/* Combined views — cumulative */}
          {combinedTrend.length >= 2 && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Cumulative views (TikTok + Instagram)</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={combinedTrend} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="combinedViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1F4D3A" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#1F4D3A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#EEF0ED" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#A9AEA4' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#A9AEA4' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={40} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #E8E9E6', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#16181A', fontWeight: 600 }}
                    cursor={{ stroke: '#C9CEC4', strokeWidth: 1 }}
                    formatter={(v) => [Number(v).toLocaleString(), 'Views']}
                  />
                  <Area type="monotone" dataKey="views" stroke="#1F4D3A" strokeWidth={2.5} fill="url(#combinedViews)" dot={false} activeDot={{ r: 4, fill: '#1F4D3A', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Combined views — per day */}
          {combinedPerDay.length >= 1 && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Views per day (TikTok + Instagram)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={combinedPerDay} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="combinedPerDay" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3F8F62" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3F8F62" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#EEF0ED" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#A9AEA4' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#A9AEA4' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={40} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #E8E9E6', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#16181A', fontWeight: 600 }}
                    cursor={{ fill: 'rgba(46,107,79,0.06)' }}
                    formatter={(v) => [Number(v).toLocaleString(), 'Views gained']}
                  />
                  <Bar dataKey="views" fill="url(#combinedPerDay)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Projects */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <h2 className="text-[18px] font-bold text-[#16181A] tracking-tight">
                Projects
              </h2>
              {!loading && projects.length > 0 && (
                <span className="text-[11px] font-semibold text-[#2E6B4F] bg-[#E8F2EC] rounded-full px-2.5 py-0.5">
                  {projects.length}
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-[14px] text-[#7C8278]">Loading…</p>
            ) : projects.length === 0 ? (
              <div className="bg-white rounded-[20px] border border-[#E8E9E6] text-center py-16 px-6 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                <p className="text-[15px] font-semibold text-[#16181A] mb-1">No projects yet</p>
                <p className="text-[13px] text-[#7C8278] mb-6">Create your first project to get started.</p>
                <button
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#1F4D3A] hover:bg-[#183D2E] text-white text-[13px] font-semibold px-5 transition-colors"
                >
                  <Plus size={15} />
                  New project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {projects.map((p) => {
                  const stageIdx    = STAGES.indexOf(p.status);
                  const stageLabel  = STAGE_LABELS[p.status] ?? p.status;
                  const stageStyle  = STATUS_STYLES[p.status] ?? 'bg-[#F0F1EE] text-[#7C8278]';
                  const stageAccent = STATUS_ACCENTS[p.status] ?? 'bg-[#C9CEC4]';
                  const combined    = (p.tiktok_followers ?? 0) + (p.instagram_followers ?? 0);
                  const vel         = velocity[p.id];
                  const hasVel      = vel && vel.trend.length >= 2;
                  const velUp       = hasVel && (vel.delta_pct === null || vel.delta_pct >= 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/project/${p.id}`)}
                      className="relative overflow-hidden bg-white rounded-[20px] pl-6 pr-5 py-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)] cursor-pointer hover:border-[#3F8F62]/40 hover:shadow-[0_4px_24px_rgba(31,77,58,0.10)] hover:bg-[#FAFBFA] transition-all duration-200 group flex flex-col"
                    >
                      {/* Stage accent bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stageAccent}`} />

                      {/* Header zone */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {p.tiktok_profile_pic_url && (
                            <img
                              src={p.tiktok_profile_pic_url}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-[#E8F2EC]"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-[#16181A] group-hover:text-[#2E6B4F] transition-colors leading-snug truncate">
                              {p.client_name}
                            </p>
                            {p.niche && (
                              <p className="text-[12px] text-[#7C8278] mt-0.5 truncate">{p.niche}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#F0F1EE] text-[#A9AEA4] hover:text-[#7C8278]"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingProject(p); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-[#A9AEA4] hover:text-red-500"
                          >
                            <Trash2 size={12} />
                          </button>
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${stageStyle}`}>
                            {stageLabel}
                          </span>
                        </div>
                      </div>

                      {/* Platform zone */}
                      {(p.tiktok_handle || p.instagram_handle) && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {p.tiktok_handle && (
                            <a
                              href={`https://www.tiktok.com/@${p.tiktok_handle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E8F2EC] hover:bg-[#D4EAE0] transition-colors"
                            >
                              {p.tiktok_profile_pic_url && (
                                <img
                                  src={p.tiktok_profile_pic_url}
                                  alt=""
                                  className="w-5 h-5 rounded-full object-cover shrink-0"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                              <span className="text-[11px] font-semibold text-[#1F4D3A]">TikTok</span>
                              {p.tiktok_followers !== null && (
                                <span className="text-[11px] text-[#2E6B4F] font-bold">{fmt(p.tiktok_followers)}</span>
                              )}
                            </a>
                          )}
                          {p.instagram_handle && (
                            <a
                              href={`https://www.instagram.com/${p.instagram_handle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EEF2FD] hover:bg-[#DDE6FA] transition-colors"
                            >
                              {p.instagram_profile_pic_url && (
                                <img
                                  src={p.instagram_profile_pic_url}
                                  alt=""
                                  className="w-5 h-5 rounded-full object-cover shrink-0"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                              <span className="text-[11px] font-semibold text-[#4B6EC8]">Instagram</span>
                              {p.instagram_followers !== null && (
                                <span className="text-[11px] text-[#4B6EC8] font-bold">{fmt(p.instagram_followers)}</span>
                              )}
                            </a>
                          )}
                          {p.tiktok_followers !== null && p.instagram_followers !== null && (
                            <span className="text-[11px] text-[#A9AEA4] font-medium">
                              {fmt(combined)} combined
                            </span>
                          )}
                        </div>
                      )}

                      {/* Metric strip — always 3 columns, consistent across cards */}
                      <div className="grid grid-cols-3 mt-4 pt-4 border-t border-[#E8E9E6] divide-x divide-[#E8E9E6]">
                        {([
                          { label: 'Trends',   value: p.trends_count,   color: 'text-[#16181A]' },
                          { label: 'Ideas',    value: p.ideas_count,    color: 'text-[#16181A]' },
                          { label: 'Approved', value: p.approved_count, color: 'text-[#3F8F62]' },
                        ] as const).map((m) => (
                          <div key={m.label} className="flex flex-col items-center text-center px-1">
                            <p className={`text-[20px] font-bold leading-none ${m.value > 0 ? m.color : 'text-[#D4D7D0]'}`}>
                              {m.value > 0 ? m.value : '—'}
                            </p>
                            <p className="text-[10px] text-[#A9AEA4] uppercase tracking-[0.08em] font-semibold mt-1.5">{m.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Footer zone */}
                      <div className="mt-4">
                        <StageProgress status={p.status} />
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[11px] text-[#A9AEA4] font-medium">Step {stageIdx + 1} of {STAGES.length}</p>
                          <p className="text-[11px] text-[#A9AEA4]">
                            {new Date(p.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        </div>
                        {hasVel && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E8E9E6]">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[10px] text-[#A9AEA4] uppercase tracking-[0.08em] font-semibold">View velocity</p>
                              {vel.delta_pct !== null && (
                                <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${velUp ? 'bg-[#E8F2EC] text-[#2E6B4F]' : 'bg-red-50 text-red-500'}`}>
                                  {velUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                  {Math.abs(vel.delta_pct as number)}%
                                </span>
                              )}
                            </div>
                            <MiniSparkline data={vel.trend} up={velUp} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Right rail */}
        <aside className="w-72 shrink-0 hidden xl:flex flex-col gap-4 sticky top-4 self-start">

          <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Overview</p>
            <div className="flex flex-col gap-3">
              {overviewStats.map(({ value, label, icon: Icon }) => (
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

          {!loading && recentIdeas.length > 0 && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Recent ideas</p>
              <div className="flex flex-col">
                {recentIdeas.slice(0, 6).map((idea, i) => (
                  <div
                    key={idea.id}
                    onClick={() => router.push(`/project/${idea.project_id}`)}
                    className={`flex items-start gap-3 py-3 cursor-pointer group ${
                      i < Math.min(recentIdeas.length, 6) - 1 ? 'border-b border-[#E8E9E6]' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#16181A] truncate group-hover:text-[#2E6B4F] transition-colors leading-snug">
                        {idea.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-medium bg-[#E8F2EC] text-[#1F4D3A] px-2 py-0.5 rounded-full">
                          {idea.client_name}
                        </span>
                        {idea.status === 'approved' && (
                          <span className="text-[10px] font-medium bg-[#E8F2EC] text-[#2E6B4F] px-2 py-0.5 rounded-full">✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

      </div>

      {/* New project dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-[#E8E9E6]">
          <DialogHeader>
            <DialogTitle className="text-[#16181A]">New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="client-name" className="text-[#7C8278]">Client name</Label>
              <Input
                id="client-name"
                placeholder="e.g. Bloom Coffee Co."
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                className="bg-[#F3F4F2] border-[#E8E9E6] text-[#16181A] placeholder-[#A9AEA4] focus-visible:ring-[#2E6B4F]/30 focus-visible:border-[#2E6B4F]/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-[#E8E9E6] text-[#7C8278] hover:bg-[#F3F4F2] hover:text-[#16181A] bg-transparent">Cancel</Button>
            <Button onClick={handleCreate} disabled={!clientName.trim() || creating} className="bg-[#1F4D3A] text-white hover:bg-[#183D2E] font-semibold">
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit client dialog */}
      <Dialog open={!!editingProject} onOpenChange={(o) => !o && setEditingProject(null)}>
        <DialogContent className="bg-white border-[#E8E9E6]">
          <DialogHeader>
            <DialogTitle className="text-[#16181A]">Edit client</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name" className="text-[#7C8278]">Client name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="bg-[#F3F4F2] border-[#E8E9E6] text-[#16181A] focus-visible:ring-[#2E6B4F]/30 focus-visible:border-[#2E6B4F]/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-niche" className="text-[#7C8278]">Niche</Label>
              <Input
                id="edit-niche"
                placeholder="e.g. Specialty coffee, Fitness studio…"
                value={editNiche}
                onChange={(e) => setEditNiche(e.target.value)}
                className="bg-[#F3F4F2] border-[#E8E9E6] text-[#16181A] placeholder-[#A9AEA4] focus-visible:ring-[#2E6B4F]/30 focus-visible:border-[#2E6B4F]/50"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[#7C8278]">Platforms</Label>
              <div className="flex gap-2">
                {['tiktok', 'instagram'].map((pl) => (
                  <button
                    key={pl}
                    type="button"
                    onClick={() => toggleEditPlatform(pl)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      editPlatforms.includes(pl)
                        ? 'bg-[#1F4D3A] text-white border-[#1F4D3A]'
                        : 'bg-[#F3F4F2] text-[#7C8278] border-[#E8E9E6] hover:border-[#A9AEA4]'
                    }`}
                  >
                    {pl.charAt(0).toUpperCase() + pl.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)} className="border-[#E8E9E6] text-[#7C8278] hover:bg-[#F3F4F2] hover:text-[#16181A] bg-transparent">Cancel</Button>
            <Button onClick={handleSaveClient} disabled={!editName.trim() || saving} className="bg-[#1F4D3A] text-white hover:bg-[#183D2E] font-semibold">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(o) => !o && setDeletingProject(null)}>
        <DialogContent className="bg-white border-[#E8E9E6]">
          <DialogHeader>
            <DialogTitle className="text-[#16181A]">Delete project</DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-[#7C8278] py-2">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-[#16181A]">{deletingProject?.client_name}</span>?
            {' '}This will permanently remove all briefs, answers, trends, and ideas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProject(null)} className="border-[#E8E9E6] text-[#7C8278] hover:bg-[#F3F4F2] hover:text-[#16181A] bg-transparent">Cancel</Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white border-0"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
