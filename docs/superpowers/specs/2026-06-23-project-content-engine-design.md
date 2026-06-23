# Project Content Engine — Design

**Date:** 2026-06-23
**Status:** Approved design, pending spec review → implementation plan

## Problem

The project page (`/project/[id]`) is a linear wizard driven by a single
`projects.status` enum (`intake → interview → synthesis → research → ideas →
done`). The page renders exactly one stage based on status, so:

- `status` is overloaded — it means both "where am I in the wizard" and "what's
  finished."
- It's a one-shot funnel. `done`/Export is a terminal dead-end; there's no loop
  to come back and generate more.
- Trends are a frozen one-time snapshot used to seed exactly one batch of ideas.
  The user can't freely go back and research new trends.
- Idea generation is a rigid one-shot batch with no memory of what the client
  actually wants.

## Goal

Turn a project from a **linear wizard** into an **ongoing content engine**: a
living per-client workspace where the client researches trends in their field
(or broadly trending content), generates content ideas on demand, and **likes /
dislikes** ideas. Disliked ideas steer future generation away from similar
concepts. Setup happens once.

**Explicitly out of scope:** tracking whether ideas get posted, linking ideas to
real published posts, or feeding post performance back into generation. What the
client does with an approved idea is their business. The existing per-project
**Analytics** page remains available as its own tab but is **not** part of the
idea engine.

## Architecture & Navigation

The project page stops being status-driven and becomes a **tabbed workspace**
under a shared layout at `app/project/[id]/layout.tsx`. The layout fetches the
project once and renders the dark `AppShell` (consistent with the rest of the
app — the project area is currently still the old light/purple theme) with a
project-scoped header (breadcrumb: `TrendForge › <client name>`) and a tab bar.

**Onboarding gate.** The layout reads `projects.onboarded`:

- `false` → render the onboarding flow only (the existing Brief → Questions →
  Profile steps, restyled to dark). The tab bar is hidden/disabled. Completing
  synthesis sets `onboarded = true`.
- `true` → render the tab bar + the active sub-route. Onboarding never blocks
  again; the profile stays editable from the Profile tab.

**Routes (all share the layout):**

| Route | Tab | Notes |
|---|---|---|
| `/project/[id]` | Home | Snapshot hub focused on the loop |
| `/project/[id]/ideas` | Ideas | The review feed (New / Approved / Disliked) |
| `/project/[id]/trends` | Trends | Refreshable feed with history |
| `/project/[id]/analytics` | Analytics | The existing analytics page, slotted in |
| `/project/[id]/profile` | Profile | Business profile editor (replaces the modal) |

`projects.status` is no longer the master switch — it collapses to "onboarded or
not" and only tracks onboarding sub-steps (`intake → interview → synthesis`)
until `onboarded` flips true. After that it is not read for routing.

## Data Model

Column additions only — **no new tables**. Two migrations under
`supabase/migrations/` (one per phase), run via `npm run migrate`.

### Phase 1 — `projects`

- Add `onboarded boolean default false`.
- Backfill: `onboarded = true` where a `synthesis` row exists for the project
  **or** `status in ('research','ideas','done')`.

### Phase 2 — `ideas` (lifecycle + dislike feedback)

- Remap `status`: `draft → new`, `approved → approved`; new third state
  `rejected`. Final set: **`new | approved | rejected`** (default `new`).
- Add `created_at timestamptz default now()` — ordering, "new" badges, de-dup.
- Add `feedback_reason text` (nullable) — optional one-tap reason/tag captured
  when an idea is disliked; fed into the next generation for precise steering.
- **No** `posted_*` fields. Posting is out of scope.

### Phase 2 — `trends` (refreshable feed with history)

- Add `created_at timestamptz default now()` — the table currently has no
  timestamp; history needs it.
- Add `dismissed boolean default false` — prune stale trends from the feed and
  from generation input without deleting the record.

> Pre-existing gap noted but **not** addressed here: the `trends` table has no
> `description` column though the UI references `trend.description` (it falls
> back to `relevance`). Left as-is.

## Phase 1 — Workspace Shell + Onboarding

Goal: kill the funnel. Make everything a freely-navigable, dark-themed tab with
one-time onboarding. No lifecycle/board/history/feedback yet.

- **`app/project/[id]/layout.tsx`** — fetch project, render `AppShell` + header +
  tab bar, apply the onboarding gate.
- **Onboarding** — existing Brief → Questions → Profile steps restyled to dark;
  finishing sets `onboarded = true`. Shown only when `onboarded = false`.
