'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Trend {
  name: string;
  description: string;
  platform: string;
  format: string;
  audio?: string;
  relevance: string;
  confidence: 'high' | 'med' | 'low';
  trendDate: string;
  sourceUrl: string;
}

interface ResearchProps {
  projectId: string;
  onUpdate: (updated: { status: string }) => void;
}

const confidenceColors: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-800',
  med: 'bg-amber-100 text-amber-800',
  low: 'bg-neutral-100 text-neutral-600',
};

export default function ResearchStage({ projectId, onUpdate }: ResearchProps) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [error, setError] = useState('');

  const runResearch = useCallback(async () => {
    setRegenerating(true);
    setError('');
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Research failed');
      setTrends(data.trends as Trend[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRegenerating(false);
    }
  }, [projectId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const res = await fetch(`/api/research?project_id=${projectId}`);
        const data = await res.json();
        if (data.trends && data.trends.length > 0) {
          setTrends(data.trends as Trend[]);
          setLoading(false);
        } else {
          setLoading(false);
          await runResearch();
        }
      } catch {
        setError('Failed to load research');
        setLoading(false);
      }
    }
    init();
  }, [projectId, runResearch]);

  async function handleGenerateIdeas() {
    setGeneratingIdeas(true);
    setError('');
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate ideas');
      onUpdate({ status: 'ideas' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setGeneratingIdeas(false);
    }
  }

  const busy = loading || regenerating || generatingIdeas;

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-neutral-400 animate-pulse">Loading research…</p>
      </div>
    );
  }

  if (regenerating) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-neutral-400 animate-pulse">Researching trends…</p>
        <p className="text-xs text-neutral-400 mt-2">This takes around 20–30 seconds</p>
      </div>
    );
  }

  if (generatingIdeas) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-neutral-400 animate-pulse">Generating ideas…</p>
        <p className="text-xs text-neutral-400 mt-2">This takes around 20–30 seconds</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-neutral-950 mb-1">
          Trend research
        </h3>
        <p className="text-sm text-neutral-500">
          {trends.length > 0
            ? `Found ${trends.length} relevant trend${trends.length !== 1 ? 's' : ''} to anchor your ideas.`
            : 'No trends found. Try regenerating.'}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {trends.length > 0 && (
        <div className="space-y-4">
          {trends.map((trend, i) => (
            <Card key={i} className="border border-neutral-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base font-semibold text-neutral-900 leading-snug">
                    {trend.name}
                  </CardTitle>
                  <span
                    className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      confidenceColors[trend.confidence] ?? confidenceColors.low
                    }`}
                  >
                    {trend.confidence}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {trend.platform}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {trend.format}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {trend.description && (
                  <p className="text-neutral-700">{trend.description}</p>
                )}
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">
                    Why it fits
                  </p>
                  <p className="text-neutral-600">{trend.relevance}</p>
                </div>
                {trend.audio && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">
                      Audio / sound
                    </p>
                    <p className="text-neutral-600">{trend.audio}</p>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
                  <span>{trend.trendDate}</span>
                  {trend.sourceUrl && (
                    <a
                      href={trend.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-neutral-600 truncate max-w-[200px]"
                    >
                      {new URL(trend.sourceUrl).hostname}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      <div className="flex flex-col gap-3">
        <Button
          onClick={handleGenerateIdeas}
          disabled={busy || trends.length === 0}
          className="w-full"
        >
          {generatingIdeas ? 'Generating…' : 'Generate 6 ideas →'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={runResearch}
          disabled={busy}
          className="w-full"
        >
          {regenerating ? 'Researching…' : 'Regenerate research'}
        </Button>
      </div>
    </div>
  );
}
