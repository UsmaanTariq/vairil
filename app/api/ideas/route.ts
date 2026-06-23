import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/db';
import { callAgent } from '@/lib/anthropic';
import { ideasPrompt } from '@/lib/prompts/ideas';
import { criticPrompt } from '@/lib/prompts/critic';
import { IdeasOutputSchema, CriticOutputSchema, type Idea } from '@/lib/schemas';

const MAX_CRITIC_RETRIES = 1;

const GEN_MODEL    = 'claude-opus-4-8';
const CRITIC_MODEL = 'claude-haiku-4-5';

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

const returnCritiqueTool: Anthropic.Tool = {
  name: 'return_critique',
  description: 'Return a quality review for each content idea',
  input_schema: {
    type: 'object' as const,
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ideaTitle: { type: 'string' },
            keep: { type: 'boolean' },
            reasons: { type: 'array', items: { type: 'string' } },
          },
          required: ['ideaTitle', 'keep', 'reasons'],
        },
      },
    },
    required: ['results'],
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
    .select('id, title, trend_ref, hook, script, shot_list, audio, caption, hashtags, why, status')
    .eq('project_id', project_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ideas: Idea[] = (data ?? []).map((row) => ({
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
    status: (row.status as 'draft' | 'approved') ?? 'draft',
  }));

  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, previousIdeas } = body as { project_id: string; previousIdeas?: string[] };

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
      previousIdeas && previousIdeas.length > 0
        ? [
            ``,
            `PREVIOUSLY GENERATED IDEAS FOR THIS PROJECT (avoid reusing these concepts, angles, or hooks):`,
            ...previousIdeas.map((t) => `- ${t}`),
          ].join('\n')
        : '';

    const baseInput = [
      profileBlock,
      ``,
      `CURRENT TRENDS TO ANCHOR IDEAS TO:`,
      trendsText,
      previousIdeasBlock,
    ].join('\n');

    // --- Initial generation ---
    const initialResult = await callAgent({
      system: ideasPrompt,
      input: `${baseInput}\n\nGenerate 6 ideas. Replace {N} in your instructions with 6.`,
      schema: IdeasOutputSchema,
      tools: [returnIdeasTool],
      toolChoice: { type: 'tool', name: 'return_ideas' },
      model: GEN_MODEL,
      effort: 'medium',
    });

    let currentIdeas: Idea[] = initialResult.ideas;
    let criticRounds = 0;
    let totalRegenerated = 0;

    // --- Critic loop (max MAX_CRITIC_RETRIES rounds) ---
    for (let retry = 0; retry < MAX_CRITIC_RETRIES; retry++) {
      const ideasForCritic = currentIdeas
        .map(
          (idea, i) =>
            `Idea ${i + 1}: "${idea.title}"\n` +
            `Trend: ${idea.trendRef}\n` +
            `Hook: ${idea.hook}\n` +
            `Script: ${idea.script}\n` +
            `Shot list: ${idea.shotList.join('; ')}\n` +
            `Why it works: ${idea.why}`
        )
        .join('\n\n---\n\n');

      const criticInput = [
        profileBlock,
        ``,
        `IDEAS TO REVIEW:`,
        ideasForCritic,
      ].join('\n');

      const critique = await callAgent({
        system: criticPrompt,
        input: criticInput,
        schema: CriticOutputSchema,
        tools: [returnCritiqueTool],
        toolChoice: { type: 'tool', name: 'return_critique' },
        model: CRITIC_MODEL,
        temperature: 0.2,
      });

      criticRounds++;

      const rejected = critique.results.filter((r) => !r.keep);
      if (rejected.length === 0) break;

      // Build feedback block for regeneration
      const feedbackBlock = rejected
        .map(
          (r) =>
            `"${r.ideaTitle}" — reasons for rejection:\n` +
            r.reasons.map((reason) => `  - ${reason}`).join('\n')
        )
        .join('\n\n');

      const rejectedTitles = new Set(rejected.map((r) => r.ideaTitle));
      const keptIdeas = currentIdeas.filter((idea) => !rejectedTitles.has(idea.title));
      const keptIdeasBlock =
        keptIdeas.length > 0
          ? `\nKEPT IDEAS (replacement ideas must differ in angle and hook from all of these):\n` +
            keptIdeas.map((i) => `- "${i.title}" — Hook: ${i.hook}`).join('\n')
          : '';

      const regenerateInput = [
        baseInput,
        ``,
        `REJECTED IDEAS — feedback below. Generate ${rejected.length} replacement idea${rejected.length !== 1 ? 's' : ''} that fix these issues. Do NOT reuse the rejected titles.`,
        ``,
        feedbackBlock,
        keptIdeasBlock,
        ``,
        `Replace {N} in your instructions with ${rejected.length}.`,
      ].join('\n');

      const replacements = await callAgent({
        system: ideasPrompt,
        input: regenerateInput,
        schema: IdeasOutputSchema,
        tools: [returnIdeasTool],
        toolChoice: { type: 'tool', name: 'return_ideas' },
        model: GEN_MODEL,
        effort: 'medium',
      });

      // Splice replacements in — preserve positions of kept ideas
      let replacementIdx = 0;

      currentIdeas = currentIdeas.map((idea) => {
        if (rejectedTitles.has(idea.title) && replacementIdx < replacements.ideas.length) {
          return replacements.ideas[replacementIdx++];
        }
        return idea;
      });

      totalRegenerated += rejected.length;
    }

    // Upsert: delete old, insert final batch
    await supabase.from('ideas').delete().eq('project_id', project_id);

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
          status: idea.status ?? 'draft',
        }))
      );
    }

    // Advance project status to ideas
    await supabase.from('projects').update({ status: 'ideas' }).eq('id', project_id);

    return NextResponse.json({
      ideas: currentIdeas,
      meta: { criticRounds, regeneratedCount: totalRegenerated },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate ideas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
