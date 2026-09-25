// STEP 6 (ARCHITECTURE.md section 3): card phrases -> hybrid retrieval -> union -> sibling
// expansion -> cap. No model call and no network: this is the cheap part that decides what the
// expensive part is allowed to consider.
// Called by: pipeline/tag.ts (and the cli `shortlist` command). Calls: index/taxonomy.ts.
// Next step: pipeline/judge.ts, on the candidates this returns.

import { config } from '../config.js';
import { baseName, type Hit, type TaxonomyIndex } from '../index/taxonomy.js';
import { tokenize } from '../index/taxonomy.js';
import type { Card } from './profile.js';

export type MatchedBy = 'dense' | 'bm25' | 'both' | 'sibling';
export type Candidate = {
  id: number;
  name: string;
  definition: string | null;
  score: number; // best fused score; siblings inherit their anchor's score
  phrases: string[]; // card phrases that retrieved it
  matchedBy: MatchedBy;
  group: string; // sibling group key (base name)
};

export type Phrase = { name: string; quote: string };

export function phrasesOf(card: Card): Phrase[] {
  return [...card.products, ...card.capabilities].map((p) => ({ name: p.name, quote: p.quote }));
}

// The query text a card phrase becomes, per QUERY_MODE. The three modes were compared over the
// 30 cards against the reference set (artifacts/query-mode-study.json): name misses 22 of the
// 391 truth groups here, name + quote 22, conditional 25, so `name` ships and the other two stay
// runnable (`cli shortlist <id> --mode ...`) as the evidence for that choice.
export async function retrieve(p: Phrase, index: TaxonomyIndex, k: number, mode = config.QUERY_MODE): Promise<Hit[]> {
  const withQuote = `${p.name}: ${p.quote}`;
  if (mode === 'name_quote') return index.searchHybrid(withQuote, k);
  const hits = await index.searchHybrid(p.name, k);
  if (mode === 'name') return hits;
  // conditional: short names ("Bars", "Powder") or a flat top-k get the quote for context
  const flat = hits.length === k && hits[0]!.score - hits[k - 1]!.score < config.shortlistMarginFloor;
  return tokenize(p.name).length <= 2 || flat ? index.searchHybrid(withQuote, k) : hits;
}

export async function shortlist(card: Card, index: TaxonomyIndex, opts: { k?: number; cap?: number; mode?: typeof config.QUERY_MODE } = {}): Promise<Candidate[]> {
  const k = opts.k ?? config.retrievalK;
  const phrases = phrasesOf(card);
  // Owner's decision (AI_LOG entry 11): the cap scales so every phrase keeps its top hits.
  const cap = opts.cap ?? Math.max(config.shortlistCap, 3 * phrases.length);
  const byId = new Map<number, Candidate>();
  const cat = (id: number) => index.category(id)!;

  for (const p of phrases) {
    for (const h of await retrieve(p, index, k, opts.mode)) {
      const by: MatchedBy = h.dense != null && h.bm25 != null ? 'both' : h.dense != null ? 'dense' : 'bm25';
      const cur = byId.get(h.id);
      if (!cur) {
        const c = cat(h.id);
        byId.set(h.id, { id: h.id, name: c.name, definition: c.definition, score: h.score, phrases: [p.name], matchedBy: by, group: baseName(c.name) });
      } else {
        if (h.score > cur.score) cur.score = h.score;
        if (!cur.phrases.includes(p.name)) cur.phrases.push(p.name);
        if (cur.matchedBy !== by) cur.matchedBy = 'both'; // sibling entries are added after this loop
      }
    }
  }

  // Sibling expansion: the judge must see Frozen X / Refrigerated X / X side by side.
  for (const c of [...byId.values()]) {
    for (const sid of index.siblings(c.id)) {
      if (byId.has(sid)) continue;
      const s = cat(sid);
      byId.set(sid, { id: sid, name: s.name, definition: s.definition, score: c.score, phrases: [...c.phrases], matchedBy: 'sibling', group: c.group });
    }
  }

  // Cap by best score, whole sibling groups only.
  const groups = new Map<string, Candidate[]>();
  for (const c of byId.values()) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  const ordered = [...groups.values()]
    .map((g) => g.sort((a, b) => b.score - a.score || a.id - b.id))
    .sort((a, b) => b[0]!.score - a[0]!.score || a[0]!.id - b[0]!.id);
  const out: Candidate[] = [];
  for (const g of ordered) {
    if (out.length + g.length > cap) continue;
    out.push(...g);
  }
  return out;
}
