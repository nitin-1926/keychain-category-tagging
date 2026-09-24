import { beforeAll, describe, expect, it } from 'vitest';
import { openSource } from '../../src/db/source.js';
import { modelCached } from '../../src/index/embed.js';
import { baseName, loadOrBuildIndex, type Hit, type TaxonomyIndex } from '../../src/index/taxonomy.js';
import type { Card } from '../../src/pipeline/profile.js';
import { shortlist } from '../../src/pipeline/shortlist.js';

const card = (names: string[], caps: string[] = []): Card => ({
  entity_type: 'manufacturer',
  products: names.map((name) => ({ name, quote: `we make ${name}`, storage: null })),
  capabilities: caps.map((name) => ({ name, quote: `we offer ${name}` })),
  brands: [],
  site_language: 'en',
  summary: '',
});

// The union, sibling expansion and cap are pure list logic: a fake index pins them without the
// 118 MB embedding model, which a fresh clone does not have.
describe('shortlist (fake index)', () => {
  const cats = [
    { id: 1, name: 'Cold Brew', definition: null },
    { id: 2, name: 'Refrigerated Cold Brew', definition: null },
    { id: 3, name: 'Kombucha', definition: null },
    { id: 4, name: 'Pizza', definition: null },
  ];
  const hits: Record<string, Hit[]> = {
    'cold brew coffee': [{ id: 2, score: 0.03, dense: 0.9 }],
    kombucha: [{ id: 3, score: 0.02, bm25: 4 }],
    pizza: [{ id: 4, score: 0.01, dense: 0.5 }],
    'pizza bases': [{ id: 4, score: 0.02, bm25: 3 }],
  };
  const byId = (id: number) => cats.find((c) => c.id === id)!;
  const index = {
    category: byId,
    siblings: (id: number) => cats.filter((c) => c.id !== id && baseName(c.name) === baseName(byId(id).name)).map((c) => c.id),
    searchHybrid: async (phrase: string) => hits[phrase] ?? [],
  } as unknown as TaxonomyIndex;

  it('pulls the whole sibling group in, at the anchor score, marked sibling', async () => {
    const out = await shortlist(card(['cold brew coffee']), index);
    // The sibling inherits the anchor's score, so the group orders by id: deterministic either way.
    expect(out.map((c) => c.name)).toEqual(['Cold Brew', 'Refrigerated Cold Brew']);
    expect(out.map((c) => c.group)).toEqual(['cold brew', 'cold brew']);
    const bare = out.find((c) => c.name === 'Cold Brew')!;
    expect(bare).toMatchObject({ matchedBy: 'sibling', score: 0.03, phrases: ['cold brew coffee'] });
  });

  it('two phrases retrieving one category merge their provenance', async () => {
    const [only] = await shortlist(card(['pizza', 'pizza bases']), index);
    expect(only).toMatchObject({ id: 4, matchedBy: 'both', score: 0.02, phrases: ['pizza', 'pizza bases'] });
  });

  it('the cap never splits a group: an over-large group is skipped, a later one still fits', async () => {
    const out = await shortlist(card(['cold brew coffee', 'kombucha']), index, { cap: 1 });
    expect(out.map((c) => c.name)).toEqual(['Kombucha']);
  });

  it('empty card -> empty shortlist', async () => {
    expect(await shortlist(card([]), index)).toEqual([]);
  });
});

describe.skipIf(!modelCached())('shortlist (integration)', () => {
  const src = openSource('data/category_tagging.sqlite');
  let index: TaxonomyIndex;
  beforeAll(async () => {
    index = await loadOrBuildIndex(src.listCategories(), src.taxonomyHash(), 'artifacts/taxonomy-index');
  });

  it('cold brew coffee + kombucha -> both categories present with provenance', async () => {
    const out = await shortlist(card(['cold brew coffee', 'kombucha']), index);
    const cb = out.find((c) => c.name === 'Refrigerated Cold Brew')!;
    const k = out.find((c) => c.name === 'Kombucha')!;
    expect(cb.phrases).toEqual(['cold brew coffee']);
    expect(['dense', 'bm25', 'both']).toContain(cb.matchedBy);
    expect(k.phrases).toEqual(['kombucha']);
  });

  it('a phrase equal to a category name is matched lexically', async () => {
    const out = await shortlist(card(['Coffee Beans']), index);
    expect(out.find((c) => c.name === 'Coffee Beans')!.matchedBy).toMatch(/bm25|both/);
  });

  it('a retrieved storage variant pulls its siblings', async () => {
    const out = await shortlist(card(['refrigerated coconut milk']), index);
    const names = out.filter((c) => c.group === 'coconut milk').map((c) => c.name).sort();
    expect(names).toEqual(['Coconut Milk', 'Refrigerated Coconut Milk', 'Shelf Stable Coconut Milk']);
    // retrieval may already return all three; the 40-phrase test below checks that every group is complete
  });

  it('40 phrases -> capped near 120 with sibling groups intact', async () => {
    const names = src.listCategories().filter((_, i) => i % 35 === 0).slice(0, 40).map((c) => c.name.toLowerCase());
    const out = await shortlist(card(names), index);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.length).toBeGreaterThan(90);
    const groups = new Set(out.map((c) => c.group));
    for (const g of groups) {
      const inList = out.filter((c) => c.group === g).map((c) => c.id).sort();
      const full = [...new Set(inList.flatMap((id) => [id, ...index.siblings(id)]))].sort();
      expect(inList, g).toEqual(full);
    }
  });

  it('empty card -> empty shortlist', async () => {
    expect(await shortlist(card([]), index)).toEqual([]);
  });
});
