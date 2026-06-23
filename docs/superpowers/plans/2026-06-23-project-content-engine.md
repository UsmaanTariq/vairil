# Project Content Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the project page from a linear status-driven wizard into a tabbed, ongoing content engine with one-time onboarding and a like/dislike idea loop that steers future generation.

**Architecture:** A shared project layout (`app/project/[id]/layout.tsx`) renders the dark `AppShell`, a project header, and a tab bar, and gates onboarding via a new `projects.onboarded` flag. Tabs (Home/Ideas/Trends/Analytics/Profile) are sub-routes sharing that layout. Phase 1 delivers the un-funneled workspace; Phase 2 adds the idea lifecycle (`new|approved|rejected`), dislike feedback steering, and a refreshable trends feed with history.

**Tech Stack:** Next.js 16 (app router, `next` 16.2.9), React 19, TypeScript, Tailwind v4, shadcn/efferd UI primitives (`@/components/ui/*`), Supabase (`@/lib/db`), Anthropic SDK via `@/lib/anthropic` `callAgent`, recharts.

## Global Constraints

- **No test runner exists.** Do NOT add one. Verify each task with: `npx tsc --noEmit` (must be clean), `npx eslint <changed files>` (must be clean), and — for UI tasks — a dev-server smoke check (`npx next dev`, load the page with the `tf_auth` cookie, confirm render + no console/compile errors). This deviation is intentional and honors the user's stated light-testing preference.
- **Dark efferd theme everywhere.** Use `@/components/ui/*` primitives (`Card`, `Button`, `Badge`, `Table`, `Input`, `Textarea`, `Label`, `Dialog`) and theme tokens (`text-muted-foreground`, `bg-card`, `border`, `var(--chart-1)`…). No hardcoded hex colors. Cards use `className="dark:bg-transparent"` to match existing pages.
- **Auth/middleware unchanged.** All `/project/*` routes are gated by existing middleware (`tf_auth` cookie). Smoke checks set `document.cookie = "tf_auth=<APP_SECRET>; path=/"` after loading `/login`.
- **Supabase access:** server-only via `import { supabase } from '@/lib/db'` inside `app/api/**/route.ts`. Client components talk to those routes via `fetch`.
- **Migrations:** SQL files in `supabase/migrations/`, run with `npm run migrate`. Use idempotent DDL (`add column if not exists`). The migrate script requires `SUPABASE_ACCESS_TOKEN`; if unset, hand the SQL to the user to run — do not block.
- **Idea/trend field mapping (DB ⇄ API):** ideas: `trend_ref⇄trendRef`, `shot_list⇄shotList`. Both `ideas` and `trends` already have a `description`/full column set as used by existing routes — do not "fix" missing columns that aren't missing.
- **Commit after every task** with a `feat:`/`refactor:`/`chore:` message. Work on branch `feat/project-content-engine` (already created).

---

# PHASE 1 — Workspace Shell + Onboarding

Goal: kill the funnel. After Phase 1 the project opens as a dark tabbed workspace; setup is one-time; every tab is freely reachable; Export is no longer terminal. No lifecycle/feedback/history yet.

## Task 1: Phase 1 migration — `projects.onboarded`

**Files:**
- Create: `supabase/migrations/20260623_project_onboarded.sql`

**Interfaces:**
- Produces: `projects.onboarded boolean` (default false), backfilled true for projects that already have a profile or progressed past synthesis.

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260623_project_onboarded.sql
alter table projects add column if not exists onboarded boolean default false;

-- Backfill: a project is onboarded if it already has a synthesis profile
-- or already progressed to research/ideas/done under the old status model.
update projects p
set onboarded = true
where p.onboarded is not true
  and (
    exists (select 1 from synthesis s where s.project_id = p.id)
    or p.status in ('research', 'ideas', 'done')
  );
