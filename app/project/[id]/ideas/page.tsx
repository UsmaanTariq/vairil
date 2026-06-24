'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useProject } from '../project-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GenerationProgress } from '@/components/generation-progress';
import { IDEAS_GENERATION_STEPS } from '@/lib/generation-steps';

interface Idea {
  id: string;
  title: string;
  trendRef: string;
  hook: string;
  script: string;
  shotList: string[];
  audio?: string;
  caption: string;
  hashtags: string[];
  why: string;
  status: 'new' | 'approved' | 'rejected';
  feedbackReason: string | null;
}

type ViewFilter = 'new' | 'approved' | 'rejected';

const DISLIKE_REASONS = ['too generic', 'off-brand', 'not my style', 'seen it before'];

export default function IdeasPage() {
  const { project } = useProject();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<ViewFilter>('new');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dislikePickerId, setDislikePickerId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  // Inline editing of a generated idea
  interface EditDraft {
    title: string;
    hook: string;
    script: string;
    shotListText: string;
    audio: string;
    caption: string;
    hashtagsText: string;
    why: string;
  }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(idea: Idea) {
    setEditingId(idea.id);
    setDraft({
      title: idea.title,
      hook: idea.hook,
      script: idea.script,
      shotListText: idea.shotList.join('\n'),
      audio: idea.audio ?? '',
      caption: idea.caption,
      hashtagsText: idea.hashtags.join(', '),
      why: idea.why,
    });
  }

  async function handleSaveEdit() {
    if (!editingId || !draft) return;
    setSavingEdit(true);
    setError('');
    const shotList = draft.shotListText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const hashtags = draft.hashtagsText
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
    const audio = draft.audio.trim();
    try {
      const res = await fetch(`/api/ideas/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          hook: draft.hook,
          script: draft.script,
          shotList,
          audio: audio || null,
          caption: draft.caption,
          hashtags,
          why: draft.why,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to save changes');
      }
      setIdeas((prev) =>
        prev.map((i) =>
          i.id === editingId
            ? {
                ...i,
                title: draft.title.trim(),
                hook: draft.hook,
                script: draft.script,
                shotList,
                audio: audio || undefined,
                caption: draft.caption,
                hashtags,
                why: draft.why,
              }
            : i
        )
      );
      setEditingId(null);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSavingEdit(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch(`/api/ideas?project_id=${project.id}`);
        const d = await r.json();
        if (mounted && d.ideas) setIdeas(d.ideas as Idea[]);
      } catch {
        if (mounted) setError('Failed to load ideas');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [project.id]);

  async function refetchIdeas() {
    try {
      const r = await fetch(`/api/ideas?project_id=${project.id}`);
      const d = await r.json();
      if (d.ideas) setIdeas(d.ideas as Idea[]);
    } catch {
      setError('Failed to reload ideas');
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate ideas');
      // POST returns only new batch; re-fetch full list
      await refetchIdeas();
      setView('new');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(idea: Idea) {
    setPendingId(idea.id);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      setIdeas((prev) =>
        prev.map((i) => (i.id === idea.id ? { ...i, status: 'approved' } : i))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDislike(idea: Idea, reason: string | null) {
    setPendingId(idea.id);
    setDislikePickerId(null);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', feedback_reason: reason }),
      });
      if (!res.ok) throw new Error('Failed to dislike');
      setIdeas((prev) =>
        prev.map((i) =>
          i.id === idea.id ? { ...i, status: 'rejected', feedbackReason: reason } : i
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPendingId(null);
    }
  }

  async function handleMoveToNew(idea: Idea, clearReason = false) {
    setPendingId(idea.id);
    try {
      const body: Record<string, unknown> = { status: 'new' };
      if (clearReason) body.feedback_reason = null;
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setIdeas((prev) =>
        prev.map((i) =>
          i.id === idea.id
            ? { ...i, status: 'new', feedbackReason: clearReason ? null : i.feedbackReason }
            : i
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPendingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = filenameMatch?.[1] ?? 'trendforge-export.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading ideas…</p>
      </div>
    );
  }

  if (generating) {
    return (
      <GenerationProgress
        active
        steps={IDEAS_GENERATION_STEPS}
        title="Generating content ideas"
        estimate="usually 45–90 seconds"
      />
    );
  }

  const newCount = ideas.filter((i) => i.status === 'new').length;
  const approvedCount = ideas.filter((i) => i.status === 'approved').length;
  const rejectedCount = ideas.filter((i) => i.status === 'rejected').length;

  const visibleIdeas = ideas.filter((i) => i.status === view);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">Content ideas</h3>
          <p className="text-sm text-muted-foreground">
            {ideas.length > 0
              ? `${ideas.length} idea${ideas.length !== 1 ? 's' : ''} total`
              : 'No ideas yet.'}
          </p>
        </div>
        {approvedCount > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export approved'}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {exportError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3">
          <p className="text-sm text-destructive">{exportError}</p>
        </div>
      )}

      {/* Empty state */}
      {ideas.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-muted-foreground text-sm">No ideas yet — generate some to get started.</p>
          <Button onClick={handleGenerate} disabled={generating}>
            Generate ideas
          </Button>
        </div>
      )}

      {ideas.length > 0 && (
        <>
          {/* View filter */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={view === 'new' ? 'default' : 'outline'}
              onClick={() => setView('new')}
            >
              New {newCount > 0 && <span className="ml-1.5 text-xs opacity-70">({newCount})</span>}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'approved' ? 'default' : 'outline'}
              onClick={() => setView('approved')}
            >
              Approved {approvedCount > 0 && <span className="ml-1.5 text-xs opacity-70">({approvedCount})</span>}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'rejected' ? 'default' : 'outline'}
              onClick={() => setView('rejected')}
            >
              Disliked {rejectedCount > 0 && <span className="ml-1.5 text-xs opacity-70">({rejectedCount})</span>}
            </Button>
          </div>

          {/* Cards */}
          {visibleIdeas.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {view === 'new'
                  ? 'No new ideas — generate more below.'
                  : view === 'approved'
                    ? 'No approved ideas yet — approve some from the New tab.'
                    : 'No disliked ideas.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {visibleIdeas.map((idea) => {
                const isPending = pendingId === idea.id;
                const showDislikePicker = dislikePickerId === idea.id;

                return (
                  <Card
                    key={idea.id}
                    className={`border transition-colors ${
                      idea.status === 'approved'
                        ? 'border-emerald-500/40'
                        : idea.status === 'rejected'
                          ? 'border-destructive/30'
                          : 'border-border'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base font-semibold leading-snug">
                          {idea.title}
                        </CardTitle>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {idea.trendRef}
                          </Badge>
                          {idea.status === 'approved' && (
                            <Badge variant="secondary" className="text-xs text-emerald-500">
                              Approved
                            </Badge>
                          )}
                          {idea.status === 'rejected' && (
                            <Badge variant="secondary" className="text-xs text-destructive">
                              Disliked
                            </Badge>
                          )}
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => openEdit(idea)}
                            disabled={isPending}
                            aria-label="Edit idea"
                            className="text-muted-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5 text-sm">
                      {/* Hook */}
                      <div className="rounded-md bg-muted px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Hook — first 3 seconds
                        </p>
                        <p className="text-foreground font-medium leading-snug">{idea.hook}</p>
                      </div>

                      {/* Script */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                          Script / voiceover
                        </p>
                        <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {idea.script}
                        </p>
                      </div>

                      {/* Shot list */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                          Shot list
                        </p>
                        <ol className="space-y-1">
                          {idea.shotList.map((shot, j) => (
                            <li key={j} className="flex gap-2 text-foreground/80">
                              <span className="shrink-0 text-muted-foreground font-mono text-xs mt-0.5">
                                {String(j + 1).padStart(2, '0')}
                              </span>
                              <span>{shot}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Audio */}
                      {idea.audio && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                            Audio / sound
                          </p>
                          <p className="text-muted-foreground">{idea.audio}</p>
                        </div>
                      )}

                      {/* Caption */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Caption
                        </p>
                        <p className="text-foreground/80">{idea.caption}</p>
                        {idea.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {idea.hashtags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
                              >
                                {tag.startsWith('#') ? tag : `#${tag}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Why it works */}
                      <div className="border-t border-border pt-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                          Why this works
                        </p>
                        <p className="text-muted-foreground italic">{idea.why}</p>
                      </div>

                      {/* Disliked: show feedback reason */}
                      {idea.status === 'rejected' && idea.feedbackReason && (
                        <div className="pt-1">
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {idea.feedbackReason}
                          </Badge>
                        </div>
                      )}

                      {/* Per-card actions */}
                      <div className="border-t border-border pt-3 space-y-3">
                        {idea.status === 'new' && (
                          <>
                            {showDislikePicker ? (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">Why not this one?</p>
                                <div className="flex flex-wrap gap-2">
                                  {DISLIKE_REASONS.map((reason) => (
                                    <Button
                                      key={reason}
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={isPending}
                                      onClick={() => handleDislike(idea, reason)}
                                      className="text-xs h-7"
                                    >
                                      {reason}
                                    </Button>
                                  ))}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={isPending}
                                    onClick={() => handleDislike(idea, null)}
                                    className="text-xs h-7 text-muted-foreground"
                                  >
                                    Skip
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={isPending}
                                    onClick={() => setDislikePickerId(null)}
                                    className="text-xs h-7 text-muted-foreground"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApprove(idea)}
                                  disabled={isPending}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                >
                                  {isPending ? '…' : 'Approve'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDislikePickerId(idea.id)}
                                  disabled={isPending}
                                >
                                  Dislike
                                </Button>
                              </div>
                            )}
                          </>
                        )}

                        {idea.status === 'approved' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleMoveToNew(idea)}
                            disabled={isPending}
                            className="text-muted-foreground"
                          >
                            {isPending ? '…' : 'Move to New'}
                          </Button>
                        )}

                        {idea.status === 'rejected' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleMoveToNew(idea, true)}
                            disabled={isPending}
                            className="text-muted-foreground"
                          >
                            {isPending ? '…' : 'Restore'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Separator />

          {/* Generate more */}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
            >
              Generate more ideas
            </Button>
          </div>
        </>
      )}

      {/* Edit idea dialog */}
      <Dialog
        open={!!editingId}
        onOpenChange={(o) => {
          if (!o) {
            setEditingId(null);
            setDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit idea</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-hook">Hook (first 3 seconds)</Label>
                <Textarea
                  id="edit-hook"
                  rows={2}
                  value={draft.hook}
                  onChange={(e) => setDraft({ ...draft, hook: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-script">Script / voiceover</Label>
                <Textarea
                  id="edit-script"
                  rows={5}
                  value={draft.script}
                  onChange={(e) => setDraft({ ...draft, script: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-shotlist">Shot list (one per line)</Label>
                <Textarea
                  id="edit-shotlist"
                  rows={5}
                  value={draft.shotListText}
                  onChange={(e) => setDraft({ ...draft, shotListText: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-audio">Audio / sound</Label>
                <Input
                  id="edit-audio"
                  value={draft.audio}
                  onChange={(e) => setDraft({ ...draft, audio: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-caption">Caption</Label>
                <Textarea
                  id="edit-caption"
                  rows={2}
                  value={draft.caption}
                  onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-hashtags">Hashtags (comma-separated)</Label>
                <Input
                  id="edit-hashtags"
                  value={draft.hashtagsText}
                  onChange={(e) => setDraft({ ...draft, hashtagsText: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-why">Why this works</Label>
                <Textarea
                  id="edit-why"
                  rows={2}
                  value={draft.why}
                  onChange={(e) => setDraft({ ...draft, why: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !draft?.title.trim()}>
              {savingEdit ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
