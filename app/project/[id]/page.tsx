'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Pencil, ChevronRight } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

interface Profile {
  description: string;
  audience: string;
  positioning: string;
  offers: string;
  tone: string;
  contentGoals: string;
  filmingConstraints: string;
}

const PROFILE_FIELDS: { key: keyof Profile; label: string; hint: string }[] = [
  { key: 'description',        label: 'Business description',      hint: 'One-line summary of the client' },
  { key: 'audience',           label: 'Target audience',           hint: 'Who they are, age, location, pain points' },
  { key: 'positioning',        label: 'Positioning & differentiator', hint: 'What sets them apart from competitors' },
  { key: 'offers',             label: 'Offers & products',         hint: 'What to promote in content' },
  { key: 'tone',               label: 'Tone & brand personality',  hint: 'How the brand communicates' },
  { key: 'contentGoals',       label: 'Content goals',             hint: 'Awareness, footfall, sales, followers, etc.' },
  { key: 'filmingConstraints', label: 'Filming constraints',       hint: 'On-camera comfort, who films, gear, location, budget' },
];
import IntakeStage from './intake';
import InterviewStage from './interview';
import SynthesisStage from './synthesis';
import ResearchStage from './research';
import IdeasStage from './ideas';
import OutputStage from './output';

const STAGES = ['intake', 'interview', 'synthesis', 'research', 'ideas', 'done'] as const;
type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<Stage, string> = {
  intake:    'Brief',
  interview: 'Questions',
  synthesis: 'Profile',
  research:  'Research',
  ideas:     'Ideas',
  done:      'Export',
};

const STAGE_DESCRIPTIONS: Record<Stage, string> = {
  intake:    'Client brief & platforms',
  interview: 'Clarifying questions',
  synthesis: 'Business profile',
  research:  'Trend discovery',
  ideas:     'Content ideas',
  done:      'Download plan',
};

interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  status: string;
  created_at: string;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNiche, setEditNiche] = useState('');
  const [editPlatforms, setEditPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((d) => setProject(d.project ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  function onProjectUpdate(updated: Partial<Project>) {
    setProject((p) => (p ? { ...p, ...updated } : p));
  }

  function openEditClient() {
    if (!project) return;
    setEditName(project.client_name);
    setEditNiche(project.niche ?? '');
    setEditPlatforms(project.platforms ?? []);
    setEditingClient(true);
  }

  async function handleSaveClient() {
    if (!project || !editName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: editName.trim(),
        niche: editNiche.trim() || null,
        platforms: editPlatforms,
      }),
    });
    const data = await res.json();
    if (data.project) {
      setProject((p) => p ? { ...p, ...data.project } : p);
    }
    setSaving(false);
    setEditingClient(false);
  }

  async function openProfile() {
    setProfileOpen(true);
    if (profile) return;
    setProfileLoading(true);
    const res = await fetch(`/api/synthesis?project_id=${id}`);
    const data = await res.json();
    if (data.profile) setProfile(data.profile as Profile);
    setProfileLoading(false);
  }

  async function handleSaveProfile() {
    if (!profile) return;
    setProfileSaving(true);
    await fetch('/api/synthesis', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: id, profile }),
    });
    setProfileSaving(false);
    setProfileOpen(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[14px] text-[#9A9AAE]">
        Loading…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[14px] text-[#9A9AAE]">
        Project not found.
      </div>
    );
  }

  const stage = project.status as Stage;
  const stageIdx = STAGES.indexOf(stage);

  return (
    <div className="min-h-screen bg-[#E9EBF0] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white shadow-[0_2px_8px_rgba(27,27,47,0.04)] shrink-0">
        <div className="h-14 px-6 flex items-center gap-2">
          <Link
            href="/"
            className="text-[14px] font-bold text-[#6C5CE7] hover:text-[#5B4BD6] transition-colors"
          >
            TrendForge
          </Link>
          <ChevronRight size={14} className="text-[#ECEDF2]" />
          <span className="text-[14px] text-[#9A9AAE] truncate">{project.client_name}</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 bg-white shadow-[0_8px_24px_rgba(27,27,47,0.05)] sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col overflow-y-auto">
          {/* Client info */}
          <div className="px-5 py-5 border-b border-[#F0F1F5]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em]">
                Client
              </p>
              <button
                onClick={openEditClient}
                className="p-1 rounded-lg hover:bg-[#F5F6FA] text-[#9A9AAE] hover:text-[#6B6B80] transition-colors"
                title="Edit client"
              >
                <Pencil size={11} />
              </button>
            </div>
            <p className="text-[15px] font-semibold text-[#1B1B2F] leading-snug">{project.client_name}</p>
            {project.niche && (
              <p className="text-[13px] text-[#9A9AAE] mt-1">{project.niche}</p>
            )}
            {project.platforms?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {project.platforms.map((pl) => (
                  <span
                    key={pl}
                    className="text-[11px] bg-[#F5F6FA] text-[#6B6B80] px-2.5 py-0.5 rounded-full font-medium"
                  >
                    {pl.charAt(0).toUpperCase() + pl.slice(1)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Business profile button */}
          {stageIdx >= 3 && (
            <div className="px-5 py-3 border-b border-[#F0F1F5]">
              <button
                onClick={openProfile}
                className="w-full flex items-center justify-between text-[13px] font-medium text-[#6B6B80] hover:text-[#1B1B2F] transition-colors group"
              >
                <span>Business profile</span>
                <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}

          {/* Stage nav */}
          <nav className="flex-1 px-3 py-5 space-y-1">
            <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] px-3 mb-3">
              Workflow
            </p>
            {STAGES.map((s, i) => {
              const isActive = s === stage;
              const isPast = stageIdx > i;

              return (
                <div
                  key={s}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-[#EEEBFC] text-[#6C5CE7]'
                      : isPast
                      ? 'text-[#6B6B80] hover:bg-[#F5F6FA]'
                      : 'text-[#9A9AAE]'
                  }`}
                >
                  {/* Step indicator */}
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isActive
                        ? 'bg-[#6C5CE7] text-white'
                        : isPast
                        ? 'bg-[#E6F6EE] text-[#2A9A5E]'
                        : 'bg-[#F5F6FA] text-[#9A9AAE]'
                    }`}
                  >
                    {isPast ? '✓' : i + 1}
                  </span>

                  <div className="min-w-0">
                    <p className={`text-[13px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                      {STAGE_LABELS[s]}
                    </p>
                    <p className={`text-[11px] mt-0.5 truncate ${
                      isActive ? 'text-[#8B7FD4]' : 'text-[#9A9AAE]'
                    }`}>
                      {STAGE_DESCRIPTIONS[s]}
                    </p>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-8 py-10">
            {/* Stage heading */}
            <div className="mb-8">
              <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] mb-1.5">
                Step {stageIdx + 1} of {STAGES.length}
              </p>
              <h1 className="text-[22px] font-bold text-[#1B1B2F]">
                {STAGE_LABELS[stage]}
              </h1>
            </div>

            {stage === 'intake' && (
              <IntakeStage project={project} onUpdate={onProjectUpdate} />
            )}
            {stage === 'interview' && (
              <InterviewStage projectId={id} onUpdate={onProjectUpdate} />
            )}
            {stage === 'synthesis' && (
              <SynthesisStage projectId={id} onUpdate={onProjectUpdate} />
            )}
            {stage === 'research' && (
              <ResearchStage projectId={id} onUpdate={onProjectUpdate} />
            )}
            {stage === 'ideas' && (
              <IdeasStage projectId={id} onUpdate={onProjectUpdate} />
            )}
            {stage === 'done' && (
              <OutputStage projectId={id} onUpdate={onProjectUpdate} />
            )}
          </div>
        </main>
      </div>

      {/* Business profile dialog */}
      <Dialog open={profileOpen} onOpenChange={(o) => !o && setProfileOpen(false)}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Business profile</DialogTitle>
          </DialogHeader>
          {profileLoading ? (
            <p className="text-[14px] text-[#9A9AAE] py-6 text-center">Loading…</p>
          ) : !profile ? (
            <p className="text-[14px] text-[#9A9AAE] py-6 text-center">No profile found.</p>
          ) : (
            <div className="grid gap-5 py-2">
              {PROFILE_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`profile-${key}`} className="text-[13px] font-semibold text-[#1B1B2F]">
                    {label}
                  </Label>
                  <p className="text-[12px] text-[#9A9AAE]">{hint}</p>
                  <Textarea
                    id={`profile-${key}`}
                    rows={key === 'description' ? 2 : 3}
                    value={profile[key]}
                    onChange={(e) => setProfile((p) => p ? { ...p, [key]: e.target.value } : p)}
                    className="resize-y"
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} disabled={!profile || profileSaving}>
              {profileSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit client dialog */}
      <Dialog open={editingClient} onOpenChange={(o) => !o && setEditingClient(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="proj-edit-name">Client name</Label>
              <Input
                id="proj-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-edit-niche">Niche</Label>
              <Input
                id="proj-edit-niche"
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
                    onClick={() =>
                      setEditPlatforms((prev) =>
                        prev.includes(pl) ? prev.filter((x) => x !== pl) : [...prev, pl]
                      )
                    }
                    className={`px-4 py-2 rounded-full text-[13px] font-medium border transition-colors ${
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
            <Button variant="outline" onClick={() => setEditingClient(false)}>Cancel</Button>
            <Button onClick={handleSaveClient} disabled={!editName.trim() || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
