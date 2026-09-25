# Manufacturer Category Tagging Service

Take-home for Keychain (AI Engineer). Given a `manufacturer_id`, returns the taxonomy category ids that apply, from the scraped website in the provided SQLite, each with a verbatim quote, a confidence and the measured cost of producing it.

Node.js 22 + TypeScript. No frontend (the brief excludes it).

## Run it

```
npm install                       # native deps: better-sqlite3, onnxruntime (approve install scripts if npm asks)
npm run cli -- index              # taxonomy index from local embeddings, ~30 s, no key needed (committed in artifacts/)
npm run cli -- tag 902            # one manufacturer, replay mode: answers come from artifacts/replay, no key
npm run cli -- tag 902 --json     # the same result in the API shape
npm run cli -- tag-all            # all 30, prints status, entity type, count and cost per manufacturer
npm run cli -- serve --port 3000  # HTTP API (contract below)
npm run cli -- report             # score stored results against artifacts/reference.json, no model calls
npm test                          # 68 tests; the ones that need the local model skip themselves when it is absent
```

Default mode is **replay**: every model response the pipeline needs is committed under `artifacts/replay/`, so the whole run reproduces with no key. To run live, copy `.env.example` to `.env`, set `OPENAI_API_KEY` and `LLM_MODE=live`. The first live run downloads the embedding model (118 MB) into `.model-cache/`.

Never run two live `tag-all` processes against one `tagging.sqlite`: both write the same cache keys and the replay files stop matching the stored results (learned the hard way, AI_LOG.md entry 12).

## The short version

1. **Clean** the markdown with string rules only: drop repeated nav lines, keep image alt text, drop placeholder URLs. 17.8M chars become 5.9M (33%).
2. **Read everything.** The cleaned site goes to `gpt-6-luna` at low reasoning effort in windows of ~10K tokens, in parallel, then one merge call produces a **card**: entity type, products with verbatim quotes and storage words, capabilities, brands. Code checks every quote against the text (after normalising quotes, dashes, markdown); a quote that is not there drops its product.
3. **Shortlist.** Each product and capability name is a query against the 1,424 categories: local multilingual embeddings plus BM25 over name + definition, fused by reciprocal rank. Storage siblings (Frozen X / Refrigerated X / X) are pulled in together so the judge sees the contrast.
4. **Judge** the shortlist in batches of 30 with the same cached prefix; per candidate `applies`, `confidence`, `reason`, and a `quote` when it applies. Code drops any id that was not in the batch and flips any `applies` whose quote is not in the evidence.
5. **Policy** in code: unevidenced storage variants move to the bare sibling; below-cutoff verdicts are stored as rejected; marketplaces and investors return an empty list with status `not_a_manufacturer` (Keychain confirmed that is the correct answer).
6. **Store** everything (card, accepted and rejected with reasons, usage per call, cost, prompt and model versions) in `artifacts/tagging.sqlite`; the LLM cache doubles as the replay source.

Why this shape and not one big prompt: the site is multilingual and noisy, so a short English card is a far better retrieval query than raw pages; retrieve-then-judge keeps every model decision over a list it was shown, so an invented category id is impossible; and every accepted category carries a quote a reviewer can check in seconds, which matches how Keychain said they score (a human review pass).

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

**Reference set.** No answer key was provided, so one was built once and committed as `artifacts/reference.json`: TypeSafe's Jev answered one yes/no question per category (all 1,424) for each manufacturer with the pipeline's own card as state ($0.17), every disagreement with the pipeline was settled by `gpt-6-sol` with the full definition in view (416 verdicts, $4.15), and the six marketplaces / investors have an empty reference by Keychain's answer. Result: 391 known-correct sibling groups over 30 manufacturers; the arbiter sided with the pipeline on 316 of the 416 disagreements, so Jev alone would have been a poor judge. Neither model is in the pipeline and neither is needed to run the eval.

**Accuracy** (per sibling group, all 30 manufacturers, `gpt-6-luna`, judge prompt v2):

| TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---|---|---|
| 307 | 16 | 84 | 95.0% | 78.5% | 86.0% |

