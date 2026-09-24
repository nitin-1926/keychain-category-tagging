// Eval, pure part: pipeline result vs the reference set, per sibling group, with a cause for every miss.

import { config } from '../config.js';
import { dot, embed } from '../index/embed.js';
import { baseName } from '../index/taxonomy.js';
import type { Decision } from '../pipeline/policy.js';
import type { Card } from '../pipeline/profile.js';
import { normalize } from '../text/normalize.js';

export type Cause = 'not_on_card' | 'not_in_shortlist' | 'judge_rejected' | 'below_cutoff' | 'policy_moved' | 'entity_gate' | 'quote_not_found' | 'pipeline_only';

export type Group = { key: string; ids: number[]; names: string[] };
export type Mismatch = { key: string; names: string[]; cause: Cause };

export type Metrics = { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number };

export function metrics(tp: number, fp: number, fn: number): Metrics {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, precision, recall, f1 };
}

export function pipelineGroups(accepted: Decision[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const d of accepted) {
    const g = groups.get(d.group) ?? { key: d.group, ids: [], names: [] };
    g.ids.push(d.id);
    g.names.push(d.name);
    groups.set(d.group, g);
  }
  return groups;
}

// Was this category on the card at all? Exact token overlap with a card phrase, or a close embedding.
export async function onCard(names: string[], card: Card, floor = config.onCardFloor): Promise<boolean> {
  const phrases = [...card.products, ...card.capabilities].map((p) => p.name);
  if (!phrases.length) return false;
  const tokens = (s: string) => new Set(normalize(s).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2));
  for (const n of names) {
    const nt = tokens(baseName(n));
    if ([...nt].length && phrases.some((p) => [...nt].every((t) => tokens(p).has(t)))) return true;
  }
  const [vn, vp] = await Promise.all([embed(names.map((n) => `query: ${n}`)), embed(phrases.map((p) => `query: ${p}`))]);
  return vn.some((a) => vp.some((b) => dot(a, b) >= floor));
}

// Which stage lost a group the reference says applies. Every reject reason the policy can write
// has an arm here; without one, a gated or storage-dropped group would be blamed on the judge.
function causeOf(ds: Decision[]): Cause {
  const reasons = new Set(ds.map((d) => d.rejectReason));
  if (reasons.has('below_cutoff')) return 'below_cutoff';
  if (reasons.has('entity_gate')) return 'entity_gate';
  if (reasons.has('storage_moved') || reasons.has('storage_sibling_weaker')) return 'policy_moved';
  if (ds.some((d) => d.flags.includes('quote_not_found'))) return 'quote_not_found';
  return 'judge_rejected';
}

export async function diff(pipeline: Map<string, Group>, reference: Map<string, Group>, result: { accepted: Decision[]; rejected: Decision[]; card: Card }): Promise<Mismatch[]> {
  const out: Mismatch[] = [];
  const judged = new Map<string, Decision[]>();
  for (const d of [...result.accepted, ...result.rejected]) judged.set(d.group, [...(judged.get(d.group) ?? []), d]);

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
