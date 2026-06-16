import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  // Grab the 5 most recently created projects
  const { data: recentProjects, error: projError } = await supabase
    .from('projects')
    .select('id, client_name')
    .order('created_at', { ascending: false })
    .limit(5);

  if (projError || !recentProjects?.length) {
    return NextResponse.json({ ideas: [] });
  }

  const projectIds = recentProjects.map((p) => p.id);

  const { data: rows, error: ideasError } = await supabase
    .from('ideas')
    .select('id, title, hook, status, project_id')
    .in('project_id', projectIds)
    .limit(9);

  if (ideasError) {
    return NextResponse.json({ error: ideasError.message }, { status: 500 });
  }

  const projectMap: Record<string, string> = Object.fromEntries(
    recentProjects.map((p) => [p.id, p.client_name])
  );

  const ideas = (rows ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    hook: row.hook as string,
    status: (row.status ?? 'draft') as 'draft' | 'approved',
    project_id: row.project_id as string,
    client_name: projectMap[row.project_id as string] ?? 'Unknown',
  }));

  return NextResponse.json({ ideas });
}
