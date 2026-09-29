import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/server.js';
import { openSource } from '../../src/db/source.js';
import { openStore } from '../../src/db/store.js';
import { modelCached } from '../../src/index/embed.js';
import { loadOrBuildIndex, type TaxonomyIndex } from '../../src/index/taxonomy.js';
import type { Card } from '../../src/pipeline/profile.js';
import { candidateIds, fakeLlm } from '../fake-llm.js';

describe.skipIf(!modelCached())('api (fake model, integration)', () => {
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
  const judgeNo = (user: string) => ({ verdicts: candidateIds(user).map((id) => ({ id, applies: false, confidence: 0.3, quote: null, reason: 'no' })) });
  const build = (store = openStore(':memory:'), judge: (user: string) => unknown = judgeNo) => {
    const { llm } = fakeLlm({ card: () => card, judge: (_req, user) => judge(user) }, { store });
    return buildApp({ src, store, llm, index });
  };

  it('job with 2 ids (one repeated) -> 202 counting it once, completes, results retrievable', async () => {
    const { app, runner } = build();
    const res = await app.inject({ method: 'POST', url: '/v1/tagging-jobs', payload: { manufacturer_ids: [507, 902, 507] } });
    expect(res.statusCode).toBe(202);
    expect(res.json().manufacturers).toBe(2);
    await runner.idle();
    const job = (await app.inject({ method: 'GET', url: `/v1/tagging-jobs/${res.json().job_id}` })).json();
    expect(job.status).toBe('completed');
    expect(job.counts).toEqual({ total: 2, pending: 0, done: 2, failed: 0 });
    const cats = await app.inject({ method: 'GET', url: '/v1/manufacturers/507/categories' });
    expect(cats.statusCode).toBe(200);
    expect(cats.json()).toMatchObject({ manufacturer_id: 507, status: 'no_confident_category', categories: [] });
  });

  // Checked before anything is queued, so a job can never be larger than the dataset.
  it('a job naming an id that is not in the dataset is refused whole, with the id', async () => {
    const { app } = build();
    const res = await app.inject({ method: 'POST', url: '/v1/tagging-jobs', payload: { manufacturer_ids: [507, 1, 99999999] } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'unknown_manufacturer', manufacturer_ids: [1, 99999999] });
  });

  it('GET serves only the current pipeline answer: 502 for a failed last attempt, 404 for an older version', async () => {
    const store = openStore(':memory:');
    const failing = build(store, () => 'not json');
    expect((await failing.app.inject({ method: 'POST', url: '/v1/manufacturers/507/tag?wait=true' })).statusCode).toBe(502);
    const got = await failing.app.inject({ method: 'GET', url: '/v1/manufacturers/507/categories' });
    expect(got.statusCode).toBe(502);
    expect(got.json().status).toBe('error');

    // A row some other prompt or setting wrote is not today's answer.
    const old = openStore(':memory:');
    old.results.put({ result_key: 'k-old', manufacturer_id: 902, status: 'tagged', entity_type: 'manufacturer', categories: '{"accepted":[],"rejected":[]}', profile: null, evidence_stats: '{}', usage: '{}', cost_usd: 0, versions: '{"judge":"v1"}', duration_ms: 0, error: null });
    expect((await build(old).app.inject({ method: 'GET', url: '/v1/manufacturers/902/categories' })).statusCode).toBe(404);
  });

  it('refuses a request addressed to another host, or sent by a page on another site', async () => {
    const { app } = build();
    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/healthz', headers: { origin: 'http://localhost:3000' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/v1/manufacturers/507/tag', headers: { origin: 'https://evil.example' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/healthz', headers: { host: 'attacker.example' } })).statusCode).toBe(403);
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
