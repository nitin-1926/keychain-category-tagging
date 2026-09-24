// Eval: stored results scored against artifacts/reference.json (built once from Jev + arbiter, see
// ARCHITECTURE.md section 8), with a cause for every miss, a calibration table and the cost table.

import { readFileSync, writeFileSync } from 'node:fs';
import { config } from '../config.js';
import { fromRow, versions, type Deps, type TagResult } from '../pipeline/tag.js';
import { diff, metrics, pipelineGroups, score, type Group, type Metrics, type Mismatch } from './compare.js';

export type Reference = {
  generatedAt: string;
  method: string;
  cost?: { jevUsd: number; arbiterUsd: number };
  manufacturers: Record<string, { domain: string; status: string; groups: { key: string; ids: number[]; names: string[]; source: string; reason?: string }[]; excluded: { key: string; names: string[]; reason?: string }[] }>;
};

export const loadReference = (path = `${config.ARTIFACTS_DIR}/reference.json`): Reference => JSON.parse(readFileSync(path, 'utf8'));

export type Compared = { id: number; domain: string; result: TagResult; mismatches: Mismatch[]; scores: Metrics };

// Only rows produced by the current pipeline are scored: a report headed "prompts judge v2" must
// not be computed from a row some other prompt version wrote.
export async function compareAll(deps: Deps, reference = loadReference(), ids = deps.src.listManufacturerIds()): Promise<Compared[]> {
  const current = JSON.stringify(versions(deps.index.taxonomyHash));
  const out: Compared[] = [];
  for (const id of ids) {
    const row = deps.store.results.latest(id, current);
    const ref = reference.manufacturers[String(id)];
    if (!row || !ref) continue;
    const result = fromRow(row);
    if (!result.card) continue;
    const truth = new Map<string, Group>(ref.groups.map((g) => [g.key, { key: g.key, ids: g.ids, names: g.names }]));
    const pipe = pipelineGroups(result.accepted);
    const mismatches = await diff(pipe, truth, { accepted: result.accepted, rejected: result.rejected, card: result.card });
    out.push({ id, domain: ref.domain, result, mismatches, scores: score(pipe, mismatches) });
  }
  return out;
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const usd = (x: number) => `$${x.toFixed(4)}`;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = s.length >> 1;
  return s.length % 2 ? s[i]! : (s[i - 1]! + s[i]!) / 2;
};

// Every judge "applies" verdict (returned or below the cutoff) against the reference. The cutoff
// table is scored against all reference groups, not only the ones the judge answered for, so its
// precision, recall and F1 mean the same thing as the accuracy table's: raising the cutoff can
// only lose true positives, never recover a group the judge never accepted.
export function calibration(rows: Compared[]) {
  const referenceGroups = rows.reduce((n, r) => n + r.scores.tp + r.scores.fn, 0);
  const vs: { conf: number; correct: boolean }[] = [];
  for (const r of rows) {
    const wrong = new Set(r.mismatches.filter((m) => m.cause === 'pipeline_only').map((m) => m.key));
    const missedBelowCutoff = new Set(r.mismatches.filter((m) => m.cause === 'below_cutoff').map((m) => m.key));
    const seen = new Set<string>();
    for (const d of [...r.result.accepted, ...r.result.rejected.filter((d) => d.rejectReason === 'below_cutoff')]) {
      if (seen.has(d.group)) continue;
      seen.add(d.group);
      const returned = d.rejectReason !== 'below_cutoff';
      vs.push({ conf: d.confidence, correct: returned ? !wrong.has(d.group) : missedBelowCutoff.has(d.group) });
    }
  }
  const edges = [0, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.01];
  const bins = edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1]!;
    const inBin = vs.filter((v) => v.conf >= lo && v.conf < hi);
    return { from: lo, to: Math.min(hi, 1), n: inBin.length, correct: inBin.filter((v) => v.correct).length, share: inBin.length ? inBin.filter((v) => v.correct).length / inBin.length : null };
  });
  const cutoffs = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((t) => {
    const kept = vs.filter((v) => v.conf >= t);
    const tp = kept.filter((v) => v.correct).length;
    return { cutoff: t, ...metrics(tp, kept.length - tp, referenceGroups - tp) };
  });
  const chosen = cutoffs.reduce((a, b) => (b.f1 > a.f1 ? b : a));
  return { verdicts: vs.length, referenceGroups, bins, cutoffs, chosenCutoff: chosen.cutoff };
}

