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
  intake:    'bg-[#252629] text-[#6B7280]',
  interview: 'bg-[#2A2200] text-[#FCD34D]',
  synthesis: 'bg-[#2A1800] text-[#F59E0B]',
  research:  'bg-[#001830] text-[#60A5FA]',
  ideas:     'bg-[rgba(170,255,0,0.1)] text-[#AAFF00]',
  done:      'bg-[rgba(52,211,153,0.1)] text-[#34D399]',
};

function StageProgress({ status }: { status: string }) {
  const currentIdx = STAGES.indexOf(status);
  return (
    <div className="flex items-center gap-0.5 mt-3">
      {STAGES.map((s, i) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition-all ${
            i < currentIdx  ? 'bg-[#AAFF00]/50' :
            i === currentIdx ? 'bg-[#AAFF00]' :
                               'bg-[#2C2D33]'
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

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/ideas/recent').then((r) => r.json()),
    ]).then(([projectsData, ideasData]) => {
      setProjects(projectsData.projects ?? []);
      setRecentIdeas(ideasData.ideas ?? []);
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
    { value: projects.length, label: 'Total clients',    icon: Users },
    { value: activeCount,     label: 'Active projects',  icon: Layers },
    { value: totalIdeas,      label: 'Ideas generated',  icon: Lightbulb },
    { value: doneCount,       label: 'Completed',        icon: CheckCircle2 },
  ];

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
              <div className="flex items-center gap-3 h-10 px-3 rounded-xl bg-[#AAFF00] shadow-[0_0_20px_rgba(170,255,0,0.25)]">
                <LayoutDashboard size={16} className="text-black shrink-0" />
                <span className="text-[13px] font-semibold text-black">Dashboard</span>
              </div>
              <button
                onClick={() => router.push('/accounts')}
                className="flex items-center gap-3 h-10 px-3 rounded-xl text-[#8B8C99] hover:bg-[#252629] hover:text-white transition-colors w-full text-left"
              >
                <Users size={16} className="shrink-0" />
                <span className="text-[13px] font-medium">Accounts</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#2C2D33]">
              <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#AAFF00] hover:bg-[#99EE00] text-black text-[13px] font-semibold transition-colors"
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
            {topStatCards.map(({ value, label, icon: Icon }) => (
              <div key={label} className="grain bg-gradient-to-b from-[#222429] to-[#1A1B1E] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[12px] text-[#8B8C99]">{label}</p>
                  <div className="w-7 h-7 rounded-lg bg-[rgba(170,255,0,0.08)] flex items-center justify-center">
                    <Icon size={13} className="text-[#AAFF00]" />
                  </div>
                </div>
                <p className="text-[32px] font-bold text-white leading-none">{loading ? '—' : value}</p>
              </div>
            ))}
          </div>

          {/* Projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em]">
                Projects
              </h2>
              {!loading && projects.length > 0 && (
                <span className="text-[10px] font-semibold text-[#AAFF00] bg-[rgba(170,255,0,0.08)] rounded-full px-2.5 py-0.5">
                  {projects.length}
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-[14px] text-[#8B8C99]">Loading…</p>
            ) : projects.length === 0 ? (
              <div className="grain bg-[#1E1F23] rounded-[20px] border border-[#2C2D33] text-center py-16 px-6 shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[15px] font-semibold text-white mb-1">No projects yet</p>
                <p className="text-[13px] text-[#8B8C99] mb-6">Create your first project to get started.</p>
                <button
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#AAFF00] hover:bg-[#99EE00] text-black text-[13px] font-semibold px-5 transition-colors"
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
                  const stageStyle = STATUS_STYLES[p.status] ?? 'bg-[#252629] text-[#8B8C99]';

                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/project/${p.id}`)}
                      className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] cursor-pointer hover:border-[rgba(170,255,0,0.3)] hover:shadow-[0_4px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(170,255,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-[#222326] transition-all duration-200 group flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-white group-hover:text-[#AAFF00] transition-colors leading-snug">
                            {p.client_name}
                          </p>
                          {p.niche && (
                            <p className="text-[13px] text-[#8B8C99] mt-0.5 truncate">{p.niche}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#2C2D33] text-[#4A4B55] hover:text-[#8B8C99]"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingProject(p); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-[#4A4B55] hover:text-red-400"
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
                            <span key={pl} className="text-[11px] bg-[#252629] text-[#8B8C99] px-2.5 py-0.5 rounded-full font-medium">
                              {pl.charAt(0).toUpperCase() + pl.slice(1)}
                            </span>
                          ))}
                        </div>
                      )}

                      {(p.trends_count > 0 || p.ideas_count > 0) && (
                        <div className="flex items-center gap-4 mb-3 pt-3 border-t border-[#2C2D33]">
                          {p.trends_count > 0 && (
                            <div>
                              <p className="text-[16px] font-bold text-[#AAFF00]">{p.trends_count}</p>
                              <p className="text-[10px] text-[#4A4B55] uppercase tracking-wide font-medium">Trends</p>
                            </div>
                          )}
                          {p.ideas_count > 0 && (
                            <div>
                              <p className="text-[16px] font-bold text-[#AAFF00]">{p.ideas_count}</p>
                              <p className="text-[10px] text-[#4A4B55] uppercase tracking-wide font-medium">Ideas</p>
                            </div>
                          )}
                          {p.approved_count > 0 && (
                            <div>
                              <p className="text-[16px] font-bold text-[#34D399]">{p.approved_count}</p>
                              <p className="text-[10px] text-[#4A4B55] uppercase tracking-wide font-medium">Approved</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-auto">
                        <StageProgress status={p.status} />
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[11px] text-[#4A4B55]">Step {stageIdx + 1} of {STAGES.length}</p>
                          <p className="text-[11px] text-[#4A4B55]">
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

          <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em] mb-4">Overview</p>
            <div className="flex flex-col gap-3">
              {overviewStats.map(({ value, label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(170,255,0,0.08)] flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-[#AAFF00]" />
                  </div>
                  <span className="text-[13px] text-[#8B8C99] flex-1">{label}</span>
                  <span className="text-[15px] font-bold text-white">{loading ? '—' : value}</span>
                </div>
              ))}
            </div>
          </div>

          {!loading && recentIdeas.length > 0 && (
            <div className="grain bg-[#1E1F23] rounded-[20px] p-5 border border-[#2C2D33] shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[10px] font-semibold text-[#4A4B55] uppercase tracking-[0.1em] mb-4">Recent ideas</p>
              <div className="flex flex-col">
                {recentIdeas.slice(0, 6).map((idea, i) => (
                  <div
                    key={idea.id}
                    onClick={() => router.push(`/project/${idea.project_id}`)}
                    className={`flex items-start gap-3 py-3 cursor-pointer group ${
                      i < Math.min(recentIdeas.length, 6) - 1 ? 'border-b border-[#2C2D33]' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#C8C9D0] truncate group-hover:text-[#AAFF00] transition-colors leading-snug">
                        {idea.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-medium bg-[rgba(170,255,0,0.08)] text-[#AAFF00] px-2 py-0.5 rounded-full">
                          {idea.client_name}
                        </span>
                        {idea.status === 'approved' && (
                          <span className="text-[10px] font-medium bg-[rgba(52,211,153,0.1)] text-[#34D399] px-2 py-0.5 rounded-full">✓</span>
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
        <DialogContent className="bg-[#1E1F23] border-[#2C2D33]">
          <DialogHeader>
            <DialogTitle className="text-white">New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="client-name" className="text-[#8B8C99]">Client name</Label>
              <Input
                id="client-name"
                placeholder="e.g. Bloom Coffee Co."
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                className="bg-[#252629] border-[#2C2D33] text-white placeholder-[#4A4B55] focus-visible:ring-[#AAFF00]/30 focus-visible:border-[#AAFF00]/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-[#2C2D33] text-[#8B8C99] hover:bg-[#252629] hover:text-white bg-transparent">Cancel</Button>
            <Button onClick={handleCreate} disabled={!clientName.trim() || creating} className="bg-[#AAFF00] text-black hover:bg-[#99EE00] font-semibold">
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit client dialog */}
      <Dialog open={!!editingProject} onOpenChange={(o) => !o && setEditingProject(null)}>
        <DialogContent className="bg-[#1E1F23] border-[#2C2D33]">
          <DialogHeader>
            <DialogTitle className="text-white">Edit client</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name" className="text-[#8B8C99]">Client name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="bg-[#252629] border-[#2C2D33] text-white focus-visible:ring-[#AAFF00]/30 focus-visible:border-[#AAFF00]/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-niche" className="text-[#8B8C99]">Niche</Label>
              <Input
                id="edit-niche"
                placeholder="e.g. Specialty coffee, Fitness studio…"
                value={editNiche}
                onChange={(e) => setEditNiche(e.target.value)}
                className="bg-[#252629] border-[#2C2D33] text-white placeholder-[#4A4B55] focus-visible:ring-[#AAFF00]/30 focus-visible:border-[#AAFF00]/50"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[#8B8C99]">Platforms</Label>
              <div className="flex gap-2">
                {['tiktok', 'instagram'].map((pl) => (
                  <button
                    key={pl}
                    type="button"
                    onClick={() => toggleEditPlatform(pl)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      editPlatforms.includes(pl)
                        ? 'bg-[#AAFF00] text-black border-[#AAFF00]'
                        : 'bg-[#252629] text-[#8B8C99] border-[#2C2D33] hover:border-[#4A4B55]'
                    }`}
                  >
                    {pl.charAt(0).toUpperCase() + pl.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)} className="border-[#2C2D33] text-[#8B8C99] hover:bg-[#252629] hover:text-white bg-transparent">Cancel</Button>
            <Button onClick={handleSaveClient} disabled={!editName.trim() || saving} className="bg-[#AAFF00] text-black hover:bg-[#99EE00] font-semibold">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(o) => !o && setDeletingProject(null)}>
        <DialogContent className="bg-[#1E1F23] border-[#2C2D33]">
          <DialogHeader>
            <DialogTitle className="text-white">Delete project</DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-[#8B8C99] py-2">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-white">{deletingProject?.client_name}</span>?
            {' '}This will permanently remove all briefs, answers, trends, and ideas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProject(null)} className="border-[#2C2D33] text-[#8B8C99] hover:bg-[#252629] hover:text-white bg-transparent">Cancel</Button>
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
