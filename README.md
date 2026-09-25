# Manufacturer Category Tagging Service

Take-home for Keychain (AI Engineer). Given a `manufacturer_id`, returns the taxonomy category ids that apply, from the scraped website in the provided SQLite, each with a verbatim quote, a confidence and the measured cost of producing it.

Node.js 22 + TypeScript. No frontend (the brief excludes it).

## Run it

```
npm install                       # native deps: better-sqlite3, onnxruntime (approve install scripts if npm asks)
npm run cli -- index              # taxonomy index: loads the committed one in a second, ~30 s to rebuild
npm run cli -- tag 902            # one manufacturer, replay mode: answers come from artifacts/replay, no key
npm run cli -- tag 902 --json     # the same result in the API shape
npm run cli -- tag-all            # all 30, prints status, entity type, count and cost per manufacturer
npm run cli -- report             # score the stored results against artifacts/reference.json, no model calls
npm run cli -- serve --port 3000  # HTTP API (contract below)
npm run cli -- search "Kaffeebohnen" 5   # the retrieval side on its own, with dense and BM25 scores
npm test                          # 80 tests; the ones that need the local model skip themselves when it is absent
```

Default mode is **replay**: every model response the pipeline needs is committed under `artifacts/replay/`, so the whole run reproduces with no API key, and a miss is an error rather than a billed call. To run live, copy `.env.example` to `.env`, set `OPENAI_API_KEY` **and** `LLM_MODE=live`; nothing else can spend money.

The embedding model is a separate matter: it is not a key, it is a 118 MB download into `.model-cache/`, and **any** first run that retrieves or scores needs it — replay included. `.model-cache/` is gitignored, so budget one download per clone. `report` reads the stored results in `artifacts/tagging.sqlite` (also gitignored), so run `tag-all` before it on a fresh clone; it refuses rather than reporting a perfect score over nothing.

Never run two live `tag-all` processes against one `tagging.sqlite`. Cache rows are immutable now (`insert or ignore`), so the second process can no longer rewrite the first one's evidence, but the two runs still interleave their own answers into one `results` table (learned the hard way, AI_LOG.md entry 12).

## The short version

1. **Clean** the markdown with string rules only: drop repeated nav lines, keep image alt text, drop placeholder URLs. 17.8M chars become 5.9M (33%).
2. **Read everything.** The cleaned site goes to `gpt-6-luna` at low reasoning effort in windows of ~10K tokens, in parallel, then one merge call produces a **card**: entity type, products with verbatim quotes and storage words, capabilities, brands. Code checks every quote against the text (after normalising quotes, dashes, markdown); a quote that is not there drops its product.
3. **Shortlist.** Each product and capability name is a query against the 1,424 categories: local multilingual embeddings plus BM25 over name + definition, fused by reciprocal rank. Storage siblings (Frozen X / Refrigerated X / X) are pulled in together so the judge sees the contrast.
4. **Judge** the shortlist in batches of 30 with the same cached prefix; per candidate `applies`, `confidence`, `reason`, and a `quote` when it applies. Code drops any id that was not in the batch and flips any `applies` whose quote is not in the evidence.
5. **Policy** in code: unevidenced storage variants move to the bare sibling; below-cutoff verdicts are stored as rejected; marketplaces and investors return an empty list with status `not_a_manufacturer` (Keychain confirmed that is the correct answer).
6. **Store** everything (card, accepted and rejected with reasons, usage per call, cost, prompt and model versions) in `artifacts/tagging.sqlite`; the LLM cache doubles as the replay source.

Why this shape and not one big prompt: the site is multilingual and noisy, so a short English card is a far better retrieval query than raw pages; retrieve-then-judge keeps every model decision over a list it was shown, so an invented category id is impossible; and every accepted category carries a quote a reviewer can check in seconds, which matches how Keychain said they score (a human review pass).

## Service contract

`npm run cli -- serve --port 3000`. One manufacturer is the unit of work; a full-base run is a job over many of them, because 30,000 blocking HTTP calls is not a batch interface.

