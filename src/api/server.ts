// Entry point 2 of 2 (the other is cli.ts). Takes the same `deps` the CLI builds and wires the
// three pieces together: routes (api/routes.ts), the job runner (api/jobs.ts) and a health check.
// Called by: cli.ts `serve`, and test/api/routes.test.ts.

import Fastify from 'fastify';
import { config } from '../config.js';
import type { Deps } from '../pipeline/tag.js';
import { createRunner } from './jobs.js';
import { registerRoutes } from './routes.js';

export function buildApp(deps: Deps, opts: { concurrency?: number; logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  const runner = createRunner(deps, opts.concurrency ?? 1);
  registerRoutes(app, deps, runner);
  app.get('/healthz', async () => ({ ok: true, mode: config.LLM_MODE }));
  return { app, runner };
}
