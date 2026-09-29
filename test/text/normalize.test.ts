import { describe, expect, it } from 'vitest';
import { findQuote, normalize, quoteMatcher } from '../../src/text/normalize.js';

describe('normalize', () => {
  it('unifies quotes, dashes, markdown marks, entities and whitespace', () => {
    expect(normalize('**“Cold-Brew”** &amp;   Tea')).toBe('cold brew & tea');
    expect(normalize('Ｃａｆé')).toBe('café'); // NFKC folds full-width forms
  });
});

describe('findQuote', () => {
  const evidence = 'We make **“Cold-Brew”** coffee and cold-pressed juices for retailers.';

  it('exact after normalisation', () => {
    expect(findQuote('"cold brew" coffee', evidence)).toBe('exact');
  });

  it('fuzzy when one word differs', () => {
    expect(findQuote('cold brew coffee and cold pressed drinks for retailers', evidence)).toBe('fuzzy');
  });

  it('none when unrelated', () => {
    expect(findQuote('frozen pizza dough', evidence)).toBe('none');
    expect(findQuote('', evidence)).toBe('none');
  });

  it('holds the 0.8 floor: three of five words is not a quote', () => {
    expect(findQuote('cold brew coffee frozen pizza', evidence)).toBe('none'); // 3/5 = 0.6
    expect(findQuote('cold brew coffee and pizza', evidence)).toBe('fuzzy'); // 4/5 = 0.8
  });

  // "..." is in almost every site, so an exact match on it proved nothing and let a verdict through.
  it('a quote with no word in it is none, even where the site contains it', () => {
    const site = 'Our range... more to come!! (see below)';
    for (const q of ['...', '!!', '()', '???']) expect(findQuote(q, site)).toBe('none');
    expect(findQuote('We', 'We make pasta')).toBe('exact'); // a one-word quote stays valid
  });

  it('a matcher built once gives the same answers as findQuote', () => {
    const m = quoteMatcher(evidence);
    for (const q of ['"cold brew" coffee', 'cold brew coffee and cold pressed drinks for retailers', 'frozen pizza dough', '']) expect(m(q)).toBe(findQuote(q, evidence));
  });

  it('a repeated word cannot pay for an invented one', () => {
    // Counting the quote's tokens with repeats, "we" and "make" three times each would reach the
    // floor on their own and carry "pasta", which the site never mentions, into the card.
    const site = 'We make cold brew coffee and we make cold pressed juice at our plant.';
    expect(findQuote('we make we make we make pasta', site)).toBe('none');
  });
});
