import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { toApi } from './api/serialize.js';
import { buildApp } from './api/server.js';
import { config } from './config.js';
import { openSource } from './db/source.js';
import { openStore } from './db/store.js';
import { buildReport, compareAll, loadReference, writeReport } from './eval/report.js';
import { loadOrBuildIndex } from './index/taxonomy.js';
import { clientFromConfig } from './llm/client.js';
import { currentPipelineRow, exportReplay, importReplay } from './llm/replay.js';
import { profile } from './pipeline/profile.js';
import { shortlist } from './pipeline/shortlist.js';
import { tag, type TagResult } from './pipeline/tag.js';
import { chunk } from './text/chunk.js';
import { clean } from './text/clean.js';

// ENTRY POINT 1 of 2 (the other is api/server.ts). Usage: npm run cli -- <command> [args].
// Every command is one entry in the `commands` map at the bottom; the file reads top to bottom as
// helpers first, commands second, dispatch last (the three lines under the map).
// deps() is what every command that touches the pipeline builds first: the read-only dataset, the
// artifacts store (with the committed replay evidence loaded into it), the LLM client and the
// taxonomy index. From there, `tag` calls pipeline/tag.ts and the rest follows the flow in the
// README's "How to read the code".
const [cmd, ...args] = process.argv.slice(2);
const src = openSource(config.SOURCE_DB);

// One store per process, and the committed replay files are loaded into it before anything reads
// it. Imported on every command, not only into an empty cache: a cache holding a few rows from an
// earlier command is exactly the case where a replay miss would otherwise surprise a reviewer.
let store: ReturnType<typeof openStore> | undefined;
function artifactStore() {
  if (store) return store;
  store = openStore(`${config.ARTIFACTS_DIR}/tagging.sqlite`);
  const replayDir = `${config.ARTIFACTS_DIR}/replay`;
  if (existsSync(replayDir)) console.error(`[replay] ${importReplay(store, replayDir)} cached responses loaded from ${replayDir}`);
  return store;
}

async function deps() {
  const store = artifactStore();
  return { src, store, llm: clientFromConfig(store), index: await loadOrBuildIndex(src.listCategories(), src.taxonomyHash()) };
}