Where the 84 misses come from: 60 the judge rejected although the category applies (it reads definitions narrowly: "confectionery coating" was not recognised as `Chocolate / Candy Melts`, "distilled water" not as `Purified Water`), 18 that were on the card but never reached the judge (`not_in_shortlist`, the retrieval side), 4 the card itself missed, 2 flipped by the quote guard. The 16 wrong tags are listed by manufacturer in the report.

**A tested change that was rejected.** A judge prompt v3 with a "match by the definition's scope, not its wording" rule, derived from the arbiter's reasons, was run on all 30 ($0.43): P 89.7% R 84.7% F1 87.1%. Recall up 6 points, precision down 5, F1 inside the 10% run-to-run noise floor; since Keychain scores by a human review pass, where a wrong tag costs reviewer time, v2 stays.

**Retrieval query text** (`artifacts/query-mode-study.json`, zero model cost): querying with the product name misses 22 of the 391 reference groups at the shortlist stage; name + quote also 22 (slightly smaller shortlists); a conditional mix 25. `QUERY_MODE=name` stays.

**Calibration** (`artifacts/calibration.json`): the judge never reports a confidence below 0.7 and 85% of its "applies" verdicts sit at 0.95 or above, so cutoffs 0.5, 0.6 and 0.7 give identical results and `CUTOFF=0.6` stays. Confidence is not a useful dial on this model; the quote and the reason are what a reviewer should read.

**Full read vs a scored subset** (`artifacts/budget-study.json`, measured with `gpt-5.6-luna`): two full reads of the same site disagree on 90 of 919 products (9.8%), the noise floor. Reading a scored subset at 16K / 32K / 64K chars lost 307 of 862, 305 of 837 and 199 of 664 products on the sites over budget, beyond the floor on 15 / 16 / 13 of them; the code for it was removed. Cleaned sites are median 110K chars (14 over 128K, 7 over 256K, 3 over 512K), so a larger budget is a full read for most sites and cuts exactly the product-rich ones.

**Cost** (`gpt-6-luna`, live run of all 30):

| | |
|---|---|
| Total for 30 manufacturers | $0.51 (the same run on `gpt-5.6-luna`: $1.01) |
| Mean / median / max per manufacturer | $0.017 / $0.013 / $0.075 (bigbrandsllc.com, 121 products) |
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
| A6 | Each manufacturer id is tagged independently; results are keyed by content hash + taxonomy hash + prompt and model versions | Johnvince Foods appears twice; identical content gets identical answers without a special case |
| A7 | One-time offline work over the taxonomy (embeddings, sibling groups) is fair and amortised | Brief section 2 leaves precomputing to me |
| A8 | Unit of work is one manufacturer; a full-base run is a batch of those | Brief section 4 |

Questions sent to the team and their answers (received 2026-09-24):

1. How is the comparison scored? **A human review pass** over the returned categories. Default kept (A3).
2. For the non-manufacturers (needl.co, spcap.com, brynwoodpartners.com), is the known-correct set empty? **Yes, empty.** Default kept (A2).

## What I chose not to build

See [ARCHITECTURE.md section 10](ARCHITECTURE.md#10-not-built-on-purpose). In short: no vector database (1,424 x 384 floats fit in a file), no queue or workers beyond an in-process table-backed runner, no frontend, no fine-tuning, no second-opinion model in the request path.

## With more time

- A second judge pass on `not_a_manufacturer` results with a human-in-the-loop prompt: the entity gate is the one decision the reference cannot check (see the mzb-group.com catch).
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
| `src/` | `text/` cleaning, `index/` embeddings and retrieval, `pipeline/` profile / shortlist / judge / policy / tag, `llm/` client and pricing, `api/` Fastify, `eval/` comparison against the reference set and the report |
| `src/prompts/` | versioned prompt files; the version is part of every cache key |
| `artifacts/` | taxonomy index, replay files, dev set, reference set, budget study, query-mode study, report, spot check, calibration (`tagging.sqlite` is gitignored) |
| `data/` | the provided SQLite, opened read-only |
