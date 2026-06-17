# TikTok Analytics Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate Accounts section that stores per-refresh TikTok analytics snapshots (followers, per-video views/likes/comments/shares) in Supabase, accessible via a manual Refresh button.

**Architecture:** Three new API routes handle account CRUD and refresh triggering. A `lib/tiktok.ts` wrapper calls RapidAPI's TikTok Scraper to fetch profile + video stats, then the refresh route writes a timestamped snapshot row to Supabase. The accounts page (`app/(dashboard)/accounts/page.tsx`) is a standalone page with a back-link to the dashboard; the dashboard sidebar gets an Accounts nav link.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + supabase-js), RapidAPI TikTok Scraper (`tiktok-scraper7.p.rapidapi.com`), Tailwind CSS

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `supabase/schema.sql` | Add `tiktok_accounts` and `tiktok_snapshots` tables |
| Modify | `.env.local` | Add `RAPIDAPI_KEY` and `RAPIDAPI_TIKTOK_HOST` |
| Create | `lib/tiktok.ts` | RapidAPI wrapper: `getProfile()` and `getVideos()` |
| Create | `app/api/tiktok/accounts/route.ts` | GET (list accounts + latest snapshot) and POST (add account) |
| Create | `app/api/tiktok/accounts/[id]/refresh/route.ts` | POST (fetch + store new snapshot) |
| Create | `app/(dashboard)/accounts/page.tsx` | Accounts page UI |
| Modify | `app/(dashboard)/page.tsx` | Add Accounts link to sidebar nav |

---

## Task 1: Add Supabase schema

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add the two tables to schema.sql**

Append to the bottom of `supabase/schema.sql`:

```sql
create table if not exists tiktok_accounts (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  created_at timestamptz default now(),
  project_id uuid references projects(id) on delete set null
);

create table if not exists tiktok_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references tiktok_accounts(id) on delete cascade,
  fetched_at timestamptz default now(),
  followers integer,
  video_count integer,
  videos jsonb default '[]'::jsonb
);
```

- [ ] **Step 2: Run the migration against your Supabase project**

Open your Supabase dashboard → SQL Editor → paste and run the two `CREATE TABLE` statements above.

Verify: both tables appear in the Table Editor with the correct columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add tiktok_accounts and tiktok_snapshots schema"
```

---

## Task 2: Add env vars and create lib/tiktok.ts

**Files:**
- Modify: `.env.local`
- Create: `lib/tiktok.ts`

**Before starting:**
1. Go to [rapidapi.com](https://rapidapi.com) and search for "TikTok Scraper 7"
2. Subscribe to the free tier
3. Copy your RapidAPI key from the API's page

- [ ] **Step 1: Add env vars to .env.local**

Add these two lines to `.env.local`:
```
RAPIDAPI_KEY=your_key_here
RAPIDAPI_TIKTOK_HOST=tiktok-scraper7.p.rapidapi.com
```

- [ ] **Step 2: Test the API manually before writing code**

Run this curl to confirm the response shape for user info:
```bash
curl "https://tiktok-scraper7.p.rapidapi.com/user/info?unique_id=charlidamelio" \
  -H "x-rapidapi-key: YOUR_KEY" \
  -H "x-rapidapi-host: tiktok-scraper7.p.rapidapi.com"
```

And for user posts:
```bash
curl "https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=charlidamelio&count=10" \
  -H "x-rapidapi-key: YOUR_KEY" \
  -H "x-rapidapi-host: tiktok-scraper7.p.rapidapi.com"
```

Note the exact field names in the response — you'll need to match them in the next step.

- [ ] **Step 3: Create lib/tiktok.ts**

```ts
export interface TikTokProfile {
  followers: number;
  video_count: number;
}

export interface TikTokVideoStat {
  video_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

const BASE = `https://${process.env.RAPIDAPI_TIKTOK_HOST}`;
const HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
  'x-rapidapi-host': process.env.RAPIDAPI_TIKTOK_HOST!,
};

