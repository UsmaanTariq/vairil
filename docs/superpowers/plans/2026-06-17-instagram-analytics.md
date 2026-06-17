# Instagram Analytics Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Instagram analytics tracking via `instagram-looter2` RapidAPI, linked through the existing `projects` table, with a per-project analytics page showing combined TikTok + Instagram metrics.

**Architecture:** Projects are the client entity. Each project stores optional `tiktok_handle` and `instagram_handle` columns; setting a handle auto-creates a linked account record. Snapshots are collected per account and surfaced on a new `/project/[id]/analytics` page with a combined overview plus per-platform sections. The existing TikTok code is unchanged.

**Tech Stack:** Next.js App Router, Supabase (postgres + JS client), RapidAPI (`instagram-looter2.p.rapidapi.com`), Recharts, Tailwind, TypeScript.

## Global Constraints

- No test files — smoke-test manually in browser or with curl only
- Use `supabase` (publishable key client from `lib/db.ts`) for all DB queries, not `supabaseAdmin()`
- All new API routes follow the exact same pattern as existing TikTok routes
- All new env vars go in `.env.local`
- No `@` prefix stored in any handle column — strip it on input
- Match the existing TrendForge green design system: `#1F4D3A`, `#2E6B4F`, `#F3F4F2`, `#E8E9E6`, `rounded-[20px]`, `shadow-[0_2px_12px_rgba(0,0,0,0.05)]`

---

## File Map

**New files:**
- `lib/instagram.ts` — API client (`getProfile`, `getPosts`)
- `app/api/instagram/accounts/route.ts` — GET list / POST create
- `app/api/instagram/accounts/[id]/route.ts` — GET detail + snapshots
- `app/api/instagram/accounts/[id]/refresh/route.ts` — POST refresh
- `app/api/projects/[id]/analytics/route.ts` — GET combined analytics for a project
- `app/project/[id]/analytics/page.tsx` — analytics UI page

**Modified files:**
- `app/api/projects/[id]/route.ts` — PATCH: handle `tiktok_handle` / `instagram_handle`, auto-create accounts
- `app/api/cron/refresh-all/route.ts` — add Instagram account refresh loop
- `app/project/[id]/intake.tsx` — add optional handle fields
- `app/project/[id]/page.tsx` — add Analytics sidebar link
- `app/(dashboard)/page.tsx` — add combined cross-platform views chart
- `.env.local` — add `RAPIDAPI_INSTAGRAM_HOST`

---

## Task 1: Database schema

**Files:**
- Modify: Supabase dashboard (SQL editor) — no migration files in repo

- [ ] **Step 1: Run migrations in Supabase SQL editor**

Open your Supabase project → SQL Editor → run:

```sql
-- Add handle columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS tiktok_handle text,
  ADD COLUMN IF NOT EXISTS instagram_handle text;

-- Link existing tiktok_accounts to projects (nullable)
ALTER TABLE tiktok_accounts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Instagram accounts
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  handle      text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Instagram snapshots
CREATE TABLE IF NOT EXISTS instagram_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  followers   integer NOT NULL DEFAULT 0,
  post_count  integer NOT NULL DEFAULT 0,
  posts       jsonb NOT NULL DEFAULT '[]',
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast account → snapshot lookups
CREATE INDEX IF NOT EXISTS instagram_snapshots_account_id_idx
  ON instagram_snapshots(account_id, fetched_at DESC);
```

- [ ] **Step 2: Verify in Supabase Table Editor**

Confirm `projects` has `tiktok_handle` and `instagram_handle` columns, `tiktok_accounts` has `project_id`, and both new tables exist.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: add instagram_accounts and instagram_snapshots schema"
```

---

## Task 2: `lib/instagram.ts` — API client

**Files:**
- Create: `lib/instagram.ts`
- Modify: `.env.local`

**Interfaces:**
- Produces:
  - `InstagramProfile { followers: number; post_count: number; user_id: string }`
  - `InstagramPostStat { post_id: string; caption: string; views: number | null; likes: number; comments: number; engagement_rate: number }`
  - `getProfile(handle: string): Promise<InstagramProfile>`
  - `getPosts(userId: string): Promise<InstagramPostStat[]>`

- [ ] **Step 1: Add env var**

Append to `.env.local`:
```
RAPIDAPI_INSTAGRAM_HOST=instagram-looter2.p.rapidapi.com
```

- [ ] **Step 2: Discover the actual API response shape**

Run these two curls and note the JSON structure — field names vary across API versions:

```bash
# Profile
curl -s "https://instagram-looter2.p.rapidapi.com/profile?id=zuck" \
  -H "x-rapidapi-key: 26dd7fcd40msh3ed43cd87443451p19adb3jsnf3d6d4e5feb8" \
  -H "x-rapidapi-host: instagram-looter2.p.rapidapi.com" | head -c 2000

