// Empirical probe: does "max cosine to any category" separate product chunks from junk?
import { DatabaseSync } from 'node:sqlite';
import { pipeline, env } from '@huggingface/transformers';
env.cacheDir = './.model-cache';

const db = new DatabaseSync('/Users/nitingupta/Desktop/Personal/Projects/keychain-category-tagging/data/category_tagging.sqlite', { readOnly: true });
const cats = db.prepare('select id, name, definition from category').all();
const t0 = Date.now();
const ex = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
console.log('model loaded', Date.now() - t0, 'ms');

async function embed(texts, prefix) {
  const out = [];
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32).map(t => prefix + t);
    const r = await ex(batch, { pooling: 'mean', normalize: true });
    const [n, d] = r.dims; const data = r.data;
    for (let j = 0; j < n; j++) out.push(data.slice(j * d, (j + 1) * d));
  }
  return out;
}
const t1 = Date.now();
const catVecs = await embed(cats.map(c => `${c.name}: ${(c.definition || '').slice(0, 1000)}`), 'passage: ');
console.log('embedded', cats.length, 'categories in', Date.now() - t1, 'ms');

function clean(md) {
  const seen = new Set(); const keep = [];
  for (let l of md.split('\n')) {
    l = l.trim().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    if (!l || l.includes('placehold.co')) continue;
    const k = l.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(k) || k.length < 2) continue;
    seen.add(k); keep.push(l);
  }
  return keep;
}
function chunk(lines, size = 1000) {
  const chunks = []; let cur = ''; let heading = '';
  for (const l of lines) {
    if (/^#{1,6}\s/.test(l)) heading = l.replace(/^#+\s*/, '');
    if (cur.length + l.length > size && cur) { chunks.push({ heading, text: cur }); cur = ''; }
    cur += (cur ? '\n' : '') + l;
  }
  if (cur) chunks.push({ heading, text: cur });
  return chunks;
}
function maxCos(v) {
  let best = -1, bi = -1;
  for (let i = 0; i < catVecs.length; i++) {
    const c = catVecs[i]; let s = 0;
    for (let k = 0; k < v.length; k++) s += v[k] * c[k];
    if (s > best) { best = s; bi = i; }
  }
  return { best, cat: cats[bi].name };
}

for (const domain of ['krierfoods.com', 'brynwoodpartners.com', 'anona.de', 'carolinabeveragegroup.com']) {
  const row = db.prepare('select m.name, s.markdown from manufacturer m join manufacturer_scraped_data s on s.id=m.id where m.domain=?').get(domain);
  const chunks = chunk(clean(row.markdown));
  const t2 = Date.now();
  const vecs = await embed(chunks.map(c => c.text.slice(0, 1500)), 'passage: ');
  const scored = chunks.map((c, i) => ({ ...c, ...maxCos(vecs[i]) })).sort((a, b) => b.best - a.best);
  console.log(`\n=== ${row.name} (${domain}) chunks=${chunks.length} embed ${Date.now() - t2}ms`);
  const show = (c) => `${c.best.toFixed(3)} [${c.cat}] (${c.heading.slice(0, 30)}) ${c.text.replace(/\s+/g, ' ').slice(0, 110)}`;
  console.log('TOP 6'); scored.slice(0, 6).forEach(c => console.log(' ', show(c)));
  console.log('BOTTOM 4'); scored.slice(-4).forEach(c => console.log(' ', show(c)));
  const s = scored.map(c => c.best); console.log('score p10/p50/p90', s[Math.floor(s.length * .9)].toFixed(3), s[Math.floor(s.length * .5)].toFixed(3), s[Math.floor(s.length * .1)].toFixed(3));
}
// phrase -> category retrieval sanity
const phrases = ['cold brew coffee', 'kombucha', 'Kaffeebohnen', 'gummy vitamins', 'contract beverage filling', 'peanut butter pretzels'];
const pv = await embed(phrases, 'query: ');
for (let i = 0; i < phrases.length; i++) {
  const sc = catVecs.map((c, j) => { let s = 0; for (let k = 0; k < c.length; k++) s += pv[i][k] * c[k]; return [s, cats[j].name]; }).sort((a, b) => b[0] - a[0]).slice(0, 5);
  console.log('QUERY', phrases[i], '->', sc.map(x => `${x[1]} ${x[0].toFixed(2)}`).join(' | '));
}