export async function getProfile(handle: string): Promise<TikTokProfile> {
  const res = await fetch(`${BASE}/user/info?unique_id=${encodeURIComponent(handle)}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`TikTok profile fetch failed: ${res.statusText}`);
  const json = await res.json();
  // Adapt field names below if your API response uses different keys
  const stats = json.data?.stats ?? json.userInfo?.stats ?? {};
  return {
    followers: stats.followerCount ?? 0,
    video_count: stats.videoCount ?? 0,
  };
}

export async function getVideos(handle: string): Promise<TikTokVideoStat[]> {
  const res = await fetch(
    `${BASE}/user/posts?unique_id=${encodeURIComponent(handle)}&count=30`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`TikTok videos fetch failed: ${res.statusText}`);
  const json = await res.json();
  // Adapt field names below if your API response uses different keys
  const videos: Record<string, unknown>[] = json.data?.videos ?? json.data?.itemList ?? [];
  return videos.map((v) => {
    const views   = (v.play ?? v.playCount ?? 0) as number;
    const likes   = (v.digg_count ?? v.diggCount ?? 0) as number;
    const comments = (v.comment_count ?? v.commentCount ?? 0) as number;
    const shares  = (v.share_count ?? v.shareCount ?? 0) as number;
    return {
      video_id: (v.video_id ?? v.id ?? '') as string,
      title: (v.title ?? v.desc ?? '') as string,
      views,
      likes,
      comments,
      shares,
      engagement_rate: views > 0
        ? Math.round(((likes + comments + shares) / views) * 10000) / 10000
        : 0,
    };
  });
}
```

- [ ] **Step 4: Verify the wrapper works**

Temporarily add a quick test script at project root (delete after):

```ts
// test-tiktok.ts  (delete after verifying)
import { getProfile, getVideos } from './lib/tiktok';
(async () => {
  const profile = await getProfile('charlidamelio');
  console.log('Profile:', profile);
  const videos = await getVideos('charlidamelio');
  console.log('First video:', videos[0]);
})();
```

Run: `npx tsx test-tiktok.ts`

Expected: `Profile: { followers: <number>, video_count: <number> }` and a video object with non-zero values. If fields come back as 0, revisit the field name mapping in `getProfile`/`getVideos`.

Delete `test-tiktok.ts` once verified.

- [ ] **Step 5: Commit**

```bash
git add lib/tiktok.ts
git commit -m "feat: add TikTok RapidAPI wrapper"
```

---

## Task 3: Create GET + POST /api/tiktok/accounts

**Files:**
- Create: `app/api/tiktok/accounts/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const { data: accounts, error } = await supabase
    .from('tiktok_accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accountsWithSnapshots = await Promise.all(
    (accounts ?? []).map(async (account) => {
      const { data: snapshot } = await supabase
        .from('tiktok_snapshots')
        .select('followers, video_count, fetched_at')
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
    .from('tiktok_accounts')
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

- [ ] **Step 2: Test with curl**

Start the dev server (`npm run dev`) then in a separate terminal:

```bash
# Add an account
curl -X POST http://localhost:3000/api/tiktok/accounts \
  -H "Content-Type: application/json" \
  -d '{"handle": "@charlidamelio"}'
```
Expected: `{"account": {"id": "...", "handle": "charlidamelio", ...}}`

```bash
# List accounts
curl http://localhost:3000/api/tiktok/accounts
```
Expected: `{"accounts": [{"id": "...", "handle": "charlidamelio", "latest_snapshot": null, ...}]}`

- [ ] **Step 3: Commit**

```bash
git add app/api/tiktok/accounts/route.ts
git commit -m "feat: add GET and POST /api/tiktok/accounts"
```

---

## Task 4: Create POST /api/tiktok/accounts/[id]/refresh

**Files:**
- Create: `app/api/tiktok/accounts/[id]/refresh/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProfile, getVideos } from '@/lib/tiktok';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const { data: account, error: accountError } = await supabase
    .from('tiktok_accounts')
    .select('handle')
    .eq('id', id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const [profile, videos] = await Promise.all([
    getProfile(account.handle),
    getVideos(account.handle),
  ]);

  const { data: snapshot, error: insertError } = await supabase
    .from('tiktok_snapshots')
    .insert({
      account_id: id,
      followers: profile.followers,
      video_count: profile.video_count,
      videos,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ snapshot });
}
```

- [ ] **Step 2: Test with curl**

Replace `ACCOUNT_ID` with the id returned in Task 3's POST test:

```bash
curl -X POST http://localhost:3000/api/tiktok/accounts/ACCOUNT_ID/refresh
```
Expected: `{"snapshot": {"id": "...", "account_id": "...", "followers": <number>, "video_count": <number>, "videos": [...], "fetched_at": "..."}}`

Then call GET /api/tiktok/accounts again and verify `latest_snapshot` is now populated for the account.

- [ ] **Step 3: Commit**

```bash
git add "app/api/tiktok/accounts/[id]/refresh/route.ts"
git commit -m "feat: add POST /api/tiktok/accounts/[id]/refresh"
```

---

## Task 5: Create the Accounts page UI

**Files:**
- Create: `app/(dashboard)/accounts/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, RefreshCw, LayoutDashboard } from 'lucide-react';