| Route | Body / query | Returns |
|---|---|---|
| `POST /v1/tagging-jobs` | `{ manufacturer_ids: [902, 507] }` or `{ all: true }`, optional `force` | `202 { job_id, manufacturers }` |
| `GET /v1/tagging-jobs/:id` | — | `200 { job_id, status, counts: { total, pending, done, failed }, cost_usd, manufacturers: { "902": { status, result_key, status_detail, cost_usd, error? } }, created_at, updated_at }`, or `404 { error: "job_not_found" }` |
| `GET /v1/manufacturers/:id/categories` | — | `200` the result below, or `404 { error: "not_tagged" }` |
| `POST /v1/manufacturers/:id/tag` | `?wait=true` runs it now, `?force=true` ignores the stored row | `200` the result, `502` with the same body if the pipeline errored, `404 { error: "unknown_manufacturer" }`; without `wait`, `202 { job_id }` |
| `GET /healthz` | — | `200 { ok, mode }` |

The result is one shape everywhere (`src/api/serialize.ts`), and `npm run cli -- tag 902 --json` prints exactly it:

```json
{ "manufacturer_id": 902, "status": "tagged", "entity_type": "both",
  "categories": [{ "id": 2564, "name": "Energy Drink", "confidence": 0.99, "quote": "energy drinks",
                   "reason": "The evidence explicitly names energy drinks among the beverages Krier packs for clients.",
                   "quote_match": "exact", "retrieval_score": 0.0328 }],
  "rejected": [{ "id": 2617, "name": "Functional Beverage", "confidence": 0.99,
                 "reason": "quote_not_found: functional beverages", "reject_reason": "judge_rejected" }],
  "evidence": { "rawChars": 176888, "cleanedChars": 58553, "chunks": 103, "windows": 2,
                "judgeEvidenceChars": 8817, "quotes": { "exact": 25, "fuzzy": 0, "none": 0 },
                "shortlist": 120, "batches": 5, "unknownIds": 0, "repeatedIds": 0 },
  "usage": { "total": { "input": 42897, "cached": 0, "output": 8224, "reasoning": 1418 } },
  "cost_usd": 0.0084,
  "versions": { "judge": "v2", "modelPipeline": "gpt-6-luna", "cutoff": "0.6", "taxonomyHash": "98c0f1ae..." },
  "duration_ms": 646, "cached": false, "error": null }
```

`status` is one of `tagged`, `no_confident_category`, `not_a_manufacturer`, `insufficient_content`, `error`. Every rejected category keeps its reason, so a reviewer can see what was considered and why it was dropped, not only what came back.

## How to read the code

Two entry points, one pipeline behind both. `src/cli.ts` is the whole surface: it parses a command,
builds `deps` (source database, artifacts store, LLM client, taxonomy index) and calls into the
pipeline. `src/api/server.ts` builds the same `deps` into a Fastify app. Everything else is called
from `src/pipeline/tag.ts`, which is the one function worth reading first — it is the pipeline,
in order, in 60 lines.

```
cli.ts <command>                         api/server.ts  buildApp(deps)
      │                                        │
      │                                        ├─ api/routes.ts    one handler per route
      │                                        └─ api/jobs.ts      queue, N workers, resumes on restart
      ▼                                        ▼
                         pipeline/tag.ts  tag(deps, manufacturerId)
                                   │
   step 1  text/clean.ts      clean(markdown)          drop nav repeats, keep alt text      [code]
   step 2  text/chunk.ts      chunk(lines)             ~1,000-char chunks in site order     [code]
   step 3  pipeline/profile.ts profile(llm, chunks)    windows() -> N parallel model reads  [model]
   step 5      "              (same call)              one merge call -> the card           [model]
           "                  verifyCard()             every quote must be in the text      [code guard]
   step 6  pipeline/shortlist.ts shortlist(card, index)  retrieve() per phrase, fuse, cap    [code]
              index/taxonomy.ts   searchHybrid()         dense (e5) + BM25, RRF             [code]
   step 7  pipeline/judge.ts   evidenceBlocks()         site head + chunks holding a quote  [code]
           "                   batches()                groups of <=30, siblings together  [code]
           "                   judge()                  one model call per batch            [model]
   step 8      "               (same call)              id in batch? quote real?            [code guard]
   step 9  pipeline/policy.ts  applyPolicy(verdicts)    storage rule, cutoff, entity gate   [code]
   step 10 db/store.ts         results.put()            one row, with card, usage and cost  [code]
```