export function costTable(rows: Compared[], reference: Reference) {
  const costs = rows.map((r) => r.result.costUsd);
  const total = costs.reduce((a, b) => a + b, 0);
  const inTok = rows.reduce((n, r) => n + r.result.usage.total.input, 0);
  const cached = rows.reduce((n, r) => n + r.result.usage.total.cached, 0);
  const outTok = rows.reduce((n, r) => n + r.result.usage.total.output, 0);
  const profileTok = rows.reduce((n, r) => n + r.result.usage.profile.input, 0);
  const judgeTok = rows.reduce((n, r) => n + r.result.usage.judge.input, 0);
  const mean = rows.length ? total / rows.length : 0;
  const max = Math.max(0, ...costs);
  return {
    manufacturers: rows.length,
    totalUsd: total,
    meanUsd: mean,
    medianUsd: median(costs),
    maxUsd: max,
    maxDomain: rows.find((r) => r.result.costUsd === max)?.domain ?? '-',
    inputTokens: inTok,
    cachedTokens: cached,
    outputTokens: outTok,
    cacheHitShare: inTok ? cached / inTok : 0,
    profileShareOfInput: inTok ? profileTok / inTok : 0,
    judgeShareOfInput: inTok ? judgeTok / inTok : 0,
    projected30k: mean * 30_000,
    // OpenAI Batch API: 50% off input and output. Valid as a straight halving only because the
    // measured prompt-cache share is 0%; with cache hits the batch total must be recomputed from
    // raw tokens, since batch requests do not get cache discounts.
    projected30kBatchApi: mean * 30_000 * 0.5,
    referenceBuildUsd: (reference.cost?.jevUsd ?? 0) + (reference.cost?.arbiterUsd ?? 0),
  };
}

