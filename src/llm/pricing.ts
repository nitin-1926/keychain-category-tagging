// $ per 1M tokens, Standard tier, short context. gpt-5.6 rows read 2026-09-22, gpt-6 rows read 2026-09-24,
// both from https://developers.openai.com/api/docs/pricing.
// Input price applies to uncached input tokens. The gpt-6 page also lists a "cache writes" rate
// ($0.125/M for luna) that the usage object does not report, so it is not charged here (small upward bias).

import { z } from 'zod';

// Validated, not cast: usage arrives from the committed replay files as well as from the API,
// and a string where a number belongs would silently corrupt every cost number downstream.
export const Usage = z.object({ input: z.number(), cached: z.number(), output: z.number(), reasoning: z.number() });
export type Usage = z.infer<typeof Usage>;

export const PRICING: Record<string, { input: number; cached: number; output: number }> = {
  'gpt-6-luna': { input: 0.1, cached: 0.01, output: 0.5 },
  'gpt-6-sol': { input: 2, cached: 0.2, output: 10 }, // priced the one-off reference build, not the pipeline
  'gpt-5.6-luna': { input: 0.2, cached: 0.02, output: 1.2 }, // the first full run, kept for the comparison in the README
};

export function costUsd(model: string, u: Usage): number {
  const p = PRICING[model];
  if (!p) throw new Error(`no price for model ${model}; add it to src/llm/pricing.ts`);
  return ((u.input - u.cached) * p.input + u.cached * p.cached + u.output * p.output) / 1e6;
}

export const ZERO_USAGE: Usage = { input: 0, cached: 0, output: 0, reasoning: 0 };

export function addUsage(a: Usage, b: Usage): Usage {
  return { input: a.input + b.input, cached: a.cached + b.cached, output: a.output + b.output, reasoning: a.reasoning + b.reasoning };
}