Every model call goes through one seam, `src/llm/client.ts` `complete()`, which caches by a hash of
the whole request — that cache is what `artifacts/replay/` is an export of, and why a re-run costs
nothing. `src/eval/` is off to the side: it reads stored rows and scores them, and is never called
by the pipeline.

Each source file opens with a comment saying which step it is, who calls it and what it calls next,
so the chain above can be followed in the code itself.

## Key decisions and trade-offs

| Decision | Alternative considered | Why this one |
|---|---|---|
| Read the whole site; no chunk selection | A scored subset under a character budget (built, measured, removed) | The brief grades correctness; a subset reader silently drops products the model never sees. Measured on all 30 sites: selection lost 3x the run-to-run noise floor at every budget. See Results |
| `gpt-6-luna` for every pipeline call, low effort for extraction | `gpt-5.6-luna` (used for the first full run), `gpt-5-nano` / `gemini-3.7-flash` / `claude-haiku-4-5` | Owner's call after a price and capability comparison (docs/RESEARCH.md); the switch from 5.6 to 6 luna halves the price ($0.10 / $0.01 / $0.50 per 1M input / cached / output, read 2026-09-24) with the same 1M context and effort settings. The model id is part of every result key, so both runs are stored |
| Hybrid retrieval (dense + BM25, RRF) with sibling expansion | Substring match on names; dense only | 249 category names are substrings of other names ("Italian" the dressing); German and French product names only match on the dense side (Kaffeebohnen -> Coffee Beans) |
| Judge in batches of ~30, sibling groups never split | One call with all candidates | Long lists lose the middle; identical prefix across batches is served from the prompt cache |
| Reason on every verdict, not only on `applies` | Reason only when applies (smaller output) | Owner's decision after seeing unexplained rejections; ~$0.0007 more per batch and every rejection is now auditable (Krier's "sodas" were rejected because the taxonomy only has flavoured sodas) |
| Shortlist cap = max(120, 3 x card phrases) | Fixed 120 | A site with 110 products lost hits under a fixed cap; accepted went from 54 to 78 on interamericanproducts.com |
| Storage rule moves an unevidenced variant to the bare category at full confidence, or keeps the strongest variant flagged `storage_inferred` | Multiply confidence by 0.7 | 285 base names exist only in qualified form; a penalty would have let the cutoff silently drop a fifth of the taxonomy |
| A committed reference set (`artifacts/reference.json`), built once from an independent model (TypeSafe Jev) over all 1,424 categories with every disagreement settled by `gpt-6-sol` | Hand labelling; Jev on our own shortlist; a stronger model as the judge | No answer key was provided; a reference that shares our retrieval would inherit our misses; Jev alone over-tags (the arbiter sided with the pipeline on 316 of 416 disagreements). Neither model is in the pipeline and neither is needed to run the eval |
| Confidence stored, cutoff checked against the reference, not trusted | Hard threshold at 0.6 | Self-reported confidence is poorly calibrated; the calibration table shows it is not a useful dial on this model |

Full reasoning, diagrams and the guards / guardrails / evals table: [ARCHITECTURE.md](ARCHITECTURE.md).

## Results

Every number below is reproduced by the command named beside it; the full tables are in `artifacts/report.md` (`npm run cli -- report`, no model calls).

**Reference set.** No answer key was provided, so one was built once and committed as `artifacts/reference.json`: TypeSafe's Jev answered one yes/no question per category (all 1,424) for each manufacturer with the pipeline's own card as state ($0.17), every disagreement with the pipeline was settled by `gpt-6-sol` with the full definition in view (416 verdicts, $4.15), and the five marketplaces / investors have an empty reference by Keychain's answer. Result: 391 known-correct sibling groups over 25 tagged manufacturers; the arbiter sided with the pipeline on 316 of the 416 disagreements, so Jev alone would have been a poor judge. Neither model is in the pipeline and neither is needed to run the eval.

**Accuracy** (per sibling group, all 30 manufacturers, `gpt-6-luna`, judge prompt v2):

| TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---|---|---|
| 307 | 16 | 84 | 95.0% | 78.5% | 86.0% |

Where the 84 misses come from: 60 the judge rejected although the category applies (it reads definitions narrowly: "confectionery coating" was not recognised as `Chocolate / Candy Melts`, "distilled water" not as `Purified Water`), 18 that were on the card but never reached the judge (`not_in_shortlist`, the retrieval side), 4 the card itself missed, 2 flipped by the quote guard. The 16 wrong tags are listed by manufacturer in the report.

