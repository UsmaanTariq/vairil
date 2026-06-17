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

export async function callAgent<T>({
  system,
  input,
  schema,
  tools,
  toolChoice,
  temperature,
}: {
  system: string;
  input: string;
  schema: z.ZodSchema<T>;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  temperature?: number;
}): Promise<T> {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system,
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    messages: [{ role: 'user', content: input }],
  });

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
