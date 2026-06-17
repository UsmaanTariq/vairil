'use client';

import { useEffect, useState } from 'react';
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

interface IdeasProps {
  projectId: string;
  onUpdate: (updated: { status: string }) => void;
}

export default function IdeasStage({ projectId, onUpdate }: IdeasProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [meta, setMeta] = useState<GenerateMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [finalising, setFinalising] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/ideas?project_id=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ideas) setIdeas(d.ideas as Idea[]);
      })
      .catch(() => setError('Failed to load ideas'))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError('');
    setMeta(null);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
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
          project_id: projectId,
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

  async function handleFinalise() {
    setFinalising(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      onUpdate({ status: 'done' });
    } catch {
      setError('Failed to advance to output');
      setFinalising(false);
    }
  }

  async function handleBackToResearch() {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'research' }),
      });
      onUpdate({ status: 'research' });
    } catch {
      setError('Failed to go back to research');
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-neutral-400 animate-pulse">Loading ideas…</p>
      </div>
    );
  }

  if (regenerating) {
    return (
      <GenerationProgress
        active
        steps={IDEAS_GENERATION_STEPS}
        title="Regenerating content ideas"
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
          <h3 className="text-lg font-bold text-neutral-950">
            Content ideas
          </h3>
          {qualityLabel && (
            <Badge
              variant="secondary"
              className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              ✓ {qualityLabel}
            </Badge>
          )}
          {approvedCount > 0 && (
            <Badge
              variant="secondary"
              className="text-xs bg-blue-50 text-blue-700 border border-blue-200"
            >
              {approvedCount} approved
            </Badge>
          )}
        </div>
        <p className="text-sm text-neutral-500">
          {ideas.length > 0
            ? `${ideas.length} idea${ideas.length !== 1 ? 's' : ''} — approve the ones you want to export, or export all.`
            : 'No ideas yet.'}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
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
                  isApproved
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-neutral-200'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base font-semibold text-neutral-900 leading-snug">
                      {idea.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {idea.trendRef}
                      </Badge>
                      {isApproved && (
                        <Badge className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300">
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
                    <div className="rounded-md bg-zinc-900 px-4 py-3">
                      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">
                        Hook — first 3 seconds
                      </p>
                      <p className="text-zinc-50 font-medium leading-snug">{idea.hook}</p>
                    </div>

                    {/* Script */}
                    <div>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">
                        Script / voiceover
                      </p>
                      <p className="text-neutral-700 whitespace-pre-wrap leading-relaxed">
                        {idea.script}
                      </p>
                    </div>

                    {/* Shot list */}
                    <div>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">
                        Shot list
                      </p>
                      <ol className="space-y-1">
                        {idea.shotList.map((shot, j) => (
                          <li key={j} className="flex gap-2 text-neutral-700">
                            <span className="shrink-0 text-neutral-400 font-mono text-xs mt-0.5">
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
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">
                          Audio / sound
                        </p>
                        <p className="text-neutral-600">{idea.audio}</p>
                      </div>
                    )}

                    {/* Caption */}
                    <div>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                        Caption
                      </p>
                      <p className="text-neutral-700">{idea.caption}</p>
                      {idea.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {idea.hashtags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full"
                            >
                              {tag.startsWith('#') ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Why it works */}
                    <div className="border-t border-neutral-100 pt-3">
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">
                        Why this works
                      </p>
                      <p className="text-neutral-500 italic">{idea.why}</p>
                    </div>

                    {/* Per-idea actions */}
                    <div className="flex gap-2 pt-1 border-t border-neutral-100">
                      <Button
                        type="button"
                        size="sm"
                        variant={isApproved ? 'default' : 'outline'}
                        onClick={() => handleToggleApprove(idea)}
                        disabled={isTogglingThis || regeneratingId !== null}
                        className={
                          isApproved
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0'
                            : ''
                        }
                      >
                        {isTogglingThis
                          ? '…'
                          : isApproved
                            ? '✓ Approved'
                            : 'Approve'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRegenerateOne(idea)}
                        disabled={isRegeneratingThis || regeneratingId !== null}
                        className="text-neutral-500"
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

      <Separator />

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          onClick={handleFinalise}
          disabled={finalising || ideas.length === 0}
          className="w-full"
        >
          {finalising ? 'Finalising…' : 'Finalise & export →'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleRegenerate}
          disabled={regenerating || regeneratingId !== null}
          className="w-full"
        >
          Regenerate all ideas
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleBackToResearch}
          disabled={regenerating}
          className="w-full text-neutral-500"
        >
          ← Back to research
        </Button>
      </div>
    </div>
  );
}
