import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// artifacts/tagging.sqlite: everything this service derives. Three tables and nothing else.
//   llm_cache  every model request and response, keyed by a hash of the request. Written by
//              llm/client.ts, exported to artifacts/replay/ by llm/replay.ts.
//   results    one row per (manufacturer, pipeline version), plus the last failed attempt under
//              its own key. Written by pipeline/tag.ts at the end of every run, read by it at the
//              start, and read by eval/report.ts and the API through results.current().
//   jobs       the API's queue. Written by api/jobs.ts.
// Called by: cli.ts and api/server.ts at startup, into `deps.store`.

export type CacheRow = {
  key: string;
  model: string;
  prompt_version: string;
  tag: string | null; // manufacturer id, for per-manufacturer replay export
  request: string; // JSON: system, user, schemaName, effort
  response: string; // raw model text
  usage: string; // JSON Usage
  cost_usd: number;
  created_at: string;
};

export function openStore(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`
    create table if not exists llm_cache (
      key text primary key,
      model text not null,
      prompt_version text not null,
      tag text,
      request text not null,
      response text not null,
      usage text not null,
      cost_usd real not null,
      created_at text not null
    );
    create table if not exists results (
      result_key text primary key,
      manufacturer_id integer not null,
      status text not null,
      entity_type text,
      categories text not null,
      profile text,
      evidence_stats text not null,
      usage text not null,
      cost_usd real not null,
      versions text not null,
      duration_ms integer not null,
      error text,
      created_at text not null
    );
    create index if not exists results_manufacturer on results(manufacturer_id, created_at);
    create table if not exists jobs (
      id text primary key,
      status text not null,
      force integer not null,
      items text not null,
      created_at text not null,
      updated_at text not null
    );
  `);
  const getJob = db.prepare<[string], JobRow>('select * from jobs where id = ?');
  const putJob = db.prepare(
    `insert or replace into jobs (id, status, force, items, created_at, updated_at)
     values (@id, @status, @force, @items, @created_at, @updated_at)`,
  );
  const openJobs = db.prepare<[], JobRow>(`select * from jobs where status in ('queued', 'running') order by created_at`);
  const getResult = db.prepare<[string], ResultRow>('select * from results where result_key = ?');
  // The one rule for "the current answer" (the API's GET and `report` both read through it): only
  // rows the current pipeline wrote, an answer before a failed attempt, then the newest.
  const currentResult = db.prepare<[number, string], ResultRow>(
    `select * from results where manufacturer_id = ? and versions = ? order by status = 'error', created_at desc limit 1`,
  );
  const putResult = db.prepare(
    `insert or replace into results (result_key, manufacturer_id, status, entity_type, categories, profile, evidence_stats, usage, cost_usd, versions, duration_ms, error, created_at)
     values (@result_key, @manufacturer_id, @status, @entity_type, @categories, @profile, @evidence_stats, @usage, @cost_usd, @versions, @duration_ms, @error, @created_at)`,
  );

  const getCache = db.prepare<[string], CacheRow>('select * from llm_cache where key = ?');
  const writeCache = (verb: string) =>
    db.prepare(
      `${verb} into llm_cache (key, model, prompt_version, tag, request, response, usage, cost_usd, created_at)
       values (@key, @model, @prompt_version, @tag, @request, @response, @usage, @cost_usd, @created_at)`,
    );
  // Runtime writes never overwrite: a key is the whole request, so an existing row is already the
  // answer to it, and a second live process must not rewrite evidence someone has exported.
  const insertCache = writeCache('insert or ignore');
  // Two writes may refresh a row: importing the committed replay files, and a live answer that
  // replaces a cached row which no longer parses.
  const replaceCache = writeCache('insert or replace');
  const allCache = db.prepare<[], CacheRow>('select * from llm_cache order by created_at, key');

  return {
    cache: {
      get: (key: string) => getCache.get(key),
      put: (row: Omit<CacheRow, 'created_at'> & { created_at?: string }) =>
        insertCache.run({ created_at: new Date().toISOString(), ...row }),
      replace: (row: Omit<CacheRow, 'created_at'> & { created_at?: string }) =>
        replaceCache.run({ created_at: new Date().toISOString(), ...row }),
      rows: () => allCache.iterate(), // streamed: the whole cache is ~90 MB of request + response text
      import: db.transaction((rows: CacheRow[]) => {
        for (const r of rows) replaceCache.run(r);
      }),
    },
    results: {
      get: (key: string) => getResult.get(key),
      // versions is the exact JSON written by pipeline/tag.ts versions(), so an answer produced by a
      // different prompt, model or setting is never served as the current one.
      current: (manufacturerId: number, versions: string) => currentResult.get(manufacturerId, versions),
      put: (row: Omit<ResultRow, 'created_at'> & { created_at?: string }) => putResult.run({ created_at: new Date().toISOString(), ...row }),
    },
    jobs: {
      get: (id: string) => getJob.get(id),
      put: (row: JobRow) => putJob.run(row),
      open: () => openJobs.all(),
    },
    close: () => db.close(),
  };
}

export type JobRow = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  force: number;
  items: string; // JSON Record<manufacturer_id, { status, result_key?, cost_usd?, error? }>
  created_at: string;
  updated_at: string;
};

export type ResultRow = {
  result_key: string;
  manufacturer_id: number;
  status: string;
  entity_type: string | null;
  categories: string; // JSON { accepted, rejected }
  profile: string | null; // JSON Card
  evidence_stats: string; // JSON
  usage: string; // JSON { profile, judge, total }
  cost_usd: number;
  versions: string; // JSON
  duration_ms: number;
  error: string | null;
  created_at: string;
};

export type Store = ReturnType<typeof openStore>;
