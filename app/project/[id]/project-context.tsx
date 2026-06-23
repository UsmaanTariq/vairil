"use client";

import { createContext, useContext } from "react";

export type Project = {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  status: string;
  onboarded: boolean;
  created_at: string;
  tiktok_handle: string | null;
  instagram_handle: string | null;
};

type Ctx = {
  project: Project;
  refresh: () => Promise<void>;
  setOnboarded: () => void;
};

const ProjectContext = createContext<Ctx | null>(null);

export function ProjectProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): Ctx {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
