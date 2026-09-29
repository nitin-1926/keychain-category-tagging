import { describe, expect, it } from 'vitest';
import { profile, PROFILE_PROMPT, REDUCE_PROMPT, verifyCard, windows, type Card } from '../../src/pipeline/profile.js';
import { chunk } from '../../src/text/chunk.js';
import { fakeLlm } from '../fake-llm.js';

const evidence = 'We brew **“Cold-Brew”** coffee in cans. Our kombucha is refrigerated. We also make oat milk lattes.';
const card = (products: Card['products'], entity_type: Card['entity_type'] = 'manufacturer'): Card => ({
  entity_type, products, capabilities: [], brands: [], site_language: 'en', summary: 's',
});

describe('verifyCard', () => {
  it('keeps products with exact quotes, keeps and counts fuzzy, drops and counts missing', () => {
    const { card: out, quotes } = verifyCard(
      card([
        { name: 'Cold brew coffee', quote: '"cold brew" coffee in cans', storage: null },
        { name: 'Kombucha', quote: 'Our kombucha is refrigerated. We also make oat milk drinks', storage: 'refrigerated' }, // one word in ten changed -> fuzzy
        { name: 'Frozen pizza', quote: 'we make frozen pizza', storage: 'frozen' },
      ]),
      evidence,
    );
    expect(out.products.map((p) => p.name)).toEqual(['Cold brew coffee', 'Kombucha']);
    expect(quotes).toEqual({ exact: 1, fuzzy: 1, none: 1 });
  });

  it('dedupes products by normalised name', () => {
    const { card: out } = verifyCard(
      card([
        { name: 'Oat Milk Latte', quote: 'oat milk lattes', storage: null },
        { name: 'oat-milk latte', quote: 'oat milk lattes', storage: null },
      ]),
      evidence,
    );
    expect(out.products).toHaveLength(1);
  });
});

describe('prompts', () => {
  it('state the marketplace / investor exclusion and the English-name rule', () => {
    expect(PROFILE_PROMPT).toMatch(/marketplace/);
    expect(PROFILE_PROMPT).toMatch(/investor/);
    expect(PROFILE_PROMPT).toMatch(/Product names are in English/);
    expect(REDUCE_PROMPT).toMatch(/copy it exactly/);
  });
});

describe('profile (fake model)', () => {
  const lines = (n: number, text: string) => Array.from({ length: n }, (_, i) => `${text} ${i}`);

  it('single window: map once, no reduce', async () => {
    const { llm, calls } = fakeLlm({ card: () => card([{ name: 'Cold brew coffee', quote: 'Cold-Brew', storage: null }]) });
    const r = await profile(llm, chunk([evidence]), 't');
    expect(r.windows).toBe(1);
    expect(calls()).toBe(1);
    expect(r.card.products).toHaveLength(1);
  });

  it('three windows: map three times, reduce once, duplicates merged', async () => {
    const seen: string[] = [];
    const { llm } = fakeLlm({
      card: (req) => {
        seen.push(req.system === REDUCE_PROMPT ? 'reduce' : 'map');
        if (req.system === REDUCE_PROMPT) {
          return card([
            { name: 'Snack bar', quote: 'snack bar 0', storage: null },
            { name: 'Snack Bar', quote: 'snack bar 1', storage: null },
          ]);
        }
        const i = Number(/Window (\d+)/.exec(req.user)![1]);
        return card([{ name: 'Snack bar', quote: `snack bar ${i}`, storage: null }]);
      },
    });
    const chunks = chunk(lines(30, 'snack bar'.padEnd(200, '.')), 1_000);
    const r = await profile(llm, chunks, 't', { windowChars: 2_500 });
    expect(r.windows).toBe(3);
    expect(seen).toEqual(['map', 'map', 'map', 'reduce']);
    expect(r.card.products).toHaveLength(1);
  });

  it('windows never split a chunk and cover every chunk in order', () => {
    const chunks = chunk(lines(12, 'x'.repeat(300)), 1_000);
    const w = windows(chunks, 1_500);
    expect(w.join('\n')).toBe(chunks.map((c) => c.text).join('\n'));
    for (const x of w) expect(x.length).toBeLessThanOrEqual(1_500 + 1);
  });
});
