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
import { Pencil, Trash2 } from 'lucide-react';

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
  intake:    'bg-neutral-100 text-neutral-500',
  interview: 'bg-amber-50 text-amber-700 border border-amber-200',
  synthesis: 'bg-amber-50 text-amber-700 border border-amber-200',
  research:  'bg-blue-50 text-blue-700 border border-blue-200',
  ideas:     'bg-violet-50 text-violet-700 border border-violet-200',
  done:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

function StageProgress({ status }: { status: string }) {
  const currentIdx = STAGES.indexOf(status);
  return (
    <div className="flex items-center gap-0.5 mt-3">
      {STAGES.map((s, i) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full ${
            i < currentIdx  ? 'bg-neutral-400' :
            i === currentIdx ? 'bg-violet-600' :
                               'bg-neutral-200'
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
  const totalApproved = projects.reduce((s, p) => s + p.approved_count, 0);
  const totalTrends   = projects.reduce((s, p) => s + p.trends_count, 0);
  const activeCount   = projects.filter((p) => p.status !== 'done').length;
  const doneCount     = projects.filter((p) => p.status === 'done').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-bold text-violet-600">TrendForge</span>
          <Button size="sm" onClick={() => setOpen(true)}>+ New project</Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Welcome section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-neutral-950 mb-1">{greeting}.</h1>
          <p className="text-neutral-400">
            {loading
              ? 'Loading your workspace…'
              : projects.length === 0
              ? 'Create your first project to get started.'
              : `Here's where things stand across your clients.`}
          </p>
        </div>

        {/* Stats row — only shown once there's data */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
            {[
              { value: projects.length, label: 'Clients' },
              { value: activeCount,     label: 'In progress' },
              { value: doneCount,       label: 'Completed' },
              { value: totalIdeas,      label: 'Ideas generated' },
              { value: totalTrends,     label: 'Trends researched' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
                <p className="text-2xl font-bold text-violet-600">{value}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Section heading */}
        {!loading && projects.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">
              Projects
            </h2>
          </div>
        )}


        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl text-center py-20 px-6">
            <p className="text-base font-semibold text-neutral-950 mb-1">No projects yet</p>
            <p className="text-sm text-neutral-400 mb-6">Create your first project to get started.</p>
            <Button onClick={() => setOpen(true)}>+ New project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const stageIdx = STAGES.indexOf(p.status);
              const stageLabel = STAGE_LABELS[p.status] ?? p.status;
              const stageStyle = STATUS_STYLES[p.status] ?? 'bg-neutral-100 text-neutral-500';

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/project/${p.id}`)}
                  className="bg-white border border-neutral-200 rounded-xl p-5 cursor-pointer hover:border-neutral-400 hover:shadow-md transition-all duration-150 group flex flex-col"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-neutral-950 group-hover:text-neutral-700 transition-colors leading-snug">
                        {p.client_name}
                      </p>
                      {p.niche && (
                        <p className="text-sm text-neutral-400 mt-0.5 truncate">{p.niche}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(p);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
                        title="Rename"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProject(p);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-50 text-neutral-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageStyle}`}>
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
                          className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full"
                        >
                          {pl.charAt(0).toUpperCase() + pl.slice(1)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  {(p.trends_count > 0 || p.ideas_count > 0) && (
                    <div className="flex items-center gap-3 mb-3 pt-2 border-t border-neutral-100">
                      {p.trends_count > 0 && (
                        <div className="text-center">
                          <p className="text-base font-bold text-violet-600">{p.trends_count}</p>
                          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Trends</p>
                        </div>
                      )}
                      {p.ideas_count > 0 && (
                        <div className="text-center">
                          <p className="text-base font-bold text-violet-600">{p.ideas_count}</p>
                          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Ideas</p>
                        </div>
                      )}
                      {p.approved_count > 0 && (
                        <div className="text-center">
                          <p className="text-base font-bold text-emerald-600">{p.approved_count}</p>
                          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Approved</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stage mini-steps */}
                  <div className="mt-auto">
                    <StageProgress status={p.status} />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-neutral-400">
                        Step {stageIdx + 1} of {STAGES.length}
                      </p>
                      <p className="text-xs text-neutral-400">
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

        {/* Recent ideas */}
        {!loading && recentIdeas.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">
              Recent ideas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentIdeas.map((idea) => (
                <div
                  key={idea.id}
                  onClick={() => router.push(`/project/${idea.project_id}`)}
                  className="bg-white border border-neutral-200 rounded-xl p-4 cursor-pointer hover:border-violet-300 hover:shadow-sm transition-all duration-150 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-neutral-950 leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">
                      {idea.title}
                    </p>
                    {idea.status === 'approved' && (
                      <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                        ✓ Approved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2 mb-3">
                    {idea.hook}
                  </p>
                  <span className="text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
                    {idea.client_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New project dialog */}
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

      {/* Edit client dialog */}
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
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500'
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(o) => !o && setDeletingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-500 py-2">
            Are you sure you want to delete <span className="font-semibold text-neutral-950">{deletingProject?.client_name}</span>? This will permanently remove all briefs, answers, trends, and ideas. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProject(null)}>Cancel</Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