# Posts
curl -s "https://instagram-looter2.p.rapidapi.com/posts?id=zuck" \
  -H "x-rapidapi-key: 26dd7fcd40msh3ed43cd87443451p19adb3jsnf3d6d4e5feb8" \
  -H "x-rapidapi-host: instagram-looter2.p.rapidapi.com" | head -c 2000
```

Note the actual field paths for: user ID, follower count, post count, post ID, caption, like count, comment count, view count (may be absent on photos).

- [ ] **Step 3: Write `lib/instagram.ts`**

Adjust the field paths in the parse functions below to match what you saw in Step 2:

```ts
export interface InstagramProfile {
  followers:  number;
  post_count: number;
  user_id:    string;
}

export interface InstagramPostStat {
  post_id:         string;
  caption:         string;
  views:           number | null;
  likes:           number;
  comments:        number;
  engagement_rate: number;
}

const BASE = `https://${process.env.RAPIDAPI_INSTAGRAM_HOST}`;
const HEADERS = {
  'x-rapidapi-key':  process.env.RAPIDAPI_KEY!,
  'x-rapidapi-host': process.env.RAPIDAPI_INSTAGRAM_HOST!,
};

export async function getProfile(handle: string): Promise<InstagramProfile> {
  const res = await fetch(`${BASE}/profile?id=${encodeURIComponent(handle)}`, {
    headers: HEADERS,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Instagram profile fetch failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  // Adjust paths below to match actual API response
  const user = json.data ?? json.user ?? json ?? {};
  return {
    followers:  user.follower_count  ?? user.followers        ?? 0,
    post_count: user.media_count     ?? user.post_count       ?? 0,
    user_id:    String(user.pk       ?? user.id               ?? user.user_id ?? ''),
  };
}

export async function getPosts(userId: string): Promise<InstagramPostStat[]> {
  const allItems: Record<string, unknown>[] = [];
  let nextMaxId: string | null = null;
  const MAX_PAGES = 10;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = nextMaxId
      ? `${BASE}/posts?id=${encodeURIComponent(userId)}&next_max_id=${nextMaxId}`
      : `${BASE}/posts?id=${encodeURIComponent(userId)}`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Instagram posts fetch failed (${res.status}): ${body}`);
    }
    const json = await res.json();
    // Adjust paths below to match actual API response
    const data  = json.data ?? json;
    const items = (data.items ?? data.posts ?? []) as Record<string, unknown>[];
    allItems.push(...items);
    if (!data.more_available || items.length === 0) break;
    nextMaxId = (data.next_max_id as string | null) ?? null;
    if (!nextMaxId) break;
  }

  return allItems.map((item) => {
    const likes    = (item.like_count    ?? 0) as number;
    const comments = (item.comment_count ?? 0) as number;
    const views    = item.view_count != null ? (item.view_count as number) : null;
    const captionNode = item.caption as Record<string, unknown> | null | undefined;
    const caption  = (typeof captionNode === 'object' && captionNode !== null
      ? (captionNode.text as string | undefined)
      : (item.caption as string | undefined)) ?? '';

    const engBase = views ?? 0;
    const engagement_rate = engBase > 0
      ? Math.round(((likes + comments) / engBase) * 10000) / 10000
      : 0;

    return {
      post_id:         String(item.id ?? item.pk ?? ''),
      caption:         caption.slice(0, 300),
      views:           views,
      likes,
      comments,
      engagement_rate,
    };
  });
}
```

- [ ] **Step 4: Smoke-test in browser console or curl**

Start the dev server (`npm run dev`) and verify `RAPIDAPI_INSTAGRAM_HOST` is picked up. Actual route tests come in Task 3.

- [ ] **Step 5: Commit**

```bash
git add lib/instagram.ts .env.local
git commit -m "feat: add instagram API client lib"
```

---

## Task 3: Instagram API routes

**Files:**
- Create: `app/api/instagram/accounts/route.ts`
- Create: `app/api/instagram/accounts/[id]/route.ts`
- Create: `app/api/instagram/accounts/[id]/refresh/route.ts`

**Interfaces:**
- Consumes: `InstagramProfile`, `InstagramPostStat`, `getProfile`, `getPosts` from `lib/instagram.ts`
- Produces:
  - `GET /api/instagram/accounts` → `{ accounts: Account[] }` where `Account` has `latest_snapshot: { followers, post_count, fetched_at } | null`
  - `POST /api/instagram/accounts` body `{ handle }` → `{ account }` 201
  - `GET /api/instagram/accounts/[id]` → `{ account, snapshots, latest_snapshot }`
  - `POST /api/instagram/accounts/[id]/refresh` → `{ snapshot }`

- [ ] **Step 1: Create `app/api/instagram/accounts/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const { data: accounts, error } = await supabase
    .from('instagram_accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accountsWithSnapshots = await Promise.all(
    (accounts ?? []).map(async (account) => {
      const { data: snapshot } = await supabase
        .from('instagram_snapshots')
        .select('followers, post_count, fetched_at')
        .eq('account_id', account.id)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { ...account, latest_snapshot: snapshot ?? null };
    })
  );

  return NextResponse.json({ accounts: accountsWithSnapshots });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rawHandle: string = body.handle ?? '';
  const handle = rawHandle.replace(/^@/, '').trim();

  if (!handle) {
    return NextResponse.json({ error: 'handle is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('instagram_accounts')
    .insert({ handle })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/instagram/accounts/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: account, error: accountError } = await supabase
    .from('instagram_accounts')
    .select('id, handle, created_at')
    .eq('id', id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const { data: snapshots } = await supabase
    .from('instagram_snapshots')
    .select('id, fetched_at, followers, post_count, posts')
    .eq('account_id', id)
    .order('fetched_at', { ascending: true });

  const { data: latestSnapshot } = await supabase
    .from('instagram_snapshots')
    .select('id, fetched_at, followers, post_count, posts')
    .eq('account_id', id)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    account,
    snapshots: snapshots ?? [],
    latest_snapshot: latestSnapshot ?? null,
  });
}
```

- [ ] **Step 3: Create `app/api/instagram/accounts/[id]/refresh/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProfile, getPosts } from '@/lib/instagram';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: account, error: accountError } = await supabase
    .from('instagram_accounts')
    .select('handle')
    .eq('id', id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  let profile, posts;
  try {
    profile = await getProfile(account.handle);
    posts   = await getPosts(profile.user_id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Instagram API request failed' },
      { status: 502 }
    );
  }

  const { data: snapshot, error: insertError } = await supabase
    .from('instagram_snapshots')
    .insert({
      account_id: id,
      followers:  profile.followers,
      post_count: profile.post_count,
      posts,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ snapshot });
}
```

- [ ] **Step 4: Smoke-test**

```bash
# Add a test account
curl -s -X POST http://localhost:3000/api/instagram/accounts \
  -H "Content-Type: application/json" \
  -d '{"handle":"cristiano"}' | jq .

# List accounts
curl -s http://localhost:3000/api/instagram/accounts | jq .
```

Both should return valid JSON with no errors. Then hit Refresh on the account to confirm snapshots save correctly.

- [ ] **Step 5: Commit**

```bash
git add app/api/instagram/
git commit -m "feat: add Instagram account CRUD and refresh routes"
```

---

## Task 4: Update `PATCH /api/projects/[id]` to auto-create accounts

**Files:**
- Modify: `app/api/projects/[id]/route.ts`

- [ ] **Step 1: Replace the PATCH handler**

```ts
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const { tiktok_handle: rawTikTok, instagram_handle: rawInstagram, ...rest } = body;

  const tiktok_handle    = rawTikTok    ? String(rawTikTok).replace(/^@/, '').trim()    : undefined;
  const instagram_handle = rawInstagram ? String(rawInstagram).replace(/^@/, '').trim() : undefined;

  const updatePayload: Record<string, unknown> = { ...rest };
  if (tiktok_handle    !== undefined) updatePayload.tiktok_handle    = tiktok_handle    || null;
  if (instagram_handle !== undefined) updatePayload.instagram_handle = instagram_handle || null;

  const { data, error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-create linked account records when handles are set
  if (tiktok_handle) {
    await supabase
      .from('tiktok_accounts')
      .upsert({ handle: tiktok_handle, project_id: id }, { onConflict: 'handle' });
  }
  if (instagram_handle) {
    await supabase
      .from('instagram_accounts')
      .upsert({ handle: instagram_handle, project_id: id }, { onConflict: 'handle' });
  }

  return NextResponse.json({ project: data });
}
```

Keep the existing GET and DELETE handlers unchanged. Add `import { NextRequest, NextResponse } from 'next/server'` and `import { supabase } from '@/lib/db'` if not already at the top.

- [ ] **Step 2: Commit**

```bash
git add app/api/projects/[id]/route.ts
git commit -m "feat: auto-create platform accounts when project handles are set"
```

---

## Task 5: `GET /api/projects/[id]/analytics` — combined data

**Files:**
- Create: `app/api/projects/[id]/analytics/route.ts`

**Interfaces:**
- Produces: `{ tiktok: { account_id, latest_snapshot, snapshots } | null, instagram: { account_id, latest_snapshot, snapshots } | null }`
- `snapshots` items include `{ fetched_at, followers, views_total }` for the combined chart

- [ ] **Step 1: Create `app/api/projects/[id]/analytics/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('tiktok_handle, instagram_handle')
    .eq('id', id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  async function getTikTokData() {
    if (!project!.tiktok_handle) return null;
    const { data: account } = await supabase
      .from('tiktok_accounts')
      .select('id')
      .eq('handle', project!.tiktok_handle)
      .maybeSingle();
    if (!account) return null;

    const { data: snapshots } = await supabase
      .from('tiktok_snapshots')
      .select('id, fetched_at, followers, video_count, videos')
      .eq('account_id', account.id)
      .order('fetched_at', { ascending: true });

    const latest = snapshots?.at(-1) ?? null;
    return { account_id: account.id, latest_snapshot: latest, snapshots: snapshots ?? [] };
  }

  async function getInstagramData() {
    if (!project!.instagram_handle) return null;
    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('handle', project!.instagram_handle)
      .maybeSingle();
    if (!account) return null;

    const { data: snapshots } = await supabase
      .from('instagram_snapshots')
      .select('id, fetched_at, followers, post_count, posts')
      .eq('account_id', account.id)
      .order('fetched_at', { ascending: true });

    const latest = snapshots?.at(-1) ?? null;
    return { account_id: account.id, latest_snapshot: latest, snapshots: snapshots ?? [] };
  }

  const [tiktok, instagram] = await Promise.all([getTikTokData(), getInstagramData()]);

  return NextResponse.json({ tiktok, instagram });
}
```

- [ ] **Step 2: Smoke-test**

With a project that has at least one handle set:
```bash
curl -s http://localhost:3000/api/projects/<project-id>/analytics | jq .
```

Should return `{ tiktok: {...} | null, instagram: {...} | null }`.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/[id]/analytics/
git commit -m "feat: add combined project analytics API route"
```

---

## Task 6: Update cron to refresh Instagram accounts

**Files:**
- Modify: `app/api/cron/refresh-all/route.ts`

- [ ] **Step 1: Update the cron route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProfile as getTikTokProfile, getVideos }         from '@/lib/tiktok';
import { getProfile as getInstagramProfile, getPosts }       from '@/lib/instagram';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- TikTok ---
  const { data: tiktokAccounts } = await supabase
    .from('tiktok_accounts')
    .select('id, handle');

  let ttSucceeded = 0, ttFailed = 0;
  const ttErrors: string[] = [];

  for (const account of tiktokAccounts ?? []) {
    try {
      const profile = await getTikTokProfile(account.handle);
      const videos  = await getVideos(profile.sec_uid);
      await supabase.from('tiktok_snapshots').insert({
        account_id:  account.id,
        followers:   profile.followers,
        video_count: profile.video_count,
        videos,
      });
      ttSucceeded++;
    } catch (err) {
      ttFailed++;
      ttErrors.push(`${account.handle}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // --- Instagram ---
  const { data: igAccounts } = await supabase
    .from('instagram_accounts')
    .select('id, handle');

  let igSucceeded = 0, igFailed = 0;
  const igErrors: string[] = [];

  for (const account of igAccounts ?? []) {
    try {
      const profile = await getInstagramProfile(account.handle);
      const posts   = await getPosts(profile.user_id);
      await supabase.from('instagram_snapshots').insert({
        account_id: account.id,
        followers:  profile.followers,
        post_count: profile.post_count,
        posts,
      });
      igSucceeded++;
    } catch (err) {
      igFailed++;
      igErrors.push(`${account.handle}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return NextResponse.json({
    tiktok:    { refreshed: ttSucceeded, failed: ttFailed, errors: ttErrors },
    instagram: { refreshed: igSucceeded, failed: igFailed, errors: igErrors },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cron/refresh-all/route.ts
git commit -m "feat: extend cron to refresh Instagram accounts alongside TikTok"
```

---

## Task 7: Intake form — add handle fields

**Files:**
- Modify: `app/project/[id]/intake.tsx`

- [ ] **Step 1: Add handle state and fields to the intake form**

At the top of `IntakeStage`, add two new state vars after the existing ones:

```ts
const [tiktokHandle,    setTiktokHandle]    = useState(project.tiktok_handle    ?? '');
const [instagramHandle, setInstagramHandle] = useState(project.instagram_handle ?? '');
```

Update the `Project` interface to include the new fields:

```ts
interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  status: string;
  tiktok_handle:    string | null;
  instagram_handle: string | null;
}
```

In `handleSubmit`, include handles in the PATCH call:

```ts
if (niche || platforms.length || tiktokHandle || instagramHandle) {
  await fetch(`/api/projects/${project.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      niche: niche || null,
      platforms,
      tiktok_handle:    tiktokHandle.replace(/^@/, '').trim()    || null,
      instagram_handle: instagramHandle.replace(/^@/, '').trim() || null,
    }),
  });
  onUpdate({
    niche: niche || null,
    platforms,
    tiktok_handle:    tiktokHandle.replace(/^@/, '').trim()    || null,
    instagram_handle: instagramHandle.replace(/^@/, '').trim() || null,
  });
}
```

Add the handle inputs **after** the Platforms section (before the error and submit button):

```tsx
{platforms.includes('tiktok') && (
  <div className="space-y-2">
    <Label htmlFor="tiktok-handle">TikTok handle <span className="text-neutral-400 font-normal">(optional)</span></Label>
    <Input
      id="tiktok-handle"
      placeholder="@handle"
      value={tiktokHandle}
      onChange={(e) => setTiktokHandle(e.target.value)}
    />
  </div>
)}

{platforms.includes('instagram') && (
  <div className="space-y-2">
    <Label htmlFor="instagram-handle">Instagram handle <span className="text-neutral-400 font-normal">(optional)</span></Label>
    <Input
      id="instagram-handle"
      placeholder="@handle"
      value={instagramHandle}
      onChange={(e) => setInstagramHandle(e.target.value)}
    />
  </div>
)}
```

- [ ] **Step 2: Smoke-test**

Open a project in intake stage, toggle on TikTok, enter a handle, submit. Check Supabase → `projects` table that `tiktok_handle` is saved and a matching row exists in `tiktok_accounts`.

- [ ] **Step 3: Commit**

```bash
git add app/project/[id]/intake.tsx
git commit -m "feat: capture TikTok and Instagram handles during project intake"
```

---

## Task 8: Project sidebar Analytics link + analytics page

**Files:**
- Modify: `app/project/[id]/page.tsx`
- Create: `app/project/[id]/analytics/page.tsx`

- [ ] **Step 1: Add Analytics link to project sidebar**

In `app/project/[id]/page.tsx`, update the `Project` interface to include handles:

```ts
interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  status: string;
  created_at: string;
  tiktok_handle:    string | null;
  instagram_handle: string | null;
}
```

Add `import { BarChart2 } from 'lucide-react'` at the top.

In the sidebar, after the "Business profile" button block (around line 222), add:

```tsx
{(project.tiktok_handle || project.instagram_handle) && (
  <div className="px-5 py-3 border-b border-[#F0F1F5]">
    <Link
      href={`/project/${id}/analytics`}
      className="w-full flex items-center gap-2 text-[13px] font-medium text-[#6B6B80] hover:text-[#1B1B2F] transition-colors"
    >
      <BarChart2 size={14} />
      Analytics
    </Link>
  </div>
)}
```

Add `import Link from 'next/link'` if not already imported.

- [ ] **Step 2: Create `app/project/[id]/analytics/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface PostStat {
  post_id: string;
  caption: string;
  views:   number | null;
  likes:   number;
  comments: number;
  engagement_rate: number;
}

interface VideoStat {
  video_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

interface SnapshotBase { id: string; fetched_at: string; followers: number }
interface TikTokSnapshot extends SnapshotBase { video_count: number; videos?: VideoStat[] }
interface InstagramSnapshot extends SnapshotBase { post_count: number; posts?: PostStat[] }

interface AnalyticsData {
  tiktok:    { account_id: string; latest_snapshot: TikTokSnapshot | null; snapshots: TikTokSnapshot[] } | null;
  instagram: { account_id: string; latest_snapshot: InstagramSnapshot | null; snapshots: InstagramSnapshot[] } | null;
}

function fmt(n: number | null) {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF', border: '1px solid #E8E9E6',
  borderRadius: '12px', color: '#16181A', fontSize: '12px',
};

type SortKey = 'views' | 'likes' | 'comments' | 'engagement_rate';

export default function ProjectAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ttSort, setTtSort] = useState<SortKey>('views');
  const [ttDir, setTtDir]   = useState<'asc' | 'desc'>('desc');
  const [igSort, setIgSort] = useState<SortKey>('views');
  const [igDir, setIgDir]   = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch(`/api/projects/${id}/analytics`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { setError(d.error); return; } setData(d); })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F2] dot-grid flex items-center justify-center">
        <p className="text-[14px] text-[#7C8278]">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F4F2] dot-grid flex items-center justify-center">
        <p className="text-[14px] text-red-500">{error}</p>
      </div>
    );
  }

  const ttSnap    = data?.tiktok?.latest_snapshot;
  const ttSnaps   = data?.tiktok?.snapshots ?? [];
  const ttVideos  = ttSnap?.videos ?? [];
  const igSnap    = data?.instagram?.latest_snapshot;
  const igSnaps   = data?.instagram?.snapshots ?? [];
  const igPosts   = igSnap?.posts ?? [];

  const ttTotalViews = ttVideos.reduce((s, v) => s + v.views, 0);
  const igTotalViews = igPosts.reduce((s, p) => s + (p.views ?? 0), 0);
  const combinedViews = ttTotalViews + igTotalViews;

  const ttAvgEng = ttVideos.length
    ? ttVideos.reduce((s, v) => s + v.engagement_rate, 0) / ttVideos.length : 0;
  const igAvgEng = igPosts.length
    ? igPosts.reduce((s, p) => s + p.engagement_rate, 0) / igPosts.length : 0;
  const combinedEngCount = (ttVideos.length > 0 ? 1 : 0) + (igPosts.length > 0 ? 1 : 0);
  const combinedAvgEng = combinedEngCount > 0
    ? (ttAvgEng + igAvgEng) / combinedEngCount : 0;

  const ttFollowers = ttSnap?.followers ?? 0;
  const igFollowers = igSnap?.followers ?? 0;
  const totalFollowers = ttFollowers + igFollowers;

  // Combined views-over-time: merge TikTok and Instagram snapshots by date
  const combinedTrend = (() => {
    const byDate: Record<string, { tt: number; ig: number }> = {};
    for (const s of ttSnaps) {
      const d = new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const views = (s.videos ?? []).reduce((acc, v) => acc + v.views, 0);
      byDate[d] = { tt: (byDate[d]?.tt ?? 0) + views, ig: byDate[d]?.ig ?? 0 };
    }
    for (const s of igSnaps) {
      const d = new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const views = (s.posts ?? []).reduce((acc, p) => acc + (p.views ?? 0), 0);
      byDate[d] = { tt: byDate[d]?.tt ?? 0, ig: (byDate[d]?.ig ?? 0) + views };
    }
    return Object.entries(byDate).map(([date, { tt, ig }]) => ({ date, views: tt + ig }));
  })();

  const ttTrendData = ttSnaps.map((s) => ({
    date: new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: s.followers,
    views: (s.videos ?? []).reduce((acc, v) => acc + v.views, 0),
  }));

  const igTrendData = igSnaps.map((s) => ({
    date: new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: s.followers,
    views: (s.posts ?? []).reduce((acc, p) => acc + (p.views ?? 0), 0),
  }));

  function toggleTtSort(key: SortKey) {
    if (ttSort === key) setTtDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setTtSort(key); setTtDir('desc'); }
  }
  function toggleIgSort(key: SortKey) {
    if (igSort === key) setIgDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setIgSort(key); setIgDir('desc'); }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F2] dot-grid">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[13px] text-[#7C8278] hover:text-[#16181A] transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="text-[22px] font-bold text-[#16181A]">Analytics</h1>
        </div>

        {/* Combined overview */}
        <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">Combined overview</p>
          <div className="flex gap-8 flex-wrap mb-6">
            {[
              { label: 'Total views',       value: fmt(combinedViews || null) },
              { label: 'Total followers',   value: fmt(totalFollowers || null) },
              { label: 'Avg engagement',    value: `${(combinedAvgEng * 100).toFixed(2)}%` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-1">{label}</p>
                <p className="text-[20px] font-bold text-[#16181A]">{value}</p>
              </div>
            ))}
          </div>
          {combinedTrend.length >= 2 && (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={combinedTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Combined views']} contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="views" stroke="#2E6B4F" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* TikTok section */}
        {data?.tiktok && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[16px] font-bold text-[#16181A]">TikTok</h2>

            {/* Stats */}
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: 'Followers',     value: fmt(ttSnap?.followers ?? null) },
                  { label: 'Videos',        value: fmt(ttSnap?.video_count ?? null) },
                  { label: 'Last refreshed', value: fmtDate(ttSnap?.fetched_at ?? null) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-1">{label}</p>
                    <p className="text-[18px] font-bold text-[#16181A]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts */}
            {ttTrendData.length >= 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                  <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Follower trend</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={ttTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Followers']} contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="followers" stroke="#2E6B4F" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                  <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Total views over time</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={ttTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views']} contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="views" stroke="#3F8F62" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Videos table */}
            {ttVideos.length > 0 && (
              <div className="bg-white rounded-[20px] border border-[#E8E9E6] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E8E9E6]">
                      {([
                        { label: 'Title', key: 'title' as const },
                        { label: 'Views', key: 'views' as const },
                        { label: 'Likes', key: 'likes' as const },
                        { label: 'Comments', key: 'comments' as const },
                        { label: 'Engagement', key: 'engagement_rate' as const },
                      ]).map(({ label, key }) => (
                        <th
                          key={key}
                          onClick={() => key !== 'title' && toggleTtSort(key as SortKey)}
                          className="text-left text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-6 py-4 cursor-pointer select-none hover:text-[#1F4D3A] transition-colors"
                        >
                          {label}
                          {ttSort === key && <span className="ml-1 text-[#2E6B4F]">{ttDir === 'desc' ? '↓' : '↑'}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...ttVideos]
                      .sort((a, b) => {
                        const av = a[ttSort], bv = b[ttSort];
                        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                        return ttDir === 'asc' ? cmp : -cmp;
                      })
                      .map((v, i, arr) => (
                        <tr key={v.video_id} className={`hover:bg-[#F3F4F2] transition-colors ${i < arr.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}>
                          <td className="px-6 py-3 text-[13px] text-[#16181A] max-w-[240px]">
                            {v.title ? (v.title.length > 60 ? v.title.slice(0, 60) + '…' : v.title) : <span className="text-[#A9AEA4]">—</span>}
                          </td>
                          <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(v.views)}</td>
                          <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(v.likes)}</td>
                          <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(v.comments)}</td>
                          <td className="px-6 py-3 text-[13px] font-medium text-[#2E6B4F]">{(v.engagement_rate * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Instagram section */}
        {data?.instagram && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[16px] font-bold text-[#16181A]">Instagram</h2>

            {/* Stats */}
            <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: 'Followers',     value: fmt(igSnap?.followers ?? null) },
                  { label: 'Posts',         value: fmt(igSnap?.post_count ?? null) },
                  { label: 'Last refreshed', value: fmtDate(igSnap?.fetched_at ?? null) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-1">{label}</p>
                    <p className="text-[18px] font-bold text-[#16181A]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts */}
            {igTrendData.length >= 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                  <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Follower trend</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={igTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Followers']} contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="followers" stroke="#2E6B4F" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                  <p className="text-[12px] font-semibold text-[#7C8278] mb-4">Total views over time</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={igTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#7C8278' }} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [fmt(typeof v === 'number' ? v : null), 'Views']} contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="views" stroke="#3F8F62" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Posts table */}
            {igPosts.length > 0 && (
              <div className="bg-white rounded-[20px] border border-[#E8E9E6] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E8E9E6]">
                      {([
                        { label: 'Caption', key: 'caption' as const },
                        { label: 'Views', key: 'views' as const },
                        { label: 'Likes', key: 'likes' as const },
                        { label: 'Comments', key: 'comments' as const },
                        { label: 'Engagement', key: 'engagement_rate' as const },
                      ]).map(({ label, key }) => (
                        <th
                          key={key}
                          onClick={() => key !== 'caption' && toggleIgSort(key as SortKey)}
                          className="text-left text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] px-6 py-4 cursor-pointer select-none hover:text-[#1F4D3A] transition-colors"
                        >
                          {label}
                          {igSort === key && <span className="ml-1 text-[#2E6B4F]">{igDir === 'desc' ? '↓' : '↑'}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...igPosts]
                      .sort((a, b) => {
                        const av = igSort === 'views' ? (a.views ?? 0) : a[igSort];
                        const bv = igSort === 'views' ? (b.views ?? 0) : b[igSort];
                        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                        return igDir === 'asc' ? cmp : -cmp;
                      })
                      .map((p, i, arr) => (
                        <tr key={p.post_id} className={`hover:bg-[#F3F4F2] transition-colors ${i < arr.length - 1 ? 'border-b border-[#E8E9E6]' : ''}`}>
                          <td className="px-6 py-3 text-[13px] text-[#16181A] max-w-[240px]">
                            {p.caption ? (p.caption.length > 60 ? p.caption.slice(0, 60) + '…' : p.caption) : <span className="text-[#A9AEA4]">—</span>}
                          </td>
                          <td className="px-6 py-3 text-[13px] text-[#7C8278]">{p.views !== null ? fmt(p.views) : '—'}</td>
                          <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(p.likes)}</td>
                          <td className="px-6 py-3 text-[13px] text-[#7C8278]">{fmt(p.comments)}</td>
                          <td className="px-6 py-3 text-[13px] font-medium text-[#2E6B4F]">{(p.engagement_rate * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {igSnap && igPosts.length === 0 && (
              <div className="bg-white rounded-[20px] p-8 border border-[#E8E9E6] text-center">
                <p className="text-[14px] text-[#7C8278]">No post data yet. Refresh the Instagram account from the accounts page.</p>
              </div>
            )}

            {!igSnap && (
              <div className="bg-white rounded-[20px] p-8 border border-[#E8E9E6] text-center">
                <p className="text-[14px] text-[#7C8278]">No Instagram data yet. Refresh the account to pull the first snapshot.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 3: Smoke-test**

Navigate to a project that has `tiktok_handle` set. Confirm "Analytics" link appears in sidebar. Click it. Confirm page loads and shows the TikTok section. (Instagram section visible once that handle is set too.)

- [ ] **Step 4: Commit**

```bash
git add app/project/[id]/page.tsx app/project/[id]/analytics/
git commit -m "feat: add Analytics sidebar link and per-project analytics page"
```

---

## Task 9: Dashboard combined views chart

**Files:**
- Create: `app/api/analytics/combined-views/route.ts`
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Create `app/api/analytics/combined-views/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const [ttResult, igResult] = await Promise.all([
    supabase
      .from('tiktok_snapshots')
      .select('fetched_at, videos')
      .order('fetched_at', { ascending: true })
      .limit(200),
    supabase
      .from('instagram_snapshots')
      .select('fetched_at, posts')
      .order('fetched_at', { ascending: true })
      .limit(200),
  ]);

  const byDate: Record<string, number> = {};

  for (const s of ttResult.data ?? []) {
    const d = new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const views = ((s.videos ?? []) as { views: number }[]).reduce((acc, v) => acc + (v.views ?? 0), 0);
    byDate[d] = (byDate[d] ?? 0) + views;
  }

  for (const s of igResult.data ?? []) {
    const d = new Date(s.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const views = ((s.posts ?? []) as { views: number | null }[]).reduce((acc, p) => acc + (p.views ?? 0), 0);
    byDate[d] = (byDate[d] ?? 0) + views;
  }

  const trend = Object.entries(byDate).map(([date, views]) => ({ date, views }));

  return NextResponse.json({ trend });
}
```

- [ ] **Step 2: Add combined views chart to dashboard**

In `app/(dashboard)/page.tsx`, add these imports at the top:

```ts
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
```

Add a new state variable after the existing state declarations:

```ts
const [combinedTrend, setCombinedTrend] = useState<{ date: string; views: number }[]>([]);
```

In the `useEffect`, add a third fetch alongside the existing two:

```ts
useEffect(() => {
  Promise.all([
    fetch('/api/projects').then((r) => r.json()),
    fetch('/api/ideas/recent').then((r) => r.json()),
    fetch('/api/analytics/combined-views').then((r) => r.json()),
  ]).then(([projectsData, ideasData, analyticsData]) => {
    setProjects(projectsData.projects ?? []);
    setRecentIdeas(ideasData.ideas ?? []);
    setCombinedTrend(analyticsData.trend ?? []);
  }).finally(() => setLoading(false));
}, []);
```

Add the chart card in `<main>` between the stat cards and the Projects section (between the `</div>` closing the stat cards grid and the `<div>` opening the Projects section):

```tsx
{/* Combined views chart */}
{combinedTrend.length >= 2 && (
  <div className="bg-white rounded-[20px] p-5 border border-[#E8E9E6] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
    <p className="text-[10px] font-semibold text-[#A9AEA4] uppercase tracking-[0.1em] mb-4">
      Combined views (all platforms)
    </p>
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={combinedTrend}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E9E6" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C8278' }} />
        <YAxis
          tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(v)}
          tick={{ fontSize: 11, fill: '#7C8278' }}
          domain={['auto', 'auto']}
        />
        <Tooltip
          formatter={(v) => [
            typeof v === 'number'
              ? v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toLocaleString()
              : '—',
            'Views'
          ]}
          contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E9E6', borderRadius: '12px', color: '#16181A', fontSize: '12px' }}
        />
        <Line type="monotone" dataKey="views" stroke="#2E6B4F" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
```

- [ ] **Step 3: Smoke-test**

Load `http://localhost:3000`. Confirm the combined chart renders (or doesn't appear at all when there's no data — the `length >= 2` guard handles the empty state).

- [ ] **Step 4: Commit**

```bash
git add app/api/analytics/ app/(dashboard)/page.tsx
git commit -m "feat: add combined TikTok + Instagram views chart to dashboard"
```
