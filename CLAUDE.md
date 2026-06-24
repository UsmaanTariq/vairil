# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ The import above is load-bearing: this is a modified Next.js 16 fork. APIs and
> conventions differ from upstream/training data. Before writing Next.js code, read
> the relevant guide under `node_modules/next/dist/docs/` (`01-app`, `02-pages`,
> `03-architecture`) and heed deprecation notices.

## Commands

```bash
npm run dev        # dev server (localhost:3000)
npm run build      # production build
npm run lint       # eslint (flat config in eslint.config.mjs)
npm run migrate    # apply supabase/schema.sql + all supabase/migrations/*.sql in name order
npx tsc --noEmit   # typecheck — there is no test runner; this + lint + a dev/Playwright smoke is the verification convention
```

`npm run migrate` runs SQL against the live Supabase project via its Management API
(needs `SUPABASE_ACCESS_TOKEN`). `schema.sql` is idempotent (`IF NOT EXISTS`); add
schema changes as a new dated file in `supabase/migrations/` and keep backfills idempotent.

## What this is

Vairil/TrendForge: an agency tool that generates short-form video content ideas for
client businesses, each anchored to a current trend, and tracks per-client social
analytics. Dark black-and-white theme is the default.

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn +
`@efferd` registry (`@/components/ui/*`, style `base-nova`) · Supabase · recharts · next-themes.

**Data access is server-only.** Client components never touch Supabase directly —
they `fetch('/api/*')`. Route handlers in `app/api/**` use `@/lib/db` (`supabase` =
publishable key; `supabaseAdmin()` = service-role key). Field convention: DB columns
are snake_case, API/TS payloads are camelCase — map at the route boundary
(`trend_ref⇄trendRef`, `shot_list⇄shotList`, `feedback_reason⇄feedbackReason`).

**LLM calls go through `@/lib/anthropic` `callAgent`** — a non-streaming wrapper
(`max_tokens: 8000`) that takes a system prompt, input, a Zod `schema`, optional
`tools`/`toolChoice`, `model`, and `effort`. It forces a tool call or extracts JSON,
then validates with the schema. Prompts live in `lib/prompts/*`, schemas in
`lib/schemas.ts`. Notes baked into the wrapper: Opus 4.7+ reject `temperature` (only
Sonnet/Haiku accept it); `effort` maps to `output_config.effort`. Per the user's
claude-api rule, **default to `claude-opus-4-8` and never downgrade the model unless
the user explicitly names another.** (Idea generation deliberately uses
`claude-sonnet-4-6` at `effort: 'low'` for speed — that was a measured decision, not a default.)

**External data sources** (all `lib/*`): Tavily (`lib/search.ts`) for trend research;
RapidAPI (`lib/tiktok.ts`, `lib/instagram.ts`) for social profile/post stats.

**Auth** is a single shared secret. `middleware.ts` redirects to `/login` unless the
`tf_auth` cookie equals `APP_SECRET`; it excludes `/login`, `/api/auth`, `/api/cron`,
and static assets. Playwright smoke tests authenticate by setting
`document.cookie = "tf_auth=<APP_SECRET>; path=/"` after loading `/login`.

**Cron:** `vercel.json` calls `GET /api/cron/refresh-all` daily; it's gated by a
`Bearer ${CRON_SECRET}` header and refreshes TikTok/Instagram snapshots.

## Routes

- `app/(dashboard)/` — dashboard home + `accounts/` (clients → project analytics).
- `app/project/[id]/` — per-client **content engine** under a shared `layout.tsx`.
  The layout fetches the project and gates on `projects.onboarded`: `false` → the
  onboarding flow only (intake → interview → synthesis); `true` → a tabbed workspace
  (Home / Ideas / Trends / Analytics / Profile). `projects.status` is no longer the
  routing master switch — it only tracks onboarding sub-steps until `onboarded` flips.
- Ideas have a taste loop, not a posting/performance tracker: `ideas.status` is
  `new | approved | rejected`; disliked ideas + their `feedback_reason` steer the next
  generation away from similar concepts (see `app/api/ideas/route.ts`). Trends are a
  refreshable feed (`created_at`, `dismissed`). Design rationale:
  `docs/superpowers/specs/2026-06-23-project-content-engine-design.md`.

## Conventions

- File references in chat use markdown links, e.g. [middleware.ts](middleware.ts).
- Light testing: smoke-check (typecheck + lint + a quick dev/Playwright pass), not deep suites.
- Commit/push only when asked. Work happens on `main`.
