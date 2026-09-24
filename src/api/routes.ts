import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fromRow, tag, type Deps } from '../pipeline/tag.js';
import type { Runner } from './jobs.js';
import { toApi } from './serialize.js';

const JobBody = z
  .object({ manufacturer_ids: z.array(z.number().int()).min(1).optional(), all: z.boolean().optional(), force: z.boolean().optional() })
  .refine((b) => b.all || b.manufacturer_ids, { message: 'manufacturer_ids or all is required' });
// Digits only: z.coerce would also accept " 507 ", 1e3 and 0x2 as ids and quietly query for them.
const IdParam = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });
const JobParam = z.object({ id: z.string().uuid() });
const Flags = z.object({ wait: z.stringbool().default(false), force: z.stringbool().default(false) });

export function registerRoutes(app: FastifyInstance, deps: Deps, runner: Runner) {
  app.post('/v1/tagging-jobs', async (req, reply) => {
    const body = JobBody.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'bad_request', details: body.error.issues });
    const ids = body.data.all ? deps.src.listManufacturerIds() : body.data.manufacturer_ids!;
    const job_id = runner.enqueue(ids, body.data.force ?? false);
    return reply.code(202).send({ job_id, manufacturers: ids.length });
  });

  app.get('/v1/tagging-jobs/:id', async (req, reply) => {
    const p = JobParam.safeParse(req.params);
    const job = p.success ? runner.get(p.data.id) : undefined;
    if (!job) return reply.code(404).send({ error: 'job_not_found' });
    const items = Object.values(job.items);
    const counts = { total: items.length, pending: 0, done: 0, failed: 0 };
    for (const it of items) counts[it.status]++;
    const cost_usd = items.reduce((s, it) => s + (it.cost_usd ?? 0), 0);
    return { job_id: job.id, status: job.status, counts, cost_usd, manufacturers: job.items, created_at: job.created_at, updated_at: job.updated_at };
  });

  app.get('/v1/manufacturers/:id/categories', async (req, reply) => {
    const p = IdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'bad_request' });
    const row = deps.store.results.latest(p.data.id);
    if (!row) return reply.code(404).send({ error: 'not_tagged' });
    return toApi(fromRow(row));
  });

  app.post('/v1/manufacturers/:id/tag', async (req, reply) => {
    const p = IdParam.safeParse(req.params);
    const q = Flags.safeParse(req.query);
    if (!p.success || !q.success) return reply.code(400).send({ error: 'bad_request' });
    if (!deps.src.getManufacturer(p.data.id)) return reply.code(404).send({ error: 'unknown_manufacturer' });
    if (!q.data.wait) return reply.code(202).send({ job_id: runner.enqueue([p.data.id], q.data.force) });
    const r = await tag(deps, p.data.id, { force: q.data.force });
    // A pipeline failure is a failure on both paths: the job endpoint reports it as `failed`,
    // so the synchronous one must not return it under 200.
    return reply.code(r.status === 'error' ? 502 : 200).send(toApi(r));
  });
}
