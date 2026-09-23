import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { openSource } from '../../src/db/source.js';
import { modelCached } from '../../src/index/embed.js';
import { buildIndex, loadOrBuildIndex, saveIndex, type TaxonomyIndex } from '../../src/index/taxonomy.js';

// Integration: needs the local model. Skipped when .model-cache is absent.
describe.skipIf(!modelCached())('taxonomy index (integration)', () => {
  const src = openSource('data/category_tagging.sqlite');
  const categories = src.listCategories();
  const byName = (n: string) => categories.find((c) => c.name === n)!.id;
  let index: TaxonomyIndex;

  beforeAll(async () => {
    index = await loadOrBuildIndex(categories, src.taxonomyHash(), 'artifacts/taxonomy-index');
  });

  const top = async (phrase: string, k = 5) => (await index.searchHybrid(phrase, k)).map((h) => index.category(h.id)!.name);

  it('cold brew coffee -> Refrigerated Cold Brew in top 3', async () => {
    expect((await top('cold brew coffee')).slice(0, 3)).toContain('Refrigerated Cold Brew');
  });

  it('Kaffeebohnen -> Coffee Beans in top 3 (multilingual dense side)', async () => {
    expect((await top('Kaffeebohnen')).slice(0, 3)).toContain('Coffee Beans');
  });

  it('italian sausage -> a sausage category in top 3, Italian dressing not in top 5', async () => {
    const names = await top('italian sausage');
    expect(names.slice(0, 3).some((n) => /sausage/i.test(n))).toBe(true);
    expect(names.some((n) => /dressing/i.test(n) && /italian/i.test(n))).toBe(false);
  });

  it('siblings of Refrigerated Coconut Milk are the other storage variants', () => {
    const names = index.siblings(byName('Refrigerated Coconut Milk')).map((id) => index.category(id)!.name).sort();
    expect(names).toEqual(['Coconut Milk', 'Shelf Stable Coconut Milk']);
  });

  it('rebuilds when the taxonomy hash changes and reloads when it does not', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'kct-idx-')), 'idx');
    const small = categories.slice(0, 3).map((c, i) => (i === 2 ? { ...c, definition: null } : c));
    const built = await buildIndex(small, 'hash-a');
    saveIndex(built, path);
    const reloaded = await loadOrBuildIndex(small, 'hash-a', path);
    expect(reloaded.vector(small[0]!.id)).toEqual(built.vector(small[0]!.id));
    const before = JSON.parse(readFileSync(`${path}.json`, 'utf8')).builtAt;
    await loadOrBuildIndex(small, 'hash-b', path);
    expect(JSON.parse(readFileSync(`${path}.json`, 'utf8')).taxonomyHash).toBe('hash-b');
    expect(JSON.parse(readFileSync(`${path}.json`, 'utf8')).builtAt).not.toBe(before);
    // corrupt meta model id -> rebuild
    writeFileSync(`${path}.json`, JSON.stringify({ ...JSON.parse(readFileSync(`${path}.json`, 'utf8')), modelId: 'other' }));
    await loadOrBuildIndex(small, 'hash-b', path);
    expect(JSON.parse(readFileSync(`${path}.json`, 'utf8')).modelId).not.toBe('other');
  });
});
