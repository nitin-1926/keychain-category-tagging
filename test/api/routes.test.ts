import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { buildApp } from '../../src/api/server.js';
import { openSource } from '../../src/db/source.js';
import { openStore } from '../../src/db/store.js';
import { modelCached } from '../../src/index/embed.js';
import { loadOrBuildIndex, type TaxonomyIndex } from '../../src/index/taxonomy.js';
import { createClient } from '../../src/llm/client.js';
import type { JudgeOutput } from '../../src/pipeline/judge.js';
import type { Card } from '../../src/pipeline/profile.js';

describe.skipIf(!modelCached())('api (stub, integration)', () => {
  const src = openSource('data/category_tagging.sqlite');
  let index: TaxonomyIndex;
  beforeAll(async () => {
    index = await loadOrBuildIndex(src.listCategories(), src.taxonomyHash(), 'artifacts/taxonomy-index');
  });

  const card: Card = {
    entity_type: 'both',
    products: [{ name: 'Protein bars', quote: 'Snack Bars, Protein Bars and Bites', storage: null }],
    capabilities: [],
    brands: [],
    site_language: 'en',
    summary: 'co-packer',
  };
  const build = (store = openStore(':memory:')) => {
    const llm = createClient({ mode: 'stub', store });
    llm.stub.on<Card>('card', () => card);
    llm.stub.on<z.infer<typeof JudgeOutput>>('judge', (req) => {
      const ids = (JSON.parse(req.user.split('CANDIDATES\n')[1]!) as { id: number }[]).map((c) => c.id);
      return { verdicts: ids.map((id) => ({ id, applies: false, confidence: 0.3, quote: null, reason: 'no' })) };
    });
    return buildApp({ src, store, llm, index });
  };

  it('job with 2 ids -> 202, completes, results retrievable; unknown id inside a job fails that item only', async () => {
    const { app, runner } = build();
    const res = await app.inject({ method: 'POST', url: '/v1/tagging-jobs', payload: { manufacturer_ids: [507, 1] } });
    expect(res.statusCode).toBe(202);
    const { job_id } = res.json();
    await runner.idle();
    const job = (await app.inject({ method: 'GET', url: `/v1/tagging-jobs/${job_id}` })).json();
    expect(job.status).toBe('completed');
    expect(job.counts).toEqual({ total: 2, pending: 0, done: 1, failed: 1 });
    expect(job.manufacturers['1'].error).toMatch(/unknown manufacturer/);
    const cats = await app.inject({ method: 'GET', url: '/v1/manufacturers/507/categories' });
    expect(cats.statusCode).toBe(200);
    expect(cats.json()).toMatchObject({ manufacturer_id: 507, status: 'no_confident_category', categories: [] });
  });

  it('404 for a never-tagged id and an unknown job; 400 for a malformed body', async () => {
    const { app } = build();
    expect((await app.inject({ method: 'GET', url: '/v1/manufacturers/902/categories' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/v1/tagging-jobs/nope' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/v1/tagging-jobs', payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/tagging-jobs', payload: { manufacturer_ids: 'x' } })).statusCode).toBe(400);
  });

  it('?wait=true returns the full result synchronously; without wait a job of one', async () => {
    const { app, runner } = build();
    const sync = await app.inject({ method: 'POST', url: '/v1/manufacturers/507/tag?wait=true' });
    expect(sync.statusCode).toBe(200);
    expect(sync.json()).toMatchObject({ manufacturer_id: 507, cached: false });
    const async = await app.inject({ method: 'POST', url: '/v1/manufacturers/507/tag' });
    expect(async.statusCode).toBe(202);
    await runner.idle();
    expect(runner.get(async.json().job_id)!.status).toBe('completed');
    expect((await app.inject({ method: 'POST', url: '/v1/manufacturers/1/tag?wait=true' })).statusCode).toBe(404);
  });

  it('a pending job row is resumed when the app restarts', async () => {
    const store = openStore(':memory:');
    store.jobs.put({ id: '11111111-1111-4111-8111-111111111111', status: 'queued', force: 0, items: JSON.stringify({ '507': { status: 'pending' } }), created_at: 'a', updated_at: 'a' });
    const { runner } = build(store);
    await runner.idle();
    expect(runner.get('11111111-1111-4111-8111-111111111111')!.status).toBe('completed');
  });
});
