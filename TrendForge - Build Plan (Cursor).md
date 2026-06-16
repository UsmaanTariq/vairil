# TrendForge — Build Plan for Cursor / Claude

A working build guide for an internal tool that turns a client brief into a researched short-form content plan (scripts + shot lists), anchored to current TikTok/Instagram trends.

**Stack:** Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · Anthropic (Claude) · a search API (Tavily) · Supabase (Postgres + auth) · Vercel.

**How to use this doc:** work through the build order in Section 7 one slice at a time. Paste the kickoff prompt (Section 8) into Cursor to scaffold, then feed it each step. Build single-user first; multi-user can come later.

---

## 1. What you're building (one screen of context)

A guided, multi-step web app. One project = one client. The flow:

```
Intake  →  Clarifying Questions  →  Synthesis (confirm)  →  Trend Research  →  Ideas (script + shots)  →  Output
```

Each AI stage is a **separate server-side call with a strict system prompt and a JSON output schema** — not one giant prompt. Stages are chained: each one's structured output is the next one's input. Two human checkpoints (after questions, after synthesis) stop errors compounding.

---

## 2. File / folder structure

```
trendforge/
├─ app/
│  ├─ (dashboard)/
│  │  └─ page.tsx                  # project list + "New project"
│  ├─ project/[id]/
│  │  ├─ page.tsx                  # project shell, routes between stages by status
│  │  ├─ intake.tsx               # Stage 1 UI
│  │  ├─ interview.tsx            # Stage 2 UI
│  │  ├─ synthesis.tsx            # Stage 3 UI (editable + confirm)
│  │  ├─ research.tsx             # Stage 4 UI (trend cards)
│  │  ├─ ideas.tsx               # Stage 5 UI (idea cards + regenerate)
│  │  └─ output.tsx              # Stage 6 UI (export)
│  └─ api/
│     ├─ projects/route.ts        # CRUD projects
│     ├─ intake/route.ts          # parse brief/files → normalised brief
│     ├─ questions/route.ts       # agent: generate clarifying questions
│     ├─ synthesis/route.ts       # agent: build business profile
│     ├─ research/route.ts        # agent: web-augmented trend research
│     ├─ ideas/route.ts           # agent: generate ideas (+ critic loop)
│     └─ export/route.ts          # compile DOCX/PDF (+ optional Notion)
├─ lib/
│  ├─ anthropic.ts                # Claude client + a callAgent() helper
│  ├─ search.ts                   # Tavily wrapper
│  ├─ db.ts                       # Supabase client
│  ├─ prompts/                    # one file per agent system prompt
│  │  ├─ questions.ts
│  │  ├─ synthesis.ts
│  │  ├─ research.ts
│  │  ├─ ideas.ts
│  │  └─ critic.ts
│  ├─ schemas.ts                  # zod schemas = single source of truth for I/O
│  └─ parse.ts                    # pdf/docx → text (pdf-parse, mammoth)
├─ components/                    # shadcn components + shared cards
├─ supabase/
│  └─ schema.sql                  # tables (Section 5)
├─ .env.local
└─ package.json
```

**Principle:** the zod schemas in `lib/schemas.ts` are the contract. Every agent returns data that parses against a schema; the UI renders from the parsed object. If you change a schema, you change the prompt and the UI together.

---

## 3. The agent pattern (one helper for all stages)

Every AI stage uses the same shape: a system prompt + structured input → JSON out, validated against a zod schema. Use Claude tool-calling (or a `response_format`-style JSON instruction) to force structure.

```ts
// lib/anthropic.ts  (sketch)
export async function callAgent<T>({
  system, input, schema, tools,           // tools optional (research uses web search)
}: {
  system: string; input: string; schema: z.ZodSchema<T>; tools?: Tool[];
}): Promise<T> {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system,
    tools,
    messages: [{ role: "user", content: input }],
  });
  const json = extractJson(res);          // pull JSON from the response / tool call
  return schema.parse(json);              // throws if the model went off-schema
}
```

Only the **research** agent gets a web-search tool. Everything else reasons over prior structured output.

