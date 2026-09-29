// Eval, pure part: one manufacturer's result against the reference set, per sibling group, with a
// cause for every miss. Nothing here runs in the request path.
// Called by: eval/report.ts, once per manufacturer. Calls: index/embed.ts (only to answer "was this
// category on the card at all?") and index/taxonomy.ts baseName() for grouping.

import { dot, embedQueries } from '../index/embed.js';
import { baseName, tokenize } from '../index/taxonomy.js';
import type { Decision } from '../pipeline/policy.js';
import type { Card } from '../pipeline/profile.js';
import { phrasesOf } from '../pipeline/shortlist.js';

type Cause = 'not_on_card' | 'not_in_shortlist' | 'judge_rejected' | 'below_cutoff' | 'policy_moved' | 'entity_gate' | 'quote_not_found' | 'pipeline_only';

export type Group = { key: string; names: string[] };
export type Mismatch = { key: string; names: string[]; cause: Cause };

export type Metrics = { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number };

export function metrics(tp: number, fp: number, fn: number): Metrics {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, precision, recall, f1 };
}

export function pipelineGroups(accepted: Decision[]): Map<string, Group> {
  return new Map([...Map.groupBy(accepted, (d) => d.group)].map(([key, ds]) => [key, { key, names: ds.map((d) => d.name) }]));
}

// Category name vs card phrase cosine above which the product counts as "on the card".
const ON_CARD_FLOOR = 0.85;

// Was this category on the card at all? Exact token overlap with a card phrase, or a close embedding.
async function onCard(names: string[], card: Card): Promise<boolean> {
  const phrases = phrasesOf(card).map((p) => p.name);
  if (!phrases.length) return false;
  const tokens = (s: string) => new Set(tokenize(s).filter((t) => t.length > 2));
  for (const n of names) {
    const nt = tokens(baseName(n));
    if ([...nt].length && phrases.some((p) => [...nt].every((t) => tokens(p).has(t)))) return true;
  }
  const [vn, vp] = await Promise.all([embedQueries(names), embedQueries(phrases)]);
  return vn.some((a) => vp.some((b) => dot(a, b) >= ON_CARD_FLOOR));
}

// Which stage lost a group the reference says applies. The Record is checked by the compiler against
// the reasons pipeline/policy.ts can write, so a new policy rule does not type-check until its
// rejections have a cause here - otherwise its misses would silently be blamed on the judge.
// When a group's decisions carry several causes, the earliest in PRECEDENCE is the one reported.
const CAUSE: Record<NonNullable<Decision['rejectReason']>, Cause> = {
  below_cutoff: 'below_cutoff',
  entity_gate: 'entity_gate',
  storage_moved: 'policy_moved',
  storage_sibling_weaker: 'policy_moved',
  judge_rejected: 'judge_rejected',
};
const PRECEDENCE: Cause[] = ['below_cutoff', 'entity_gate', 'policy_moved', 'quote_not_found', 'judge_rejected'];

function causeOf(ds: Decision[]): Cause {
  const causes = new Set(ds.flatMap((d) => [CAUSE[d.rejectReason ?? 'judge_rejected'], ...(d.flags.includes('quote_not_found') ? ['quote_not_found' as const] : [])]));
  return PRECEDENCE.find((c) => causes.has(c))!;
}

export async function diff(pipeline: Map<string, Group>, reference: Map<string, Group>, result: { accepted: Decision[]; rejected: Decision[]; card: Card }): Promise<Mismatch[]> {
  const out: Mismatch[] = [];
  const judged = Map.groupBy([...result.accepted, ...result.rejected], (d) => d.group);

  for (const [key, g] of reference) {
    if (pipeline.has(key)) continue;
    const ds = judged.get(key);
    const cause = ds ? causeOf(ds) : (await onCard(g.names, result.card)) ? 'not_in_shortlist' : 'not_on_card';
    out.push({ key, names: g.names, cause });
  }
  for (const [key, g] of pipeline) {
    if (reference.has(key)) continue;
    out.push({ key, names: g.names, cause: 'pipeline_only' });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

// Derived from the same mismatches the cause table is built from, so the headline numbers and the
// explanation of them can never disagree: every mismatch is either a wrong tag or a missed one.
export function score(pipeline: Map<string, Group>, mismatches: Mismatch[]): Metrics {
  const fp = mismatches.filter((m) => m.cause === 'pipeline_only').length;
  return metrics(pipeline.size - fp, fp, mismatches.length - fp);
}
