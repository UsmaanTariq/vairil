'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  status: string;
  created_at: string;
  ideas_count: number;
  approved_count: number;
  trends_count: number;
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

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/ideas/recent').then((r) => r.json()),
      fetch('/api/analytics/combined-views').then((r) => r.json()),
    ]).then(([projectsData, ideasData, trendData]) => {
      setProjects(projectsData.projects ?? []);
      setRecentIdeas(ideasData.ideas ?? []);
      setCombinedTrend(trendData.trend ?? []);
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

  const topStatCards = [
    { value: projects.length, label: 'Total clients',    icon: Users,        hero: true },
    { value: activeCount,     label: 'Active projects',  icon: Layers,       hero: false },
    { value: totalIdeas,      label: 'Ideas generated',  icon: Lightbulb,    hero: false },
    { value: doneCount,       label: 'Completed',        icon: CheckCircle2, hero: false },
  ];

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

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {topStatCards.map(({ value, label, icon: Icon, hero }) => (
              <div
                key={label}
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
                <p className={`text-[32px] font-bold leading-none ${hero ? 'text-white' : 'text-[#16181A]'}`}>
                  {loading ? '—' : value}
                </p>
              </div>
            ))}
          </div>

          {/* Combined views chart */}
          {combinedTrend.length >= 2 && (
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Combined views (TikTok + Instagram)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={combinedTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#A9AEA4' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#A9AEA4' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #E8E9E6', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#16181A', fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="views" stroke="#1F4D3A" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#1F4D3A' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em]">
                Projects
              </h2>
              {!loading && projects.length > 0 && (
                <span className="text-[10px] font-semibold text-[#2E6B4F] bg-[#E8F2EC] rounded-full px-2.5 py-0.5">
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
                  const stageIdx   = STAGES.indexOf(p.status);
                  const stageLabel = STAGE_LABELS[p.status] ?? p.status;
                  const stageStyle = STATUS_STYLES[p.status] ?? 'bg-[#F0F1EE] text-[#7C8278]';

                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/project/${p.id}`)}
                      className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)] cursor-pointer hover:border-[#3F8F62]/40 hover:shadow-[0_4px_24px_rgba(31,77,58,0.10)] hover:bg-[#FAFBFA] transition-all duration-200 group flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#16181A] group-hover:text-[#2E6B4F] transition-colors leading-snug">
                            {p.client_name}
                          </p>
                          {p.niche && (
                            <p className="text-[13px] text-[#7C8278] mt-0.5 truncate">{p.niche}</p>
                          )}
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

                      {p.platforms?.length > 0 && (
                        <div className="flex gap-1.5 mb-3">
                          {p.platforms.map((pl) => (
                            <span key={pl} className="text-[11px] bg-[#F0F1EE] text-[#7C8278] px-2.5 py-0.5 rounded-full font-medium">
                              {pl.charAt(0).toUpperCase() + pl.slice(1)}
                            </span>
                          ))}
                        </div>
                      )}

                      {(p.trends_count > 0 || p.ideas_count > 0) && (
                        <div className="flex items-center gap-4 mb-3 pt-3 border-t border-[#E8E9E6]">
                          {p.trends_count > 0 && (
                            <div>
                              <p className="text-[16px] font-bold text-[#2E6B4F]">{p.trends_count}</p>
                              <p className="text-[10px] text-[#A9AEA4] uppercase tracking-wide font-medium">Trends</p>
                            </div>
                          )}
                          {p.ideas_count > 0 && (
                            <div>
                              <p className="text-[16px] font-bold text-[#2E6B4F]">{p.ideas_count}</p>
                              <p className="text-[10px] text-[#A9AEA4] uppercase tracking-wide font-medium">Ideas</p>
                            </div>
                          )}
                          {p.approved_count > 0 && (
                            <div>
                              <p className="text-[16px] font-bold text-[#3F8F62]">{p.approved_count}</p>
                              <p className="text-[10px] text-[#A9AEA4] uppercase tracking-wide font-medium">Approved</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-auto">
                        <StageProgress status={p.status} />
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[11px] text-[#A9AEA4]">Step {stageIdx + 1} of {STAGES.length}</p>
                          <p className="text-[11px] text-[#A9AEA4]">
                            {new Date(p.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        </div>
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
