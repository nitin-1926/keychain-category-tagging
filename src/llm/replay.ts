// The bridge between the live cache and the committed evidence.
// Called by: cli.ts - `cache export` after a live run, and an import on every command so a fresh
// clone can answer every model call from artifacts/replay/ with no API key.
// Calls: llm/client.ts requestKey(), to recognise which rows the current pipeline would ask for.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import type { CacheRow, Store } from '../db/store.js';
import { requestKey } from './client.js';

// Only the rows the current pipeline replays: current model and prompt versions, and no salted
// re-runs (a salted key differs from the key recomputed from the stored request).
export function currentPipelineRow(row: CacheRow): boolean {
  if (row.model !== config.MODEL_PIPELINE) return false;
  if (!Object.values(config.prompts).includes(row.prompt_version)) return false;
  const r = JSON.parse(row.request) as { system: string; user: string; schemaName: string; effort: string | null };
  return requestKey({ model: row.model, promptVersion: row.prompt_version, effort: r.effort ?? undefined, schemaName: r.schemaName, system: r.system, user: r.user } as never) === row.key;
}

// artifacts/replay/<tag>.json: the committed evidence + responses so the pipeline reruns without a key.
// Rows are written sorted and pretty-printed so a re-export of the same cache is byte-identical.
// The rows are grouped before anything is deleted, so an empty or filtered-out cache never takes the
// committed evidence with it. Only files named like replay files are removed (a stale manufacturer's
// file goes, a rewritten one is replaced): any other .json in the directory is not this command's
// to delete, so `cache export .` or `cache export artifacts` cannot take package.json or
// reference.json with it (AI_LOG entry 18).
const REPLAY_FILE = /^(\d+|untagged)\.json$/;

export function exportReplay(store: Store, dir: string, keep: (row: CacheRow) => boolean = () => true): string[] {
  // Filtered while streaming: the whole cache is ~90 MB, the rows this export keeps a fraction of it.
  const groups = new Map<string, CacheRow[]>();
  for (const row of store.cache.rows()) {
    if (!keep(row)) continue;
    const tag = row.tag ?? 'untagged';
    groups.set(tag, [...(groups.get(tag) ?? []), row]);
  }
  if (!groups.size) throw new Error(`nothing to export: no cache row matches the current pipeline, refusing to empty ${dir}`);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (REPLAY_FILE.test(f)) rmSync(join(dir, f));
  const files: string[] = [];
  for (const [tag, rows] of groups) {
    const file = join(dir, `${tag}.json`);
    rows.sort((a, b) => a.key.localeCompare(b.key));
    writeFileSync(file, JSON.stringify(rows, null, 2) + '\n');
    files.push(file);
  }
  return files;
}

export function importReplay(store: Store, dir: string): number {
  let n = 0;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const rows = JSON.parse(readFileSync(join(dir, name), 'utf8')) as CacheRow[];
    store.cache.import(rows);
    n += rows.length;
  }
  return n;
}
