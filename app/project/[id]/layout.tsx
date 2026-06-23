"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProjectProvider, type Project } from "./project-context";
import { ProjectTabs } from "./project-tabs";
import { Onboarding } from "./onboarding";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback((): Promise<void> => {
    return fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((d: { project?: Project }) => {
        setProject(d.project ?? null);
      });
  }, [id]);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((d: { project?: Project }) => setProject(d.project ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  const setOnboarded = useCallback(() => {
    setProject((p) => (p ? { ...p, onboarded: true } : p));
  }, []);

  if (loading) {
    return <AppShell><div className="py-10 text-sm text-muted-foreground">Loading…</div></AppShell>;
  }
  if (!project) {
    return <AppShell><div className="py-10 text-sm text-muted-foreground">Project not found.</div></AppShell>;
  }

  return (
    <AppShell>
      <ProjectProvider value={{ project, refresh, setOnboarded }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">TrendForge</Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{project.client_name}</span>
          </div>
          {project.onboarded ? (
            <>
              <ProjectTabs projectId={project.id} />
              {children}
            </>
          ) : (
            <Onboarding />
          )}
        </div>
      </ProjectProvider>
    </AppShell>
  );
}
