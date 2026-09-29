// Probe 2: contrastive scoring (category sim minus junk-prototype sim) and category-token density
import { DatabaseSync } from 'node:sqlite';
import { pipeline, env } from '@huggingface/transformers';
env.cacheDir = './.model-cache';
const db = new DatabaseSync('data/category_tagging.sqlite', { readOnly: true });
const cats = db.prepare('select id, name, definition from category').all();
const ex = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
async function embed(texts, prefix) {
  const out = [];
  for (let i = 0; i < texts.length; i += 32) {
    const r = await ex(texts.slice(i, i + 32).map(t => prefix + t), { pooling: 'mean', normalize: true });
    const [n, d] = r.dims; for (let j = 0; j < n; j++) out.push(r.data.slice(j * d, (j + 1) * d));
  }
  return out;
}
const dot = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; return s; };
const maxSim = (v, vecs) => vecs.reduce((m, c) => Math.max(m, dot(v, c)), -1);
const catVecs = await embed(cats.map(c => `${c.name}: ${(c.definition || '').slice(0, 1000)}`), 'passage: ');
const JUNK = [
  'job opening, career opportunities, apply now, responsibilities, qualifications, benefits, equal opportunity employer',
  'privacy policy, cookies, personal information, terms of use, data protection, GDPR',
  'contact us, phone number, address, opening hours, directions, email us',
  'press release: the private equity firm announces the acquisition of a portfolio company; investors, fund, transaction',
  'our history, community involvement, sponsorship, employee stories, company values, sustainability report',
  'Stellenangebot, Bewerbung, Datenschutz, Impressum, Kontakt, Ausbildung',
  'offre d\'emploi, politique de confidentialité, mentions légales, contactez-nous',
];
const PROD = [
  'our products: we manufacture and sell a range of food and beverage products, flavors, sizes, ingredients, packaging formats',
  'contract manufacturing and co-packing capabilities: filling, bottling, canning, retort, hot fill, private label, white label',
  'unsere Produkte: wir stellen her; Lohnherstellung, Private Label, Abfüllung',
  'nos produits: nous fabriquons; sous-traitance, marque blanche',
];
const junkVecs = await embed(JUNK, 'passage: '), prodVecs = await embed(PROD, 'passage: ');
const nameTokens = new Set(cats.flatMap(c => c.name.toLowerCase().split(/\W+/)).filter(t => t.length > 3 && !['frozen','refrigerated','shelf','stable','ready','drink','plant','based','free'].includes(t)));
function clean(md) { const seen = new Set(), keep = []; for (let l of md.split('\n')) { l = l.trim().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); if (!l || l.includes('placehold.co')) continue; const k = l.toLowerCase().replace(/\s+/g, ' '); if (seen.has(k) || k.length < 2) continue; seen.add(k); keep.push(l); } return keep; }
function chunk(lines, size = 1000) { const out = []; let cur = '', heading = ''; for (const l of lines) { if (/^#{1,6}\s/.test(l)) heading = l.replace(/^#+\s*/, ''); if (cur.length + l.length > size && cur) { out.push({ heading, text: cur }); cur = ''; } cur += (cur ? '\n' : '') + l; } if (cur) out.push({ heading, text: cur }); return out; }

for (const domain of ['krierfoods.com', 'carolinabeveragegroup.com', 'anona.de', 'needl.co']) {
  const row = db.prepare('select m.name, s.markdown from manufacturer m join manufacturer_scraped_data s on s.id=m.id where m.domain=?').get(domain);
  let chunks = chunk(clean(row.markdown)); if (chunks.length > 400) chunks = chunks.filter((_, i) => i % Math.ceil(chunks.length / 400) === 0);
  const vecs = await embed(chunks.map(c => c.text.slice(0, 1500)), 'passage: ');
  const scored = chunks.map((c, i) => {
    const cat = maxSim(vecs[i], catVecs), junk = maxSim(vecs[i], junkVecs), prod = maxSim(vecs[i], prodVecs);
    const toks = c.text.toLowerCase().split(/\W+/); const dens = toks.filter(t => nameTokens.has(t)).length / Math.max(toks.length, 1);
    return { ...c, cat, junk, prod, dens, contrast: Math.max(cat, prod) - junk };
  });
  const show = (c) => `contrast=${c.contrast.toFixed(3)} cat=${c.cat.toFixed(2)} prod=${c.prod.toFixed(2)} junk=${c.junk.toFixed(2)} dens=${c.dens.toFixed(2)} (${c.heading.slice(0, 22)}) ${c.text.replace(/\s+/g, ' ').slice(0, 90)}`;
  for (const key of ['contrast', 'dens']) {
    const s = [...scored].sort((a, b) => b[key] - a[key]);
    console.log(`\n=== ${row.name} by ${key} (n=${chunks.length})\nTOP 5`); s.slice(0, 5).forEach(c => console.log(' ', show(c)));
    console.log('BOTTOM 3'); s.slice(-3).forEach(c => console.log(' ', show(c)));
  }
}
