// THE PIPELINE. One manufacturer, end to end. Start reading here.
//   clean (step 1) -> chunk (2) -> profile (3 and 5, two model calls) -> shortlist (6)
//   -> judge (7 and 8, one model call per batch) -> policy (9) -> store (10)
// Called by: cli.ts `tag` / `tag-all`, and api/routes.ts / api/jobs.ts. Everything the pipeline
// needs arrives in `deps`, so nothing here reaches for a global or opens a connection of its own.
// `versions()` and `resultKey()` sit above tag() because they decide whether any of it runs.

import { createHash } from 'node:crypto';
import { config } from '../config.js';
import type { SourceDb } from '../db/source.js';
import type { ResultRow, Store } from '../db/store.js';
import type { TaxonomyIndex } from '../index/taxonomy.js';
import type { LlmClient } from '../llm/client.js';
import { addUsage, ZERO_USAGE, type Usage } from '../llm/pricing.js';
import { chunk } from '../text/chunk.js';
import { clean } from '../text/clean.js';
import { evidenceBlocks, judge, JUDGE_PROMPT } from './judge.js';
import { applyPolicy, type Decision, type Status } from './policy.js';
import { profile, PROFILE_PROMPT, REDUCE_PROMPT, type Card } from './profile.js';
import { shortlist } from './shortlist.js';

export type Deps = { src: SourceDb; store: Store; llm: LlmClient; index: TaxonomyIndex };

export type TagResult = {
  manufacturerId: number;
  key: string;
  status: Status;
  entityType: Card['entity_type'] | null;
  accepted: Decision[];
  rejected: Decision[];
  card: Card | null;
  evidence: { rawChars: number; cleanedChars: number; chunks: number; windows: number; judgeEvidenceChars: number; quotes: Record<string, number>; shortlist: number; batches: number; unknownIds: number; repeatedIds: number };
  usage: { profile: Usage; judge: Usage; total: Usage };
  costUsd: number;
  versions: Record<string, string>;
  durationMs: number;
  cached: boolean;
  error: string | null;
};

// Every setting and prompt that can change the answer, so that changing any of them re-tags instead
// of serving a stored row. Built by leaving settings out, not by listing them in: a hand-kept list
// missed seven settings across two audits (AI_LOG entries 16 and 18). What is left out changes how
// a run happens, not what it returns - the key, the mode, file paths, concurrency. The prompts count
// by their text as well as their label, so editing a prompt file in place is a change too.
// Code is not in the key: after editing pipeline code (a policy rule, say), re-tag with --force /
// ?force=true. The model calls still come from the cache, so that costs nothing unless a prompt changed.
const promptText = createHash('sha256').update([PROFILE_PROMPT, REDUCE_PROMPT, JUDGE_PROMPT].join('\u0000')).digest('hex').slice(0, 16);

export function versions(taxonomyHash: string): Record<string, string> {
  const { OPENAI_API_KEY, LLM_MODE, SOURCE_DB, ARTIFACTS_DIR, llmConcurrency, prompts, ...settings } = config;
  return { ...prompts, promptText, ...Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, String(v)])), taxonomyHash };
}

// The manufacturer id is part of the key: two manufacturers can hold the same site text (the
// dataset already lists Johnvince Foods twice), and a shared row would file one company's
// answer under the other's id.
function resultKey(manufacturerId: number, cleanedText: string, v: Record<string, string>): string {
  return createHash('sha256').update(String(manufacturerId)).update('\u0000').update(cleanedText).update('\u0000').update(JSON.stringify(v)).digest('hex');
}

export function fromRow(row: ResultRow): TagResult {
  const categories = JSON.parse(row.categories) as { accepted: Decision[]; rejected: Decision[] };
  return {
    manufacturerId: row.manufacturer_id,
    key: row.result_key,
    status: row.status as Status,
    entityType: row.entity_type as TagResult['entityType'],
    accepted: categories.accepted,
    rejected: categories.rejected,
    card: row.profile ? JSON.parse(row.profile) : null,
    evidence: JSON.parse(row.evidence_stats),
    usage: JSON.parse(row.usage),
    costUsd: row.cost_usd,
    versions: JSON.parse(row.versions),
    durationMs: row.duration_ms,
    cached: true,
    error: row.error,
  };
}

function toRow(r: TagResult): Omit<ResultRow, 'created_at'> {
  return {
    result_key: r.key,
    manufacturer_id: r.manufacturerId,
    status: r.status,
    entity_type: r.entityType,
    categories: JSON.stringify({ accepted: r.accepted, rejected: r.rejected }),
    profile: r.card ? JSON.stringify(r.card) : null,
    evidence_stats: JSON.stringify(r.evidence),
    usage: JSON.stringify(r.usage),
    cost_usd: r.costUsd,
    versions: JSON.stringify(r.versions),
    duration_ms: r.durationMs,
    error: r.error,
  };
}

