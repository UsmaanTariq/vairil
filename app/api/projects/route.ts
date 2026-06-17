import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const [projectsResult, ideasResult, trendsResult, ttSnapsResult, igSnapsResult, ttAccountsResult, igAccountsResult] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('ideas').select('project_id, status'),
    supabase.from('trends').select('project_id'),
    supabase.from('tiktok_snapshots').select('followers, fetched_at, tiktok_accounts!inner(handle)').order('fetched_at', { ascending: false }),
    supabase.from('instagram_snapshots').select('followers, fetched_at, instagram_accounts!inner(handle)').order('fetched_at', { ascending: false }),
    supabase.from('tiktok_accounts').select('handle, profile_pic_url'),
    supabase.from('instagram_accounts').select('handle, profile_pic_url'),
  ]);

  if (projectsResult.error) {
    return NextResponse.json({ error: projectsResult.error.message }, { status: 500 });
  }

  const ideas  = ideasResult.data  ?? [];
  const trends = trendsResult.data ?? [];

  // de-duplicate to get latest followers per handle
  const ttFollowers: Record<string, number> = {};
  for (const s of ttSnapsResult.data ?? []) {
    const handle = (s.tiktok_accounts as unknown as { handle: string }).handle;
    if (!(handle in ttFollowers)) ttFollowers[handle] = s.followers;
  }
  const igFollowers: Record<string, number> = {};
  for (const s of igSnapsResult.data ?? []) {
    const handle = (s.instagram_accounts as unknown as { handle: string }).handle;
    if (!(handle in igFollowers)) igFollowers[handle] = s.followers;
  }

  const ttPics: Record<string, string> = {};
  for (const a of ttAccountsResult.data ?? []) {
    if (a.profile_pic_url) ttPics[a.handle] = a.profile_pic_url as string;
  }
  const igPics: Record<string, string> = {};
  for (const a of igAccountsResult.data ?? []) {
    if (a.profile_pic_url) igPics[a.handle] = a.profile_pic_url as string;
  }

  const projects = (projectsResult.data ?? []).map((p) => ({
    ...p,
    ideas_count:    ideas.filter((i) => i.project_id === p.id).length,
    approved_count: ideas.filter((i) => i.project_id === p.id && i.status === 'approved').length,
    trends_count:   trends.filter((t) => t.project_id === p.id).length,
    tiktok_followers:         p.tiktok_handle    ? (ttFollowers[p.tiktok_handle]    ?? null) : null,
    instagram_followers:      p.instagram_handle ? (igFollowers[p.instagram_handle] ?? null) : null,
    tiktok_profile_pic_url:   p.tiktok_handle    ? (ttPics[p.tiktok_handle]         ?? null) : null,
    instagram_profile_pic_url: p.instagram_handle ? (igPics[p.instagram_handle]     ?? null) : null,
  }));

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_name, niche, platforms } = body;

  if (!client_name) {
    return NextResponse.json({ error: 'client_name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ client_name, niche: niche ?? null, platforms: platforms ?? [], status: 'intake' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data }, { status: 201 });
}
