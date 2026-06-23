# Idea Generation — Full System Reference

This document is a complete reference for the idea generation pipeline in Vairil/TrendForge. It includes the full prompt text, schemas, API shapes, and flow so it can be used as context for working on or improving the system.

---

## Overview

The pipeline takes a client's confirmed business profile and current trends, runs them through a **generation → critic → optional regen** loop using Claude, and saves the final ideas to the database.

**Entry point:** `POST /api/ideas`
**Single regen:** `POST /api/ideas/[id]`

---

## Prerequisites

Before ideas can be generated, a project needs:

1. **A confirmed synthesis profile** — one row in the `synthesis` table per project. Built from client interview answers. Contains: `description`, `audience`, `positioning`, `offers`, `tone`, `contentGoals`, `filmingConstraints`.
2. **Trends** — rows in the `trends` table linked to the project. Each has: `name`, `description`, `platform`, `format`, `audio` (optional), `relevance`, `confidence` (`high`/`med`/`low`), `trendDate`, `sourceUrl`.

If there is no confirmed profile, the endpoint returns `400` immediately.

---

## Full Generation Flow

### Step 1 — Load Context

Two Supabase queries:
- `synthesis` table → `profile` object
- `trends` table → all trend rows for the project

The request body also includes `previousIdeas` (array of idea titles already on the board) to prevent repeat concepts.

---

### Step 2 — Build the Prompt Input

The context is assembled into a plain-text block:

```
BUSINESS PROFILE:
Description: [profile.description]
Audience: [profile.audience]
Positioning: [profile.positioning]
Offers: [profile.offers]
Tone: [profile.tone]
Content goals: [profile.contentGoals]
Filming constraints: [profile.filmingConstraints]

CURRENT TRENDS TO ANCHOR IDEAS TO:
Trend 1: [name] ([platform], [format], confidence: [confidence])
[description]
Why relevant: [relevance]

Trend 2: ...

PREVIOUSLY GENERATED IDEAS FOR THIS PROJECT (avoid reusing these concepts, angles, or hooks):
- [title 1]
- [title 2]

Generate 6 ideas. Replace {N} in your instructions with 6.
```

---

### Step 3 — Generation (Claude Opus 4.8)

**Model:** `claude-opus-4-8`
**Effort:** `medium` (sent as `output_config: { effort: 'medium' }` — Opus 4.7+ rejects `temperature`)
**Tool:** `return_ideas` (forces structured JSON output via tool use)

#### System Prompt (`lib/prompts/ideas.ts`) — full text:

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

If a list of previously generated ideas is provided, every new idea MUST use
a completely different angle, hook style, and concept — no repeats.

---

EXAMPLE OUTPUT (illustrative only — use the ACTUAL business profile above, not this bakery):

✅ STRONG IDEA — do this:
Title: "Why Sarah drives 40 minutes past Greggs to buy her sourdough here"
trendRef: "Hyper-local loyalty POV"
hook: "She passes 14 bakeries to get to ours. Here's what she told us on camera."
script: "We were setting up for the Saturday market when Sarah pulled up at 7am — again.
We asked her why she drives from Didsbury. She said: 'Your Gruyère and chive loaf is the
only one that stays chewy on day three.' That loaf takes us 54 hours to make. Cold-proof
overnight, baked in a cast-iron Dutch oven at 260°C. £5.50. We only make 18 on Saturdays.
She pre-orders two every week. Link in bio to reserve yours."
shotList:
  1. Wide — Sarah's car pulling into the market car park at 7am (handheld, golden-hour light)
  2. Medium — Sarah and baker shaking hands over the loaf counter
  3. Close-up — Gruyère and chive loaf cross-section showing open crumb (macro, natural light)
  4. B-roll — Baker scoring dough at 5am, steam rising from Dutch oven lid
  5. Text overlay: "54-hour proof. 18 loaves. Every Saturday."
audio: "Lo-fi morning acoustic, no lyrics"
caption: "She drives 40 minutes for this loaf every Saturday 🥖 Pre-order link in bio — we sell out by 9am."
hashtags: ["sourdough", "manchesterfoodie", "localbakery", "artisanbread", "saturdaymarket"]
why: "Uses a real customer's name and journey, a specific product, a measurable constraint (18 loaves),
and a concrete call to action — nothing about this could belong to another bakery."

