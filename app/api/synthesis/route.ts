import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/db';
import { callAgent } from '@/lib/anthropic';
import { synthesisPrompt } from '@/lib/prompts/synthesis';
import { ProfileSchema } from '@/lib/schemas';

const synthesisTool: Anthropic.Tool = {
  name: 'return_profile',
  description: 'Return the structured business profile',
  input_schema: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      audience: { type: 'string' },
      positioning: { type: 'string' },
      offers: { type: 'string' },
      tone: { type: 'string' },
      contentGoals: { type: 'string' },
      filmingConstraints: { type: 'string' },
    },
    required: [
      'description',
      'audience',
      'positioning',
      'offers',
      'tone',
      'contentGoals',
      'filmingConstraints',
    ],
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get('project_id');

  if (!project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('synthesis')
    .select('profile, confirmed')
    .eq('project_id', project_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ profile: null, confirmed: false });
  }

  return NextResponse.json({ profile: data.profile, confirmed: data.confirmed });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, answers } = body as {
      project_id: string;
      answers?: { question: string; answer: string }[];
    };

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    const { data: brief } = await supabase
      .from('briefs')
      .select('parsed_text, raw_text')
      .eq('project_id', project_id)
      .single();

    const briefText = brief?.parsed_text || brief?.raw_text || '';

    // Use passed answers or fall back to answers stored in DB
    let qaList: { question: string; answer: string }[] = [];

    if (answers && answers.length > 0) {
      qaList = answers;
    } else {
      const { data: savedAnswers } = await supabase
        .from('answers')
        .select('qa')
        .eq('project_id', project_id)
        .single();

      if (savedAnswers?.qa) {
        qaList = savedAnswers.qa as { question: string; answer: string }[];
      }
    }

    const answersText = qaList
      .filter((a) => a.answer?.trim())
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join('\n\n');

    const input = `BRIEF:\n${briefText}${answersText ? `\n\nINTERVIEW ANSWERS:\n${answersText}` : ''}`;

    const profile = await callAgent({
      system: synthesisPrompt,
      input,
      schema: ProfileSchema,
      tools: [synthesisTool],
      toolChoice: { type: 'tool', name: 'return_profile' },
      temperature: 0.2,
    });

    // Store the full Q+A in answers table so regeneration can reuse them
    if (answers && answers.length > 0) {
      await supabase.from('answers').delete().eq('project_id', project_id);
      await supabase.from('answers').insert({ project_id, qa: answers });
    }

    // Upsert synthesis profile
    await supabase.from('synthesis').delete().eq('project_id', project_id);
    await supabase
      .from('synthesis')
      .insert({ project_id, profile, confirmed: false });

    // Advance project status to synthesis
    await supabase
      .from('projects')
      .update({ status: 'synthesis' })
      .eq('id', project_id);

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, confirmed, profile } = body as {
      project_id: string;
      confirmed?: boolean;
      profile?: Record<string, string>;
    };

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (confirmed !== undefined) update.confirmed = confirmed;
    if (profile !== undefined) update.profile = profile;

    const { error } = await supabase
      .from('synthesis')
      .update(update)
      .eq('project_id', project_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (confirmed) {
      await supabase
        .from('projects')
        .update({ status: 'research' })
        .eq('id', project_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update synthesis';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
