import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/db';
import { callAgent } from '@/lib/anthropic';
import { ideasPrompt } from '@/lib/prompts/ideas';
import { IdeasOutputSchema } from '@/lib/schemas';

// Single fast generation pass on Sonnet at low effort. The human like/dislike
// loop is the quality gate now, so the old critic→regenerate round (which
// roughly doubled latency) has been removed.
const GEN_MODEL = 'claude-sonnet-4-6';

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
            status: { type: 'string', enum: ['new', 'approved', 'rejected'] },
          },
          required: ['title', 'trendRef', 'hook', 'script', 'shotList', 'caption', 'hashtags', 'why'],
        },
      },
    },
    required: ['ideas'],
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get('project_id');

  if (!project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ideas')
    .select('id, title, trend_ref, hook, script, shot_list, audio, caption, hashtags, why, status, feedback_reason, created_at')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ideas = (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title,
    trendRef: row.trend_ref,
    hook: row.hook,
    script: row.script,
    shotList: (row.shot_list as string[]) ?? [],
    audio: row.audio ?? undefined,
    caption: row.caption,
    hashtags: (row.hashtags as string[]) ?? [],
    why: row.why,
    status: (row.status as 'new' | 'approved' | 'rejected') ?? 'new',
    feedbackReason: row.feedback_reason ?? null,
  }));

  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id } = body as { project_id: string };

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

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

    // Load trends (non-dismissed only)
    const { data: trendRows } = await supabase
      .from('trends')
      .select('name, description, platform, format, relevance, confidence')
      .eq('project_id', project_id)
      .eq('dismissed', false);

    // Load existing ideas for avoid-repeats + negative steering
    const { data: existingIdeaRows } = await supabase
      .from('ideas')
      .select('title, hook, status, feedback_reason')
      .eq('project_id', project_id);

    const existingTitles = (existingIdeaRows ?? []).map((r) => r.title as string);
    const disliked = (existingIdeaRows ?? []).filter((r) => r.status === 'rejected');

    const trendsText =
      (trendRows ?? [])
        .map(
          (t, i) =>
            `Trend ${i + 1}: ${t.name} (${t.platform}, ${t.format}, confidence: ${t.confidence})\n` +
            `${t.description}\nWhy relevant: ${t.relevance}`
        )
        .join('\n\n') || 'No trends available — generate ideas based on the business profile alone.';

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

    const previousIdeasBlock =
      existingTitles.length > 0
        ? [
            '',
            'ALREADY-GENERATED IDEAS (do not repeat these concepts, angles, or hooks):',
            ...existingTitles.map((t) => `- ${t}`),
          ].join('\n')
        : '';

    const dislikedBlock =
      disliked.length > 0
        ? [
            '',
            'THE CLIENT DISLIKED THESE IDEAS — generate clearly different concepts. Avoid their style, topics, and angles:',
            ...disliked.map((r) => `- "${r.title as string}"${r.feedback_reason ? ` (reason: ${r.feedback_reason as string})` : ''}`),
          ].join('\n')
        : '';

    const baseInput = [
      profileBlock,
      ``,
      `CURRENT TRENDS TO ANCHOR IDEAS TO:`,
      trendsText,
      previousIdeasBlock,
      dislikedBlock,
    ].join('\n');

    // Single fast generation pass.
    const { ideas: currentIdeas } = await callAgent({
      system: ideasPrompt,
      input: `${baseInput}\n\nGenerate 6 ideas. Replace {N} in your instructions with 6.`,
      schema: IdeasOutputSchema,
      tools: [returnIdeasTool],
      toolChoice: { type: 'tool', name: 'return_ideas' },
      model: GEN_MODEL,
      effort: 'low',
    });

    // Append new ideas as status 'new' (do NOT delete existing).
    if (currentIdeas.length > 0) {
      await supabase.from('ideas').insert(
        currentIdeas.map((idea) => ({
          project_id,
          title: idea.title,
          trend_ref: idea.trendRef,
          hook: idea.hook,
          script: idea.script,
          shot_list: idea.shotList,
          audio: idea.audio ?? null,
          caption: idea.caption,
          hashtags: idea.hashtags,
          why: idea.why,
          status: 'new',
        }))
      );
    }

    return NextResponse.json({ ideas: currentIdeas });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate ideas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
