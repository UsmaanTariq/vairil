# TrendForge UX — Light & Editorial Design

**Date:** 2026-06-16  
**Scope:** Visual polish only — no structural UX changes (no progress stepper, no new nav)  
**Direction:** Light & Editorial — clean white surfaces, sharp black typography, generous whitespace. Notion/Linear aesthetic.  
**Files changed:** 7 (4 substantive, 3 single-line heading-class updates)

---

## Design Principles

- **Neutral palette** — no accent colors, just black, white, and grays
- **Typography-led hierarchy** — weight and tracking do the work that color would otherwise do
- **Surfaces create depth** — white cards on off-white page, a hairline under the header
- **Status through shape, not color** — filled chip = active, outline chip = early, text = done

---

## Section 1 — Design System

### `app/layout.tsx`

- Update `metadata.title` from `"Create Next App"` to `"TrendForge"`
- No `dark` class added — the app stays pure light mode. All existing `dark:` Tailwind classes remain in place (safe to enable dark mode later without re-doing this work)

### `app/globals.css` — `:root` token changes

| Token | Before | After | Reason |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.985 0 0)` | Barely-off-white page, so white cards lift off it |
| `--card` | `oklch(1 0 0)` | `oklch(1 0 0)` | Cards stay pure white |
| `--radius` | `0.625rem` | `0.5rem` | Slightly crisper corners, more editorial feel |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.09 0 0)` | Richer, denser black for primary buttons and text |

No `.dark` block changes — dark mode tokens remain untouched.

---

## Section 2 — Dashboard (`app/(dashboard)/page.tsx`)

### Wordmark

```
Before: text-3xl font-bold tracking-tight text-zinc-900
After:  text-3xl font-extrabold tracking-tighter text-neutral-950
```

Heavier weight + tighter tracking gives the brand name more authority on the page.

### Status badge system

Replace the generic shadcn `<Badge variant="secondary|default">` with inline-styled chips that communicate stage meaning at a glance:

| Stage | Style | Rationale |
|---|---|---|
| `intake`, `interview`, `synthesis` | Outline chip — `border border-neutral-300 text-neutral-400 bg-transparent` | Work not yet in active phase; de-emphasized |
| `research`, `ideas` | Filled chip — `bg-neutral-100 text-neutral-800 font-medium` | Active stage; should be visible |
| `done` | Plain text — `text-neutral-400` | No chip at all; project is complete |

### Cards

- Background: `bg-white` (cards) on `bg-neutral-50` (page) — subtle depth
- Border: `border-neutral-200` (slightly warmer than current `ring` style)
- Hover: `hover:border-neutral-400` (already close; tighten to `hover:shadow-none hover:border-neutral-400`)

---

## Section 3 — Project page (`app/project/[id]/page.tsx`)

### Header breadcrumb

Replace the two-line `TRENDFORGE` label + client name with a single compact editorial header:

```tsx
// Before
<p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">TrendForge</p>
<h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{project.client_name}</h2>

// After
<p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[.15em] mb-2">
  TrendForge · {project.client_name}
</p>
<h2 className="text-2xl font-extrabold tracking-tighter text-neutral-950">
  {project.client_name}  {/* keep the full name large — the breadcrumb is a byline */}
</h2>
```

### Separator under header

Add `<div className="border-b border-neutral-100 mb-8" />` below the header block before the stage component renders. Creates a visual anchor between chrome and content.

### Stage section headings

The per-stage `<h3>` titles (e.g. `"Trend research"`, `"Business profile"`, `"Content plan"`) should match the header weight:

```
Before: text-lg font-semibold text-zinc-900
After:  text-lg font-extrabold tracking-tight text-neutral-950
```

This touches: `research.tsx`, `synthesis.tsx`, `output.tsx` (read-only update — just class strings, no logic).

---

## What Does NOT Change

- `intake.tsx` — platform pills (selected = `bg-zinc-900 text-white`) already editorial; no change
- `interview.tsx` — numbered question list with textareas; fine as-is
- `ideas.tsx` — dark hook block (`bg-zinc-900`), emerald approved state; already correct
- `output.tsx` tab underline — `border-zinc-900` active state is already editorial
- `research.tsx` confidence pills — emerald/amber/zinc with existing dark variants; fine
- All loading/error states — `text-zinc-400`, error panels with red tints; correct

---

## Files Changed Summary

| File | Change |
|---|---|
| `app/layout.tsx` | Fix metadata title |
| `app/globals.css` | Slight background, radius, primary token refinements |
| `app/(dashboard)/page.tsx` | Wordmark weight/tracking, semantic badge system, card bg |
| `app/project/[id]/page.tsx` | Combined breadcrumb byline, separator, heading weight |

Additionally, the `h3` heading class in `research.tsx`, `synthesis.tsx`, and `output.tsx` gets a weight/tracking update — but this is a single-line class string change in each, no logic touched.

---

## Success Criteria

- The app feels editorial and deliberate — like a polished internal tool, not a shadcn/ui demo
- Typography has a clear hierarchy: wordmark > client name > section title > body
- Status badges communicate stage position without needing to read the label closely
- No regression — all existing functionality (loading states, error states, file upload, platform pills) looks correct
