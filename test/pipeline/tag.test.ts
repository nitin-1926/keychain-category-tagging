import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { openSource } from '../../src/db/source.js';
import { openStore } from '../../src/db/store.js';
import { modelCached } from '../../src/index/embed.js';
import { loadOrBuildIndex, type TaxonomyIndex } from '../../src/index/taxonomy.js';
import { createClient, LlmOutputError } from '../../src/llm/client.js';
import type { JudgeOutput } from '../../src/pipeline/judge.js';
import type { Card } from '../../src/pipeline/profile.js';
import { tag } from '../../src/pipeline/tag.js';

// End to end with a stub model on a real site (assemblers.com, 4,451 cleaned chars, one window).
describe.skipIf(!modelCached())('tag (stub, integration)', () => {
  const src = openSource('data/category_tagging.sqlite');
  let index: TaxonomyIndex;
  beforeAll(async () => {
    index = await loadOrBuildIndex(src.listCategories(), src.taxonomyHash(), 'artifacts/taxonomy-index');
  });

  const card: Card = {
    entity_type: 'both',
    products: [{ name: 'Protein bars', quote: 'Snack Bars, Protein Bars and Bites', storage: null }],
    capabilities: [{ name: 'Co-packing', quote: 'Food co-packing' }],
    brands: [],
    site_language: 'en',
    summary: 'co-packer',
  };
  const stubbed = (judgeFn?: (ids: number[]) => z.infer<typeof JudgeOutput>) => {
    const store = openStore(':memory:');
    const llm = createClient({ mode: 'stub', store });
    let calls = 0;
    llm.stub.on<Card>('card', () => (calls++, card));
    llm.stub.on<z.infer<typeof JudgeOutput>>('judge', (req) => {
      calls++;
      const ids = (JSON.parse(req.user.split('CANDIDATES\n')[1]!) as { id: number }[]).map((c) => c.id);
      if (judgeFn) return judgeFn(ids);
      const proteinBar = src.listCategories().find((c) => c.name === 'Protein Bar')!.id;
      return { verdicts: ids.map((id) => ({ id, applies: id === proteinBar, confidence: id === proteinBar ? 0.9 : 0.2, quote: id === proteinBar ? 'Protein Bars' : null, reason: 'r' })) };
    });
    return { deps: { src, store, llm, index }, calls: () => calls };
  };

  it('tags end to end, stores the row, and serves it from the store on the second run', async () => {
    const { deps, calls } = stubbed();
    const a = await tag(deps, 507);
    expect(a.status).toBe('tagged');
    expect(a.accepted.map((d) => d.name)).toEqual(['Protein Bar']);
    expect(a.evidence.shortlist).toBeGreaterThan(0);
    expect(a.cached).toBe(false);
    const n = calls();
    expect(n).toBeGreaterThanOrEqual(2);

    const b = await tag(deps, 507);
    expect(b.cached).toBe(true);
    expect(b.accepted).toEqual(a.accepted);
    expect(calls()).toBe(n);

    const c = await tag(deps, 507, { force: true });
    expect(c.cached).toBe(false);
    expect(calls()).toBe(2 * n);
  });

  it('judge failure -> status error, no categories, row stored, and retried next time', async () => {
    const { deps, calls } = stubbed(() => {
      throw new LlmOutputError('judge: output failed schema twice', ['{"verdicts":']);
    });
    const r = await tag(deps, 507);
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/LlmOutputError/);
    expect(r.error).toContain('verdicts'); // the raw output travels with the error, per ARCHITECTURE section 9
    expect(r.accepted).toEqual([]);
    expect(r.costUsd).toBe(0); // the stub is free, but the profile call is charged before the judge runs
    expect(deps.store.results.latest(507)?.status).toBe('error');

    // A stored error is a failed attempt, not an answer: the next call must try again.
    const n = calls();
    const again = await tag(deps, 507);
    expect(again.cached).toBe(false);
    expect(calls()).toBeGreaterThan(n);
  });

  it('unknown manufacturer throws', async () => {
    const { deps } = stubbed();
    await expect(tag(deps, 1)).rejects.toThrow(/unknown manufacturer/);
  });
});
