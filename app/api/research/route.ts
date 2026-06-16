import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/db';
import { callAgent } from '@/lib/anthropic';
import { researchPrompt } from '@/lib/prompts/research';
import { TrendsOutputSchema, type Trend } from '@/lib/schemas';
import { searchMultiple } from '@/lib/search';

const returnTrendsTool: Anthropic.Tool = {
  name: 'return_trends',
  description: 'Return structured trend data for short-form video content',
  input_schema: {
    type: 'object' as const,
    properties: {
      trends: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            platform: { type: 'string' },
            format: { type: 'string' },
            audio: { type: 'string' },
            relevance: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'med', 'low'] },
            trendDate: { type: 'string' },
            sourceUrl: { type: 'string' },
          },
          required: [
            'name',
            'description',
            'platform',
            'format',
            'relevance',
            'confidence',
            'trendDate',
            'sourceUrl',
          ],
        },
      },
    },
    required: ['trends'],
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get('project_id');

  if (!project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('trends')
    .select('name, description, platform, format, audio, relevance, source_url, trend_date, confidence')
    .eq('project_id', project_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const trends: Trend[] = (data ?? []).map((row) => ({
    name: row.name,
    description: row.description ?? '',
    platform: row.platform,
    format: row.format,
    audio: row.audio ?? undefined,
    relevance: row.relevance,
    confidence: row.confidence as 'high' | 'med' | 'low',
    trendDate: row.trend_date,
    sourceUrl: row.source_url,
  }));

  return NextResponse.json({ trends });
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

    // Load project for niche + platforms
    const { data: project } = await supabase
      .from('projects')
      .select('niche, platforms')
      .eq('id', project_id)
      .single();

    const niche = project?.niche ?? profile.description ?? 'business';
    const platforms = (project?.platforms as string[] | null) ?? ['tiktok', 'instagram'];
    const platformLabel = platforms.join(' and ');

    const now = new Date();
    const monthYear = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const audience = (profile.audience as string | undefined) ?? '';

    const queries = [
      `trending ${niche} ${platformLabel} content ${monthYear}`,
      `TikTok ${niche} hooks viral ${monthYear}`,
      `${niche} short-form video formats going viral ${monthYear}`,
      `${niche} Instagram Reels trends ${monthYear}`,
      `${audience} ${niche} content creators trends ${monthYear}`.trim(),
    ];

    const rawResults = await searchMultiple(queries, 5);

    // Sort newest-first; undated results go to the end
    const sorted = rawResults.sort((a, b) => {
      if (!a.published_date && !b.published_date) return 0;
      if (!a.published_date) return 1;
      if (!b.published_date) return -1;
      return new Date(b.published_date).getTime() - new Date(a.published_date).getTime();
    });

    const results = sorted.slice(0, 15);

    const searchContext = results
      .map((r, i) =>
        [
          `[${i + 1}] ${r.title}`,
          `URL: ${r.url}`,
          r.published_date ? `Date: ${r.published_date}` : '',
          r.content.slice(0, 600),
        ]
          .filter(Boolean)
          .join('\n')
      )
      .join('\n\n');

    const input = [
      `BUSINESS PROFILE:`,
      `Description: ${profile.description}`,
      `Audience: ${profile.audience}`,
      `Niche: ${niche}`,
      `Platforms: ${platformLabel}`,
      ``,
      `SEARCH RESULTS (${monthYear}):`,
      searchContext,
    ].join('\n');

    const { trends } = await callAgent({
      system: researchPrompt,
      input,
      schema: TrendsOutputSchema,
      tools: [returnTrendsTool],
      toolChoice: { type: 'tool', name: 'return_trends' },
    });

    // Upsert: delete old, insert fresh
    await supabase.from('trends').delete().eq('project_id', project_id);

    if (trends.length > 0) {
      await supabase.from('trends').insert(
        trends.map((t) => ({
          project_id,
          name: t.name,
          description: t.description,
          platform: t.platform,
          format: t.format,
          audio: t.audio ?? null,
          relevance: t.relevance,
          confidence: t.confidence,
          trend_date: t.trendDate,
          source_url: t.sourceUrl,
        }))
      );
    }

    return NextResponse.json({ trends });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to run research';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
