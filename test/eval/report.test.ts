import { describe, expect, it } from 'vitest';
import { diff, metrics, pipelineGroups, score, type Group, type Mismatch } from '../../src/eval/compare.js';
import { calibration, type Compared } from '../../src/eval/report.js';
import { modelCached } from '../../src/index/embed.js';
import type { Decision } from '../../src/pipeline/policy.js';
import type { Card } from '../../src/pipeline/profile.js';
import { ZERO_USAGE } from '../../src/llm/pricing.js';

const names: Record<number, string> = { 1: 'Coconut Milk', 4: 'Kombucha', 5: 'Frozen Dumpling', 6: 'Cold Brew' };
const ref = (ids: number[]): Map<string, Group> => new Map(ids.map((id) => { const key = names[id]!.toLowerCase().replace(/^frozen /, ''); return [key, { key, names: [names[id]!] }]; }));
const card = (products: string[], storage: Card['products'][0]['storage'] = null): Card => ({
  entity_type: 'manufacturer', products: products.map((name) => ({ name, quote: name, storage })), capabilities: [], brands: [], site_language: 'en', summary: '',
});
const dec = (id: number, name: string, group: string, over: Partial<Decision> = {}): Decision => ({
  id, name, group, applies: true, confidence: 0.9, quote: 'q', reason: 'r', quoteMatch: 'exact', retrievalScore: 0.03, matchedBy: 'both', phrases: [], flags: [], ...over,
});
const mismatch = (key: string, cause: Mismatch['cause']): Mismatch => ({ key, names: [key], cause });

describe('metrics', () => {
  it('known P / R / F1 and the zero / zero case', () => {
    expect(metrics(2, 1, 2)).toMatchObject({ precision: 2 / 3, recall: 0.5 });
    expect(metrics(0, 0, 0)).toMatchObject({ precision: 1, recall: 1, f1: 1 });
  });
});

describe('score', () => {
  it('counts a returned group as a hit only when the reference has it', () => {
    const pipe = pipelineGroups([dec(4, 'Kombucha', 'kombucha'), dec(6, 'Cold Brew', 'cold brew'), dec(1, 'Coconut Milk', 'coconut milk')]);
    // one wrong tag, two missed: 3 returned - 1 wrong = 2 hits.
    const ms = [mismatch('cold brew', 'pipeline_only'), mismatch('dumpling', 'not_on_card'), mismatch('cola', 'judge_rejected')];
    expect(score(pipe, ms)).toMatchObject({ tp: 2, fp: 1, fn: 2 });
  });

  it('a group the reference does not list and the pipeline did not return counts as nothing', () => {
    // The regression this pins: a group neither side claims used to be counted as a true positive,
    // which inflated F1 from 86.0% to 92.5%. It produces no mismatch, so it must move no number.
    const pipe = pipelineGroups([dec(4, 'Kombucha', 'kombucha')]);
    expect(score(pipe, [])).toMatchObject({ tp: 1, fp: 0, fn: 0, precision: 1, recall: 1 });
  });
});

describe.skipIf(!modelCached())('diff causes', () => {
  it('classifies every mismatch type', async () => {
    const c = card(['kombucha', 'coconut milk']);
    const accepted = [dec(6, 'Cold Brew', 'cold brew')];
    const rejected = [dec(4, 'Kombucha', 'kombucha', { confidence: 0.4, rejectReason: 'below_cutoff' }), dec(2, 'Refrigerated Coconut Milk', 'coconut milk', { applies: false, rejectReason: 'judge_rejected', confidence: 0.2 })];
    const truth = ref([4, 1, 5]);
    const pipe = pipelineGroups(accepted);
    const ms = await diff(pipe, truth, { accepted, rejected, card: c });
    expect(Object.fromEntries(ms.map((m) => [m.key, m.cause]))).toEqual({
      'cold brew': 'pipeline_only',
      'coconut milk': 'judge_rejected',
      dumpling: 'not_on_card',
      kombucha: 'below_cutoff',
    });
    expect(score(pipe, ms)).toMatchObject({ tp: 0, fp: 1, fn: 3 });
  });

  it('blames the stage that actually dropped the group, not the judge', async () => {
    const c = card(['kombucha']);
    const rejected = [
      dec(4, 'Kombucha', 'kombucha', { applies: false, rejectReason: 'entity_gate' }),
      dec(1, 'Coconut Milk', 'coconut milk', { applies: false, rejectReason: 'storage_sibling_weaker' }),
    ];
    const ms = await diff(new Map(), ref([4, 1]), { accepted: [], rejected, card: c });
    expect(Object.fromEntries(ms.map((m) => [m.key, m.cause]))).toEqual({ kombucha: 'entity_gate', 'coconut milk': 'policy_moved' });
  });

  it('a manufacturer with no mismatches scores 1', async () => {
    const c = card(['kombucha']);
    const accepted = [dec(4, 'Kombucha', 'kombucha')];
    const truth = ref([4]);
    const pipe = pipelineGroups(accepted);
    const ms = await diff(pipe, truth, { accepted, rejected: [], card: c });
    expect(ms).toEqual([]);
    expect(score(pipe, ms).f1).toBe(1);
  });
});

describe('calibration', () => {
  it('bins sum to the number of distinct applies verdicts and picks the best-F1 cutoff', () => {
    const row = (accepted: Decision[], rejected: Decision[], mismatches: Compared['mismatches']): Compared => ({
      id: 1, domain: 'x', mismatches, scores: metrics(2, 1, 0), // two reference groups, so the cutoff table has a real denominator
      result: { manufacturerId: 1, key: 'k', status: 'tagged', entityType: 'manufacturer', accepted, rejected, card: card([]), evidence: {} as never, usage: { profile: ZERO_USAGE, judge: ZERO_USAGE, total: ZERO_USAGE }, costUsd: 0, versions: {}, durationMs: 0, cached: true, error: null },
    });
    const rows = [
      row(
        [dec(4, 'Kombucha', 'kombucha', { confidence: 0.95 }), dec(6, 'Cold Brew', 'cold brew', { confidence: 0.65 })],
        [dec(1, 'Coconut Milk', 'coconut milk', { confidence: 0.55, rejectReason: 'below_cutoff' })],
        [mismatch('cold brew', 'pipeline_only'), mismatch('coconut milk', 'below_cutoff')],
      ),
    ];
    const cal = calibration(rows);
    expect(cal.verdicts).toBe(3);
    expect(cal.bins.reduce((n, b) => n + b.n, 0)).toBe(3);
    expect(cal.referenceGroups).toBe(2);
    // 0.95 correct, 0.65 wrong, 0.55 correct (reference has it): cutoff 0.5 -> P 2/3 R 1; 0.9 -> P 1 R 1/2; 0.5 wins on F1
    expect(cal.chosenCutoff).toBe(0.5);
    // The cutoff table is scored against the reference groups, so its recall cannot exceed the real one.
    expect(cal.cutoffs.every((c) => c.recall <= 1)).toBe(true);
  });
});
