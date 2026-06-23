"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "./project-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, ThumbsDown, TrendingUp, BarChart2 } from "lucide-react";

type Trend = {
  id: string;
  name: string;
  platform: string;
};

export default function ProjectHome() {
  const { project } = useProject();
  const [newCount, setNewCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [trendCount, setTrendCount] = useState(0);
  const [topTrends, setTopTrends] = useState<Trend[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ideasRes = await fetch(`/api/ideas?project_id=${project.id}`).then((r) => r.json());
        if (mounted) {
          const ideas = ideasRes.ideas ?? [];
          setNewCount(ideas.filter((i: { status: string }) => i.status === "new").length);
          setApprovedCount(ideas.filter((i: { status: string }) => i.status === "approved").length);
          setRejectedCount(ideas.filter((i: { status: string }) => i.status === "rejected").length);
        }

        const trendsRes = await fetch(`/api/research?project_id=${project.id}`).then((r) => r.json());
        if (mounted) {
          const trends = trendsRes.trends ?? [];
          setTrendCount(trends.length);
          setTopTrends(trends.slice(0, 3));
        }
      } catch (e) {
        console.error("Failed to load home data:", e);
      }
    })();
    return () => { mounted = false; };
  }, [project.id]);

  const base = `/project/${project.id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card className="dark:bg-transparent">
          <CardHeader>
            <CardDescription className="flex items-center gap-2"><Sparkles className="size-4" /> New (awaiting review)</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">{newCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-transparent">
          <CardHeader>
            <CardDescription className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Approved</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">{approvedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-transparent">
          <CardHeader>
            <CardDescription className="flex items-center gap-2"><ThumbsDown className="size-4" /> Disliked</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">{rejectedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-transparent lg:col-span-3">
          <CardHeader>
            <CardDescription className="flex items-center gap-2"><TrendingUp className="size-4" /> Trends ({trendCount})</CardDescription>
            <CardTitle className="font-mono text-sm pt-2">Newest trends</CardTitle>
          </CardHeader>
          <CardContent>
            {topTrends.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {topTrends.map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <span className="text-foreground">{t.name}</span>
                    <Badge variant="secondary" className="text-xs">{t.platform}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No trends yet</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button render={<Link href={`${base}/trends`} />} nativeButton={false}>Research trends</Button>
        <Button variant="outline" render={<Link href={`${base}/ideas`} />} nativeButton={false}>Generate ideas</Button>
        {(project.tiktok_handle || project.instagram_handle) && (
          <Button variant="ghost" render={<Link href={`${base}/analytics`} />} nativeButton={false}>
            <BarChart2 className="size-4" /> View analytics
          </Button>
        )}
      </div>
    </div>
  );
}