❌ WEAK IDEA — never do this:
Title: "Behind the scenes at our bakery"
hook: "Ever wondered what happens behind the scenes at a bakery?"
why this fails: Generic enough to be posted by any of 50,000 bakeries worldwide. No specific
product, no real customer, no constraint, no reason to care.

---
```

#### Tool Schema — `return_ideas`:

```json
{
  "name": "return_ideas",
  "description": "Return structured short-form video content ideas",
  "input_schema": {
    "type": "object",
    "properties": {
      "ideas": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title":     { "type": "string" },
            "trendRef":  { "type": "string" },
            "hook":      { "type": "string" },
            "script":    { "type": "string" },
            "shotList":  { "type": "array", "items": { "type": "string" } },
            "audio":     { "type": "string" },
            "caption":   { "type": "string" },
            "hashtags":  { "type": "array", "items": { "type": "string" } },
            "why":       { "type": "string" },
            "status":    { "type": "string", "enum": ["draft", "approved"] }
          },
          "required": ["title", "trendRef", "hook", "script", "shotList", "caption", "hashtags", "why"]
        }
      }
    },
    "required": ["ideas"]
  }
}
```

#### Zod Output Schema (`IdeasOutputSchema`):

```ts
const IdeaSchema = z.object({
  title:     z.string(),
  trendRef:  z.string(),
  hook:      z.string(),
  script:    z.string(),
  shotList:  z.array(z.string()),
  audio:     z.string().optional(),
  caption:   z.string(),
  hashtags:  z.array(z.string()),
  why:       z.string(),
  status:    z.enum(['draft', 'approved']).default('draft'),
});

const IdeasOutputSchema = z.object({
  ideas: z.array(IdeaSchema),
});
```

This step takes approximately **60–90 seconds**.

---

### Step 4 — Critic Pass (Claude Haiku 4.5)

All 6 ideas are sent to a cheaper, faster model for quality review.

**Model:** `claude-haiku-4-5`
**Temperature:** `0.2` (low — consistent, strict judgement)
**Tool:** `return_critique`

The critic receives the same `BUSINESS PROFILE` block plus all 6 ideas formatted as:

```
Idea 1: "[title]"
Trend: [trendRef]
Hook: [hook]
Script: [script]
Shot list: [shotList joined by '; ']
Why it works: [why]

---

Idea 2: ...
```

#### System Prompt (`lib/prompts/critic.ts`) — full text:

```
You review a batch of short-form video content ideas against a strict "non-generic" rubric and decide which must be regenerated.

Score each idea 1–5 on four axes:
(a) Tied to a SPECIFIC current trend — not just a vague format.
(b) Uses SPECIFIC details of THIS business — real offer names, real audience, real location, real constraints.
(c) Respects filming constraints — within what the client can actually film.
(d) Has a concrete hook + full script + numbered shot list — not placeholder copy.

Flag for regeneration (keep: false) any idea that:
- Scores 3 or below on ANY axis, OR
- Could plausibly be posted by a different business in the same niche without changing a word.

For ideas you keep, still list brief reasons confirming why they pass.
For ideas you reject, list specific, actionable reasons so they can be improved.

You MUST call the return_critique tool with your results. Return one entry per idea, using the idea's exact title as ideaTitle.
```

#### Tool Schema — `return_critique`:

```json
{
  "name": "return_critique",
  "description": "Return a quality review for each content idea",
  "input_schema": {
    "type": "object",
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "ideaTitle": { "type": "string" },
            "keep":      { "type": "boolean" },
            "reasons":   { "type": "array", "items": { "type": "string" } }
          },
          "required": ["ideaTitle", "keep", "reasons"]
        }
      }
    },
    "required": ["results"]
  }
}
```

#### Zod Output Schema (`CriticOutputSchema`):

```ts
const CriticOutputSchema = z.object({
  results: z.array(
    z.object({
      ideaTitle: z.string(),
      keep:      z.boolean(),
      reasons:   z.array(z.string()),
    })
  ),
});
```

---

### Step 5 — Regeneration (if needed)

If any ideas were rejected and `criticRounds < MAX_CRITIC_RETRIES` (currently **1**):

The regeneration prompt input is built as:

```
[same BUSINESS PROFILE + TRENDS block]

REJECTED IDEAS — feedback below. Generate [N] replacement idea(s) that fix these issues. Do NOT reuse the rejected titles.

