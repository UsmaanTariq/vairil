"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "./project-context";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, TrendingUp, CheckCircle2, BarChart2 } from "lucide-react";

export default function ProjectHome() {
  const { project } = useProject();
  const [ideaCount, setIdeaCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [trendCount, setTrendCount] = useState(0);

  useEffect(() => {
    fetch(`/api/ideas?project_id=${project.id}`).then((r) => r.json()).then((d) => {
      const ideas = d.ideas ?? [];
      setIdeaCount(ideas.length);
      setApprovedCount(ideas.filter((i: { status: string }) => i.status === "approved").length);
    });
    fetch(`/api/research?project_id=${project.id}`).then((r) => r.json()).then((d) => {
      setTrendCount((d.trends ?? []).length);
    });
  }, [project.id]);

  const base = `/project/${project.id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card className="dark:bg-transparent">
          <CardHeader>
            <CardDescription className="flex items-center gap-2"><Lightbulb className="size-4" /> Ideas</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">{ideaCount}</CardTitle>
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
            <CardDescription className="flex items-center gap-2"><TrendingUp className="size-4" /> Trends</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">{trendCount}</CardTitle>
          </CardHeader>
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