// One pipeline per manufacturer at a time. Two callers asking for the same id at the same moment
// (the API's ?wait=true, or tag-all with a concurrency above 1) would otherwise both miss the
// results row and both pay for the same work.
const inFlight = new Map<string, Promise<TagResult>>();

export function tag(deps: Deps, manufacturerId: number, opts: { force?: boolean } = {}): Promise<TagResult> {
  const key = `${manufacturerId}:${opts.force ? 1 : 0}`;
  const running = inFlight.get(key);
  if (running) return running;
  const p = runTag(deps, manufacturerId, opts).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function runTag(deps: Deps, manufacturerId: number, opts: { force?: boolean }): Promise<TagResult> {
  const t0 = Date.now();
  // Input: one row of the provided dataset - name, domain, and the scraped site as markdown.
  const m = deps.src.getManufacturer(manufacturerId);
  if (!m) throw new Error(`unknown manufacturer ${manufacturerId}`);
  const v = versions(deps.index.taxonomyHash);

  // STEP 1: clean (text/clean.ts). String rules only, no model. ~17.8M chars become ~5.9M.
  const cleaned = clean(m.markdown);
  const key = resultKey(manufacturerId, cleaned.text, v);

  // Nothing below runs if this exact site text has already been tagged by this exact pipeline. A
  // failed attempt is stored under its own key (step 10), so it is never served and always retried.
  if (!opts.force) {
    const row = deps.store.results.get(key);
    if (row) return fromRow(row);
  }

  // STEP 2: chunk (text/chunk.ts). Used twice below: as windows in step 3, as evidence in step 7.
  const chunks = chunk(cleaned.lines, config.chunkChars);
  const result: TagResult = {
    manufacturerId,
    key,
    status: 'error',
    entityType: null,
    accepted: [],
    rejected: [],
    card: null,
    evidence: { rawChars: m.markdown.length, cleanedChars: cleaned.text.length, chunks: chunks.length, windows: 0, judgeEvidenceChars: 0, quotes: {}, shortlist: 0, batches: 0, unknownIds: 0, repeatedIds: 0 },
    usage: { profile: ZERO_USAGE, judge: ZERO_USAGE, total: ZERO_USAGE },
    costUsd: 0,
    versions: v,
    durationMs: 0,
    cached: false,
    error: null,
  };

  // Every model call below goes through this client, which charges each billed attempt to the
  // result the moment it is made: a run that fails halfway is still stored with what it cost.
  const llm: LlmClient = {
    complete: (req) =>
      deps.llm.complete(req, (usage, costUsd) => {
        const step = req.schemaName === 'judge' ? 'judge' : 'profile';
        result.usage[step] = addUsage(result.usage[step], usage);
        result.costUsd += costUsd;
      }),
  };

  try {
    if (cleaned.text.length < config.minCleanedChars) {
      result.status = 'insufficient_content';
    } else {
      const tagStr = String(manufacturerId);

      // STEPS 3 and 5: read every window, merge into the card, verify its quotes (pipeline/profile.ts).
      // Model calls 1..n. Everything after this works from the card, not from the site text.
      const p = await profile(llm, chunks, tagStr);
      result.card = p.card;
      result.entityType = p.card.entity_type;
      result.evidence.windows = p.windows;
      result.evidence.quotes = p.quotes;

      // STEP 6: which categories are even worth asking about (pipeline/shortlist.ts). Local, free.
      const candidates = await shortlist(p.card, deps.index);
      result.evidence.shortlist = candidates.length;

      // STEP 7 input: the slice of the site the judge gets to see (pipeline/judge.ts).
      const evidence = evidenceBlocks(p.card, chunks);
      result.evidence.judgeEvidenceChars = evidence.length;

      // STEPS 7 and 8: judge each candidate in batches, then validate every verdict in code.
      const j = await judge(llm, p.card, evidence, candidates, tagStr);
      result.evidence.batches = j.batches;
      result.evidence.unknownIds = j.unknownIds;
      result.evidence.repeatedIds = j.repeatedIds;

      // STEP 9: the rules code owns, not the model (pipeline/policy.ts). Decides the final status.
      const policy = applyPolicy(j.verdicts, p.card, { cutoff: config.CUTOFF, nonManufacturerPolicy: config.NON_MANUFACTURER_POLICY });
      result.status = policy.status;
      result.accepted = policy.accepted;
      result.rejected = policy.rejected;
    }
  } catch (e) {
    result.status = 'error';
    result.error = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
  }
  // STEP 10: one row, always - a failure is stored as `error` with what it cost, never dropped. It
  // goes under its own key, so a forced re-run that fails cannot overwrite the answer already
  // stored for this exact input, and results.current() still serves that answer.
  if (result.status === 'error') result.key = `${key}:error`;
  result.usage.total = addUsage(result.usage.profile, result.usage.judge);
  result.durationMs = Date.now() - t0;
  deps.store.results.put(toRow(result));
  return result;
}
