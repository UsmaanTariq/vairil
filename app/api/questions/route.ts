import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/db';
import { callAgent } from '@/lib/anthropic';
import { questionsPrompt } from '@/lib/prompts/questions';
import { QuestionsOutputSchema } from '@/lib/schemas';

const questionsTool: Anthropic.Tool = {
  name: 'return_questions',
  description: 'Return the clarifying questions as structured data',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            question: { type: 'string' },
          },
          required: ['id', 'question'],
        },
      },
    },
    required: ['questions'],
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get('project_id');

  if (!project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('answers')
    .select('qa')
    .eq('project_id', project_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ questions: null });
  }

  return NextResponse.json({ questions: data.qa });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    const { data: brief, error: briefError } = await supabase
      .from('briefs')
      .select('parsed_text, raw_text')
      .eq('project_id', project_id)
      .single();

    if (briefError || !brief) {
      return NextResponse.json({ error: 'Brief not found for this project' }, { status: 404 });
    }

    const input = brief.parsed_text || brief.raw_text || '';

    if (!input.trim()) {
      return NextResponse.json({ error: 'Brief is empty' }, { status: 400 });
    }

    const result = await callAgent({
      system: questionsPrompt,
      input,
      schema: QuestionsOutputSchema,
      tools: [questionsTool],
      toolChoice: { type: 'tool', name: 'return_questions' },
    });

    await supabase.from('answers').delete().eq('project_id', project_id);
    await supabase.from('answers').insert({ project_id, qa: result.questions });

    return NextResponse.json({ questions: result.questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate questions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
