import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const [projectsResult, ideasResult, trendsResult] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('ideas').select('project_id, status'),
    supabase.from('trends').select('project_id'),
  ]);

  if (projectsResult.error) {
    return NextResponse.json({ error: projectsResult.error.message }, { status: 500 });
  }

  const ideas = ideasResult.data ?? [];
  const trends = trendsResult.data ?? [];

  const projects = (projectsResult.data ?? []).map((p) => ({
    ...p,
    ideas_count: ideas.filter((i) => i.project_id === p.id).length,
    approved_count: ideas.filter((i) => i.project_id === p.id && i.status === 'approved').length,
    trends_count: trends.filter((t) => t.project_id === p.id).length,
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