- **Tabs (Phase 1 behaviour):**
  - **Home** — lightweight hub: stat tiles (idea count, approved count, trends
    count, last refreshed), newest trends preview, primary actions (Generate
    ideas, Refresh trends, View analytics).
  - **Ideas** — the *current* ideas list, restyled (full feed in Phase 2).
  - **Trends** — current research view, restyled, with **Refresh trends** always
    available (history/dismiss in Phase 2).
  - **Analytics** — the existing analytics page, slotted in as a tab.
  - **Profile** — the current profile modal's fields rendered as a real page.

**Outcome:** Export is no longer terminal; there is no forced linear path. The
client roams tabs and re-runs Generate / Refresh freely.

## Phase 2 — The Idea Engine

### Ideas tab — review feed (not a kanban)

Filterable views over the project's ideas:

- **New** (default) — freshly generated, awaiting a verdict. Each card has
  👍 **Approve** / 👎 **Dislike**. Dislike opens a one-tap optional reason:
  quick tags (e.g. *too generic / off-brand / not my style*) or skip.
- **Approved** — the keepers (the client's shortlist).
- **Disliked** — what they said no to, reviewable with the reason if given; can
  be restored to New.
- Persistent **Generate more ideas** action.
- Cards keep the existing rich detail: hook, script, shot list, audio, caption,
  hashtags, why.

### Generation loop

When generating, the engine sends the model:

1. the client **profile**,
2. the **current (non-dismissed) trends** — optionally only the subset the
   client selected,
3. **avoid-repeats:** titles/hooks of all existing ideas for the project,
4. **negative steering:** the disliked ideas + their `feedback_reason`s, as an
   explicit instruction to generate clearly different concepts.

New ideas are appended as a fresh batch in **New**; nothing is overwritten.

### Trends tab

Refreshable feed with history:

- **Refresh trends** appends new dated trends (using `created_at`).
- Stale trends can be **dismissed** (hidden from the feed and from generation
  input; not deleted).
- Optionally select a subset of current trends to generate from.
- **Research mode toggle:** **In their niche** (uses the profile) vs **Broadly
  trending** (platform-wide, niche-agnostic).

### Home hub (revised)

Focused on the loop, not posting: tiles (New awaiting review / Approved /
Disliked / trends count + last refreshed), newest trends preview, and the two
primary actions — **Research trends** and **Generate ideas**. No
posted/performance widgets.

### Analytics tab

Unchanged — the existing per-project analytics page, present as a tab but
separate from the engine.

## API Changes

- **`PATCH /api/ideas/[id]`** — extend to set `status` (`new | approved |
  rejected`) and `feedback_reason`.
- **`POST /api/ideas`** (generate) — read all existing ideas (avoid-repeats) and
  all `rejected` ideas + reasons (negative steering); append new `new` ideas
  rather than gating status.
- **`POST /api/research`** — accept a `mode` param (`niche | broad`); persist
  trends with `created_at`; support appending to history.
- **`GET /api/research`** — return non-dismissed trends ordered by `created_at`.
- **New: trend dismiss** — `PATCH`/endpoint to set `trends.dismissed = true`.
- **`PATCH /api/projects/[id]`** — set `onboarded` when synthesis completes.

## Error Handling

- Generation/research failures surface inline (existing `GenerationProgress` +
  error patterns) and never advance/overwrite state on failure.
- Onboarding gate is server-evaluated in the layout; a project with no profile
  always lands in onboarding regardless of stale `status`.
- Empty states: no trends yet → prompt to Research; no ideas yet → prompt to
  Generate; all ideas triaged → "all caught up, generate more."

## Testing

Light, per the project's testing preference — smoke-checks, not deep suites:

- Migrations apply and backfill correctly (existing projects become `onboarded`;
  `draft → new` remap).
- Onboarding gate routes correctly (un-onboarded → onboarding; onboarded →
  tabs).
- Like/dislike updates persist and move cards between views.
- Generate excludes repeats and disliked concepts (manual smoke check of the
  prompt payload + output).
- Trends refresh appends with dates; dismiss hides from feed and generation.
- Typecheck + lint clean; dark theme renders on every tab.

## Migration / Rollout

- Phase 1 ships first and is independently usable (workspace + onboarding,
  existing ideas/trends restyled).
- Phase 2 adds the lifecycle remap, feedback, trends history, and the steering
  loop.
- Each phase has its own SQL migration; backfills are idempotent.

## Out of Scope

- Posting / scheduling / linking ideas to published posts.
- Feeding post performance into generation.
- Auto/scheduled trend refresh (manual refresh only for now).
- Any change to the analytics feature beyond slotting it in as a tab.
