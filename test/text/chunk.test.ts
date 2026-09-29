import { describe, expect, it } from 'vitest';
import { chunk } from '../../src/text/chunk.js';

describe('chunk', () => {
  it('starts a new chunk at each heading', () => {
    const lines = ['# Site', 'intro line', '## Products', 'juice', 'coffee', '## Careers', 'hiring'];
    const out = chunk(lines, 1_000);
    expect(out.map((c) => c.text.split('\n')[0])).toEqual(['# Site', '## Products', '## Careers']);
    expect(out[1]!.text).toBe('## Products\njuice\ncoffee');
    expect(out.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it('merges small lines up to the target and records charStart', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i} `.padEnd(100, 'x'));
    const out = chunk(lines, 1_000);
    expect(out.length).toBeGreaterThanOrEqual(3);
    for (const c of out) expect(c.text.length).toBeLessThanOrEqual(1_000);
    expect(out[1]!.charStart).toBe(lines.join('\n').indexOf(out[1]!.text));
  });

  it('splits a 5,000-char paragraph at sentence ends under ~1,200 chars', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog near the river bank. ';
    const para = sentence.repeat(Math.ceil(5_000 / sentence.length));
    const out = chunk([para], 1_000);
    expect(out.length).toBeGreaterThan(3);
    for (const c of out) {
      expect(c.text.length).toBeLessThanOrEqual(1_200);
      expect(c.text.trimEnd().endsWith('.')).toBe(true);
    }
  });

  it('empty input -> zero chunks', () => {
    expect(chunk([])).toEqual([]);
  });
});
