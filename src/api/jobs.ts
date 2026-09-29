// Table-backed in-process job runner: one loop, N workers per job, pending rows resumed on start.
// Called by: api/server.ts (created once) and api/routes.ts (enqueue, get).
// Calls: pipeline/tag.ts, once per manufacturer in the job, and db/store.ts to persist progress
// after every item - so a restart resumes instead of starting over.

import { randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import type { JobRow } from '../db/store.js';
import { tag, type Deps } from '../pipeline/tag.js';
import { pool } from '../pool.js';

type JobItem = { status: 'pending' | 'done' | 'failed'; result_key?: string; status_detail?: string; cost_usd?: number; error?: string };
type Job = { id: string; status: JobRow['status']; force: boolean; items: Record<string, JobItem>; created_at: string; updated_at: string };

const toJob = (r: JobRow): Job => ({ ...r, force: r.force === 1, items: JSON.parse(r.items) });
const toRow = (j: Job): JobRow => ({ ...j, force: j.force ? 1 : 0, items: JSON.stringify(j.items) });

export function createRunner(deps: Deps, concurrency: number) {
  const queue: string[] = deps.store.jobs.open().map((r) => r.id); // resume after a restart
  let running: Promise<void> | null = null;

  const save = (j: Job) => deps.store.jobs.put(toRow({ ...j, updated_at: new Date().toISOString() }));

  async function runJob(id: string) {
    const j = toJob(deps.store.jobs.get(id)!);
    j.status = 'running';
    save(j);
    const ids = Object.keys(j.items).filter((k) => j.items[k]!.status === 'pending');
    await pool(ids, concurrency, async (key) => {
      try {
        const r = await tag(deps, Number(key), { force: j.force });
        j.items[key] = { status: r.status === 'error' ? 'failed' : 'done', result_key: r.key, status_detail: r.status, cost_usd: r.costUsd, ...(r.error ? { error: r.error } : {}) };
      } catch (e) {
        j.items[key] = { status: 'failed', error: e instanceof Error ? e.message : String(e) };
      }
      save(j);
      // An already-tagged manufacturer resolves without touching the event loop; without this a job
      // of stored answers would hold the server (and /healthz) until the whole job had drained.
      await setImmediate();
    });
    j.status = Object.values(j.items).every((it) => it.status === 'failed') && ids.length ? 'failed' : 'completed';
    save(j);
  }

  function pump() {
    if (running) return;
    // .finally runs after the assignment, so an empty queue cannot leave `running` set forever.
    // A job that throws outside its per-item try (a failed write, a corrupt row) is marked failed
    // and the loop drains the rest: one bad job must not take the process and the queue with it.
    running = (async () => {
      while (queue.length) {
        const id = queue.shift()!;
        try {
          await runJob(id);
        } catch (e) {
          console.error(`[jobs] ${id} failed: ${e instanceof Error ? e.message : String(e)}`);
          const row = deps.store.jobs.get(id);
          if (row) save({ ...toJob(row), status: 'failed' });
        }
      }
    })().finally(() => {
      running = null;
    });
  }

  pump(); // resume whatever the last process left queued

  return {
    enqueue(ids: number[], force: boolean): string {
      const now = new Date().toISOString();
      const job: Job = { id: randomUUID(), status: 'queued', force, items: Object.fromEntries(ids.map((id) => [String(id), { status: 'pending' as const }])), created_at: now, updated_at: now };
      save(job);
      queue.push(job.id);
      pump();
      return job.id;
    },
    get: (id: string): Job | undefined => {
      const r = deps.store.jobs.get(id);
      return r ? toJob(r) : undefined;
    },
    idle: async () => {
      while (running) await running;
    },
  };
}

export type Runner = ReturnType<typeof createRunner>;
