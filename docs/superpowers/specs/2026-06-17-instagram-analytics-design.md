# Instagram Analytics Integration Design

**Date:** 2026-06-17
**Status:** Approved

## Overview

Extend TrendForge with Instagram analytics tracking via `instagram-looter2` on RapidAPI. Projects (the existing client entity) become the anchor for both TikTok and Instagram accounts. A new per-project analytics page provides platform-level breakdowns and a combined bird's-eye view of cross-platform performance.

---

## Data Model

### `projects` table (additions)
| Column | Type | Notes |
|---|---|---|
| `tiktok_handle` | text, nullable | Without `@` prefix |
| `instagram_handle` | text, nullable | Without `@` prefix |

### `tiktok_accounts` table (addition)
| Column | Type | Notes |
|---|---|---|
| `project_id` | uuid, nullable FK → `projects` | NULL for pre-existing rows |

### `instagram_accounts` (new)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK |  |
| `project_id` | uuid, nullable FK → `projects` |  |
| `handle` | text, unique |  |
| `created_at` | timestamptz |  |

### `instagram_snapshots` (new)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK |  |
| `account_id` | uuid, FK → `instagram_accounts` |  |
| `followers` | integer |  |
| `post_count` | integer |  |
| `posts` | jsonb | Array of post stat objects |
| `fetched_at` | timestamptz, default now() |  |

**Post stat object shape:**
```ts
{
  post_id: string;
  caption: string;
  views: number | null;   // null for non-Reels
  likes: number;
  comments: number;
  engagement_rate: number; // if views > 0: (likes + comments) / views; else: (likes + comments) / followers
}
```

---

## API Layer

### New: `lib/instagram.ts`
Mirrors `lib/tiktok.ts` exactly. Uses `RAPIDAPI_INSTAGRAM_HOST=instagram-looter2.p.rapidapi.com` and the existing `RAPIDAPI_KEY`.

- `getProfile(handle: string)` — `GET /profile?id=<handle>` → `{ followers, post_count, user_id }`
- `getPosts(userId: string)` — `GET /posts?id=<userId>`, paginated up to 10 pages → `InstagramPostStat[]`

### New routes: `/api/instagram/accounts/`
Identical structure to `/api/tiktok/accounts/`:
- `GET /api/instagram/accounts` — list all accounts with latest snapshot
- `POST /api/instagram/accounts` — add account by handle
- `GET /api/instagram/accounts/[id]` — account detail + all snapshots
- `POST /api/instagram/accounts/[id]/refresh` — fetch from API, insert snapshot

### Updated: `PATCH /api/projects/[id]`
When `tiktok_handle` or `instagram_handle` is included in the body:
1. Saves the handle to the `projects` row
2. Upserts a record in `tiktok_accounts` / `instagram_accounts` with `project_id` set

### New: `GET /api/projects/[id]/analytics`
Returns combined snapshot data for the analytics page:
- Latest TikTok snapshot (followers, videos array)
- Latest Instagram snapshot (followers, posts array)
- Historical snapshots from both platforms merged by date for the combined views-over-time chart

### Updated: `GET /api/cron/refresh-all`
Refreshes all Instagram accounts in addition to TikTok accounts.

---

## UI Changes

### 1. Intake form (`app/project/[id]/intake.tsx`)
- After the Platforms toggle, add optional "TikTok handle" and "Instagram handle" text inputs
- Each input only appears if the corresponding platform is toggled on
- On submit, handles are included in the PATCH to the project

### 2. Project sidebar (`app/project/[id]/page.tsx`)
- Add an "Analytics" nav link in the sidebar, visible once at least one handle is set on the project
- Links to `/project/[id]/analytics`

### 3. New: `/project/[id]/analytics` page
Three sections top to bottom:

**Combined overview** (always shown if either platform has data)
- Total views (TikTok + Instagram combined)
- Combined average engagement rate
- Total followers across both platforms
- Combined views-over-time line chart

**TikTok section** (shown if `tiktok_handle` is set)
- Follower trend chart
- Top videos by views bar chart
- Engagement rate bar chart
- Full sortable videos table

**Instagram section** (shown if `instagram_handle` is set)
- Identical layout to TikTok section
- Views column shows `—` for non-Reels posts

### 4. Dashboard (`app/(dashboard)/page.tsx`)
- Add combined cross-platform views chart summing TikTok + Instagram views across all projects over time
- Existing TikTok-only summary stats updated to show combined totals

---

## Environment Variables

```
RAPIDAPI_KEY=<existing key>
RAPIDAPI_TIKTOK_HOST=tiktok-api23.p.rapidapi.com        # existing
RAPIDAPI_INSTAGRAM_HOST=instagram-looter2.p.rapidapi.com # new
```

---

## Out of Scope

- Auth / multi-user (single workspace assumed)
- Historical post-level trend data (snapshots capture post stats at a point in time; post-level trending over time is not tracked)
- Linking existing `tiktok_accounts` rows (pre-existing rows) to projects retroactively via UI (their `project_id` stays NULL)