"[rejected title]" — reasons for rejection:
  - [reason 1]
  - [reason 2]

KEPT IDEAS (replacement ideas must differ in angle and hook from all of these):
- "[kept title]" — Hook: [hook]

Replace {N} in your instructions with [N].
```

Then Opus 4.8 is called again with `effort: 'medium'` to generate exactly N replacements. They are spliced back into the original array at the positions of the rejected ideas.

With `MAX_CRITIC_RETRIES = 1`, there is **at most one regen round**. If Haiku keeps all ideas on the first pass, regeneration is skipped entirely.

---

### Step 6 — Save to Database

1. All existing ideas for the project are **deleted** from the `ideas` table
2. The final idea set is inserted fresh
3. The project's `status` column is set to `'ideas'`

Response:
```json
{
  "ideas": [...],
  "meta": {
    "criticRounds": 1,
    "regeneratedCount": 0
  }
}
```

---

## Single-Idea Regeneration (`POST /api/ideas/[id]`)

Regenerates one idea in-place without touching the others.

**Request body:**
```json
{
  "project_id": "uuid",
  "otherIdeas": ["Title of idea 2", "Title of idea 3", "..."]
}
```

**Flow:**
1. Loads the existing idea row (title, trendRef, hook, script) for "do not reuse" context
2. Loads the project synthesis profile and trends from Supabase
3. Builds prompt input:

```
[BUSINESS PROFILE block]

CURRENT TRENDS TO ANCHOR IDEAS TO:
[trends]

REPLACING THIS IDEA (do NOT reuse its title or hook):
Title: "[existing title]"
Trend: [existing trendRef]
Hook: [existing hook]

OTHER IDEAS ALREADY ON THE BOARD (this new idea must be clearly different from all of them):
- [other title 1]
- [other title 2]

Generate 1 fresh idea. Replace {N} in your instructions with 1. Make it distinctly different from the idea being replaced and from all other ideas already on the board.
```

4. Calls `callAgent()` with `model: 'claude-opus-4-8'`, `effort: 'medium'`, same `return_ideas` tool
5. Updates the existing `ideas` row in-place — same `id`, all fields overwritten, status reset to `'draft'`

Takes approximately **15–20 seconds**.

---

## The `callAgent()` Wrapper (`lib/anthropic.ts`)

All Claude calls go through this function:

```ts
export async function callAgent<T>({
  system,
  input,
  schema,
  tools,
  toolChoice,
  temperature,
  model = 'claude-sonnet-4-6',
  effort,
}: {
  system: string;
  input: string;
  schema: z.ZodSchema<T>;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  temperature?: number;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
}): Promise<T>
```

**Key behaviours:**
- Opus 4.7+ rejects `temperature`/`top_p`/`top_k` with a 400. The wrapper guards this with `acceptsTemperature()` — only Sonnet and Haiku models receive the temperature param.
- `effort` is passed as `output_config: { effort }` (cast via double-assertion to bypass TypeScript's index signature restriction). This is GA on Opus 4.5+.
- JSON is extracted from the response either from a `tool_use` block (preferred) or from a fenced ` ```json ``` ` block in text, then validated with the provided Zod schema.

---

## Model Routing Summary

| Role | Model | Config | Reason |
|---|---|---|---|
| Idea generation | `claude-opus-4-8` | `effort: 'medium'` | Highest quality creative output |
| Regeneration | `claude-opus-4-8` | `effort: 'medium'` | Same quality bar as initial gen |
| Critic | `claude-haiku-4-5` | `temperature: 0.2` | Fast, cheap, consistent judgement |
| Research, synthesis, questions | `claude-sonnet-4-6` | default | Balanced — not changed |

---

## Key Files

| File | Purpose |
|---|---|
| `app/api/ideas/route.ts` | Main generation endpoint (GET list + POST generate) |
| `app/api/ideas/[id]/route.ts` | Single-idea regen (POST) and status toggle (PATCH) |
| `lib/anthropic.ts` | `callAgent()` wrapper — model routing, effort config, JSON extraction |
| `lib/prompts/ideas.ts` | System prompt for Opus: what makes a strong idea |
| `lib/prompts/critic.ts` | System prompt for Haiku: how to score and reject ideas |
| `lib/schemas.ts` | Zod schemas for all input/output types |
