import { describe, expect, it } from 'vitest';
import { pool } from '../src/pool.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('pool', () => {
  it('returns results in input order whatever order they finish in', async () => {
    expect(await pool([30, 10, 20, 0], 3, async (ms) => (await sleep(ms), ms))).toEqual([30, 10, 20, 0]);
  });

  // The profile's windows run through this: when one window fails, the others already in flight
  // are still billing, and tag() stores the bill as soon as this throws.
  it('a failure starts nothing new, and throws only after the calls in flight have finished', async () => {
    const finished: number[] = [];
    const started: number[] = [];
    const run = pool([0, 1, 2, 3, 4, 5], 2, async (i) => {
      started.push(i);
      if (i === 0) throw new Error('window 0 failed');
      await sleep(20);
      finished.push(i);
    });
    await expect(run).rejects.toThrow('window 0 failed');
    expect(started).toEqual([0, 1]);
    expect(finished).toEqual([1]);
  });
});
