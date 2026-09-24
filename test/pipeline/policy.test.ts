import { describe, expect, it } from 'vitest';
import type { Verdict } from '../../src/pipeline/judge.js';
import { applyPolicy, storageOf } from '../../src/pipeline/policy.js';
import type { Card } from '../../src/pipeline/profile.js';

const v = (id: number, name: string, group: string, applies: boolean, confidence: number, over: Partial<Verdict> = {}): Verdict => ({
  id, name, group, applies, confidence, quote: applies ? `we make ${group}` : null, reason: 'r',
  quoteMatch: applies ? 'exact' : null, retrievalScore: 0.03, matchedBy: 'both', phrases: ['coconut milk'], flags: [], ...over,
});
const card = (entity_type: Card['entity_type'] = 'manufacturer', storage: Card['products'][0]['storage'] = null): Card => ({
  entity_type, products: [{ name: 'coconut milk', quote: 'q', storage }], capabilities: [], brands: [], site_language: 'en', summary: '',
});
const opts = { cutoff: 0.6, nonManufacturerPolicy: 'empty' as const };

describe('policy', () => {
  it('storageOf reads the three storage prefixes only', () => {
    expect(storageOf('Refrigerated Coconut Milk')).toBe('refrigerated');
    expect(storageOf('Shelf Stable Bouillon')).toBe('shelf_stable');
    expect(storageOf('Diet Ginger Beer')).toBeNull();
  });

  it('unevidenced storage variant moves to the bare sibling', () => {
    const r = applyPolicy([v(1, 'Refrigerated Coconut Milk', 'coconut milk', true, 0.8), v(2, 'Coconut Milk', 'coconut milk', false, 0.3)], card(), opts);
    expect(r.accepted.map((d) => [d.id, d.confidence, d.movedFrom])).toEqual([[2, 0.8, 1]]);
    expect(r.rejected.find((d) => d.id === 1)!.rejectReason).toBe('storage_moved');
    expect(r.status).toBe('tagged');
  });

  it('storage evidenced by the card product keeps the qualified category', () => {
    const r = applyPolicy([v(1, 'Refrigerated Coconut Milk', 'coconut milk', true, 0.8), v(2, 'Coconut Milk', 'coconut milk', false, 0.3)], card('manufacturer', 'refrigerated'), opts);
    expect(r.accepted.map((d) => d.id)).toEqual([1]);
  });

  it('storage evidenced by the judge quote keeps the qualified category', () => {
    const r = applyPolicy([v(1, 'Frozen Dumpling', 'dumpling', true, 0.8, { quote: 'our frozen dumplings', phrases: ['dumplings'] })], card(), opts);
    expect(r.accepted.map((d) => d.id)).toEqual([1]);
    expect(r.accepted[0]!.storageInferred).toBeUndefined();
  });

  it('only qualified siblings exist -> strongest kept at its confidence with storage_inferred', () => {
    const r = applyPolicy(
      [v(1, 'Frozen Dumpling', 'dumpling', true, 0.7, { phrases: ['dumplings'] }), v(2, 'Shelf Stable Dumpling', 'dumpling', true, 0.5, { phrases: ['dumplings'] })],
      card(),
      opts,
    );
    expect(r.accepted.map((d) => [d.id, d.confidence, d.storageInferred])).toEqual([[1, 0.7, true]]);
    expect(r.rejected.find((d) => d.id === 2)!.rejectReason).toBe('storage_sibling_weaker');
  });

  it('marketplace with the default flag -> empty, not_a_manufacturer; flag tag -> normal', () => {
    const vs = [v(1, 'Coconut Milk', 'coconut milk', true, 0.9)];
    const a = applyPolicy(vs, card('marketplace'), opts);
    expect(a).toMatchObject({ status: 'not_a_manufacturer', accepted: [] });
    expect(a.rejected[0]!.rejectReason).toBe('entity_gate');
    const b = applyPolicy(vs, card('marketplace'), { ...opts, nonManufacturerPolicy: 'tag' });
    expect(b.status).toBe('tagged');
    expect(b.accepted).toHaveLength(1);
  });

  it('all below cutoff -> no_confident_category, stored as rejected', () => {
    const r = applyPolicy([v(1, 'Coconut Milk', 'coconut milk', true, 0.5), v(2, 'Kombucha', 'kombucha', false, 0.9)], card(), opts);
    expect(r.status).toBe('no_confident_category');
    expect(r.rejected.map((d) => [d.id, d.rejectReason])).toEqual(expect.arrayContaining([[1, 'below_cutoff'], [2, 'judge_rejected']]));
  });
});
