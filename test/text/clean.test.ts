import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openSource } from '../../src/db/source.js';
import { clean, cleanLine } from '../../src/text/clean.js';

const fixture = readFileSync('test/fixtures/site-sample.md', 'utf8');

describe('clean', () => {
  it('keeps each paragraph once, drops repeated nav and placeholder urls', () => {
    const { lines, text } = clean(fixture);
    expect(lines.filter((l) => l === 'Home Products Careers')).toHaveLength(1);
    expect(lines.filter((l) => l === '# Zeus Beverages')).toHaveLength(1);
    expect(text).not.toContain('placehold');
    expect(text).not.toContain('zeus.example');
    expect(lines.filter((l) => l.startsWith('We are a family') || l.startsWith('Our juice') || l.startsWith('This website'))).toHaveLength(3);
  });

  it('keeps image alt text and the rest of the line', () => {
    expect(cleanLine('![ZEUS - Fruit Juices](https://placehold.co/600x400) Order now')).toBe('ZEUS - Fruit Juices Order now');
    expect(cleanLine('![](https://placehold.co/600x400)')).toBe('');
    expect(cleanLine('see https://placehold.co/600x400 here')).toBe('see here');
  });

  it('treats lines differing only in case or spacing as duplicates', () => {
    const { lines, dropped } = clean('Cold Brew\ncold   brew\nCOLD BREW');
    expect(lines).toEqual(['Cold Brew']);
    expect(dropped.map((d) => d.reason)).toEqual(['duplicate', 'duplicate']);
  });

  it('drops punctuation-only and single-character lines', () => {
    const { lines, dropped } = clean('---\n*\n|\na\nA1');
    expect(lines).toEqual(['A1']);
    expect(dropped.every((d) => d.reason === 'trivial')).toBe(true);
  });

  it('empty markdown -> nothing', () => {
    expect(clean('')).toEqual({ lines: [], text: '', dropped: [] });
  });

  it('integration: every real site retains between 2% and 90% of its chars', () => {
    const src = openSource('data/category_tagging.sqlite');
    let raw = 0;
    let kept = 0;
    for (const id of src.listManufacturerIds()) {
      const m = src.getManufacturer(id)!;
      const ratio = clean(m.markdown).text.length / m.markdown.length;
      expect(ratio, m.domain).toBeGreaterThan(0.02);
      expect(ratio, m.domain).toBeLessThan(0.9);
      raw += m.markdown.length;
      kept += clean(m.markdown).text.length;
    }
    expect(kept / raw).toBeCloseTo(0.32, 1); // measured in ARCHITECTURE.md 1.1
  });
});
