// One normaliser for every quote check (ARCHITECTURE.md step 8, plan U2).
// Applied to both the model's quote and the evidence it was given.

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
export function findQuote(quote: string, evidence: string, fuzzyFloor = 0.8): QuoteMatch {
  const q = normalize(quote);
  if (!q) return 'none';
  const e = normalize(evidence);
  if (e.includes(q)) return 'exact';

  const tokens = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const qt = tokens(q);
  const distinct = [...new Set(qt)];
  const et = tokens(e);
  const need = Math.ceil(distinct.length * fuzzyFloor);
  for (let i = 0; i + qt.length <= et.length; i++) {
    const window = new Set(et.slice(i, i + qt.length));
    let hits = 0;
    for (const t of distinct) if (window.has(t)) hits++;
    if (hits >= need) return 'fuzzy';
  }
  return 'none';
}
