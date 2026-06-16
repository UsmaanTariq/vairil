'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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

interface OutputProps {
  projectId: string;
  onUpdate: (updated: { status: string }) => void;
}

type Tab = 'approved' | 'all';

export default function OutputStage({ projectId, onUpdate }: OutputProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('approved');

  useEffect(() => {
    fetch(`/api/ideas?project_id=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ideas) {
          const fetched = d.ideas as Idea[];
          setIdeas(fetched);
          if (!fetched.some((i) => i.status === 'approved')) {
            setTab('all');
          }
        }
      })
      .catch(() => setError('Failed to load ideas'))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Export failed');
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
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleBackToIdeas() {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ideas' }),
      });
      onUpdate({ status: 'ideas' });
    } catch {
      setError('Failed to go back to ideas');
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-neutral-400 animate-pulse">Loading…</p>
      </div>
    );
  }

  const approvedIdeas = ideas.filter((i) => i.status === 'approved');
  const displayed = tab === 'approved' ? approvedIdeas : ideas;
  const hasApproved = approvedIdeas.length > 0;
  const exportNote = hasApproved
    ? `${approvedIdeas.length} approved idea${approvedIdeas.length !== 1 ? 's' : ''} will be exported`
    : `No ideas approved — all ${ideas.length} will be exported`;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-neutral-950 mb-1">
          Content plan
        </h3>
        <p className="text-sm text-neutral-500">
          Review your ideas and download the content plan as a Word document.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 mb-0.5">
            Download DOCX
          </p>
          <p className="text-xs text-neutral-500">{exportNote}</p>
        </div>
        <Button
          type="button"
          onClick={handleExport}
          disabled={exporting || ideas.length === 0}
          className="shrink-0"
        >
          {exporting ? 'Generating…' : '↓ Download DOCX'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {ideas.length > 0 && (
        <div>
          <div className="flex gap-1 border-b border-neutral-200 mb-6">
            <button
              onClick={() => setTab('approved')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === 'approved'
                  ? 'border-neutral-950 text-neutral-950'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Approved
              {hasApproved && (
                <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                  {approvedIdeas.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === 'all'
                  ? 'border-neutral-950 text-neutral-950'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              All ideas
              <span className="ml-1.5 text-xs text-neutral-400">{ideas.length}</span>
            </button>
          </div>

          {displayed.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-neutral-400">No approved ideas yet.</p>
              <p className="text-xs text-neutral-500 mt-1">
                Go back to ideas and approve the ones you want to include.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {displayed.map((idea, i) => (
                <Card
                  key={idea.id}
                  className={`border ${
                    idea.status === 'approved'
                      ? 'border-emerald-200'
                      : 'border-neutral-200'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-xs font-mono text-neutral-400 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <CardTitle className="text-base font-semibold text-neutral-900 leading-snug">
                          {idea.title}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {idea.trendRef}
                        </Badge>
                        {idea.status === 'approved' && (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300">
                            ✓ Approved
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Separator />

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={handleBackToIdeas}
          className="w-full text-neutral-500"
        >
          ← Back to ideas
        </Button>
      </div>
    </div>
  );
}