---

## 4. Agent system prompts

Paste these into `lib/prompts/*`. Tune wording as you test — the critic prompt especially.

### 4.1 Questions agent (`prompts/questions.ts`)
```
You are a content strategist interviewing a marketer about their client.
You are given a client brief and business plan. Your job: identify what is
MISSING or unclear, and ask only the questions needed to plan content well.

Rules:
- Ask 5–10 questions. Skip anything the brief already answers clearly.
- Cover, only where unknown: target audience (who/age/location/pain points),
  positioning & differentiator, offers/products to push, tone & brand
  personality, content goals (awareness/footfall/sales/followers), filming
  constraints (on-camera comfort, who films, gear, location, budget), and
  what's already been tried + how it performed.
- Each question must be specific to THIS business, not generic.
- Return JSON only, matching the provided schema.
```

### 4.2 Synthesis agent (`prompts/synthesis.ts`)
```
You turn a brief + interview answers into a tight, structured business profile
that later stages will rely on as the single source of truth.

Produce: one-line description, audience (with location), positioning/
differentiator, offers, tone, content goals, and filming constraints.
Be concrete and specific. Do not invent facts not supported by the inputs;
if something is unknown, say "unknown". Return JSON only, matching the schema.
```

### 4.3 Research agent (`prompts/research.ts`) — has web search
```
You research CURRENT short-form video trends relevant to a specific business,
on TikTok and Instagram. You have a web search tool — use it.

Method:
- Build several targeted queries from the niche, audience and platforms, e.g.
  "trending {niche} reels {month year}", "TikTok {niche} hooks",
  "{niche} content formats going viral", plus relevant creators/competitors.
- Prefer recent sources. Capture the date and a source URL for each trend.
- Deduplicate. Keep the 6–10 most relevant, highest-confidence trends.

For each trend return: name/description, platform, format type (talking-head /
transition / POV / listicle / green-screen / etc.), associated audio or sound
(if any), a one-line "why it fits this client", a confidence (high/med/low),
a date, and a source URL.

Be honest: you are inferring trends from the open web, not live platform data.
Do not fabricate sources. Return JSON only, matching the schema.
```

### 4.4 Ideas agent (`prompts/ideas.ts`)
```
You generate short-form video ideas for a specific business, each anchored to
one of the supplied current trends. Generate {N} ideas (default 6).

Each idea MUST be filmable as-is and impossible to copy-paste to another
business — use the real offers, audience, location and constraints from the
business profile, and respect the filming constraints.

Each idea includes: title, the trend it's based on, a word-for-word hook
(first 3 seconds), a full script/voiceover, a numbered shot list (what to
film + framing + b-roll), suggested audio/sound and on-screen text, a caption
+ hashtag starter, and a one-line "why this works".

Return JSON only, matching the schema.
```

### 4.5 Critic agent (`prompts/critic.ts`) — the anti-generic gate
```
You review a batch of content ideas against a "non-generic" rubric and decide
which must be regenerated.

Score each idea 1–5 on: (a) tied to a SPECIFIC current trend, (b) uses
SPECIFIC details of THIS business (offer/audience/location), (c) respects
filming constraints, (d) has a concrete hook + script + shot list.

Flag for regeneration any idea scoring 3 or below on any axis, or that could
plausibly be posted by a different business in the same niche unchanged.
Return JSON: for each idea, {keep: boolean, reasons: string[]}.
```

**Critic loop:** run ideas → run critic → for every `keep:false`, call the ideas agent again with the critic's reasons appended, until all kept or a max of 2 retries.

---

## 5. Database schema (`supabase/schema.sql`)

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  client_name text,
  niche text,
  platforms text[],            -- ['tiktok','instagram']
  status text default 'intake',-- intake|interview|synthesis|research|ideas|done
  created_at timestamptz default now()
);

create table briefs (
  project_id uuid references projects(id) on delete cascade,
  raw_text text,
  file_refs text[],
  parsed_text text
);

create table answers (
  project_id uuid references projects(id) on delete cascade,
  qa jsonb                     -- [{question, answer}]
);

