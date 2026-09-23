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
// The rows are grouped before anything is deleted, and only the .json files this export replaces
// are removed: an empty or filtered-out cache must never take the committed evidence with it.

export function exportReplay(store: Store, dir: string, keep: (row: CacheRow) => boolean = () => true): string[] {
  const groups = new Map<string, CacheRow[]>();
  for (const row of store.cache.rows()) {
    if (!keep(row)) continue;
    const tag = row.tag ?? 'untagged';
    groups.set(tag, [...(groups.get(tag) ?? []), row]);
  }
  if (!groups.size) throw new Error(`nothing to export: no cache row matches the current pipeline, refusing to empty ${dir}`);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) rmSync(join(dir, f));
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
