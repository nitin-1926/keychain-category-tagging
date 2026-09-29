// The quote guard, shared by both places the model is asked to copy text from the site.
// Called by: pipeline/profile.ts verifyCard() (step 5, drops a product whose quote is not real)
// and pipeline/judge.ts (step 8, flips `applies` to false when the quote is not real). Also by
// pipeline/policy.ts and index/taxonomy.ts, for name comparison rather than quote checking.
// Applied to both sides: the model's quote and the evidence it was given.

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m]!)
    .replace(/[‘’‚‛′'"“”„‟″]/g, '') // quotes, straight and curly
    .replace(/[‐-―−-]/g, ' ') // hyphens and dashes read as word breaks
    .replace(/[*#_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type QuoteMatch = 'exact' | 'fuzzy' | 'none';

// Fuzzy: >= 0.8 of the quote's distinct tokens appear inside some evidence window of the
// quote's length. Distinct, because counting a repeated quote token twice would let it pay
// for an invented one ("we make frozen pizza and we make frozen pasta" against evidence that
// never says pasta). Measured over the 30 stored cards: this changes no verdict (1,235 card
// quotes, 327 judge quotes, 0 flips), it only closes the hole.
// A quote with no word in it ("...", "!!") proves nothing even where the site contains it, so it
// is `none`. One-word quotes stay valid: 68 of the 327 judge quotes are a single product word
// from a list ("Bagels", "Vodka"), and 63 of those match the reference set.
// Built once per evidence text and applied to every quote: normalising and tokenising a 968K-char
// site once per quote made the guard the slowest step on the largest site.
const FUZZY_FLOOR = 0.8;
const tokens = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export function quoteMatcher(evidence: string): (quote: string) => QuoteMatch {
  const e = normalize(evidence);
  const et = tokens(e);
  return (quote) => {
    const q = normalize(quote);
    const qt = tokens(q);
    if (!qt.length) return 'none';
    if (e.includes(q)) return 'exact';
    const distinct = [...new Set(qt)];
    const need = Math.ceil(distinct.length * FUZZY_FLOOR);
    for (let i = 0; i + qt.length <= et.length; i++) {
      const window = new Set(et.slice(i, i + qt.length));
      let hits = 0;
      for (const t of distinct) if (window.has(t)) hits++;
      if (hits >= need) return 'fuzzy';
    }
    return 'none';
  };
}

export const findQuote = (quote: string, evidence: string): QuoteMatch => quoteMatcher(evidence)(quote);