export function buildReport(rows: Compared[], reference: Reference) {
  const cal = calibration(rows);
  const cost = costTable(rows, reference);
  const overall = metrics(rows.reduce((n, r) => n + r.scores.tp, 0), rows.reduce((n, r) => n + r.scores.fp, 0), rows.reduce((n, r) => n + r.scores.fn, 0));
  const allMismatches = rows.flatMap((r) => r.mismatches.map((m) => ({ ...m, domain: r.domain })));
  const missed = allMismatches.filter((m) => m.cause !== 'pipeline_only');
  const causes = [...new Set(missed.map((m) => m.cause))].sort().map((cause) => ({ cause, n: missed.filter((m) => m.cause === cause).length }));

  const lines: string[] = [];
  lines.push(`# Eval report`, ``, `Generated ${new Date().toISOString()}. Pipeline: ${config.MODEL_PIPELINE}, prompts profile ${config.prompts.profile} / judge ${config.prompts.judge}, query mode ${config.QUERY_MODE}, cutoff ${config.CUTOFF}. Reference: artifacts/reference.json (${reference.generatedAt.slice(0, 10)}): ${reference.method} Every number comes from rows in artifacts/tagging.sqlite; rerun \`npm run cli -- report\` to regenerate.`, ``);
  lines.push(`## Accuracy (per sibling group)`, ``, `| TP | FP | FN | Precision | Recall | F1 |`, `|---|---|---|---|---|---|`, `| ${overall.tp} | ${overall.fp} | ${overall.fn} | ${pct(overall.precision)} | ${pct(overall.recall)} | ${pct(overall.f1)} |`, ``);
  lines.push(`| Manufacturer | Status | Returned | Reference | Missed | Wrong | P | R | F1 |`, `|---|---|---|---|---|---|---|---|---|`);
  for (const r of rows) {
    // A manufacturer with no reference groups and no tags scores nothing; 100% there would be a lie.
    const s = r.scores.tp + r.scores.fp + r.scores.fn ? `${pct(r.scores.precision)} | ${pct(r.scores.recall)} | ${pct(r.scores.f1)}` : `- | - | -`;
    lines.push(`| ${r.domain} | ${r.result.status} | ${r.result.accepted.length} | ${r.scores.tp + r.scores.fn} | ${r.scores.fn} | ${r.scores.fp} | ${s} |`);
  }
  lines.push(``, `## Why the misses happen`, ``, `The ${overall.fn} missed groups by the stage that lost them (the ${overall.fp} wrong tags are listed separately below).`, ``, `| Cause | Groups |`, `|---|---|`);
  for (const c of causes) lines.push(`| ${c.cause} | ${c.n} |`);
  lines.push(``, `Missed groups by manufacturer:`, ``);
  for (const r of rows.filter((r) => r.mismatches.some((m) => m.cause !== 'pipeline_only'))) lines.push(`- ${r.domain}: ${r.mismatches.filter((m) => m.cause !== 'pipeline_only').map((m) => `${m.names.join(' / ')} (${m.cause})`).join('; ')}`);
  lines.push(``, `Wrong groups by manufacturer (${overall.fp} in total):`, ``);
  for (const r of rows.filter((r) => r.mismatches.some((m) => m.cause === 'pipeline_only'))) lines.push(`- ${r.domain}: ${r.mismatches.filter((m) => m.cause === 'pipeline_only').map((m) => m.names.join(' / ')).join('; ')}`);
  lines.push(``, `## Calibration (judge confidence vs reference, ${cal.verdicts} "applies" verdicts)`, ``, `The judge scores only what it accepted; the cutoff table below is scored against all ${cal.referenceGroups} reference groups, so it is comparable with the accuracy table above.`, ``, `| Confidence | n | Correct | Share |`, `|---|---|---|---|`);
  for (const b of cal.bins) lines.push(`| ${b.from.toFixed(2)} to ${b.to.toFixed(2)} | ${b.n} | ${b.correct} | ${b.share == null ? '-' : pct(b.share)} |`);
  lines.push(``, `| Cutoff | Precision | Recall | F1 |`, `|---|---|---|---|`);
  for (const c of cal.cutoffs) lines.push(`| ${c.cutoff} | ${pct(c.precision)} | ${pct(c.recall)} | ${pct(c.f1)} |`);
  lines.push(``, `Best-F1 cutoff: **${cal.chosenCutoff}**. Config CUTOFF = ${config.CUTOFF}.`, ``);
  lines.push(`## Cost`, ``, `| | |`, `|---|---|`);
  lines.push(`| Manufacturers | ${cost.manufacturers} |`, `| Total pipeline cost | ${usd(cost.totalUsd)} |`, `| Mean / median / max per manufacturer | ${usd(cost.meanUsd)} / ${usd(cost.medianUsd)} / ${usd(cost.maxUsd)} (${cost.maxDomain}) |`);
  lines.push(`| Input tokens (cached share) | ${cost.inputTokens.toLocaleString('en-US')} (${pct(cost.cacheHitShare)}) |`, `| Output tokens | ${cost.outputTokens.toLocaleString('en-US')} |`, `| Profile / judge share of input | ${pct(cost.profileShareOfInput)} / ${pct(cost.judgeShareOfInput)} |`);
  lines.push(`| Projected for 30,000 manufacturers | ${usd(cost.projected30k)} (Batch API: ${usd(cost.projected30kBatchApi)}) |`, `| One-off cost of building the reference set | ${usd(cost.referenceBuildUsd)} |`, ``);

  return { report: lines.join('\n') + '\n', calibration: { generatedAt: new Date().toISOString(), ...cal }, overall, causes, cost };
}

export function writeReport(out: ReturnType<typeof buildReport>) {
  writeFileSync(`${config.ARTIFACTS_DIR}/report.md`, out.report);
  writeFileSync(`${config.ARTIFACTS_DIR}/calibration.json`, JSON.stringify(out.calibration, null, 2) + '\n');
}