interface Snapshot {
  followers: number | null;
  video_count: number | null;
  fetched_at: string | null;
}

interface Account {
  id: string;
  handle: string;
  created_at: string;
  latest_snapshot: Snapshot | null;
}

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tiktok/accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    const trimmed = handle.replace(/^@/, '').trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError('');
    const res = await fetch('/api/tiktok/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: trimmed }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setAddError(data.error ?? 'Failed to add account');
      return;
    }
    setHandle('');
    setAccounts((prev) => [{ ...data.account, latest_snapshot: null }, ...prev]);
  }

  async function handleRefresh(id: string) {
    setRefreshingId(id);
    const res = await fetch(`/api/tiktok/accounts/${id}/refresh`, { method: 'POST' });
    const data = await res.json();
    setRefreshingId(null);
    if (!res.ok) return;
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              latest_snapshot: {
                followers: data.snapshot.followers,
                video_count: data.snapshot.video_count,
                fetched_at: data.snapshot.fetched_at,
              },
            }
          : a
      )
    );
  }

  function fmt(n: number | null) {
    if (n === null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-[#E9EBF0]">
      <div className="flex gap-6 p-6 min-h-screen">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 sticky top-6 self-start h-[calc(100vh-48px)] bg-white rounded-[24px] shadow-[0_8px_24px_rgba(27,27,47,0.05)] flex flex-col overflow-hidden">
          <div className="flex flex-col flex-1 p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-xl bg-[#EEEBFC] flex items-center justify-center shrink-0">
                <LayoutDashboard size={18} className="text-[#6C5CE7]" />
              </div>
              <span className="text-[15px] font-bold text-[#6C5CE7] tracking-tight">TrendForge</span>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] px-3 mb-2">
                Workspace
              </p>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-3 h-11 px-3 rounded-xl text-[#6B6B80] hover:bg-[#F5F6FA] transition-colors w-full text-left"
              >
                <LayoutDashboard size={20} className="shrink-0" />
                <span className="text-[13px] font-medium">Dashboard</span>
              </button>
              <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-[#EEEBFC] w-full">
                <ArrowLeft size={20} className="text-[#6C5CE7] shrink-0" />
                <span className="text-[13px] font-semibold text-[#6C5CE7]">Accounts</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[#1B1B2F]">TikTok Accounts</h1>
              <p className="text-[14px] text-[#9A9AAE] mt-0.5">Track client performance over time</p>
            </div>
          </div>

          {/* Add account */}
          <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_24px_rgba(27,27,47,0.05)]">
            <p className="text-[13px] font-semibold text-[#1B1B2F] mb-3">Add account</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={handle}
                onChange={(e) => { setHandle(e.target.value); setAddError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="@handle or handle"
                className="flex-1 h-10 px-4 rounded-xl border border-[#ECEDF2] text-[14px] text-[#1B1B2F] placeholder-[#9A9AAE] focus:outline-none focus:border-[#6C5CE7] focus:ring-2 focus:ring-[#6C5CE7]/10 transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !handle.trim()}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4BD6] disabled:opacity-50 text-white text-[13px] font-medium transition-colors"
              >
                <Plus size={15} />
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
            {addError && (
              <p className="text-[13px] text-red-500 mt-2">{addError}</p>
            )}
          </div>

          {/* Accounts table */}
          <div className="bg-white rounded-[24px] shadow-[0_8px_24px_rgba(27,27,47,0.05)] overflow-hidden">
            {loading ? (
              <p className="text-[14px] text-[#9A9AAE] p-6">Loading…</p>
            ) : accounts.length === 0 ? (
              <div className="text-center py-16 px-6">
                <p className="text-[15px] font-semibold text-[#1B1B2F] mb-1">No accounts yet</p>
                <p className="text-[14px] text-[#9A9AAE]">Add a TikTok handle above to start tracking.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0F1F5]">
                    {['Handle', 'Followers', 'Videos', 'Last refreshed', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] px-6 py-4 first:pl-6"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a, i) => (
                    <tr
                      key={a.id}
                      className={`${i < accounts.length - 1 ? 'border-b border-[#F0F1F5]' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-semibold text-[#1B1B2F]">@{a.handle}</span>
                      </td>
                      <td className="px-6 py-4 text-[14px] text-[#1B1B2F]">
                        {fmt(a.latest_snapshot?.followers ?? null)}
                      </td>
                      <td className="px-6 py-4 text-[14px] text-[#1B1B2F]">
                        {fmt(a.latest_snapshot?.video_count ?? null)}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#9A9AAE]">
                        {fmtDate(a.latest_snapshot?.fetched_at ?? null)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRefresh(a.id)}
                          disabled={refreshingId === a.id}
                          className="inline-flex items-center gap-2 h-8 px-4 rounded-lg border border-[#ECEDF2] hover:border-[#6C5CE7] hover:text-[#6C5CE7] disabled:opacity-50 text-[#6B6B80] text-[12px] font-medium transition-colors"
                        >
                          <RefreshCw size={13} className={refreshingId === a.id ? 'animate-spin' : ''} />
                          {refreshingId === a.id ? 'Refreshing…' : 'Refresh'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page in the browser**

Navigate to `http://localhost:3000/accounts`

Check:
- Page loads without errors
- Add form renders correctly
- Add a handle (e.g. `@charlidamelio`) → row appears with `—` for stats
- Click Refresh → button shows spinner → row updates with follower count and video count
- Refreshing one row doesn't affect other rows

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/accounts/page.tsx"
git commit -m "feat: add TikTok accounts page with refresh"
```

---

## Task 6: Add Accounts nav link to dashboard sidebar

**Files:**
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Add usePathname import and Accounts nav item**

In `app/(dashboard)/page.tsx`, the sidebar nav section currently contains only the Dashboard link (around line 210). Add an Accounts link below it.

Find this block (around line 209–217):
```tsx
            {/* Nav group */}
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] px-3 mb-2">
                Workspace
              </p>
              <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-[#EEEBFC]">
                <LayoutDashboard size={20} className="text-[#6C5CE7] shrink-0" />
                <span className="text-[13px] font-semibold text-[#6C5CE7]">Dashboard</span>
              </div>
            </div>
```

Replace it with:
```tsx
            {/* Nav group */}
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-[#9A9AAE] uppercase tracking-[0.08em] px-3 mb-2">
                Workspace
              </p>
              <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-[#EEEBFC]">
                <LayoutDashboard size={20} className="text-[#6C5CE7] shrink-0" />
                <span className="text-[13px] font-semibold text-[#6C5CE7]">Dashboard</span>
              </div>
              <button
                onClick={() => router.push('/accounts')}
                className="flex items-center gap-3 h-11 px-3 rounded-xl text-[#6B6B80] hover:bg-[#F5F6FA] transition-colors w-full text-left"
              >
                <Users size={20} className="shrink-0" />
                <span className="text-[13px] font-medium">Accounts</span>
              </button>
            </div>
```

`Users` is already imported from `lucide-react` at the top of the file — no new import needed.

- [ ] **Step 2: Verify in the browser**

Navigate to `http://localhost:3000`

Check:
- "Accounts" link appears in the sidebar below "Dashboard"
- Clicking it navigates to `/accounts`

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/page.tsx"
git commit -m "feat: add Accounts nav link to dashboard sidebar"
```

---

## Self-Review Checklist (done before saving this plan)

- [x] Spec coverage: schema ✓, lib/tiktok.ts ✓, three API routes ✓, accounts page ✓, forward-compatible project_id ✓
- [x] No placeholders: all code blocks are complete; API field names include fallbacks for common variant spellings
- [x] Type consistency: `Account`, `Snapshot`, `TikTokProfile`, `TikTokVideoStat` used consistently across tasks
- [x] Env var names match in .env.local and lib/tiktok.ts (`RAPIDAPI_KEY`, `RAPIDAPI_TIKTOK_HOST`)
- [x] `supabase` (not `supabaseAdmin`) used in routes, matching existing pattern
- [x] `Users` icon was confirmed already imported in dashboard page — no new import needed
