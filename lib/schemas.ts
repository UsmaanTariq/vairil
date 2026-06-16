import { z } from 'zod';

export const NormalisedBriefSchema = z.object({
  rawText: z.string(),
  clientName: z.string().optional(),
  niche: z.string().optional(),
  platforms: z.array(z.string()).optional(),
});

export type NormalisedBrief = z.infer<typeof NormalisedBriefSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
});

export const QuestionsOutputSchema = z.object({
  questions: z.array(QuestionSchema),
});

export type QuestionsOutput = z.infer<typeof QuestionsOutputSchema>;

export const ProfileSchema = z.object({
  description: z.string(),
  audience: z.string(),
  positioning: z.string(),
  offers: z.string(),
  tone: z.string(),
  contentGoals: z.string(),
  filmingConstraints: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const TrendSchema = z.object({
  name: z.string(),
  description: z.string(),
  platform: z.string(),
  format: z.string(),
  audio: z.string().optional(),
  relevance: z.string(),
  confidence: z.enum(['high', 'med', 'low']),
  trendDate: z.string(),
  sourceUrl: z.string(),
});

export type Trend = z.infer<typeof TrendSchema>;

export const TrendsOutputSchema = z.object({
  trends: z.array(TrendSchema),
});

export const IdeaSchema = z.object({
  title: z.string(),
  trendRef: z.string(),
  hook: z.string(),
  script: z.string(),
  shotList: z.array(z.string()),
  audio: z.string().optional(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  why: z.string(),
  status: z.enum(['draft', 'approved']).default('draft'),
});

export type Idea = z.infer<typeof IdeaSchema>;

export const IdeasOutputSchema = z.object({
  ideas: z.array(IdeaSchema),
});

export const CriticOutputSchema = z.object({
  results: z.array(
    z.object({
      ideaTitle: z.string(),
      keep: z.boolean(),
      reasons: z.array(z.string()),
    })
  ),
});

export type CriticOutput = z.infer<typeof CriticOutputSchema>;