**Three tested changes that were rejected, and what they cost to find out.** Each one bought recall and paid for it in precision — the pipeline is sitting on its precision/recall frontier.

| Change | Why it should have worked | Measured | Verdict |
|---|---|---|---|
| Judge prompt v3: "match by the definition's scope, not its wording" ($0.43) | 60 of the 84 misses are the judge reading a definition more narrowly than the arbiter | P 89.7 R 84.7 **F1 87.1** | Rejected: −5 precision for +6 recall, F1 gain inside the noise floor |
| `k` 8 → 16, shortlist cap 120 → 600 ($0.55) | 18 misses never reach the judge at all; offline this cuts them to 6 | P 89.9 R 81.8 **F1 85.7**, $795 per 30K | Rejected: it worked (`not_in_shortlist` 18 → 4, TP +13) but brought 20 new false positives and cost 56% more |
| `evidenceBlocks` using the same quote matcher as the guard ($0.18) | 12 of 1,235 card quotes contribute no evidence block | P 94.7 R 77.2 **F1 85.1** | Rejected: `quote_not_found` 2 → 1 as intended, but more evidence made the judge stricter, `judge_rejected` 60 → 66 |

Full sweeps in `artifacts/retrieval-study.json`, including the definition-length sweep (0 / 200 / 400 / 600 / 800 / 1,000 / 1,500 chars and the whole definition miss 25 / 27 / 29 / 26 / 29 / 22 / 20 / 25 groups — no trend, so the shipped 1,000 stays and the best single number is not chased).

**Retrieval query text** (`artifacts/query-mode-study.json`, zero model cost): querying with the product name misses 22 of the 391 reference groups at the shortlist stage; name + quote also 22 (at a slightly smaller shortlist, 133 against 140); a conditional mix 25. `QUERY_MODE=name` stays.

**Calibration** (`artifacts/calibration.json`): the judge never reports a confidence below 0.7 and 85% of its "applies" verdicts sit at 0.95 or above, so cutoffs 0.5, 0.6 and 0.7 give identical results (F1 86.0%) and `CUTOFF=0.6` stays; at 0.95 recall falls to 68.0% for one point of precision. The cutoff table is scored against all 391 reference groups, so it is the same metric as the accuracy table above. Confidence is not a useful dial on this model; the quote and the reason are what a reviewer should read.

**Full read vs a scored subset** (`artifacts/budget-study.json`, measured with `gpt-5.6-luna`): two full reads of the same site disagree on 90 of 919 products (9.8%), the noise floor. Reading a scored subset at 16K / 32K / 64K chars lost 307 of 862, 305 of 837 and 199 of 664 products on the sites over budget, beyond the floor on 15 / 16 / 13 of them; the code for it was removed. Cleaned sites are median 110K chars (14 over 128K, 7 over 256K, 3 over 512K), so a larger budget is a full read for most sites and cuts exactly the product-rich ones.

**Cost** (`gpt-6-luna`, live run of all 30):

| | |
|---|---|
| Total for 30 manufacturers | $0.51 (the same run on `gpt-5.6-luna`: $1.01) |
| Mean / median / max per manufacturer | $0.017 / $0.012 / $0.075 (bigbrandsllc.com, 121 products) |
| Input / output tokens | 3.23M / 374K; window reads 47% of input, judge 53% |
| Projected for 30,000 manufacturers | $510; $255 on the Batch API (computed, not wired) |
| Prompt cache hits | 0%. On GPT-5.6+ the cache needs an explicit breakpoint (`prompt_cache_options`) and charges writes at 1.25x; the judge prefix is reused 2 to 12 times per site, an estimated 10 to 15% saving not yet taken |
| One-off cost of the reference set | $4.32 |

**Reproducibility**: a copy of the repo with no `.env`, no database and no model cache reproduced all 30 results from `artifacts/replay/` with the identical cost total.

## Assumptions

Each is a config value or a single policy function, so it can be flipped in the walkthrough.

