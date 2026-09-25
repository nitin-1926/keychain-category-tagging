// STEPS 7 and 8 (ARCHITECTURE.md section 3): the judge decides, in batches that share one prefix,
// then code validates what it said. Steps 7 and 8 live in one file because they are one loop: no
// verdict leaves judge() without having been checked.
// Called by: pipeline/tag.ts. Calls: llm/client.ts complete() once per batch, text/normalize.ts
// for the quote guard. Next step: pipeline/policy.ts, on the verdicts this returns.
// Order below: the output schema, evidenceBlocks() (what the judge is shown), batches() (how it is
// cut up), then judge() which runs the calls and applies the guards.

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { config } from '../config.js';
import type { LlmClient } from '../llm/client.js';
import { addUsage, ZERO_USAGE, type Usage } from '../llm/pricing.js';
import type { Chunk } from '../text/chunk.js';
import { findQuote, normalize, type QuoteMatch } from '../text/normalize.js';
import type { Card } from './profile.js';
import type { Candidate, MatchedBy } from './shortlist.js';

export const JudgeOutput = z.object({
  verdicts: z.array(
    z.object({
      id: z.number().int(),
      applies: z.boolean(),
      confidence: z.number().min(0).max(1),
      quote: z.string().nullable(),
      reason: z.string(),
    }),
  ),
});

export type Verdict = {
  id: number;
  name: string;
  group: string;
  applies: boolean;
  confidence: number;
  quote: string | null;
  reason: string;
  quoteMatch: QuoteMatch | null;
  retrievalScore: number;
  matchedBy: MatchedBy;
  phrases: string[];
  flags: string[]; // quote_not_found | missing_from_output
};

export type JudgeResult = { verdicts: Verdict[]; batches: number; unknownIds: number; repeatedIds: number; usage: Usage; costUsd: number };

export const JUDGE_PROMPT = readFileSync(new URL(`../prompts/judge.${config.prompts.judge}.md`, import.meta.url), 'utf8');

// What the judge sees: the site head (entity context) plus every chunk a card quote was found in.
// Bounded by the card size, not the site size, so a 190K-token site does not go into every batch.
export function evidenceBlocks(card: Card, chunks: Chunk[], headChars = 2_000): string {
  const quotes = [...card.products, ...card.capabilities].map((p) => normalize(p.quote)).filter(Boolean);
  const keep = new Set<number>();
  for (const c of chunks) if (c.charStart < headChars) keep.add(c.index);
  const norm = chunks.map((c) => normalize(c.text));
  // Deliberately stricter than the guard that admitted the quote in step 5: a plain substring,
  // no fuzzy tier. It means 12 of 1,235 card quotes (a fuzzy match, or a quote straddling a
  // heading, which always starts a new chunk) contribute no block of their own. Using findQuote
  // here instead was built and run live over all 30 ($0.18): quote_not_found fell 2 -> 1, but
  // judge_rejected rose 60 -> 66 and F1 fell 86.0% -> 85.1%. The extra chunks give the judge more
  // context and a stricter reading of it - refresco gained a group, interamerican lost five - so
  // the tight bundle stays. The site head is always included, so no quote is left contextless.
  for (const q of quotes) {
    const i = norm.findIndex((t) => t.includes(q));
    if (i >= 0) keep.add(chunks[i]!.index);
  }
  return chunks.filter((c) => keep.has(c.index)).map((c) => c.text).join('\n');
}

// Sibling groups are contiguous in the shortlist; a batch never splits one.
export function batches(candidates: Candidate[], size = config.judgeBatchSize): Candidate[][] {
  const out: Candidate[][] = [];
  let cur: Candidate[] = [];
  for (let i = 0; i < candidates.length; ) {
    let j = i + 1;
    while (j < candidates.length && candidates[j]!.group === candidates[i]!.group) j++;
    const group = candidates.slice(i, j);
    if (cur.length && cur.length + group.length > size) {
      out.push(cur);
      cur = [];
    }
    cur.push(...group);
    i = j;
  }
  if (cur.length) out.push(cur);
  return out;
}

export async function judge(llm: LlmClient, card: Card, evidence: string, candidates: Candidate[], tag: string): Promise<JudgeResult> {
  const prefix = `CARD\n${JSON.stringify(card, null, 1)}\n\nEVIDENCE\n${evidence}\n\nCANDIDATES\n`;
  let usage = ZERO_USAGE;
  let costUsd = 0;
  let unknownIds = 0;
  let repeatedIds = 0;
  const verdicts: Verdict[] = [];
  const batched = batches(candidates);

  for (const batch of batched) {
    const list = batch.map((c) => ({ id: c.id, name: c.name, definition: (c.definition ?? '').slice(0, 300) }));
    const r = await llm.complete({
      model: config.MODEL_PIPELINE,
      promptVersion: config.prompts.judge,
      system: JUDGE_PROMPT,
      user: prefix + JSON.stringify(list, null, 1),
      schemaName: 'judge',
      schema: JudgeOutput,
      // Reasoning tokens count against this, so it is sized for a reason on every verdict, not
      // only the ones that apply: the worst of the 874 cached calls used 74% of its allowance.
      maxOutputTokens: 200 + batch.length * 150,
      tag,
    });
    usage = addUsage(usage, r.usage);
    costUsd += r.costUsd;

    const inBatch = new Map(batch.map((c) => [c.id, c]));
    const seen = new Set<number>();
    for (const v of r.output.verdicts) {
      const c = inBatch.get(v.id);
      // Counted apart: an id that was never in the batch is an invention, a repeat is sloppiness.
      if (!c) {
        unknownIds++;
        continue;
      }
      if (seen.has(v.id)) {
        repeatedIds++;
        continue;
      }
      seen.add(v.id);
      const flags: string[] = [];
      let { applies, quote, reason } = v;
      let quoteMatch: QuoteMatch | null = null;
      if (applies) {
        quoteMatch = findQuote(quote ?? '', evidence);
        if (quoteMatch === 'none') {
          applies = false;
          flags.push('quote_not_found');
          reason = `quote_not_found: ${quote ?? ''}`.slice(0, 300);
          quote = null;
        }
      }
      verdicts.push({ id: c.id, name: c.name, group: c.group, applies, confidence: v.confidence, quote, reason, quoteMatch, retrievalScore: c.score, matchedBy: c.matchedBy, phrases: c.phrases, flags });
    }
    for (const c of batch) {
      if (seen.has(c.id)) continue;
      verdicts.push({ id: c.id, name: c.name, group: c.group, applies: false, confidence: 0, quote: null, reason: 'missing_from_output', quoteMatch: null, retrievalScore: c.score, matchedBy: c.matchedBy, phrases: c.phrases, flags: ['missing_from_output'] });
    }
  }
  return { verdicts, batches: batched.length, unknownIds, repeatedIds, usage, costUsd };
}
