'use client';

import { useEffect, useState } from 'react';
import { useProject } from '../project-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { GenerationProgress } from '@/components/generation-progress';
import { IDEAS_GENERATION_STEPS, IDEAS_REGEN_ONE_STEPS } from '@/lib/generation-steps';

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
  status: 'draft' | 'approved';
}

interface GenerateMeta {
  criticRounds: number;
  regeneratedCount: number;
}

export default function IdeasPage() {
  const { project } = useProject();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [meta, setMeta] = useState<GenerateMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch(`/api/ideas?project_id=${project.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (mounted && d.ideas) setIdeas(d.ideas as Idea[]);
      })
      .catch(() => {
        if (mounted) setError('Failed to load ideas');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [project.id]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setMeta(null);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate ideas');
      setIdeas(data.ideas as Idea[]);
      if (data.meta) setMeta(data.meta as GenerateMeta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError('');
    setMeta(null);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          previousIdeas: ideas.map((i) => i.title),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to regenerate ideas');
      setIdeas(data.ideas as Idea[]);
      if (data.meta) setMeta(data.meta as GenerateMeta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRegenerateOne(idea: Idea) {
    setRegeneratingId(idea.id);
    setError('');
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          otherIdeas: ideas.filter((i) => i.id !== idea.id).map((i) => i.title),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to regenerate idea');
      setIdeas((prev) =>
        prev.map((existing) => (existing.id === idea.id ? (data.idea as Idea) : existing))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleToggleApprove(idea: Idea) {
    const newStatus = idea.status === 'approved' ? 'draft' : 'approved';
    setTogglingId(idea.id);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setIdeas((prev) =>
        prev.map((existing) =>
          existing.id === idea.id ? { ...existing, status: newStatus } : existing
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading ideas…</p>
      </div>
    );
  }

  if (generating || regenerating) {
    return (
      <GenerationProgress
        active
        steps={IDEAS_GENERATION_STEPS}
        title={regenerating ? 'Regenerating content ideas' : 'Generating content ideas'}
        estimate="usually 45–90 seconds"
      />
    );
  }

  const approvedCount = ideas.filter((i) => i.status === 'approved').length;

  const qualityLabel =
    meta && meta.regeneratedCount > 0
      ? `${meta.regeneratedCount} idea${meta.regeneratedCount !== 1 ? 's' : ''} refined`
      : meta
        ? 'Quality checked'
        : null;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-lg font-bold text-foreground">Content ideas</h3>
          {qualityLabel && (
            <Badge variant="secondary" className="text-xs text-emerald-500">
              ✓ {qualityLabel}
            </Badge>
          )}
          {approvedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {approvedCount} approved
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {ideas.length > 0
            ? `${ideas.length} idea${ideas.length !== 1 ? 's' : ''} — approve the ones you want to export, or export all.`
            : 'No ideas yet.'}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {ideas.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-muted-foreground text-sm">No ideas yet — generate some to get started.</p>
          <Button onClick={handleGenerate} disabled={generating}>
            Generate ideas
          </Button>
        </div>
      )}

      {ideas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {ideas.map((idea) => {
            const isRegeneratingThis = regeneratingId === idea.id;
            const isTogglingThis = togglingId === idea.id;
            const isApproved = idea.status === 'approved';

            return (
              <Card
                key={idea.id}
                className={`border transition-colors ${
                  isApproved ? 'border-emerald-500/40' : 'border-border'
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
                      {isApproved && (
                        <Badge variant="secondary" className="text-xs text-emerald-500">
                          ✓ Approved
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isRegeneratingThis ? (
                  <CardContent>
                    <GenerationProgress
                      active
                      steps={IDEAS_REGEN_ONE_STEPS}
                      title="Regenerating idea"
                      estimate="usually 15–30 seconds"
                      compact
                    />
                  </CardContent>
                ) : (
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

                    {/* Per-idea actions */}
                    <div className="flex gap-2 pt-1 border-t border-border">
                      <Button
                        type="button"
                        size="sm"
                        variant={isApproved ? 'default' : 'outline'}
                        onClick={() => handleToggleApprove(idea)}
                        disabled={isTogglingThis || regeneratingId !== null}
                        className={isApproved ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0' : ''}
                      >
                        {isTogglingThis ? '…' : isApproved ? '✓ Approved' : 'Approve'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRegenerateOne(idea)}
                        disabled={isRegeneratingThis || regeneratingId !== null}
                        className="text-muted-foreground"
                      >
                        Regenerate
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {ideas.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleRegenerate}
              disabled={regenerating || regeneratingId !== null}
              className="w-full"
            >
              {ideas.length > 0 ? 'Generate more' : 'Regenerate all ideas'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
