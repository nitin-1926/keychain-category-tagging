// The taxonomy index: the 1,424 categories, searchable. Built once, saved to artifacts/, no model
// calls at request time and no network.
// Called by: cli.ts and api/server.ts build it into `deps` at startup (loadOrBuildIndex), then
// pipeline/shortlist.ts queries it once per card phrase (step 6) through searchHybrid().
// Calls: index/embed.ts for the local embedding model.
// Reading order below: BM25, then reciprocal rank fusion, then sibling grouping, then the index
// object that ties the three together, then load/save.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import type { Category } from '../db/source.js';
import { normalize } from '../text/normalize.js';
import { DIMS, dot, embed } from './embed.js';

export type Hit = { id: number; score: number; dense?: number; bm25?: number };

// ---- BM25 (whole-word, no stemming; the dense side covers morphology and language) ----

export const tokenize = (s: string) => normalize(s).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1);

export function bm25(docs: string[][], k1 = 1.2, b = 0.75) {
  const n = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / Math.max(n, 1);
  const df = new Map<string, number>();
  const tf = docs.map((d) => {
    const m = new Map<string, number>();
    for (const t of d) m.set(t, (m.get(t) ?? 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return m;
  });
  const idf = (t: string) => Math.log(1 + (n - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
  return (query: string[], k: number): { index: number; score: number }[] => {
    const scores = new Float64Array(n);
    for (const t of new Set(query)) {
      if (!df.has(t)) continue;
      const w = idf(t);
      for (let i = 0; i < n; i++) {
        const f = tf[i]!.get(t) ?? 0;
        if (f) scores[i] = scores[i]! + (w * f * (k1 + 1)) / (f + k1 * (1 - b + (b * docs[i]!.length) / avgdl));
      }
    }
    return topK(scores, k).filter((h) => h.score > 0);
  };
}

function topK(scores: ArrayLike<number>, k: number) {
  const idx = Array.from({ length: scores.length }, (_, i) => i);
  idx.sort((a, b) => scores[b]! - scores[a]! || a - b);
  return idx.slice(0, k).map((index) => ({ index, score: scores[index]! }));
}

// Reciprocal rank fusion over ranked lists of ids. c = 60 is the usual constant.
export function rrf(lists: number[][], c = 60): { id: number; score: number }[] {
  const fused = new Map<number, number>();
  for (const list of lists) list.forEach((id, rank) => fused.set(id, (fused.get(id) ?? 0) + 1 / (c + rank + 1)));
  return [...fused].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score || a.id - b.id);
}

// ---- Siblings: same base name after stripping storage / qualifier prefixes ----

const SIBLING_PREFIXES = ['frozen', 'refrigerated', 'shelf stable', 'plant based', 'diet', 'ready to drink', 'canned', 'tinned', 'pickled', 'marinated', 'loose'];

export function baseName(name: string): string {
  let s = normalize(name);
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of SIBLING_PREFIXES) {
      if (s.startsWith(p + ' ')) {
        s = s.slice(p.length + 1);
        changed = true;
      }
    }
  }
  return s;
}

// ---- The index ----

export type TaxonomyIndex = ReturnType<typeof makeIndex>;

function makeIndex(categories: Category[], vectors: Float32Array[], taxonomyHash: string) {
  const ids = categories.map((c) => c.id);
  const byId = new Map(categories.map((c, i) => [c.id, i]));
  const searchLexical = bm25(categories.map((c) => tokenize(`${c.name} ${c.definition ?? ''}`)));
  const groups = new Map<string, number[]>();
  categories.forEach((c) => {
    const b = baseName(c.name);
    groups.set(b, [...(groups.get(b) ?? []), c.id]);
  });

  const searchDense = (q: Float32Array, k: number): Hit[] =>
    topK(vectors.map((v) => dot(q, v)), k).map((h) => ({ id: ids[h.index]!, score: h.score, dense: h.score }));

  const searchBm25 = (phrase: string, k: number): Hit[] =>
    searchLexical(tokenize(phrase), k).map((h) => ({ id: ids[h.index]!, score: h.score, bm25: h.score }));

  return {
    ids,
    taxonomyHash,
    vectors,
    category: (id: number) => categories[byId.get(id)!],
    vector: (id: number) => vectors[byId.get(id)!]!,
    searchDense,
    searchBm25,
    // Dense top-2k and BM25 top-2k fused by RRF; each hit keeps its component scores.
    async searchHybrid(phrase: string, k: number): Promise<Hit[]> {
      const [q] = await embed([`query: ${phrase}`]);
      const dense = searchDense(q!, 2 * k);
      const lexical = searchBm25(phrase, 2 * k);
      const d = new Map(dense.map((h) => [h.id, h.dense!]));
      const l = new Map(lexical.map((h) => [h.id, h.bm25!]));
      return rrf([dense.map((h) => h.id), lexical.map((h) => h.id)])
        .slice(0, k)
        .map((h) => ({ id: h.id, score: h.score, dense: d.get(h.id), bm25: l.get(h.id) }));
    },
    siblings: (id: number): number[] => (groups.get(baseName(categories[byId.get(id)!]!.name)) ?? []).filter((s) => s !== id),
  };
}

// What each category looks like to the dense side: its name plus the first 1,000 characters of its
// definition. Every definition in this taxonomy is longer than that (1,206 to 2,894 chars, mean
// 1,702), so the bound is doing real work, and it is not arbitrary: retrieval recall was measured
// over the 391 reference groups at 0 / 200 / 400 / 600 / 800 / 1,000 / 1,500 chars and the whole
// definition, giving 25 / 27 / 29 / 26 / 29 / 22 / 20 / 25 groups missed. There is no trend to
// follow - neighbouring settings swing by nine groups - so 1,000 stays and the 1,500 that measured
// best is not chased: on 30 manufacturers that is one run of a coin, and every change here rebuilds
// every vector and invalidates the committed replay evidence. The BM25 side reads the whole
// definition, which is where an exact term deep in the text is still found.
const categoryText = (c: Category) => `passage: ${c.name}: ${(c.definition ?? '').slice(0, 1_000)}`;

export async function buildIndex(categories: Category[], taxonomyHash: string): Promise<TaxonomyIndex> {
  const vectors = await embed(categories.map(categoryText));
  return makeIndex(categories, vectors, taxonomyHash);
}

type Meta = { taxonomyHash: string; modelId: string; dims: number; ids: number[]; builtAt: string };

export function saveIndex(index: TaxonomyIndex, path: string) {
  const bin = new Float32Array(index.vectors.length * DIMS);
  index.vectors.forEach((v, i) => bin.set(v, i * DIMS));
  const meta: Meta = {
    taxonomyHash: index.taxonomyHash,
    modelId: config.EMBED_MODEL,
    dims: DIMS,
    ids: index.ids,
    builtAt: new Date().toISOString(),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.bin`, Buffer.from(bin.buffer));
  writeFileSync(`${path}.json`, JSON.stringify(meta, null, 2));
}

// Rebuilds when the taxonomy hash or model id differs.
export async function loadOrBuildIndex(categories: Category[], taxonomyHash: string, path = `${config.ARTIFACTS_DIR}/taxonomy-index`): Promise<TaxonomyIndex> {
  if (existsSync(`${path}.json`) && existsSync(`${path}.bin`)) {
    const meta = JSON.parse(readFileSync(`${path}.json`, 'utf8')) as Meta;
    const fresh = meta.taxonomyHash === taxonomyHash && meta.modelId === config.EMBED_MODEL && meta.dims === DIMS && meta.ids.length === categories.length;
    if (fresh) {
      const buf = readFileSync(`${path}.bin`);
      const bin = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      let row = 0;
      const next = () => bin.slice(row * DIMS, ++row * DIMS);
      const vectors = categories.map(next);
      return makeIndex(categories, vectors, taxonomyHash);
    }
  }
  const index = await buildIndex(categories, taxonomyHash);
  saveIndex(index, path);
  return index;
}