create table synthesis (
  project_id uuid references projects(id) on delete cascade,
  profile jsonb,               -- confirmed business profile
  confirmed boolean default false
);

create table trends (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text, platform text, format text, audio text,
  relevance text, source_url text, trend_date text, confidence text
);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text, trend_ref text, hook text, script text,
  shot_list jsonb, audio text, caption text, why text,
  status text default 'draft'  -- draft|approved
);
```

Matching zod schemas live in `lib/schemas.ts` and are reused by the agents and the UI.

---

## 6. Environment variables (`.env.local`)

```
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NOTION_API_KEY=          # optional, Phase 3
```

---

## 7. Build order (slices — ship each before the next)

**Slice 0 — Scaffold.** `create-next-app` (TS, App Router, Tailwind), add shadcn/ui, Supabase client, Anthropic + Tavily wrappers, zod schemas. Run the schema.sql.

**Slice 1 — Projects + Intake.** Dashboard list, "New project", intake form (brief/plan paste + file upload + niche + platform toggles). `parse.ts` for PDF/DOCX → text. Persist a brief. *Done when:* you can create a project and see its brief saved.

**Slice 2 — Questions + Synthesis.** `questions` agent → render dynamic form → save answers → `synthesis` agent → editable profile with a **Confirm** button. *Done when:* one brief produces a confirmed profile.

**Slice 3 — Idea generation (basic research).** Wire the `ideas` agent off the confirmed profile. For research, start with a single simple Tavily query so ideas have something to anchor to. Render idea cards with hook/script/shots. *Done when:* you get a full plan end-to-end, even if research is shallow.

> At the end of Slice 3 you have a usable MVP. Stop and actually use it on a real client before building more.

**Slice 4 — Real research engine.** Multi-query, dedupe, rank, sourced trend cards (Section 4.3). Replace the placeholder from Slice 3.

**Slice 5 — Critic loop.** Add the `critic` agent + regeneration loop. This is where quality jumps — budget time to tune both prompts.

**Slice 6 — Output + polish.** DOCX/PDF export, regenerate-per-idea, "approve" status, saved library. Optional Notion push.

**Slice 7 (optional).** Multi-user/auth hardening, reusable trend library across same-niche clients, light performance tracking.

---

## 8. Kickoff prompt for Cursor

Paste this first to scaffold Slice 0:

```
Build the scaffold for "TrendForge", a Next.js (App Router, TypeScript) web app.
Use Tailwind + shadcn/ui. Set up:
- Supabase client (lib/db.ts) and run the SQL I'll paste for tables.
- An Anthropic client in lib/anthropic.ts exposing a generic callAgent({system,
  input, schema, tools}) helper that calls Claude, extracts JSON, and validates
  it with a passed zod schema.
- A Tavily search wrapper in lib/search.ts.
- lib/schemas.ts with zod schemas for: NormalisedBrief, Question[], Profile,
  Trend, Idea (fields as I'll specify).
- The folder structure for app/project/[id] stages and app/api routes as I'll
  describe.
Don't implement the agents yet — just the scaffolding, types, and empty API
route handlers. Use environment variables, never hard-coded keys.
```

Then feed it Section 2 (structure), Section 5 (schema), and each slice in order. Add the agent prompts from Section 4 when you reach Slices 2–5.

---

## 9. Watch-outs while building

- **Force structured output.** If an agent returns prose instead of JSON, the UI breaks. Use tool-calling/JSON mode and `schema.parse()` to fail loudly.
- **Cache research per project.** Don't re-run Tavily/Claude on every page load — store results and only regenerate on demand. Keeps cost trivial.
- **Don't scrape TikTok/Instagram directly** (ToS). Stay on the search API + public web.
- **Label trend confidence + date** in the UI so you always know how fresh/solid a trend is.
- **Keep stages independently testable.** Because each agent is one call with one schema, you can build a tiny test page that runs a single stage on saved input while tuning prompts.
```
```

*Draft v0.1 — companion to "TrendForge — Strategy & Build Spec".*