| # | Assumption | Why |
|---|---|---|
| A1 | A tag means "this company makes or can make this product". Co-packers are tagged on the product types they state they make for clients | Keychain matches brands to manufacturers; a co-packer with no tags is invisible to the search it exists for |
| A2 | Marketplaces and investors do not inherit the products they list or own; they return an empty list with status `not_a_manufacturer` (`NON_MANUFACTURER_POLICY=empty`) | Confirmed by the team, see below. An industrial group that owns operating brands and factories is a manufacturer, not an investor (a catch from the live run, AI_LOG.md entry 12) |
| A3 | Return every category the judge accepts above a calibrated cutoff, slight lean to recall; every category carries a confidence so a reviewer can sort | The team scores by a human review pass; a wrong tag is caught faster by a reviewer than a missing one |
| A4 | When the site does not state a storage state, prefer the unqualified category if one exists; otherwise return the strongest variant at its confidence, flagged `storage_inferred` | 440 of 1,424 categories are Frozen / Refrigerated / Shelf Stable variants and sites rarely say |
| A5 | Categories with the same name and different ids are distinct; the definition decides (both are returned when both apply) | Their definitions differ (Pumpkin Butter 1416 / 1487, Tea Mix 1699 / 1710 ...) |
| A6 | Each manufacturer id is tagged independently; results are keyed by manufacturer id + content hash + taxonomy hash + prompt, model, cutoff and policy versions | Johnvince Foods appears twice: identical content reuses every model call through the cache (the answer costs nothing the second time) but is still filed under its own id |
| A7 | One-time offline work over the taxonomy (embeddings, sibling groups) is fair and amortised | Brief section 2 leaves precomputing to me |
| A8 | Unit of work is one manufacturer; a full-base run is a batch of those | Brief section 4 |

Questions sent to the team and their answers (received 2026-09-24):

1. How is the comparison scored? **A human review pass** over the returned categories. Default kept (A3).
2. For the non-manufacturers (needl.co, spcap.com, brynwoodpartners.com), is the known-correct set empty? **Yes, empty.** Default kept (A2).

## What I chose not to build

See [ARCHITECTURE.md section 10](ARCHITECTURE.md#10-not-built-on-purpose). In short: no vector database (1,424 x 384 floats fit in a file), no queue or workers beyond an in-process table-backed runner, no frontend, no fine-tuning, no second-opinion model in the request path.

## With more time

The measurements above say where the remaining headroom is and, just as usefully, where it is not. Retrieval, the evidence bundle and a looser judge prompt have each been bought and returned; 60 of the 84 misses are one thing — the judge reading a definition more narrowly than the arbiter did — and that is where I would spend next.

- **A second opinion on rejections only.** Re-ask a stronger model about the rejections whose retrieval score is high and whose reason is "the site does not use this word". That targets the 60 without touching the 307 already correct, so precision cannot fall the way it did in all three rejected experiments. At ~200 such rejections it is a few cents per 30 manufacturers.
- A second judge pass on `not_a_manufacturer` results with a human in the loop: the entity gate is the one decision the reference cannot check (see the mzb-group.com catch).
- Batch API for full-base runs (50% off, computed in the cost table but not wired).
- Per-flavour categories (Orange Soda, Cherry Cola) need the site to name flavours; a "generic soda" fallback would need a taxonomy change, so it is reported, not patched.

## Repo map

| Path | What |
|---|---|
| `docs/ASSIGNMENT.md` | the brief |
| `ARCHITECTURE.md` | dataset facts, design, diagrams, guards and evals |
| `docs/plans/` | the approved implementation plan (14 units) |
| `docs/RESEARCH.md`, `docs/probes/` | company and prior-art notes; the two design probes with their unedited output |
| `AI_LOG.md` | AI usage log (deliverable 7): every prompt verbatim, decisions, catches |
| `src/` | `text/` cleaning and chunking, `index/` embeddings and retrieval, `pipeline/` profile / shortlist / judge / policy / tag, `llm/` client, pricing and replay, `db/` the read-only source and the artifacts store, `api/` Fastify, `eval/` comparison against the reference set and the report |
| `test/` | 15 files, 80 tests, mirroring `src/`; the ones that need the local embedding model skip themselves |
| `src/prompts/` | versioned prompt files; the version is part of every cache key |
| `artifacts/` | taxonomy index, replay files, dev set, reference set, the budget / query-mode / retrieval studies, report, spot check, calibration (`tagging.sqlite` is gitignored) |
| `data/` | the provided SQLite, opened read-only |