// Five manufacturers drawn once with a fixed seed (grill Q17: "choose random 5"); committed in artifacts/.
function devSet(): number[] {
  const file = `${config.ARTIFACTS_DIR}/dev-set.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as number[];
  let s = 42;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const ids = [...src.listManufacturerIds()].sort(() => rand() - 0.5).slice(0, 5).sort((a, b) => a - b);
  writeFileSync(file, JSON.stringify(ids) + '\n');
  return ids;
}

function printResult(r: TagResult) {
  const m = src.getManufacturer(r.manufacturerId)!;
  console.log(`${m.domain} (${r.manufacturerId}): ${r.status}, entity ${r.entityType ?? '-'}, ${r.accepted.length} accepted / ${r.rejected.length} rejected, $${r.costUsd.toFixed(4)}, ${r.durationMs} ms${r.cached ? ' (stored)' : ''}`);
  console.log(`evidence: ${JSON.stringify(r.evidence)}`);
  if (r.error) console.log(`error: ${r.error}`);
  for (const d of r.accepted) console.log(`  + ${String(d.id).padEnd(5)} ${d.confidence.toFixed(2)}  ${d.name.padEnd(36)} ${d.storageInferred ? '[storage_inferred] ' : ''}${d.movedFrom ? `[moved from ${d.movedFrom}] ` : ''}<- "${(d.quote ?? '').slice(0, 70)}"`);
  const shown = r.rejected.filter((d) => d.rejectReason !== 'judge_rejected');
  for (const d of shown) console.log(`  - ${String(d.id).padEnd(5)} ${d.confidence.toFixed(2)}  ${d.name.padEnd(36)} ${d.rejectReason}${d.flags.length ? ` ${d.flags.join(',')}` : ''}`);
  console.log(`  (${r.rejected.length - shown.length} more rejected by the judge)`);
}

const commands: Record<string, (args: string[]) => Promise<void> | void> = {
  ids() {
    for (const id of src.listManufacturerIds()) {
      const m = src.getManufacturer(id)!;
      console.log(`${id}\t${m.domain}\t${m.name}\t${m.markdown.length} chars`);
    }
  },

  // clean-stats [--show-dropped <id> [n]]
  'clean-stats'(args) {
    if (args[0] === '--show-dropped') {
      const m = src.getManufacturer(Number(args[1]))!;
      const { dropped } = clean(m.markdown);
      const n = Number(args[2] ?? 40);
      const step = Math.max(1, Math.floor(dropped.length / n));
      console.log(`${m.domain}: ${dropped.length} dropped lines, showing every ${step}th`);
      for (let i = 0; i < dropped.length; i += step) console.log(`[${dropped[i]!.reason}] ${dropped[i]!.line.slice(0, 140)}`);
      return;
    }
    let raw = 0;
    let kept = 0;
    console.log('id\tdomain\traw\tcleaned\tkept%\tchunks');
    for (const id of src.listManufacturerIds()) {
      const m = src.getManufacturer(id)!;
      const c = clean(m.markdown);
      raw += m.markdown.length;
      kept += c.text.length;
      const pct = ((100 * c.text.length) / m.markdown.length).toFixed(0);
      console.log(`${id}\t${m.domain}\t${m.markdown.length}\t${c.text.length}\t${pct}%\t${chunk(c.lines, config.chunkChars).length}`);
    }
    console.log(`total\t\t${raw}\t${kept}\t${((100 * kept) / raw).toFixed(0)}%`);
  },

  // index: build or load artifacts/taxonomy-index.{bin,json}
  async index() {
    const t0 = Date.now();
    const index = await loadOrBuildIndex(src.listCategories(), src.taxonomyHash());
    console.log(`${index.ids.length} categories, ${Date.now() - t0} ms`);
  },

  // profile <manufacturer_id>: the card from the full read
  async profile(args) {
    const m = src.getManufacturer(Number(args[0]))!;
    const llm = clientFromConfig(artifactStore());
    const chunks = chunk(clean(m.markdown).lines, config.chunkChars);
    const t0 = Date.now();
    const r = await profile(llm, chunks, String(m.id));
    console.log(`${m.domain}: ${r.windows} windows, ${r.evidence.length} chars, quotes ${JSON.stringify(r.quotes)}, usage ${JSON.stringify(r.usage)}, $${r.costUsd.toFixed(4)}, ${Date.now() - t0} ms`);
    console.log(`entity_type: ${r.card.entity_type} (${r.card.site_language})  ${r.card.summary}`);
    console.log(`brands: ${r.card.brands.join(', ')}`);
    for (const p of r.card.products) console.log(`  product     ${p.name}${p.storage ? ` [${p.storage}]` : ''}  <- "${p.quote.slice(0, 90)}"`);
    for (const c of r.card.capabilities) console.log(`  capability  ${c.name}  <- "${c.quote.slice(0, 90)}"`);
  },

  // shortlist <manufacturer_id> [--mode name|name_quote|conditional]: candidates with provenance (card from cache)
  async shortlist(args) {
    const m = src.getManufacturer(Number(args[0]))!;
    const mode = args[1] === '--mode' ? (args[2] as typeof config.QUERY_MODE) : config.QUERY_MODE;
    const llm = clientFromConfig(artifactStore());
    const index = await loadOrBuildIndex(src.listCategories(), src.taxonomyHash());
    const { card } = await profile(llm, chunk(clean(m.markdown).lines, config.chunkChars), String(m.id));
    const out = await shortlist(card, index, { mode });
    console.log(`${m.domain}: ${card.products.length} products + ${card.capabilities.length} capabilities -> ${out.length} candidates (mode ${mode})`);
    for (const c of out) console.log(`${c.id}\t${c.score.toFixed(4)}\t${c.matchedBy.padEnd(7)}\t${c.name.padEnd(40)}\t<- ${c.phrases.join(' | ').slice(0, 60)}`);
  },

  // tag <manufacturer_id> [--force] [--json]: one manufacturer end to end
  async tag(args) {
    const r = await tag(await deps(), Number(args[0]), { force: args.includes('--force') });
    if (args.includes('--json')) console.log(JSON.stringify(toApi(r), null, 2));
    else printResult(r);
  },

  // serve [--port N] [--concurrency N]: the HTTP contract (ARCHITECTURE.md section 7)
  async serve(args) {
    const port = Number(args[args.indexOf('--port') + 1]) || 3000;
    const concurrency = Number(args[args.indexOf('--concurrency') + 1]) || 1;
    const { app } = buildApp(await deps(), { concurrency, logger: true });
    await app.listen({ port, host: '127.0.0.1' });
  },

  // tag-all [--dev] [--force] [--concurrency N]: every manufacturer, or the dev set
  async 'tag-all'(args) {
    const d = await deps();
    const ids = args.includes('--dev') ? devSet() : src.listManufacturerIds();
    const n = Number(args[args.indexOf('--concurrency') + 1]) || 1;
    const force = args.includes('--force');
    let next = 0;
    let total = 0;
    const worker = async () => {
      for (let i = next++; i < ids.length; i = next++) {
        const r = await tag(d, ids[i]!, { force });
        total += r.costUsd;
        const m = src.getManufacturer(r.manufacturerId)!;
        console.log(`${r.manufacturerId}\t${m.domain.padEnd(32)}\t${r.status.padEnd(22)}\t${(r.entityType ?? '-').padEnd(12)}\t${String(r.accepted.length).padStart(3)} accepted\t$${r.costUsd.toFixed(4)}${r.cached ? '\t(stored)' : ''}${r.error ? `\t${r.error}` : ''}`);
      }
    };
    await Promise.all(Array.from({ length: n }, worker));
    console.log(`total $${total.toFixed(4)} for ${ids.length} manufacturers`);
  },

  // report: artifacts/report.md and calibration.json, stored results vs artifacts/reference.json
  async report() {
    const d = await deps();
    const reference = loadReference();
    const rows = await compareAll(d, reference);
    // Without this, a fresh clone would print a perfect score over zero manufacturers and
    // overwrite the committed report with it.
    if (!rows.length) {
      console.error('no stored results for the current pipeline version: run `npm run cli -- tag-all` first (replay mode needs no key)');
      process.exit(1);
    }
    const out = buildReport(rows, reference);
    writeReport(out);
    console.log(`${rows.length} manufacturers vs reference: P ${(100 * out.overall.precision).toFixed(1)}% R ${(100 * out.overall.recall).toFixed(1)}% F1 ${(100 * out.overall.f1).toFixed(1)}%; best-F1 cutoff ${out.calibration.chosenCutoff}; mean cost $${out.cost.meanUsd.toFixed(4)}, projected 30K $${out.cost.projected30k.toFixed(0)}`);
    console.log('written: artifacts/report.md, artifacts/calibration.json');
  },

  // cache export|import [dir]: llm_cache <-> artifacts/replay/<manufacturer>.json
  cache(args) {
    const store = artifactStore();
    const dir = args[1] ?? `${config.ARTIFACTS_DIR}/replay`;
    if (args[0] === 'export') console.log(exportReplay(store, dir, currentPipelineRow).join('\n') || '(cache empty)');
    else if (args[0] === 'import') console.log(`${importReplay(store, dir)} rows imported`);
    else console.error('usage: cache export|import [dir]');
  },

  // search <phrase> [k]: hybrid retrieval with component scores
  async search(args) {
    const index = await loadOrBuildIndex(src.listCategories(), src.taxonomyHash());
    const k = Number(args[1] ?? 8);
    for (const h of await index.searchHybrid(args[0]!, k)) {
      console.log(`${h.id}\t${index.category(h.id)!.name}\trrf=${h.score.toFixed(4)}\tdense=${h.dense?.toFixed(3) ?? '-'}\tbm25=${h.bm25?.toFixed(2) ?? '-'}`);
    }
  },
};

const run = commands[cmd ?? ''];
if (!run) {
  console.error(`commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}
await run(args);
