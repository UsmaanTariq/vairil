import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/db';
import { callAgent } from '@/lib/anthropic';
import { ideasPrompt } from '@/lib/prompts/ideas';
import { IdeasOutputSchema } from '@/lib/schemas';

const returnIdeasTool: Anthropic.Tool = {
  name: 'return_ideas',
  description: 'Return structured short-form video content ideas',
  input_schema: {
    type: 'object' as const,
    properties: {
      ideas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            trendRef: { type: 'string' },
            hook: { type: 'string' },
            script: { type: 'string' },
            shotList: { type: 'array', items: { type: 'string' } },
            audio: { type: 'string' },
            caption: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
            why: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'approved'] },
          },
          required: ['title', 'trendRef', 'hook', 'script', 'shotList', 'caption', 'hashtags', 'why'],
        },
      },
    },
    required: ['ideas'],
  },
};

// Toggle idea status between draft and approved
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status: 'draft' | 'approved' };

  if (!['draft', 'approved'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { error } = await supabase.from('ideas').update({ status }).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}

// Regenerate a single idea using the same profile + trends context
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { project_id, otherIdeas } = body as { project_id: string; otherIdeas?: string[] };

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    // Load the existing idea for context
    const { data: existingRow } = await supabase
      .from('ideas')
      .select('title, trend_ref, hook, script')
      .eq('id', id)
      .single();

    // Load confirmed profile
    const { data: synthRow } = await supabase
      .from('synthesis')
      .select('profile')
      .eq('project_id', project_id)
      .single();

    if (!synthRow?.profile) {
      return NextResponse.json({ error: 'No confirmed profile found' }, { status: 400 });
    }

    const profile = synthRow.profile as Record<string, string>;

    // Load trends
    const { data: trendRows } = await supabase
      .from('trends')
      .select('name, description, platform, format, relevance, confidence')
      .eq('project_id', project_id);

    const trendsText =
      (trendRows ?? [])
        .map(
          (t, i) =>
            `Trend ${i + 1}: ${t.name} (${t.platform}, ${t.format}, confidence: ${t.confidence})\n` +
            `${t.description}\nWhy relevant: ${t.relevance}`
        )
        .join('\n\n') || 'No trends available — generate an idea based on the business profile alone.';

    const profileBlock = [
      `BUSINESS PROFILE:`,
      `Description: ${profile.description}`,
      `Audience: ${profile.audience}`,
      `Positioning: ${profile.positioning}`,
      `Offers: ${profile.offers}`,
      `Tone: ${profile.tone}`,
      `Content goals: ${profile.contentGoals}`,
      `Filming constraints: ${profile.filmingConstraints}`,
    ].join('\n');

    const oldIdeaContext = existingRow
      ? `\n\nREPLACING THIS IDEA (do NOT reuse its title or hook):\nTitle: "${existingRow.title}"\nTrend: ${existingRow.trend_ref}\nHook: ${existingRow.hook}`
      : '';

    const otherIdeasBlock =
      otherIdeas && otherIdeas.length > 0
        ? [
            ``,
            `OTHER IDEAS ALREADY ON THE BOARD (this new idea must be clearly different from all of them):`,
            ...otherIdeas.map((t) => `- ${t}`),
          ].join('\n')
        : '';

    const input = [
      profileBlock,
      ``,
      `CURRENT TRENDS TO ANCHOR IDEAS TO:`,
      trendsText,
      oldIdeaContext,
      otherIdeasBlock,
      ``,
      `Generate 1 fresh idea. Replace {N} in your instructions with 1. Make it distinctly different from the idea being replaced and from all other ideas already on the board.`,
    ].join('\n');

    const result = await callAgent({
      system: ideasPrompt,
      input,
      schema: IdeasOutputSchema,
      tools: [returnIdeasTool],
      toolChoice: { type: 'tool', name: 'return_ideas' },
      temperature: 0.9,
    });

    const newIdea = result.ideas[0];
    if (!newIdea) {
      return NextResponse.json({ error: 'Agent returned no ideas' }, { status: 500 });
    }

    // Update the existing row in place
    const { error: updateError } = await supabase
      .from('ideas')
      .update({
        title: newIdea.title,
        trend_ref: newIdea.trendRef,
        hook: newIdea.hook,
        script: newIdea.script,
        shot_list: newIdea.shotList,
        audio: newIdea.audio ?? null,
        caption: newIdea.caption,
        hashtags: newIdea.hashtags,
        why: newIdea.why,
        status: 'draft',
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ idea: { id, ...newIdea, status: 'draft' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to regenerate idea';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
