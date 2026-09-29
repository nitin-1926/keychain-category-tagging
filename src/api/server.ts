// Entry point 2 of 2 (the other is cli.ts). Takes the same `deps` the CLI builds and wires the
// three pieces together: routes (api/routes.ts), the job runner (api/jobs.ts) and a health check.
// Called by: cli.ts `serve`, and test/api/routes.test.ts.

import Fastify from 'fastify';
import { config } from '../config.js';
import type { Deps } from '../pipeline/tag.js';
import { createRunner } from './jobs.js';
import { registerRoutes } from './routes.js';

// The service is local-only (cli.ts binds 127.0.0.1), but a browser can still reach it: a page on
// any site may POST to localhost without a preflight, and a DNS-rebinding page reaches it under its
// own host name. Either could start a billed run in live mode, so a request not addressed to
// localhost, or sent by another site's page, is refused. curl and scripts send no Origin.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function buildApp(deps: Deps, opts: { concurrency?: number; logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin?.replace(/^https?:\/\//, '');
    if (!LOCAL.test(req.headers.host ?? '') || (origin && !LOCAL.test(origin))) return reply.code(403).send({ error: 'forbidden' });
  });
  const runner = createRunner(deps, opts.concurrency ?? 1);
  registerRoutes(app, deps, runner);
  app.get('/healthz', async () => ({ ok: true, mode: config.LLM_MODE }));
  return { app, runner };
}
