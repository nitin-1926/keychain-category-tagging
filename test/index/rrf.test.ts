import { describe, expect, it } from 'vitest';

import { baseName, bm25, rrf, tokenize } from '../../src/index/taxonomy.js';

describe('rrf', () => {
  it('fuses two ranked lists: agreed items first, then by best single rank, ties broken by id', () => {
    // 1 and 3 appear in both (ranks 1+3 each), 2 and 4 once (rank 2 each). Exact ties are normal
    // in RRF, so the id tie-break is what makes a fused list identical from run to run - and a
    // shortlist that reorders between runs would break the committed replay evidence.
    expect(rrf([[1, 2, 3], [3, 4, 1]], 60).map((h) => h.id)).toEqual([1, 3, 2, 4]);
  });
});

describe('bm25', () => {
  it('matches whole words only', () => {
    const docs = ['Italian Sausage: pork sausage seasoned with fennel', 'Italian Dressing: vinaigrette', 'Ranch Dip'].map(tokenize);
    const search = bm25(docs);
    expect(search(tokenize('italian sausage'), 3)[0]!.index).toBe(0);
    expect(search(tokenize('sausages'), 3)).toEqual([]); // no stemming; dense covers it
  });
});

describe('baseName', () => {
  it('strips storage and qualifier prefixes, repeatedly', () => {
    expect(baseName('Refrigerated Coconut Milk')).toBe('coconut milk');
    expect(baseName('Shelf Stable Plant Based Milk')).toBe('milk');
    expect(baseName('Coconut Milk')).toBe('coconut milk');
    expect(baseName('Frozen')).toBe('frozen'); // a bare prefix is not stripped to nothing
  });
});
