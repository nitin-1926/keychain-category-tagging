import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from '../../src/config.js';
import type { CacheRow } from '../../src/db/store.js';
import { openStore } from '../../src/db/store.js';
import { requestKey } from '../../src/llm/client.js';
import { currentPipelineRow, exportReplay, importReplay } from '../../src/llm/replay.js';

const row = (key: string, tag: string | null) => ({
  key, model: 'gpt-5.6-luna', prompt_version: 'v1', tag,
  request: '{"user":"x"}', response: '{"answer":"y"}', usage: '{"input":1,"cached":0,"output":1,"reasoning":0}', cost_usd: 0.000001,
  created_at: '2026-09-23T00:00:00.000Z',
});

describe('store + replay', () => {
  it('export then import round-trips byte-identical, grouped by tag', () => {
    const a = openStore(':memory:');
    a.cache.put(row('k2', '402'));
    a.cache.put(row('k1', '402'));
    a.cache.put(row('k3', null));
    const dir = mkdtempSync(join(tmpdir(), 'kct-replay-'));
    const files = exportReplay(a, dir).sort();
    expect(files.map((f) => f.split('/').pop())).toEqual(['402.json', 'untagged.json']);

    const b = openStore(':memory:');
    expect(importReplay(b, dir)).toBe(3);
    expect([...b.cache.rows()].map((r) => r.key).sort()).toEqual(['k1', 'k2', 'k3']);
    const dir2 = mkdtempSync(join(tmpdir(), 'kct-replay-'));
    exportReplay(b, dir2);
    expect(readFileSync(join(dir2, '402.json'), 'utf8')).toBe(readFileSync(join(dir, '402.json'), 'utf8'));
  });

  // `cache export .` used to delete package.json and tsconfig.json; `cache export artifacts`,
  // reference.json. Only files shaped like replay files are this command's to remove.
  it('export removes stale replay files and nothing else in the directory', () => {
    const a = openStore(':memory:');
    a.cache.put(row('k1', '402'));
    const dir = mkdtempSync(join(tmpdir(), 'kct-replay-'));
    for (const f of ['package.json', 'reference.json', '999.json', 'untagged.json']) writeFileSync(join(dir, f), '{}');
    exportReplay(a, dir);
    expect(readdirSync(dir).sort()).toEqual(['402.json', 'package.json', 'reference.json']);
  });

  it('an export that would keep nothing refuses instead of emptying the committed evidence', () => {
    const a = openStore(':memory:');
    a.cache.put(row('k1', '402'));
    const dir = mkdtempSync(join(tmpdir(), 'kct-replay-'));
    exportReplay(a, dir);
    expect(() => exportReplay(openStore(':memory:'), dir)).toThrow(/nothing to export/);
    expect(() => exportReplay(a, dir, () => false)).toThrow(/nothing to export/);
    expect(readFileSync(join(dir, '402.json'), 'utf8')).toContain('k1'); // still there
  });

  // This filter decides what evidence is committed; if it silently rejected everything, the
  // export would have nothing to write (and, before the guard above, would have deleted the lot).
  it('the export filter keeps a current-pipeline row and drops a re-run of one', () => {
    const req = { model: config.MODEL_PIPELINE, promptVersion: config.prompts.judge, schemaName: 'judge', system: 'sys', user: 'u' };
    const mk = (over: Record<string, unknown> = {}): CacheRow => {
      const r = { ...req, ...over } as typeof req & { salt?: string };
      return {
        key: requestKey(r as never), model: r.model, prompt_version: r.promptVersion, tag: '402',
        request: JSON.stringify({ system: r.system, user: r.user, schemaName: r.schemaName, effort: null }),
        response: '{}', usage: '{"input":0,"cached":0,"output":0,"reasoning":0}', cost_usd: 0, created_at: 'x',
      };
    };
    expect(currentPipelineRow(mk())).toBe(true);
    expect(currentPipelineRow(mk({ salt: 'noise-run-2' }))).toBe(false); // a salted re-run, not the shipped answer
    expect(currentPipelineRow({ ...mk(), model: 'some-other-model' })).toBe(false);
    expect(currentPipelineRow({ ...mk(), prompt_version: 'v0' })).toBe(false);
  });

  it('a runtime write never overwrites an existing cache row', () => {
    const a = openStore(':memory:');
    a.cache.put(row('k1', '402'));
    a.cache.put({ ...row('k1', '402'), response: '{"answer":"different"}' });
    expect(a.cache.get('k1')?.response).toBe('{"answer":"y"}');
    a.cache.import([{ ...row('k1', '402'), response: '{"answer":"imported"}' }]);
    expect(a.cache.get('k1')?.response).toBe('{"answer":"imported"}');
  });
});