```

- [ ] **Step 2: Apply the migration**

Run: `npm run migrate`
Expected: completes without error. If `SUPABASE_ACCESS_TOKEN` is missing, copy the SQL into the Supabase SQL editor and run it there.

- [ ] **Step 3: Verify the column + backfill**

Verify in Supabase (SQL editor or dashboard): `select id, status, onboarded from projects;` — existing seeded projects (e.g. CricketArena, S4s Home Interior, both at status `ideas`) show `onboarded = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623_project_onboarded.sql
git commit -m "feat: add projects.onboarded flag + backfill"
```

## Task 2: Expose `onboarded` through the project API

**Files:**
- Modify: `app/api/projects/[id]/route.ts` (GET select + PATCH allow `onboarded`)

**Interfaces:**
- Produces: `GET /api/projects/[id]` returns `project.onboarded: boolean`. `PATCH /api/projects/[id]` accepts `{ onboarded?: boolean }`.

- [ ] **Step 1: Read the current route**

Run: `sed -n '1,80p' "app/api/projects/[id]/route.ts"` — confirm the GET `select(...)` column list and the PATCH allowed-fields whitelist.

- [ ] **Step 2: Add `onboarded` to the GET select**

In the GET handler's `.select('...')`, append `, onboarded` to the column list so the returned `project` includes it. If the route selects `*`, no change is needed — verify.

- [ ] **Step 3: Allow `onboarded` in PATCH**

In the PATCH handler where the update payload is assembled from the request body, allow `onboarded` (boolean) to pass through to the `.update({...})` call, alongside the existing fields (`client_name`, `niche`, `platforms`, `tiktok_handle`, `instagram_handle`, `status`).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → clean. Then smoke: `curl -s -H "Cookie: tf_auth=$APP_SECRET" localhost:3000/api/projects/<id>` (dev server running) → JSON includes `"onboarded": true`.

- [ ] **Step 5: Commit**

```bash
git add "app/api/projects/[id]/route.ts"
git commit -m "feat: expose onboarded in project GET/PATCH"
```

## Task 3: Project context + shared layout shell

**Files:**
- Create: `app/project/[id]/project-context.tsx`
- Create: `app/project/[id]/project-tabs.tsx`
- Create: `app/project/[id]/layout.tsx`

**Interfaces:**
- Produces:
  - `useProject(): { project: Project; refresh: () => Promise<void>; setOnboarded: () => void }` from `project-context.tsx`.
  - `type Project = { id: string; client_name: string; niche: string | null; platforms: string[]; status: string; onboarded: boolean; created_at: string; tiktok_handle: string | null; instagram_handle: string | null }`.
  - `<ProjectTabs />` renders the tab bar (Home/Ideas/Trends/Analytics/Profile) with active highlighting via `usePathname()`.
  - The layout renders `AppShell` + header + (onboarding OR tabs+children).

- [ ] **Step 1: Create the project context**

```tsx
// app/project/[id]/project-context.tsx
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
```

- [ ] **Step 2: Create the tab bar**

```tsx
// app/project/[id]/project-tabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Home", seg: "" },
  { label: "Ideas", seg: "ideas" },
  { label: "Trends", seg: "trends" },
  { label: "Analytics", seg: "analytics" },
  { label: "Profile", seg: "profile" },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/project/${projectId}`;
  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={t.label}
            href={href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Create the layout with the onboarding gate**

```tsx
// app/project/[id]/layout.tsx
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

  const refresh = useCallback(async () => {
    const d = await fetch(`/api/projects/${id}`).then((r) => r.json());
    setProject(d.project ?? null);
  }, [id]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

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
```

- [ ] **Step 4: Verify after Task 4 provides `Onboarding`**

`./onboarding` does not exist yet (Task 4). Expect `tsc` to error on that import until Task 4 lands. Do Task 4 next, then run `npx tsc --noEmit`.

- [ ] **Step 5: Commit (after Task 4 compiles)**

```bash
git add app/project/[id]/project-context.tsx app/project/[id]/project-tabs.tsx app/project/[id]/layout.tsx
git commit -m "feat: project workspace layout + tabs + context"
```

## Task 4: Onboarding flow (one-time setup, dark)

**Files:**
- Create: `app/project/[id]/onboarding.tsx`
- Modify: `app/project/[id]/synthesis.tsx` (on confirm, set `onboarded`)

**Interfaces:**
- Consumes: existing `IntakeStage`, `InterviewStage`, `SynthesisStage` components (`./intake`, `./interview`, `./synthesis`), `useProject()`.
- Produces: `<Onboarding />` runs intake → interview → synthesis; on synthesis completion calls `PATCH /api/projects/[id] { onboarded: true }` then `setOnboarded()`.

- [ ] **Step 1: Create the onboarding component**

Drive the three existing setup steps from local state seeded by `project.status` (`intake|interview|synthesis`). The existing stage components already call `onUpdate({status})` to advance; map those to local step changes. On synthesis complete, mark onboarded.

```tsx
// app/project/[id]/onboarding.tsx
"use client";

import { useState } from "react";
import { useProject } from "./project-context";
import IntakeStage from "./intake";
import InterviewStage from "./interview";
import SynthesisStage from "./synthesis";

type Step = "intake" | "interview" | "synthesis";

export function Onboarding() {
  const { project, setOnboarded } = useProject();
  const initial: Step = (["intake", "interview", "synthesis"].includes(project.status)
    ? project.status
    : "intake") as Step;
  const [step, setStep] = useState<Step>(initial);

  async function finishOnboarding() {
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarded: true }),
    });
    setOnboarded();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Setup {step === "intake" ? "1" : step === "interview" ? "2" : "3"} of 3
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {step === "intake" ? "Client brief" : step === "interview" ? "A few questions" : "Business profile"}
        </h1>
      </div>
      {step === "intake" && (
        <IntakeStage project={project} onUpdate={() => setStep("interview")} />
      )}
      {step === "interview" && (
        <InterviewStage projectId={project.id} onUpdate={() => setStep("synthesis")} />
      )}
      {step === "synthesis" && (
        <SynthesisStage projectId={project.id} onUpdate={finishOnboarding} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Make SynthesisStage's confirm trigger onboarding finish**

`SynthesisStage` currently calls `onUpdate({ status: 'research' })` on confirm. The `Onboarding` wrapper passes `onUpdate={finishOnboarding}`, which ignores the arg and sets `onboarded`. Verify `SynthesisStage`'s `onUpdate` prop type accepts being called (adjust its prop type to `onUpdate: (u?: { status: string }) => void` if needed so `finishOnboarding` is assignable). Make the minimal prop-type widening only.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean (layout import now resolves). Run `npx eslint app/project/[id]/onboarding.tsx app/project/[id]/layout.tsx app/project/[id]/project-tabs.tsx app/project/[id]/project-context.tsx` → clean.

- [ ] **Step 4: Smoke check**

Start dev server. Create a fresh project from the dashboard ("New project") → it should open into onboarding (step 1 of 3), not the old wizard. (Don't complete it unless you want test data.) An existing onboarded project should skip onboarding (next tasks render its tabs).

- [ ] **Step 5: Commit**

```bash
git add app/project/[id]/onboarding.tsx app/project/[id]/synthesis.tsx app/project/[id]/project-context.tsx app/project/[id]/project-tabs.tsx app/project/[id]/layout.tsx
git commit -m "feat: one-time onboarding flow + workspace shell"
```

## Task 5: Home tab (Phase 1 hub)

**Files:**
- Replace: `app/project/[id]/page.tsx` (currently the full wizard — replaced by the Home hub)

**Interfaces:**
- Consumes: `useProject()`, `GET /api/ideas?project_id`, `GET /api/research?project_id`.
- Produces: Home hub with stat tiles + newest-trends preview + primary actions linking to `/ideas` and `/trends`.

- [ ] **Step 1: Replace the wizard page with the hub**

The old `page.tsx` (status-switch wizard) is fully superseded by the layout + tabs. Replace its entire contents:

```tsx
// app/project/[id]/page.tsx
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
        <Button render={<Link href={`${base}/trends`} />}>Research trends</Button>
        <Button variant="outline" render={<Link href={`${base}/ideas`} />}>Generate ideas</Button>
        {(project.tiktok_handle || project.instagram_handle) && (
          <Button variant="ghost" render={<Link href={`${base}/analytics`} />}>
            <BarChart2 className="size-4" /> View analytics
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → clean. `npx eslint app/project/[id]/page.tsx` → clean. (If `Button render={<Link/>}` typing complains, wrap with `nativeButton={false}` as the efferd `Button` API requires — match how `app-sidebar.tsx` uses `render`.)

- [ ] **Step 3: Smoke check**

Open an onboarded project (`/project/<id>`) → Home hub renders with tiles + tabs; clicking tabs navigates.

- [ ] **Step 4: Commit**

```bash
git add app/project/[id]/page.tsx
git commit -m "feat: project Home hub tab"
```

## Task 6: Profile tab

**Files:**
- Create: `app/project/[id]/profile/page.tsx`

**Interfaces:**
- Consumes: `useProject()`, `GET /api/synthesis?project_id`, `PATCH /api/synthesis`.
- Produces: a Profile editor page reusing the 7 `PROFILE_FIELDS` (the same fields the old modal edited).

- [ ] **Step 1: Create the Profile page**

Port the profile-editing logic from the old `page.tsx` modal (the `Profile` type, `PROFILE_FIELDS`, `openProfile`/`handleSaveProfile`) into a standalone dark page using `Card` + `Textarea` + `Button`.

```tsx
// app/project/[id]/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useProject } from "../project-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Profile = {
  description: string; audience: string; positioning: string; offers: string;
  tone: string; contentGoals: string; filmingConstraints: string;
};
const FIELDS: { key: keyof Profile; label: string; hint: string }[] = [
  { key: "description", label: "Business description", hint: "One-line summary of the client" },
  { key: "audience", label: "Target audience", hint: "Who they are, age, location, pain points" },
  { key: "positioning", label: "Positioning & differentiator", hint: "What sets them apart" },
  { key: "offers", label: "Offers & products", hint: "What to promote in content" },
  { key: "tone", label: "Tone & brand personality", hint: "How the brand communicates" },
  { key: "contentGoals", label: "Content goals", hint: "Awareness, footfall, sales, followers" },
  { key: "filmingConstraints", label: "Filming constraints", hint: "On-camera comfort, gear, location, budget" },
];

export default function ProfilePage() {
  const { project } = useProject();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/synthesis?project_id=${project.id}`).then((r) => r.json()).then((d) => {
      if (d.profile) setProfile(d.profile as Profile);
    });
  }, [project.id]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    await fetch("/api/synthesis", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: project.id, profile }),
    });
    setSaving(false);
  }

  if (!profile) return <p className="text-sm text-muted-foreground">Loading profile…</p>;

  return (
    <Card className="dark:bg-transparent">
      <CardHeader><CardTitle>Business profile</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-5">
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="grid gap-1.5">
            <Label htmlFor={`p-${key}`}>{label}</Label>
            <p className="text-xs text-muted-foreground">{hint}</p>
            <Textarea id={`p-${key}`} rows={key === "description" ? 2 : 3}
              value={profile[key]}
              onChange={(e) => setProfile((p) => (p ? { ...p, [key]: e.target.value } : p))} />
          </div>
        ))}
        <div><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify + smoke**

`npx tsc --noEmit` clean; `npx eslint` clean. Smoke: `/project/<id>/profile` loads existing profile, edits save (PATCH 200).

- [ ] **Step 3: Commit**

```bash
git add app/project/[id]/profile/page.tsx
git commit -m "feat: Profile tab"
```

## Task 7: Trends tab (Phase 1 — restyle current research view)

**Files:**
- Create: `app/project/[id]/trends/page.tsx`

**Interfaces:**
- Consumes: `useProject()`, `GET /api/research?project_id`, `POST /api/research { project_id }`.
- Produces: a dark trends list with an always-available **Refresh trends** action. (History/dismiss/mode added in Phase 2 Task 12.)

- [ ] **Step 1: Create the Trends page**

Reuse the data flow from the existing `research.tsx` stage (fetch on mount; `POST /api/research` to refresh) but render with `Card`/`Badge` in dark theme and drop the "Generate ideas →" gating button (idea generation lives on the Ideas tab now). Show `GenerationProgress` (`RESEARCH_STEPS`) while refreshing.

```tsx
// app/project/[id]/trends/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useProject } from "../project-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GenerationProgress } from "@/components/generation-progress";
import { RESEARCH_STEPS } from "@/lib/generation-steps";

type Trend = {
  name: string; description: string; platform: string; format: string;
  audio?: string; relevance: string; confidence: "high" | "med" | "low";
  trendDate: string; sourceUrl: string;
};

export default function TrendsPage() {
  const { project } = useProject();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const d = await fetch(`/api/research?project_id=${project.id}`).then((r) => r.json());
    setTrends(d.trends ?? []);
  }, [project.id]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function refresh() {
    setRefreshing(true); setError("");
    try {
      const res = await fetch("/api/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Research failed");
      setTrends(d.trends as Trend[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setRefreshing(false); }
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
        <Button onClick={refresh}>Refresh trends</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {trends.map((t, i) => (
          <Card key={i} className="dark:bg-transparent">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <Badge variant="secondary">{t.confidence}</Badge>
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
```

- [ ] **Step 2: Verify + smoke**

`npx tsc --noEmit` clean; eslint clean. Smoke: `/project/<id>/trends` shows existing trends; **Refresh trends** runs and re-renders. (Refresh hits the model + web search; expect ~20–30s.)

- [ ] **Step 3: Commit**

```bash
git add app/project/[id]/trends/page.tsx
git commit -m "feat: Trends tab (Phase 1 restyle)"
```

## Task 8: Ideas tab (Phase 1 — restyle current ideas list)

**Files:**
- Create: `app/project/[id]/ideas/page.tsx`

**Interfaces:**
- Consumes: `useProject()`, `GET /api/ideas?project_id`, `POST /api/ideas { project_id, previousIdeas }`.
- Produces: a dark ideas list with **Generate ideas** / **Generate more** and the existing approve/regenerate-one actions, using current `draft|approved` semantics (lifecycle remap is Phase 2).

- [ ] **Step 1: Create the Ideas page**

Port the data flow + card detail from the existing `ideas.tsx` stage (hook/script/shot list/caption/hashtags/why; approve toggle; regenerate-one; regenerate-all), restyled to dark `Card`/`Button`/`Badge`. Drop the "Finalise & export →" and "← Back to research" stage-navigation buttons. Empty state → a **Generate ideas** button calling `POST /api/ideas`.

(Use the exact JSX structure of the existing `app/project/[id]/ideas.tsx`, swapping hardcoded `neutral-*`/`emerald-*` classes for theme tokens and `Card`/`Button`/`Badge` primitives. Keep `handleToggleApprove`, `handleRegenerateOne`, `handleRegenerate`, and the `GenerationProgress` usage verbatim. Remove `handleFinalise`/`handleBackToResearch`.)

- [ ] **Step 2: Verify + smoke**

`npx tsc --noEmit` clean; eslint clean. Smoke: `/project/<id>/ideas` lists ideas; approve toggles; "Generate more" appends/replaces per current API.

- [ ] **Step 3: Commit**

```bash
git add app/project/[id]/ideas/page.tsx
git commit -m "feat: Ideas tab (Phase 1 restyle)"
```

## Task 9: Analytics tab — render inside the project shell

**Files:**
- Modify: `app/project/[id]/analytics/page.tsx` (remove its own `AppShell` wrapper; render content only)

**Interfaces:**
- Consumes: now wrapped by the project `layout.tsx` (which provides `AppShell` + tabs).
- Produces: analytics content rendered within the shared workspace shell (no double shell, tab bar visible).

- [ ] **Step 1: Remove the inner AppShell**

In `analytics/page.tsx`, replace the outer `<AppShell> … </AppShell>` wrapper with a fragment/`<>`/top-level `div`, and remove the `import { AppShell }` line. Everything inside stays. The shared layout now supplies the shell, header, and tabs.

- [ ] **Step 2: Verify + smoke**

`npx tsc --noEmit` clean; eslint clean. Smoke: `/project/<id>/analytics` renders with the project tab bar (Analytics active), no nested/duplicated sidebar, charts intact.

- [ ] **Step 3: Commit + delete dead stage files**

Delete the now-unused stage entry points that the layout/tabs replaced: `app/project/[id]/research.tsx`, `app/project/[id]/ideas.tsx`, `app/project/[id]/output.tsx` are superseded by the tab pages. Keep `intake.tsx`, `interview.tsx`, `synthesis.tsx` (used by onboarding). Confirm nothing imports the deleted files (`grep -rn "from './research'\|from './output'\|from './ideas'" app/project`).

```bash
git rm app/project/[id]/research.tsx app/project/[id]/output.tsx app/project/[id]/ideas.tsx
git add app/project/[id]/analytics/page.tsx
git commit -m "refactor: analytics renders in project shell; drop dead stage files"
```

> Note: if Export (download plan) from the old `output.tsx` should be preserved, add it as an "Export approved" action button on the Ideas tab in Phase 2 (Task 11) reusing `/api/export`. Confirm with the user before deleting `output.tsx` if unsure.

---

# PHASE 2 — The Idea Engine

Goal: the like/dislike loop, dislike-steered generation, and a refreshable trends feed with history.

## Task 10: Phase 2 migration — idea lifecycle + trends history

**Files:**
- Create: `supabase/migrations/20260623_idea_engine.sql`

**Interfaces:**
- Produces: `ideas.status` values `new|approved|rejected`; `ideas.created_at`; `ideas.feedback_reason`; `trends.created_at`; `trends.dismissed`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260623_idea_engine.sql
alter table ideas add column if not exists created_at timestamptz default now();
alter table ideas add column if not exists feedback_reason text;
-- Remap legacy statuses: draft -> new (approved stays approved)
update ideas set status = 'new' where status = 'draft';

alter table trends add column if not exists created_at timestamptz default now();
alter table trends add column if not exists dismissed boolean default false;
```

- [ ] **Step 2: Apply + verify**

Run: `npm run migrate`. Verify: `select status, count(*) from ideas group by status;` shows only `new`/`approved`. `select created_at, dismissed from trends limit 1;` returns columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260623_idea_engine.sql
git commit -m "feat: idea lifecycle + trends history migration"
```

## Task 11: Ideas API — lifecycle, feedback, append, steering

**Files:**
- Modify: `app/api/ideas/route.ts` (GET select/order; POST append + negative steering; stop overwriting + stop status gating)
- Modify: `app/api/ideas/[id]/route.ts` (PATCH accepts `new|approved|rejected` + `feedback_reason`)

**Interfaces:**
- Consumes: `ideas.created_at`, `ideas.feedback_reason`, `ideas.status (new|approved|rejected)`.
- Produces:
  - `GET /api/ideas?project_id` → ideas include `status` and `feedbackReason`, ordered `created_at desc`.
  - `POST /api/ideas { project_id }` → appends N new ideas (status `new`), using profile + non-dismissed trends + avoid-repeats (all existing titles/hooks) + negative steering (rejected titles + `feedback_reason`). Does NOT delete existing ideas; does NOT change `projects.status`.
  - `PATCH /api/ideas/[id] { status?: 'new'|'approved'|'rejected', feedback_reason?: string|null }`.

- [ ] **Step 1: Update PATCH in `[id]/route.ts`**

Replace the status whitelist and update payload:

```ts
const { status, feedback_reason } = body as {
  status?: "new" | "approved" | "rejected";
  feedback_reason?: string | null;
};
const update: Record<string, unknown> = {};
if (status) {
  if (!["new", "approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  update.status = status;
}
if (feedback_reason !== undefined) update.feedback_reason = feedback_reason;
if (Object.keys(update).length === 0) {
  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
const { error } = await supabase.from("ideas").update(update).eq("id", id);
if (error) return NextResponse.json({ error: error.message }, { status: 500 });
return NextResponse.json({ ok: true, ...update });
```

Also in the same file's `returnIdeasTool` input schema, change the `status` enum from `['draft','approved']` to `['new','approved','rejected']`, and where the regenerated idea is written (`.update({... status: 'draft'}`), change to `status: 'new'`.

- [ ] **Step 2: Update GET in `route.ts`**

Add `created_at, feedback_reason` to the `.select(...)`, add `.order('created_at', { ascending: false })`, and include `status` + `feedbackReason` in the mapped objects:

```ts
.select("id, title, trend_ref, hook, script, shot_list, audio, caption, hashtags, why, status, feedback_reason, created_at")
.eq("project_id", project_id)
.order("created_at", { ascending: false });
// in map():
status: (row.status as "new" | "approved" | "rejected") ?? "new",
feedbackReason: row.feedback_reason ?? null,
```

- [ ] **Step 3: Make POST append + steer (the core change)**

In `route.ts` POST: (a) load existing ideas for avoid-repeats + rejected feedback; (b) only use non-dismissed trends; (c) after generation, **insert** (append) instead of delete-all; (d) remove the `projects.update({status:'ideas'})` line.

Replace the trends query and add an existing-ideas query near the top of the handler:

```ts
const { data: trendRows } = await supabase
  .from("trends")
  .select("name, description, platform, format, relevance, confidence")
  .eq("project_id", project_id)
  .eq("dismissed", false);

const { data: existingIdeaRows } = await supabase
  .from("ideas")
  .select("title, hook, status, feedback_reason")
  .eq("project_id", project_id);

const existingTitles = (existingIdeaRows ?? []).map((r) => r.title);
const disliked = (existingIdeaRows ?? []).filter((r) => r.status === "rejected");
```

Replace the `previousIdeasBlock` construction to use all existing titles, and add a negative-steering block:

```ts
const previousIdeasBlock =
  existingTitles.length > 0
    ? ["", "ALREADY-GENERATED IDEAS (do not repeat these concepts, angles, or hooks):",
       ...existingTitles.map((t) => `- ${t}`)].join("\n")
    : "";

const dislikedBlock =
  disliked.length > 0
    ? ["", "THE CLIENT DISLIKED THESE IDEAS — generate clearly different concepts. Avoid their style, topics, and angles:",
       ...disliked.map((r) => `- "${r.title}"${r.feedback_reason ? ` (reason: ${r.feedback_reason})` : ""}`)].join("\n")
    : "";
```

Add `dislikedBlock` into `baseInput` (after `previousIdeasBlock`). Keep the critic loop as-is. Finally, replace the persistence block:

```ts
// Append new ideas as status 'new' (do NOT delete existing).
if (currentIdeas.length > 0) {
  await supabase.from("ideas").insert(
    currentIdeas.map((idea) => ({
      project_id,
      title: idea.title,
      trend_ref: idea.trendRef,
      hook: idea.hook,
      script: idea.script,
      shot_list: idea.shotList,
      audio: idea.audio ?? null,
      caption: idea.caption,
      hashtags: idea.hashtags,
      why: idea.why,
      status: "new",
    }))
  );
}
// (removed: delete-all, and projects.update status='ideas')
return NextResponse.json({ ideas: currentIdeas, meta: { criticRounds, regeneratedCount: totalRegenerated } });
```

Also change `returnIdeasTool`'s `status` enum in this file to `['new','approved','rejected']`.

- [ ] **Step 4: Verify**

`npx tsc --noEmit` clean. Smoke (dev server): `POST /api/ideas` for a project appends a fresh batch (GET count increases, all new ones `status:new`); manually set one idea to `rejected` with a `feedback_reason` via `PATCH`, generate again, and confirm in the server logs / returned ideas that concepts differ (qualitative check).

- [ ] **Step 5: Commit**

```bash
git add app/api/ideas/route.ts "app/api/ideas/[id]/route.ts"
git commit -m "feat: idea lifecycle API — append, like/dislike, dislike steering"
```

## Task 12: Ideas tab — review feed (New / Approved / Disliked)

**Files:**
- Modify: `app/project/[id]/ideas/page.tsx`

**Interfaces:**
- Consumes: `GET /api/ideas` (with `status` + `feedbackReason`), `PATCH /api/ideas/[id]`, `POST /api/ideas`.
- Produces: filter views (New default / Approved / Disliked), approve + dislike (with optional one-tap reason), restore-from-disliked, and **Generate more ideas**.

- [ ] **Step 1: Add the lifecycle UI**

Extend the Ideas page from Task 8: add a view filter (`new | approved | rejected`), and per-card actions:
- **New** view: 👍 Approve → `PATCH {status:'approved'}`; 👎 Dislike → opens a small inline reason picker (tags: `too generic`, `off-brand`, `not my style`, `seen it before`, or skip), then `PATCH {status:'rejected', feedback_reason}`.
- **Approved** view: shows keepers; allow moving back to New (`PATCH {status:'new'}`).
- **Disliked** view: shows rejected ideas + their `feedbackReason`; **Restore** → `PATCH {status:'new', feedback_reason:null}`.
- Header counts per view; **Generate more ideas** button → `POST /api/ideas { project_id }`, then re-fetch.

Use the dislike reason picker as a tiny inline popover/menu (tag buttons + "Skip"). Local state moves the card between views optimistically after each PATCH.

```tsx
// reason tags
const DISLIKE_REASONS = ["too generic", "off-brand", "not my style", "seen it before"];
// dislike handler
async function dislike(idea: Idea, reason: string | null) {
  await fetch(`/api/ideas/${idea.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "rejected", feedback_reason: reason }),
  });
  setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, status: "rejected", feedbackReason: reason } : i));
}
```

- [ ] **Step 2: Verify + smoke**

`npx tsc --noEmit` clean; eslint clean. Smoke: approve moves a card to Approved; dislike with a tag moves it to Disliked and shows the reason; restore returns it to New; "Generate more" appends new cards to New.

- [ ] **Step 3: Commit**

```bash
git add app/project/[id]/ideas/page.tsx
git commit -m "feat: idea review feed with like/dislike + reasons"
```

## Task 13: Research API + Trends tab — history, dismiss, mode

**Files:**
- Modify: `app/api/research/route.ts` (GET filter dismissed + order; POST append + `mode`; dismiss support)
- Modify: `app/project/[id]/trends/page.tsx` (mode toggle, dismiss, select-subset)

**Interfaces:**
- Produces:
  - `GET /api/research?project_id` → non-dismissed trends, ordered `created_at desc`.
  - `POST /api/research { project_id, mode }` (`mode: 'niche'|'broad'`) → appends new trends (`created_at` set by default), does NOT delete history.
  - `PATCH /api/research { trend dismiss }` — set `dismissed=true` for given trend id(s). (Add a `PATCH` handler; trends need an `id` — add `id` to the GET select.)
  - Trends tab: mode toggle (In their niche / Broadly trending), per-trend Dismiss, optional select-subset (selection is passed to the Ideas generate call later if wired; for now selection just visually marks).

- [ ] **Step 1: GET — filter dismissed, return id, order**

In `research.ts` GET: add `id` to the select, add `.eq('dismissed', false)` and `.order('created_at', { ascending: false })`, and include `id` in the mapped trend objects (extend the `Trend` mapping with `id: row.id`).

- [ ] **Step 2: POST — accept `mode`, append instead of replace**

Accept `mode` from the body (default `'niche'`). When `mode === 'broad'`, build the search `queries` without the niche/profile (platform-wide trending queries, e.g. `trending TikTok content ${monthYear}`, `viral Instagram Reels formats ${monthYear}`) and steer the prompt to platform-wide trends. **Remove** the `await supabase.from('trends').delete()...` line so refresh appends to history (the new rows get `created_at` by default).

- [ ] **Step 3: PATCH — dismiss**

Add a `PATCH` handler to `research.ts`:

```ts
export async function PATCH(req: NextRequest) {
  const { trend_id, dismissed } = await req.json() as { trend_id: string; dismissed: boolean };
  if (!trend_id) return NextResponse.json({ error: "trend_id required" }, { status: 400 });
  const { error } = await supabase.from("trends").update({ dismissed }).eq("id", trend_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Trends tab — mode toggle + dismiss**

In `trends/page.tsx`: add a two-button mode toggle (`niche`/`broad`) whose value is sent in the refresh POST body; add a **Dismiss** action per card calling `PATCH /api/research { trend_id, dismissed: true }` and removing it from local state; add a `Trend.id` field to the local type (GET now returns it).

- [ ] **Step 5: Verify + smoke**

`npx tsc --noEmit` clean; eslint clean. Smoke: refresh in `niche` then `broad` appends trends (count grows, history kept); dismiss hides a trend; generating ideas afterward uses only non-dismissed trends (qualitative).

- [ ] **Step 6: Commit**

```bash
git add app/api/research/route.ts app/project/[id]/trends/page.tsx
git commit -m "feat: trends history, dismiss, and niche/broad research modes"
```

## Task 14: Home hub — revised tiles

**Files:**
- Modify: `app/project/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/ideas` (status counts incl. `rejected`), `GET /api/research`.
- Produces: tiles for New-awaiting-review / Approved / Disliked / Trends (+ last refreshed), newest-trends preview, primary actions (Research trends, Generate ideas).

- [ ] **Step 1: Update counts + tiles**

Extend the Home hub: compute `new`/`approved`/`rejected` counts from `GET /api/ideas`; add a "newest trends" preview (top 3 from `GET /api/research`); keep the Research trends / Generate ideas actions. Generate ideas here calls `POST /api/ideas { project_id }` then routes to `/ideas`.

- [ ] **Step 2: Verify + smoke**

`npx tsc --noEmit` clean; eslint clean. Smoke: Home reflects correct counts after approving/disliking on the Ideas tab.

- [ ] **Step 3: Commit**

```bash
git add app/project/[id]/page.tsx
git commit -m "feat: Home hub revised tiles for the idea loop"
```

---

## Self-Review (completed by author)

- **Spec coverage:** Tabbed workspace (Tasks 3,5–9) · onboarding gate + `onboarded` (Tasks 1,2,4) · idea lifecycle `new/approved/rejected` (Tasks 10–12) · optional dislike reason → steering (Tasks 10–12) · avoid-repeats (Task 11) · trends feed + history + dismiss + niche/broad (Tasks 10,13) · analytics as a tab, separate from engine (Task 9) · Home hub (Tasks 5,14) · dark theme throughout (all UI tasks). Posting/performance explicitly excluded — no task adds it. ✓
- **Placeholder scan:** Restyle Tasks 7,8,12,13,14 reference adapting existing files; the logic-bearing code (migrations, API changes, layout, context, tabs, home, profile) is given in full. No "TBD"/"handle edge cases"/"add validation" left. ✓
- **Type consistency:** `Project` type (Task 3) used by all tabs; idea `status` is `new|approved|rejected` consistently across migration (Task 10), API (Task 11), and UI (Task 12); `feedback_reason` (DB) ⇄ `feedbackReason` (API/UI) mapping stated in Task 11 and used in Task 12; trend `id` added in Task 13 GET before the tab consumes it. ✓
- **Open confirmation:** Task 9 flags deleting `output.tsx` (Export) — confirm with user whether to preserve Export as an Ideas-tab action before removing.
