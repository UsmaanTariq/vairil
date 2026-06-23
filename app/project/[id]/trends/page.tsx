"use client";

import { useEffect, useState } from "react";
import { useProject } from "../project-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GenerationProgress } from "@/components/generation-progress";
import { RESEARCH_STEPS } from "@/lib/generation-steps";

type Trend = {
  id: string;
  name: string; description: string; platform: string; format: string;
  audio?: string; relevance: string; confidence: "high" | "med" | "low";
  trendDate: string; sourceUrl: string;
};

type ResearchMode = "niche" | "broad";

export default function TrendsPage() {
  const { project } = useProject();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<ResearchMode>("niche");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const d = await fetch(`/api/research?project_id=${project.id}`).then((r) => r.json());
      if (mounted) {
        setTrends(d.trends ?? []);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [project.id]);

  async function refresh() {
    setRefreshing(true); setError("");
    try {
      const res = await fetch("/api/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, mode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Research failed");
      // Append newly returned trends to state (GET will filter dismissed on next load)
      setTrends((prev) => {
        const newTrends = (d.trends as Trend[]).filter(
          (t) => !prev.some((p) => p.id === t.id)
        );
        return [...newTrends, ...prev];
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setRefreshing(false); }
  }

  async function dismiss(trend_id: string) {
    try {
      const res = await fetch("/api/research", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trend_id, dismissed: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Dismiss failed");
      }
      setTrends((prev) => prev.filter((t) => t.id !== trend_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to dismiss trend");
    }
  }

  if (refreshing) return <GenerationProgress active steps={RESEARCH_STEPS} title="Researching trends" estimate="usually 20–30 seconds" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Trends</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${trends.length} trend${trends.length !== 1 ? "s" : ""} in ${project.niche ?? "this niche"}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setMode("niche")}
              className={`px-3 py-1.5 text-sm transition-colors ${mode === "niche" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
            >
              In their niche
            </button>
            <button
              onClick={() => setMode("broad")}
              className={`px-3 py-1.5 text-sm transition-colors border-l ${mode === "broad" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
            >
              Broadly trending
            </button>
          </div>
          <Button onClick={refresh}>Refresh trends</Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {trends.map((t) => (
          <Card key={t.id} className="dark:bg-transparent">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary">{t.confidence}</Badge>
                  <button
                    onClick={() => dismiss(t.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Dismiss trend"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="secondary">{t.platform}</Badge>
                <Badge variant="outline">{t.format}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {t.description && <p className="text-muted-foreground">{t.description}</p>}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Why it fits</p>
                <p>{t.relevance}</p>
              </div>
              <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                <span>{t.trendDate}</span>
                {t.sourceUrl && <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">source</a>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
