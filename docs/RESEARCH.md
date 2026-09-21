# Research notes

Gathered with an AI research agent on 2026-09-21. Links not yet all opened by hand; anything used as an argument in the README must be opened and checked first.

## Keychain

- Marketplace + data platform matching CPG brands and retailers with contract manufacturers. Claims 30,000+ manufacturers, 20,000+ brands and retailers. [Forbes](https://www.forbes.com/sites/douglasyu/2023/11/14/manufacturing-matchmaker-keychain-launches-with-18-million-in-seed-funding/), [TechCrunch](https://techcrunch.com/2023/11/14/cpg-manufacturing-platform-keychain-raises-18-million)
- Founders: Oisin Hanrahan (CEO) and Umang Dua (COO), both ex Handy / Angi; Jordan Weitz. [PR Newswire](https://www.prnewswire.com/news-releases/oisin-hanrahan-and-umang-dua-announce-18-million-in-seed-funding-to-build-international-platform-for-cpg-manufacturing-301986663.html)
- Funding: $18M seed, $15M Series A, $30M Series B. [AlleyWatch](https://www.alleywatch.com/2025/08/keychain-cpg-supply-chain-workflow-manufacturing-automation-platform-oisin-hanrahan/), [FoodBusinessNews](https://www.foodbusinessnews.net/articles/27206-keychain-raises-15-million-in-series-a)
- KeychainOS launched with the Series B: an "AI operating system" for CPG manufacturing workflows. [PR Newswire](https://www.prnewswire.com/news-releases/keychain-raises-30-million-series-b-and-launches-keychainos-an-ai-operating-system-set-to-power-the-future-of-cpg-manufacturing-302532859.html)
- Press says they indexed 760K+ products from 24K manufacturers with AI, and infer required processing / packaging equipment from product text to match against manufacturer capabilities. [AgFunderNews](https://agfundernews.com/from-handy-to-keychain-angi-of-cpg-tackles-biggest-pain-points-in-cpg-manufacturing), [Pulse2](https://pulse2.com/keychain-profile-oisin-hanrahan-interview/)
- Not found: engineering blog, tech stack, how they actually do category tagging. Nothing here should be presented as knowledge of their system.

Takeaway: tags feed matching. Capability matters as much as owned products.

## How others describe the same problem

| Company | What they describe | Link |
|---|---|---|
| Instacart | Retrieve top ~100 taxonomy nodes by ANN, LLM reranks, output constrained to the retrieved list, then validate | [Intent Engine](https://tech.instacart.com/building-the-intent-engine-how-instacart-is-revamping-query-understanding-with-llms-3ac8051ae7ac) |
| Shopify | 10K+ category taxonomy. Earlier: hierarchical descent with hierarchy-aware metrics. Now: several LLMs label, a judge model arbitrates, humans on edge cases | [Categorizing at scale](https://shopify.engineering/categorizing-products-at-scale), [Evolution](https://shopify.engineering/evolution-product-classification) |
| Mercari | LLM labels a sample (~10 candidates shown per item), then kNN over open-source multilingual embeddings does the volume. All-LLM was estimated at ~$1M | [Mercari Engineering](https://engineering.mercari.com/en/blog/entry/20240411-large-scale-item-categoraization-using-llm/) |
| DoorDash | Waterfall: string matching first, LLM for ambiguous cases, offline batch, smaller fine-tuned models for volume | [ZenML summary](https://www.zenml.io/llmops-database/building-a-food-delivery-product-knowledge-graph-with-llms) |
| Wayfair | Embed the LLM's output and match to real category embeddings to catch invalid labels | [Wayfair Tech](https://www.aboutwayfair.com/careers/tech-blog/teaching-wayfairs-catalog-to-see-style-an-llm-powered-style-compatibility-labeling-pipeline-on-google-cloud) |

## Techniques

- Infer, retrieve, rank (IReRa) and ICXML: LLM guesses labels, retriever maps guesses to real labels, LLM reranks. [ICXML](https://arxiv.org/pdf/2311.09649)
- Taxonomy-guided reasoning: put class definitions in the prompt. [arXiv 2503.12989](https://arxiv.org/pdf/2503.12989)
- "Hallucinate then match": let a small model name the category freely, embed, snap to nearest real node. [softwaredoug](https://softwaredoug.com/blog/2026/08/10/hypothetical-classifications)
- Hierarchy-aware evaluation: a sibling miss should cost less than an unrelated miss (Shopify)

## What none of them cover

Inputs this long. Every source classifies a short product title or query. Here the input is a whole website, so the evidence selection + profile step in ARCHITECTURE.md is the part with no reference design, and the part to be most careful about measuring.

## SDK and pricing facts (fetched 2026-09-22 by an AI research agent; re-check before quoting in README)

### OpenAI
- Model ids: `gpt-5.6-sol` (arbiter), `gpt-5.6-luna` (cost-optimised), `gpt-5.4-nano`, `gpt-5-nano`; strongest `gpt-6-astra`. https://developers.openai.com/api/docs/models
- Prices per 1M tokens, input / cached input / output: sol $4 / $0.40 / $20; luna $0.20 / $0.02 / $1.20; 5.4-nano $0.20 / $0.02 / $1.25; 5-nano $0.05 / $0.005 / $0.40. Batch: 50% off. https://developers.openai.com/api/docs/pricing
- Structured output: `openai.responses.parse` with `zodTextFormat(schema, name)`; `response.output_parsed`. `openai` npm 7.20.0, zod ^3.25 or ^4. https://developers.openai.com/api/docs/guides/structured-outputs
- Usage: `response.usage.input_tokens`, `output_tokens`, `input_tokens_details.cached_tokens`. Prompt cache minimum 1,024 tokens on GPT-5.6+. https://developers.openai.com/api/docs/guides/prompt-caching
- Batch API: JSONL upload, 24h window, 50,000 requests per batch. https://developers.openai.com/api/docs/guides/batch
- Not verified: the exact Response `usage` object schema page.

### TypeSafe (Jev)
- `@typesafe-ai/sdk` 0.6.0; `new TypeSafeClient()` reads `TYPESAFE_API_KEY`; default model `jev-latest`. https://docs.typesafe.ai/sdk/javascript.md
- Many yes/no questions over one state in one call: `client.systemOne({ state, questions: { q1: noul("..."), ... } })` -> `answers.q1.noul` in 0-1. Questions are independent and run in parallel. https://docs.typesafe.ai/primitives/noul.md
- Limits: 64k tokens per request, 32k for state + longest question; 250k tokens/s, 1,200 req/min. No documented cap on question count, so 1,424 questions are chunked across a few requests. https://docs.typesafe.ai/models.md
- Price: $0.042 per 1M input tokens, output free. Usage in `result.usage.input_tokens`.

### @huggingface/transformers
- v4.3.0. `pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' })`, then `extractor(texts, { pooling: 'mean', normalize: true })`, 384 dims. Quantised model ~118 MB, cached under `env.cacheDir`. https://huggingface.co/docs/transformers.js/api/pipelines

### better-sqlite3
- 13.0.3, Node >= 22, `new Database(path, { readonly: true })`. `node:sqlite` is still "active development" in Node 22, so better-sqlite3 it is.

## Alternatives pass (2026-09-22, AI research agent; links not yet opened by hand)

- Selection diversity: MMR / per-page caps so one page does not consume the budget. [Elastic on MMR](https://www.elastic.co/search-labs/blog/maximum-marginal-relevance-diversify-results)
- HyDE-style query generation for selection: adds an LLM call and hallucination risk; not needed when category definitions are embedded directly
- Embedding models: bge-m3 and jina-v3 score higher on multilingual benchmarks but are ~5x larger; jina-v3 has an open transformers.js request ([issue 1072](https://github.com/huggingface/transformers.js/issues/1072)). e5-small kept
- Hybrid BM25 + dense with RRF reported as the highest-impact upgrade over dense-only ([denser.ai](https://denser.ai/blog/hybrid-search-for-rag/), [arXiv 2604.01733](https://arxiv.org/html/2604.01733v1)); cross-encoder rerankers add 200 ms to 2.5 s per query ([onnxruntime issue](https://github.com/microsoft/onnxruntime/issues/19494))
- Lost-in-the-middle on long listwise prompts ([arXiv 2604.03642](https://arxiv.org/html/2604.03642)); mitigations: batching, ordering by score
- Self-reported confidence calibration is poor (ECE 0.05 to 0.61) ([survey](https://arxiv.org/html/2603.06604)); logprobs empty with structured outputs on the Responses API ([OpenAI community](https://community.openai.com/t/gpt-5-1-5-2-message-output-text-logprobs-is-empty-when-structured-outputs-json-schema-is-enabled-in-responses-api/1371927))
- Quote grounding: byte-exact checks fail on curly quotes and dashes; normalise then fuzzy tier
- LLM-as-judge bias: cross-family judging is the standard mitigation ([survey](https://arxiv.org/pdf/2604.23178)); a small human-labelled calibration set is treated as near-mandatory ([deepchecks](https://deepchecks.com/llm-judge-calibration-automated-issues/))

## Small-model comparison (fetched 2026-09-22 by an AI research agent from official pages; quality numbers from Artificial Analysis, not verified by hand)

| Model | In / cached / out $ per 1M | Context | Reasoning control | AA Intelligence Index v4 |
|---|---|---|---|---|
| `gpt-5.6-luna` | 0.20 / 0.02 / 1.20 | 1.05M | `reasoning.effort`: none, low, medium, high, xhigh, max | 32 (high) to 37 (max) |
| `gpt-5.4-mini` | 0.75 / 0.075 / 4.50 | 400K | none to xhigh | 24; IFBench 73% |
| `gpt-5.4-nano` | 0.20 / 0.02 / 1.25 | 400K | none to xhigh | not fetched |
| `gpt-5-nano` | 0.05 / 0.005 / 0.40 | 400K | levels not on page | 13; IFBench 67.5% |
| `gemini-3.7-flash` | 0.75 / 0.075 / 3.75 (doubles 2027-01-01) | 1.05M | `thinking_level` low / medium / high, cannot be off | 39 |
| `gemini-3.5-flash-lite` | 0.30 / 0.03 / 2.50 | 1.05M | minimal to high | not fetched |
| `claude-haiku-4-5` | 1.00 / 0.10 / 5.00 | 200K | `budget_tokens` thinking only | 15; IFBench 42% |

Sources: https://developers.openai.com/api/docs/models/gpt-5.6-luna, https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash, https://ai.google.dev/gemini-api/docs/pricing, https://platform.claude.com/docs/en/about-claude/pricing, https://artificialanalysis.ai/models/gemini-3-7-flash, https://artificialanalysis.ai/models/comparisons/gpt-5-6-luna-vs-gpt-5-4-mini, https://artificialanalysis.ai/models/gpt-5-nano, https://artificialanalysis.ai/models/claude-4-5-haiku

Verified: OpenAI Responses API `reasoning: { effort }` with `none | minimal | low | medium | high | xhigh | max`, not every model supports every value (https://developers.openai.com/api/reference/resources/responses/methods/create). Not found: any benchmark for multilingual extraction with verbatim quotes or JSON-schema adherence on these models.
