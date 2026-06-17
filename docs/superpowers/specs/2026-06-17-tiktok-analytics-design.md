# TikTok Analytics Tracking — Design Spec

**Date:** 2026-06-17
**Status:** Approved

## Overview

A separate Accounts section that lets users add TikTok handles and manually refresh their analytics. Each refresh stores a timestamped snapshot in Supabase, building up historical data over time. No project linkage yet, but the schema is forward-compatible with it.

---

## Data Model

### `tiktok_accounts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `handle` | text | TikTok username, no @ prefix |
| `created_at` | timestamptz | |
| `project_id` | uuid FK (nullable) | references `projects(id)`, unused for now |

### `tiktok_snapshots`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | references `tiktok_accounts(id)` |
| `fetched_at` | timestamptz | when the pull occurred |
| `followers` | integer | creator follower count |
| `video_count` | integer | total videos on profile |
| `videos` | jsonb | array of per-video objects (see below) |

**Per-video object shape (inside `videos` jsonb):**
```json
{
  "video_id": "string",
  "title": "string",
  "views": 0,
  "likes": 0,
  "comments": 0,
  "shares": 0,
  "engagement_rate": 0.0
}
```

`engagement_rate` is computed as `(likes + comments + shares) / views`.

---

## API Routes

### `POST /api/tiktok/accounts`
Adds a new TikTok account. Strips leading `@` from handle before storing.

**Body:** `{ handle: string }`
**Response:** the created `tiktok_accounts` row

### `GET /api/tiktok/accounts`
Returns all accounts joined with their most recent snapshot.

**Response:** array of accounts each with latest snapshot fields inlined

### `POST /api/tiktok/accounts/[id]/refresh`
Triggers a data pull for the given account:
1. Calls `tiktok.getProfile(handle)` → followers, video_count
2. Calls `tiktok.getVideos(handle)` → recent videos with per-video stats
3. Computes engagement_rate per video
4. Inserts a new row into `tiktok_snapshots`
5. Returns the new snapshot

---

## TikTok Client (`lib/tiktok.ts`)

Wraps RapidAPI calls, modelled after the existing `lib/search.ts` pattern.

```ts
export async function getProfile(handle: string): Promise<{ followers: number; video_count: number }>
export async function getVideos(handle: string): Promise<VideoStat[]>
```

`RAPIDAPI_KEY` stored in `.env.local`. The RapidAPI provider is a TikTok scraper (e.g. Tokapi or ScrapTik).

---

## UI

**Route:** `app/(dashboard)/accounts/page.tsx`

Two sections:
1. **Add account form** — text input for handle + Add button
2. **Accounts table** — columns: Handle, Followers, Total Videos, Last Refreshed, Refresh (button)

While a refresh is in flight, the Refresh button for that row is disabled with a loading state. All other rows remain interactive.

---

## Future Considerations (out of scope now)

- Tie accounts to projects via `project_id` FK (schema already supports it)
- Historical charts (follower growth, engagement over time) using existing snapshots
- Use analytics to influence content plan generation in the research/ideas stages
- Scheduled automatic refreshes
