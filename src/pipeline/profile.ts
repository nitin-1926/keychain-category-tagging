// STEPS 3 and 5 (ARCHITECTURE.md section 3): read the whole site in windows, merge into the card,
// verify every quote. The card is what the rest of the pipeline works from - the site text is not
// looked at again except as evidence for the judge.
// Called by: pipeline/tag.ts (and the cli `profile` command, to print a card on its own).
// Calls: llm/client.ts complete() once per window plus one merge call (windows run through
// pool.ts, four at a time); text/normalize.ts for the quote guard. What the calls cost is recorded
// by the client that pipeline/tag.ts hands in, not here. Next step: pipeline/shortlist.ts, on the
// card this returns.
// Order below: the Card schema (what the model must return), windows(), verifyCard() (the guard),
// then profile() which runs them in sequence.

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { config } from '../config.js';
import type { LlmClient } from '../llm/client.js';
import { pool } from '../pool.js';
import type { Chunk } from '../text/chunk.js';
import { normalize, quoteMatcher, type QuoteMatch } from '../text/normalize.js';

const ENTITY_TYPES = ['manufacturer', 'co_packer', 'both', 'marketplace', 'investor', 'distributor', 'other'] as const;
const STORAGE = ['frozen', 'refrigerated', 'shelf_stable'] as const;

export const Card = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  products: z.array(z.object({ name: z.string(), quote: z.string(), storage: z.enum(STORAGE).nullable() })),
  capabilities: z.array(z.object({ name: z.string(), quote: z.string() })),
  brands: z.array(z.string()),
  site_language: z.string(),
  summary: z.string(),
});
export type Card = z.infer<typeof Card>;

const prompt = (name: string) => readFileSync(new URL(`../prompts/${name}.md`, import.meta.url), 'utf8');
export const PROFILE_PROMPT = prompt(`profile.${config.prompts.profile}`);
export const REDUCE_PROMPT = prompt(`profile-reduce.${config.prompts.profileReduce}`);

type ProfileResult = {
  card: Card;
  windows: number;
  quotes: Record<QuoteMatch, number>; // exact / fuzzy kept, none dropped
};

// Consecutive chunks grouped into windows of about windowChars (~10K tokens at 4 chars/token).
export function windows(chunks: Chunk[], windowChars = config.windowChars): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let size = 0;
  for (const c of chunks) {
    if (cur.length && size + c.text.length > windowChars) {
      out.push(cur.join('\n'));
      cur = [];
      size = 0;
    }
    cur.push(c.text);
    size += c.text.length + 1;
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

// Code-side guard after the model: quotes must be in the evidence; products deduped by normalised name.
export function verifyCard(card: Card, evidence: string): { card: Card; quotes: Record<QuoteMatch, number> } {
  const quotes: Record<QuoteMatch, number> = { exact: 0, fuzzy: 0, none: 0 };
  const findQuote = quoteMatcher(evidence);
  const seen = new Set<string>();
  const products = card.products.filter((p) => {
    const m = findQuote(p.quote);
    quotes[m]++;
    if (m === 'none') return false;
    const k = normalize(p.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const capabilities = card.capabilities.filter((c) => {
    const m = findQuote(c.quote);
    quotes[m]++;
    return m !== 'none';
  });
  return { card: { ...card, products, capabilities }, quotes };
}

export async function profile(llm: LlmClient, chunks: Chunk[], tag: string, opts: { windowChars?: number } = {}): Promise<ProfileResult> {
  const wins = windows(chunks, opts.windowChars);

  const readings = await pool(wins, config.llmConcurrency, async (text, i) => {
    const r = await llm.complete({
      model: config.MODEL_PIPELINE,
      promptVersion: config.prompts.profile,
      effort: config.effortProfile,
      system: PROFILE_PROMPT,
      user: `Window ${i} of ${wins.length}.\n\n${text}`,
      schemaName: 'card',
      schema: Card,
      tag,
    });
    return r.output;
  });

  let merged = readings[0]!;
  if (readings.length > 1) {
    const r = await llm.complete({
      model: config.MODEL_PIPELINE,
      promptVersion: config.prompts.profileReduce,
      effort: config.effortProfile,
      system: REDUCE_PROMPT,
      user: readings.map((c, i) => `Reading of window ${i}:\n${JSON.stringify(c)}`).join('\n\n'),
      schemaName: 'card',
      schema: Card,
      tag,
    });
    merged = r.output;
  }
  const { card, quotes } = verifyCard(merged, wins.join('\n'));
  return { card, windows: wins.length, quotes };
}
