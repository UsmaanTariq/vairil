import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { parseFile } from '@/lib/parse';

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const projectId = formData.get('project_id') as string;
  const rawText = (formData.get('raw_text') as string) ?? '';
  const files = formData.getAll('files') as File[];

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  let parsedText = rawText;
  const fileRefs: string[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseFile(buffer, file.type);
    parsedText += '\n\n' + text;
    fileRefs.push(file.name);
  }

  parsedText = parsedText.trim();

  const { error: briefError } = await supabase
    .from('briefs')
    .upsert({ project_id: projectId, raw_text: rawText, file_refs: fileRefs, parsed_text: parsedText });

  if (briefError) {
    return NextResponse.json({ error: briefError.message }, { status: 500 });
  }

  const { error: projectError } = await supabase
    .from('projects')
    .update({ status: 'interview' })
    .eq('id', projectId);

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, parsed_text: parsedText });
}
