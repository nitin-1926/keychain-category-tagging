import { describe, expect, it } from 'vitest';
import { batches, evidenceBlocks, judge, JUDGE_PROMPT, type JudgeOutput } from '../../src/pipeline/judge.js';
import type { Card } from '../../src/pipeline/profile.js';
import type { Candidate } from '../../src/pipeline/shortlist.js';
import { chunk } from '../../src/text/chunk.js';
import type { z } from 'zod';
import { candidateIds, fakeLlm } from '../fake-llm.js';

const cand = (id: number, name: string, group = name.toLowerCase()): Candidate => ({
  id, name, definition: `${name} definition`, score: 1 / id, phrases: ['x'], matchedBy: 'both', group,
});
const card: Card = {
  entity_type: 'manufacturer',
  products: [{ name: 'Cold brew coffee', quote: 'We brew cold brew coffee in cans', storage: null }],
  capabilities: [],
  brands: [],
  site_language: 'en',
  summary: '',
};
const evidence = 'Home page. We brew cold brew coffee in cans and make kombucha.';

describe('batches', () => {
  it('65 candidates -> 3 batches of <= 30, a sibling group of 3 never split', () => {
    const cs: Candidate[] = [];
    for (let i = 1; i <= 62; i++) cs.push(cand(i, `C${i}`));
    cs.splice(28, 0, cand(100, 'Frozen Dumpling', 'dumpling'), cand(101, 'Shelf Stable Dumpling', 'dumpling'), cand(102, 'Refrigerated Dumpling', 'dumpling'));
    const b = batches(cs, 30);
    expect(b).toHaveLength(3);
    expect(b.flat()).toHaveLength(65);
    for (const batch of b) expect(batch.length).toBeLessThanOrEqual(30);
    const home = b.findIndex((batch) => batch.some((c) => c.group === 'dumpling'));
    expect(b[home]!.filter((c) => c.group === 'dumpling')).toHaveLength(3);
  });
});

describe('evidenceBlocks', () => {
  it('keeps the site head and the chunks containing card quotes, nothing else', () => {
    const pad = (s: string) => s.padEnd(90, '.');
    const lines = ['# Head', 'x'.repeat(2_500), pad('Careers page text'), pad('We brew **cold brew** coffee in cans'), pad('Privacy policy')];
    const out = evidenceBlocks(card, chunk(lines, 100));
    expect(out).toContain('# Head');
    expect(out).toContain('We brew **cold brew** coffee in cans');
    expect(out).not.toContain('Careers');
    expect(out).not.toContain('Privacy');
  });
});

describe('judge (fake model)', () => {
  const withJudge = (fn: (ids: number[]) => z.infer<typeof JudgeOutput>['verdicts']) => fakeLlm({ judge: (req) => ({ verdicts: fn(candidateIds(req.user)) }) }).llm;

  it('prompt states the two rules', () => {
    expect(JUDGE_PROMPT).toMatch(/capability sentence alone/);
    expect(JUDGE_PROMPT).toMatch(/Storage variants/);
  });

  it('drops ids outside the batch, flips applies when the quote is not in the evidence, fills missing ids', async () => {
    const llm = withJudge((ids) => [
      { id: ids[0]!, applies: true, confidence: 0.9, quote: 'cold brew coffee in cans', reason: 'named' },
      { id: ids[1]!, applies: true, confidence: 0.8, quote: 'we make frozen pizza', reason: 'invented' },
      { id: 999, applies: true, confidence: 1, quote: 'x', reason: 'not in batch' },
    ]);
    const r = await judge(llm, card, evidence, [cand(1, 'Cold Brew'), cand(2, 'Pizza'), cand(3, 'Kombucha')], 't');
    expect(r.unknownIds).toBe(1);
    expect(r.verdicts.map((v) => [v.id, v.applies, v.flags])).toEqual([
      [1, true, []],
      [2, false, ['quote_not_found']],
      [3, false, ['missing_from_output']],
    ]);
    expect(r.verdicts[0]!.quoteMatch).toBe('exact');
    expect(r.verdicts[0]!.retrievalScore).toBe(1);
  });

  it('merges verdicts across batches', async () => {
    const llm = withJudge((ids) => ids.map((id) => ({ id, applies: id % 2 === 0, confidence: 0.7, quote: id % 2 === 0 ? 'kombucha' : null, reason: 'no' })));
    const cs = Array.from({ length: 65 }, (_, i) => cand(i + 1, `C${i + 1}`));
    const r = await judge(llm, card, evidence, cs, 't');
    expect(r.batches).toBe(3);
    expect(r.verdicts).toHaveLength(65);
    expect(r.verdicts.filter((v) => v.applies)).toHaveLength(32);
  });
});
