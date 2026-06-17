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
  ArrowRight,
  Sparkles,
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
  intake:    'bg-[#F5F6FA] text-[#9A9AAE]',
  interview: 'bg-[#FEF6E9] text-[#C07800]',
  synthesis: 'bg-[#FEF6E9] text-[#C07800]',
  research:  'bg-[#E8F1FD] text-[#3A6FBF]',
  ideas:     'bg-[#EEEBFC] text-[#6C5CE7]',
  done:      'bg-[#E6F6EE] text-[#2A9A5E]',
};

function StageProgress({ status }: { status: string }) {
  const currentIdx = STAGES.indexOf(status);
  return (
    <div className="flex items-center gap-0.5 mt-3">
      {STAGES.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            i < currentIdx  ? 'bg-[#1B1B2F]' :
            i === currentIdx ? 'bg-[#6C5CE7]' :
                               'bg-[#ECEDF2]'
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
    if (data.project) {
      router.push(`/project/${data.project.id}`);
    }
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

  const totalIdeas    = projects.reduce((s, p) => s + p.ideas_count, 0);
  const totalTrends   = projects.reduce((s, p) => s + p.trends_count, 0);
  const activeCount   = projects.filter((p) => p.status !== 'done').length;
  const doneCount     = projects.filter((p) => p.status === 'done').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const overviewStats = [
    { value: projects.length, label: 'Clients',           icon: Users },
    { value: activeCount,     label: 'In progress',       icon: Layers },
    { value: doneCount,       label: 'Completed',         icon: CheckCircle2 },
    { value: totalIdeas,      label: 'Ideas generated',   icon: Lightbulb },
    { value: totalTrends,     label: 'Trends researched', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-[#E9EBF0]">
      <div className="flex gap-6 p-6 min-h-screen">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
        <aside className="w-60 shrink-0 sticky top-6 self-start h-[calc(100vh-48px)] bg-white rounded-[24px] shadow-[0_8px_24px_rgba(27,27,47,0.05)] flex flex-col overflow-hidden">
          <div className="flex flex-col flex-1 p-6">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-xl bg-[#EEEBFC] flex items-center justify-center shrink-0">
                <LayoutDashboard size={18} className="text-[#6C5CE7]" />
              </div>
              <span className="text-[15px] font-bold text-[#6C5CE7] tracking-tight">TrendForge</span>
            </div>

            {/* Nav group */}
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] px-3 mb-2">
                Workspace
              </p>
              <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-[#EEEBFC]">
                <LayoutDashboard size={20} className="text-[#6C5CE7] shrink-0" />
                <span className="text-[13px] font-semibold text-[#6C5CE7]">Dashboard</span>
              </div>
              <button
                onClick={() => router.push('/accounts')}
                className="flex items-center gap-3 h-11 px-3 rounded-xl text-[#6B6B80] hover:bg-[#F5F6FA] transition-colors w-full text-left"
              >
                <Users size={20} className="shrink-0" />
                <span className="text-[13px] font-medium">Accounts</span>
              </button>
            </div>

            {/* Footer: new project */}
            <div className="pt-4 border-t border-[#F0F1F5]">
              <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-[#6C5CE7] hover:bg-[#5B4BD6] text-white text-[13px] font-medium transition-colors"
              >
                <Plus size={16} />
                New project
              </button>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col gap-6">

          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#7B68F0] via-[#6C5CE7] to-[#5A48D6] p-8">
            {/* Decorative sparkle */}
            <Sparkles
              size={120}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/10 pointer-events-none"
            />
            <div className="relative">
              <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium text-white mb-4">
                Content Planning
              </span>
              <h1 className="text-[30px] font-bold text-white leading-tight mb-2">
                {greeting}.
              </h1>
              <p className="text-[14px] text-white/70 mb-6 max-w-sm">
                {loading
                  ? 'Loading your workspace…'
                  : projects.length === 0
                  ? 'Create your first project to get started.'
                  : `Here's where things stand across your clients.`}
              </p>
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 h-11 rounded-full bg-[#1B1B2F] hover:bg-[#2A2A40] text-white text-[13px] font-medium px-5 transition-colors"
              >
                New project
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Projects section */}
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em]">
                Projects
              </h2>
              {!loading && projects.length > 0 && (
                <span className="text-[11px] font-semibold text-[#6C5CE7] bg-[#EEEBFC] rounded-full px-2.5 py-0.5">
                  {projects.length}
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-[14px] text-[#9A9AAE]">Loading…</p>
            ) : projects.length === 0 ? (
              <div className="bg-white rounded-[24px] shadow-[0_8px_24px_rgba(27,27,47,0.05)] text-center py-16 px-6">
                <p className="text-[15px] font-semibold text-[#1B1B2F] mb-1">No projects yet</p>
                <p className="text-[14px] text-[#9A9AAE] mb-6">Create your first project to get started.</p>
                <button
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center gap-2 h-10 rounded-full bg-[#6C5CE7] hover:bg-[#5B4BD6] text-white text-[13px] font-medium px-5 transition-colors"
                >
                  <Plus size={15} />
                  New project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {projects.map((p) => {
                  const stageIdx = STAGES.indexOf(p.status);
                  const stageLabel = STAGE_LABELS[p.status] ?? p.status;
                  const stageStyle = STATUS_STYLES[p.status] ?? 'bg-[#F5F6FA] text-[#9A9AAE]';

                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/project/${p.id}`)}
                      className="bg-white rounded-[24px] p-6 shadow-[0_8px_24px_rgba(27,27,47,0.05)] cursor-pointer hover:shadow-[0_12px_32px_rgba(27,27,47,0.08)] transition-all duration-200 group flex flex-col"
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#1B1B2F] group-hover:text-[#6C5CE7] transition-colors leading-snug">
                            {p.client_name}
                          </p>
                          {p.niche && (
                            <p className="text-[13px] text-[#9A9AAE] mt-0.5 truncate">{p.niche}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#F5F6FA] text-[#9A9AAE] hover:text-[#6B6B80]"
                            title="Rename"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingProject(p); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-[#9A9AAE] hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                          <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${stageStyle}`}>
                            {stageLabel}
                          </span>
                        </div>
                      </div>

                      {/* Platforms */}
                      {p.platforms?.length > 0 && (
                        <div className="flex gap-1.5 mb-3">
                          {p.platforms.map((pl) => (
                            <span
                              key={pl}
                              className="text-[12px] bg-[#F5F6FA] text-[#6B6B80] px-2.5 py-0.5 rounded-full font-medium"
                            >
                              {pl.charAt(0).toUpperCase() + pl.slice(1)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Stats mini row */}
                      {(p.trends_count > 0 || p.ideas_count > 0) && (
                        <div className="flex items-center gap-4 mb-3 pt-3 border-t border-[#F0F1F5]">
                          {p.trends_count > 0 && (
                            <div>
                              <p className="text-[15px] font-bold text-[#6C5CE7]">{p.trends_count}</p>
                              <p className="text-[11px] text-[#9A9AAE] uppercase tracking-wide font-medium">Trends</p>
                            </div>
                          )}
                          {p.ideas_count > 0 && (
                            <div>
                              <p className="text-[15px] font-bold text-[#6C5CE7]">{p.ideas_count}</p>
                              <p className="text-[11px] text-[#9A9AAE] uppercase tracking-wide font-medium">Ideas</p>
                            </div>
                          )}
                          {p.approved_count > 0 && (
                            <div>
                              <p className="text-[15px] font-bold text-[#3DBE7A]">{p.approved_count}</p>
                              <p className="text-[11px] text-[#9A9AAE] uppercase tracking-wide font-medium">Approved</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stage progress */}
                      <div className="mt-auto">
                        <StageProgress status={p.status} />
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[12px] text-[#9A9AAE]">
                            Step {stageIdx + 1} of {STAGES.length}
                          </p>
                          <p className="text-[12px] text-[#9A9AAE]">
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

        {/* ── RIGHT RAIL ───────────────────────────────────────── */}
        <aside className="w-80 shrink-0 hidden xl:flex flex-col gap-5 sticky top-6 self-start">

          {/* Stats overview card */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_8px_24px_rgba(27,27,47,0.05)]">
            <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] mb-4">
              Overview
            </p>
            <div className="flex flex-col gap-3">
              {overviewStats.map(({ value, label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#EEEBFC] flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-[#6C5CE7]" />
                  </div>
                  <span className="text-[13px] text-[#6B6B80] flex-1">{label}</span>
                  <span className="text-[15px] font-bold text-[#1B1B2F]">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent ideas card */}
          {!loading && recentIdeas.length > 0 && (
            <div className="bg-white rounded-[24px] p-5 shadow-[0_8px_24px_rgba(27,27,47,0.05)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em]">
                  Recent ideas
                </p>
                <button
                  onClick={() => {}}
                  className="text-[12px] font-medium text-[#6C5CE7] hover:text-[#5B4BD6] transition-colors"
                >
                  See all
                </button>
              </div>
              <div className="flex flex-col">
                {recentIdeas.slice(0, 6).map((idea, i) => (
                  <div
                    key={idea.id}
                    onClick={() => router.push(`/project/${idea.project_id}`)}
                    className={`flex items-start gap-3 py-3 cursor-pointer group ${
                      i < recentIdeas.slice(0, 6).length - 1 ? 'border-b border-[#F0F1F5]' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1B1B2F] truncate group-hover:text-[#6C5CE7] transition-colors leading-snug">
                        {idea.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] font-medium bg-[#EEEBFC] text-[#6C5CE7] px-2 py-0.5 rounded-full">
                          {idea.client_name}
                        </span>
                        {idea.status === 'approved' && (
                          <span className="text-[11px] font-medium bg-[#E6F6EE] text-[#2A9A5E] px-2 py-0.5 rounded-full">
                            ✓
                          </span>
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

      {/* ── DIALOGS ──────────────────────────────────────────── */}

      {/* New project */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Client name</Label>
              <Input
                id="client-name"
                placeholder="e.g. Bloom Coffee Co."
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!clientName.trim() || creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit client */}
      <Dialog open={!!editingProject} onOpenChange={(o) => !o && setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Client name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-niche">Niche</Label>
              <Input
                id="edit-niche"
                placeholder="e.g. Specialty coffee, Fitness studio…"
                value={editNiche}
                onChange={(e) => setEditNiche(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Platforms</Label>
              <div className="flex gap-2">
                {['tiktok', 'instagram'].map((pl) => (
                  <button
                    key={pl}
                    type="button"
                    onClick={() => toggleEditPlatform(pl)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      editPlatforms.includes(pl)
                        ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]'
                        : 'bg-white text-[#6B6B80] border-[#ECEDF2] hover:border-[#9A9AAE]'
                    }`}
                  >
                    {pl.charAt(0).toUpperCase() + pl.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)}>Cancel</Button>
            <Button onClick={handleSaveClient} disabled={!editName.trim() || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deletingProject} onOpenChange={(o) => !o && setDeletingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-[#6B6B80] py-2">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-[#1B1B2F]">{deletingProject?.client_name}</span>?
            {' '}This will permanently remove all briefs, answers, trends, and ideas. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProject(null)}>Cancel</Button>
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
