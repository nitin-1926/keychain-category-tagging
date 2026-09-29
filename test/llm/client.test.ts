import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { openStore } from '../../src/db/store.js';
import { createClient, LlmOutputError, ReplayMissError, requestKey, type Transport } from '../../src/llm/client.js';
import { costUsd } from '../../src/llm/pricing.js';

const Answer = z.object({ answer: z.string() });
const req = (over: Partial<Omit<Parameters<typeof requestKey>[0], 'schema'>> = {}) => ({
  model: 'gpt-5.6-luna',
  promptVersion: 'v1',
  system: 'sys',
  user: 'hello',
  schemaName: 'answer',
  schema: Answer,
  tag: '402',
  ...over,
});
const usage = { input: 1000, cached: 200, output: 100, reasoning: 0 };
const okTransport = (): Transport => vi.fn(async () => ({ text: JSON.stringify({ answer: 'hi' }), usage }));

describe('llm client', () => {
  it('live: same request twice -> one transport call, second from cache', async () => {
    const transport = okTransport();
    const c = createClient({ mode: 'live', store: openStore(':memory:'), transport, log: () => {} });
    const a = await c.complete(req());
    const b = await c.complete(req());
    expect(transport).toHaveBeenCalledTimes(1);
    expect(a.source).toBe('live');
    expect(b).toMatchObject({ source: 'cache', output: { answer: 'hi' }, usage, costUsd: a.costUsd });
    expect(requestKey(req())).not.toBe(requestKey(req({ effort: 'low' })));
  });

  it('prices usage: 1000 in (200 cached), 100 out on luna', () => {
    // (800 * 0.20 + 200 * 0.02 + 100 * 1.20) / 1e6
    expect(costUsd('gpt-5.6-luna', usage)).toBeCloseTo(0.000284, 9);
    expect(() => costUsd('unknown-model', usage)).toThrow(/no price/);
  });

  it('schema failure -> one retry with the error appended; second failure -> LlmOutputError', async () => {
    const transport = vi.fn(async (_r, user: string) => ({ text: JSON.stringify({ wrong: user.includes('did not match') ? 2 : 1 }), usage }));
    const c = createClient({ mode: 'live', store: openStore(':memory:'), transport, log: () => {} });
    await expect(c.complete(req())).rejects.toBeInstanceOf(LlmOutputError);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]![1]).toContain('did not match the required schema');
  });

  // Both attempts were billed even though the call threw; a caller that only summed returned
  // results used to store such a run at $0.
  it('spend hears every billed attempt, including both of a call that fails its schema, and a cache hit', async () => {
    const heard: number[] = [];
    const bad = createClient({ mode: 'live', store: openStore(':memory:'), transport: async () => ({ text: '{}', usage }), log: () => {} });
    await expect(bad.complete(req(), (_, usd) => heard.push(usd))).rejects.toBeInstanceOf(LlmOutputError);
    expect(heard).toEqual([costUsd('gpt-5.6-luna', usage), costUsd('gpt-5.6-luna', usage)]);

    const store = openStore(':memory:');
    const good = createClient({ mode: 'live', store, transport: okTransport(), log: () => {} });
    await good.complete(req());
    heard.length = 0;
    await good.complete(req(), (_, usd) => heard.push(usd));
    expect(heard).toEqual([costUsd('gpt-5.6-luna', usage)]); // the stored cost, charged on replay too
  });

  it('a model with no price fails before anything is billed', async () => {
    const transport = okTransport();
    const c = createClient({ mode: 'live', store: openStore(':memory:'), transport, log: () => {} });
    await expect(c.complete(req({ model: 'unpriced-model' }))).rejects.toThrow(/no price/);
    expect(transport).not.toHaveBeenCalled();
  });

  // Inserting under an existing key is ignored, so without the replace the bad row stayed and every
  // later run paid for the same call again (a schema change without a prompt-version bump does this).
  it('a cached row that no longer parses is replaced by the fresh answer, so it is paid for once', async () => {
    const store = openStore(':memory:');
    store.cache.put({ key: requestKey(req()), model: 'gpt-5.6-luna', prompt_version: 'v1', tag: '402', request: '{}', response: '{"old":1}', usage: JSON.stringify(usage), cost_usd: 0 });
    const transport = okTransport();
    const c = createClient({ mode: 'live', store, transport, log: () => {} });
    await c.complete(req());
    await c.complete(req());
    expect(transport).toHaveBeenCalledTimes(1);
    expect(store.cache.get(requestKey(req()))?.response).toBe(JSON.stringify({ answer: 'hi' }));
  });

  it('retry that succeeds is cached under the original key with summed usage', async () => {
    let n = 0;
    const transport: Transport = async () => ({ text: n++ === 0 ? 'garbage' : JSON.stringify({ answer: 'second' }), usage });
    const store = openStore(':memory:');
    const c = createClient({ mode: 'live', store, transport, log: () => {} });
    const r = await c.complete(req());
    expect(r.output.answer).toBe('second');
    expect(r.usage.input).toBe(2000);
    expect(store.cache.get(requestKey(req()))?.response).toBe(JSON.stringify({ answer: 'second' }));
  });

  it('replay miss -> ReplayMissError naming the key, and never a billed call', async () => {
    const c = createClient({ mode: 'replay', store: openStore(':memory:') });
    await expect(c.complete(req())).rejects.toMatchObject({ key: requestKey(req()) });
    await expect(c.complete(req())).rejects.toBeInstanceOf(ReplayMissError);

    // Even handed a transport, replay must not reach it: a reviewer with a key in .env who runs
    // the default mode cannot be billed by a miss.
    const transport = okTransport();
    const withKey = createClient({ mode: 'replay', store: openStore(':memory:'), transport, log: () => {} });
    await expect(withKey.complete(req())).rejects.toBeInstanceOf(ReplayMissError);
    expect(transport).not.toHaveBeenCalled();
  });

  it('a cache row with a malformed usage object is rejected, not silently priced', async () => {
    const store = openStore(':memory:');
    const c = createClient({ mode: 'replay', store, log: () => {} });
    store.cache.put({
      key: requestKey(req()), model: 'gpt-5.6-luna', prompt_version: 'v1', tag: '402',
      request: '{}', response: JSON.stringify({ answer: 'hi' }), usage: '{"input":"1000","cached":0,"output":1,"reasoning":0}', cost_usd: 0,
    });
    await expect(c.complete(req())).rejects.toThrow();
  });
});
