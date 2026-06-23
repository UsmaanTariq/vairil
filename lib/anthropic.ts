import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type Tool = Anthropic.Tool;
type ToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string };
type Effort = 'low' | 'medium' | 'high' | 'max';

// Opus 4.7+ reject the sampling parameters (temperature/top_p/top_k) with a 400.
// Sonnet and Haiku still accept temperature.
function acceptsTemperature(model: string) {
  return model.startsWith('claude-sonnet') || model.startsWith('claude-haiku');
}

export async function callAgent<T>({
  system,
  input,
  schema,
  tools,
  toolChoice,
  temperature,
  model = 'claude-sonnet-4-6',
  effort,
}: {
  system: string;
  input: string;
  schema: z.ZodSchema<T>;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  temperature?: number;
  model?: string;
  effort?: Effort;
}): Promise<T> {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 8000,
    system,
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    ...(acceptsTemperature(model) && temperature !== undefined ? { temperature } : {}),
    messages: [{ role: 'user', content: input }],
  };

  // effort is GA on Opus 4.5+; controls thinking depth / token spend.
  if (effort) {
    (params as unknown as Record<string, unknown>).output_config = { effort };
  }

  const res = await anthropic.messages.create(params);

  const json = extractJson(res);
  return schema.parse(json);
}

function extractJson(res: Anthropic.Message): unknown {
  for (const block of res.content) {
    if (block.type === 'tool_use') {
      return block.input;
    }
    if (block.type === 'text') {
      const match = block.text.match(/```json\s*([\s\S]*?)```/) ??
        block.text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        return JSON.parse(match[1]);
      }
    }
  }
  throw new Error('No JSON found in agent response');
}
