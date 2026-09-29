import { beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../src/config.js';
import { openSource } from '../../src/db/source.js';
import { openStore, type Store } from '../../src/db/store.js';
import { modelCached } from '../../src/index/embed.js';
import { loadOrBuildIndex, type TaxonomyIndex } from '../../src/index/taxonomy.js';
import { costUsd } from '../../src/llm/pricing.js';
import type { Card } from '../../src/pipeline/profile.js';
import { tag, versions } from '../../src/pipeline/tag.js';
import { candidateIds, fakeLlm } from '../fake-llm.js';

// The result key decides whether a change re-tags or serves an old answer. It used to be a
// hand-kept list that missed the batch size, window size and the prompt text itself.
describe('versions (the result key inputs)', () => {
  it('changes with any setting that can change an answer, and with the prompt text', () => {
    const before = versions('h');
    for (const [k, changed] of [['judgeBatchSize', 20], ['windowChars', 20_000], ['minCleanedChars', 1], ['CUTOFF', 0.7]] as const) {
      const was = config[k];
      (config as Record<string, unknown>)[k] = changed;
      expect(versions('h'), k).not.toEqual(before);
      (config as Record<string, unknown>)[k] = was;
    }
    expect(before.promptText).toMatch(/^[0-9a-f]{16}$/);
    expect(versions('h')).toEqual(before);
  });

  it('leaves out what only changes how a run happens: the key, the mode, paths, concurrency', () => {
    const v = versions('h');
    for (const k of ['OPENAI_API_KEY', 'LLM_MODE', 'SOURCE_DB', 'ARTIFACTS_DIR', 'llmConcurrency']) expect(v, k).not.toHaveProperty(k);
  });
});

// End to end with a fake model on a real site (assemblers.com, 4,451 cleaned chars, one window).
describe.skipIf(!modelCached())('tag (fake model, integration)', () => {
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
  const proteinBar = () => src.listCategories().find((c) => c.name === 'Protein Bar')!.id;
  const judgeOk = (user: string) => ({
    verdicts: candidateIds(user).map((id) => ({ id, applies: id === proteinBar(), confidence: id === proteinBar() ? 0.9 : 0.2, quote: id === proteinBar() ? 'Protein Bars' : null, reason: 'r' })),
  });
  // `results` is where answers are stored; the model's own cache lives in the fake's store, so a
  // test can give a second run an empty model cache while keeping the stored answers.
  const setup = (judge: (user: string) => unknown = judgeOk, results: Store = openStore(':memory:'), usage?: { input: number; cached: number; output: number; reasoning: number }) => {
    const fake = fakeLlm({ card: () => card, judge: (_req, user) => judge(user) }, { usage });
    return { deps: { src, store: results, llm: fake.llm, index }, calls: fake.calls };
  };

  it('tags end to end, stores the row, and serves it from the store on the second run', async () => {
    const { deps, calls } = setup();
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

    // Forced: the pipeline runs again, but every model call is already in the cache - as in production.
    const c = await tag(deps, 507, { force: true });
    expect(c.cached).toBe(false);
    expect(c.accepted).toEqual(a.accepted);
    expect(calls()).toBe(n);
  });

  it('judge failure -> status error, stored with both billed attempts, and retried next time', async () => {
    const usage = { input: 1_000, cached: 0, output: 100, reasoning: 0 };
    const { deps, calls } = setup(() => '{"verdicts":', openStore(':memory:'), usage);
    const r = await tag(deps, 507);
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/LlmOutputError/);
    expect(r.error).toContain('verdicts'); // the raw output travels with the error, per ARCHITECTURE section 9
    expect(r.accepted).toEqual([]);
    // One profile call plus two judge attempts, all billed; the old accounting stored this at the profile cost only.
    expect(r.costUsd).toBeCloseTo(3 * costUsd('gpt-6-luna', usage), 12);
    expect(r.usage.judge.input).toBe(2_000);
    expect(deps.store.results.get(r.key)?.status).toBe('error');

    // A stored error is a failed attempt, not an answer: the next call must try again.
    const n = calls();
    const again = await tag(deps, 507);
    expect(again.cached).toBe(false);
    expect(calls()).toBeGreaterThan(n);
  });

  it('a forced re-run that fails does not overwrite the stored answer, which stays the current one', async () => {
    const results = openStore(':memory:');
    const good = await tag(setup(judgeOk, results).deps, 507);
    expect(good.status).toBe('tagged');
    // A fresh model cache, so the forced run really calls the model, and the model fails.
    const failed = await tag(setup(() => 'not json', results).deps, 507, { force: true });
    expect(failed.status).toBe('error');
    expect(failed.key).not.toBe(good.key);
    expect(results.results.get(good.key)?.status).toBe('tagged');
    expect(results.results.current(507, JSON.stringify(versions(index.taxonomyHash)))?.status).toBe('tagged');
  });

  it('unknown manufacturer throws', async () => {
    const { deps } = setup();
    await expect(tag(deps, 1)).rejects.toThrow(/unknown manufacturer/);
  });
});
