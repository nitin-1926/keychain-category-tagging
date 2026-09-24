# AI Usage Log

Entries were written during the work. Prompts are quoted in my words, trimmed for length.

Tools used: claude.ai (chat, first read of the brief and data), Claude Code (repo work).

### 1. First read of the brief and the database  (2026-09-21, claude.ai)  [CATCH]

**Prompt** (trimmed):
> What can you infer from this?? Do you see any caveats? How easy do you think it is? Do you think there are any questions I should ask them before starting the assignment?

Follow-ups:
> Can you please cross verify everything once before I ask them these questions? Maybe there is a hidden answer to any of these in the assignment instructions
>
> This is the full assignment. Please go through it now and re-verify everything.

**Response summary:** Profiled the SQLite (row counts, definition and markdown sizes, duplicate names, the Johnvince duplicate, marketplace / PE-firm sites, storage-state sibling categories, non-English sites, id gaps suggesting a leaf-only export) and proposed about 20 questions for the team.

**Verification:** I asked it to cross-verify its own findings, then had a second tool re-run the key queries independently (entry 2). Counts matched. The cross-check round produced corrections to its first answer, listed below.

**Outcome:** modified. What was wrong in the first answer:
- It said fragrance and supplement companies (Alpha Aromatics, InnoMark) had no valid category and should abstain. Wrong: `Perfume` (6249) and `Powder Supplements` (4328) exist, and their definitions place them under Fragrances / Supplements parents. Abstaining would have lost both. Found only after reading the actual definitions
- "Hundreds of storage-state triplets" was loose. Actual: 165 Frozen, 162 Refrigerated, 113 Shelf Stable names, 139 base names with more than one variant, mostly pairs
- It had only seen sections 5 to 8 of the brief (my paste was cut off) and still produced questions that sections 1 to 4 answer
- Token figures were chars/4, presented as token counts. Kept as rough lower bounds only

**Decision:** I did not send the 20 questions. The brief says to state assumptions where things are ambiguous, so almost everything became a stated assumption in the README. See entry 3 for the final cut.

### 2. Independent re-check of entry 1, company research, draft design  (2026-09-21, Claude Code)

**Prompt** (trimmed):
> go through everything, get equipped with what's required. Study the company and maybe there is some blog or resource on how they have implemented this or some competitor has done it [...] draft a final set of questions [...] setup a project/folder with ARCHITECTURE.md [...] README.md and AI_LOG.md

**Response summary:** Re-ran the dataset checks from scratch, researched Keychain and public write-ups of LLM taxonomy classification (Instacart, Shopify, Mercari, DoorDash, Wayfair), wrote a draft architecture and a question list.

**Verification:**
- Dataset numbers reproduced independently: 1424 / 30 / 30 rows, 4 duplicate names with the same id pairs, 165 / 162 / 113 qualifier counts, 3400 listing blocks on needl.co, 17.8M -> 5.8M chars (32%) after cleaning. One mismatch: chat said assemblers.com keeps 4% after cleaning, the re-run says 6% (different whitespace handling). Using the re-run number
- Research links: **not yet verified**. I will open each source before citing it in the README

**Outcome:** accepted as a draft. Nothing in ARCHITECTURE.md is measured except the numbers tagged (measured).

### 3. Scope and stack corrections  (2026-09-21, Claude Code)

**Prompt** (trimmed):
> Verify the questions that should be asked or not. I think we can trim 1-2 at least more. They also will be testing the assumptions [...] I prefer Node.js/JS + TS instead of fast api and python [...] They told no frontend but should we build it [...] Let's only keep what they asked and what is needed

**Response summary:** AI had defaulted to Python + FastAPI and had created extra documents (requirements file, questions file, decision journal) beyond what the brief asks for.

**Outcome:** modified.
- Stack changed to Node.js + TypeScript, my preferred stack and the one I will be extending live in the walkthrough
- Extra documents removed; assumptions moved into the README where the brief asks for them
- Questions cut from 5 + 4 optional to 2, because the assumptions themselves are being evaluated
- Frontend: I asked whether building one would help. AI recommended against: the brief says not to build one, and "what they chose not to build" is an evaluation criterion. Accepted

**Decision:** stack, document cleanup and the question cut were mine. The AI had picked a stack without asking. The no-frontend call was the AI's recommendation, which I agreed with after reading the brief's section 5 and 6 again.

### 4. TypeSafe skill install, and what "run decisions via Jev" means  (2026-09-21, Claude Code)

**Prompt** (verbatim; first part was TypeSafe's own install snippet, pasted):
> Install the TypeSafe skill. If you're in Claude Code, run `claude plugin marketplace add typesafe-ai/skills`, then `claude plugin install typesafe@typesafe-ai`. [...rest of TypeSafe's published install instructions...] Then use the TypeSafe skill when working on this project.
>
> After doing this tell me where to add the api key. Once I have added the api key, I want to run all the decisions taken in this session via jev and future as well.

**Response summary:** AI read the skill's source before installing (single SKILL.md, no hooks or scripts). Install failed: the git clone was blocked on this machine (HTTP 403). AI did not work around the block. Told me the key goes in `.env` as `TYPESAFE_API_KEY`.

**Questions the AI asked / owner's answers:**
- AI: does "run all the decisions via jev" mean (a) Jev makes the pipeline's per-category decisions, or (b) Jev reviews the design decisions of this session? Said (b) does not fit the tool: it returns probabilities, no reasoning.
- Me: (a). See entry 5.

**Verification:** plugin.json, marketplace.json and SKILL.md read from the repo before running the install command.

**Outcome:** not installed (blocked). Docs are readable, so the SDK can be used without the skill.

### 5. Jev as a reference run, and a process correction  (2026-09-21, Claude Code)  [CATCH]

**Prompt** (verbatim):
> Okay so 2 things here:
> 1. I was talking about - Jev makes the pipeline's decisions. But that basically nullifies the objective of the assignment and all. What I was thinking was to add it along with the original approach as well and let it run once and store that result and then we can work on optimising our algorithm and logic to be as close to Jev's output as possible? And then we can mention in readme.md that we tried this approach to validate or basically test our logic. What do you think about it?
> 2. How was ARCHITECTURE.md created? I didn't approve anything, nothing was discussed with me. No questions were asked. No brainstorming happened and all. Please follow particular steps and then only decide on things. Use /grill-me and then let's create a plan of what needs to be done using /compound-engineering:ce-plan and how we are approaching the problem and also make sure whatever question AI is asking or whatever decisions are made and whatever prompts I am writing as is go to into AI_LOG.md as well. Right?

**What was wrong (point 2):** I asked the AI to set up a project folder including an ARCHITECTURE.md. It filled that file with a complete design (two LLM calls, hybrid retrieval, API shape, stack) in one pass, asking me nothing. It looked finished and reasonable, which is the problem: none of it was a decision I had made or could defend. Same pattern as the Python/FastAPI pick in entry 3.

**What I did instead:** ARCHITECTURE.md is now marked "AI proposal, not approved". Only the measured dataset facts in it stand. Process from here: grill session on the design -> written plan -> my approval -> code. Every question the AI asks and my answer goes in this log, and my prompts are pasted as typed.

**On point 1 (Jev):** AI's view, which I am weighing in the grill session: do not tune the pipeline to match Jev. Jev is not ground truth, so matching it copies its mistakes, and Keychain scores against their own labels. Better use: run Jev once over the same candidates, store it, and use the *disagreements* between Jev and my pipeline to decide which manufacturer/category pairs I check by hand. Tuning is against my hand-checked set. Decision: pending, see next entry.

Note: entries 1 to 3 have trimmed prompts; from entry 4 on they are verbatim.

### 6. Design grill session  (2026-09-21, Claude Code, `grill-me` skill)

The AI asks one design question at a time with its recommendation; my answer is pasted as typed. Decisions here replace the unapproved ARCHITECTURE.md.

**Q1. What is the reference the pipeline is measured against while building?** Options: (a) hand-checked set of 8-10 manufacturers, with Jev-vs-pipeline disagreements choosing what to check; (b) Jev's output as the reference; (c) no reference, eyeball. AI recommended (a).

> b, wherever there is a mismatch that we will check with intelligent models on who is right or wrong.

Decision (mine, against the AI's recommendation): Jev run is the reference. Mismatches between my pipeline and Jev are arbitrated by a stronger reasoning model. AI's stated concern, which I accept as a known limit: cases where Jev and my pipeline agree are never examined, so a category both miss stays invisible, and the judge is itself a model. Whether to add a mitigation: Q1b, open.

**Q1b. How do I know the judge model is right?** Options: (a) I spot-check ~20 judge verdicts by hand across 3-4 manufacturers, plus 2 manufacturers where Jev and the pipeline fully agree; (b) trust the judge, state the limit. AI recommended (a).

> a

Decision: (a). Agreed with the AI's recommendation. The README accuracy claim will state how many judge verdicts I checked and how many I agreed with.

**Q2. What does a tag mean?** Options: (a) makes or can make, so co-packers are tagged on capability; (b) own-brand products only; (c) anything mentioned on the site. AI recommended (a).

> Firstly please ask interactively. Secondly, I don't understand this and want to discuss more on this. Considering I have to make an assumption and reason with it properly and justify it, i think co-packing should also be tagged right? and that's what keychain might be doing as well. I feel we can always have more list rather than skipping some manufacturer. What do you think? I think option a should work.

Decision: (a). My reasoning: Keychain matches brands to contract manufacturers, so a co-packer with no tags is invisible in the search it exists for; I would rather a manufacturer shows up than gets skipped. AI agreed on (a) but pushed back on "more is always better": if Keychain scores with precision or F1, every wrong tag costs points too, and a co-packer that says only "we fill beverages" could be matched to ~200 drink categories. So "can make" needs an evidence bar, which is Q3.

**Q3. How much evidence before a "can make" category is tagged?** Options: named product type on the site; process + format implies products; named type plus a low-confidence inferred tier. AI recommended named product type.

> Named product type (Recommended)

Decision: a category is tagged only when the site names that product type or a close synonym, and every tag carries the quote. "We fill beverages in cans" alone tags nothing specific. Accepted cost: thin co-packer sites may get few tags.

**Q4. What should the service return for the marketplace (needl.co) and the two PE firms?** Options: detect and return no categories; tag like anyone else; detect and tag with a cap. AI recommended detect + empty.

> I am yet to ask the 2 questions you mentioned to the keychain team. So untill I get a response for those, we can fix and finalise other things.

Decision: parked until the Keychain team replies (this and the scoring question). Everything that does not depend on those two answers gets decided now.

**Q5. How much of a site does the LLM read?** (A typical site is still ~48K tokens after free cleanup.) Options: select the most product-related parts under a token budget; read everything with a cheap model; select first and read more if the result is thin. AI recommended selection.

I did not answer straight away. My questions, as typed:

> Aren't we getting de-noised or markdown in manufacturer_scraped_data which is essential what we need to use to know about the manufacturer? I didn't understand the question?

> Do you think the risk is worth it? I mean how will we identify from code what products and co-packing and all are?? regex? pattern matching? what will be the accuracy of it?

AI's answers: the markdown is the only source but it is the whole site concatenated, not de-noised (only 32% survives removing blank / placeholder / repeated lines, and the median is still ~48K tokens). Selection is not regex: a local multilingual embedding model scores each ~1000-char piece by closeness in meaning to any category definition or to co-packing phrases. On accuracy the AI said it did not know and would not guess; it proposed measuring it: run "read everything" once on a few sites, then count how many of those products survive selection at 4K / 8K / 16K budgets.

> Select parts, measured against full read (Recommended)

Decision: meaning-based selection with a token budget, and the budget is chosen from a measured comparison against a full read, not assumed. If selection loses too much, add the "read more when thin" fallback. The AI's claim that real product lines repeat across many pages is an untested expectation until that measurement exists.

**Q6. From selected site text to a shortlist of categories?** Options: LLM call 1 lists products / capabilities / storage words with quotes, then code matches each phrase to its nearest ~10 categories; match raw site text directly with no first call; show the LLM all 1424 names. AI recommended the first.

> LLM lists products, then match each (Recommended)

Decision: a small-model "profile" call produces a structured list (products, co-packing capabilities, storage words, quote per item), and free code matches each product phrase to nearest categories. Shortlist is the union, expected 50-100. Reason: clean English phrases match better than mixed page text and the same step handles German / French.

**Q7. Shape of the judging call?** Options: one call with all candidates and per-candidate structured verdicts; one yes/no call per candidate; two-stage groups then leaves. AI recommended one call.

> One call, all candidates, structured verdicts (Recommended)

Decision: one call per manufacturer. Input: shortlist (name + definition trimmed), profile, quotes. Output per candidate: id, applies, confidence, quote. Code rejects ids outside the shortlist and quotes not found in the evidence.

**Q8. Frozen / Refrigerated / Shelf Stable variants when the site does not say?** Options: only what the site states; return all plausible variants; let the model guess. AI recommended only what the site states.

> Only what the site states (Recommended)

Decision: a qualified variant is tagged only when a storage word was found near the product. Otherwise the unqualified category if it exists; if only qualified variants exist, the most likely one at low confidence with the reason stated. May be revised by the team's scoring answer.

**Q9. Which LLM for the profile and judge calls?** Options: Claude small model for both, upgrade judge if eval says so; OpenAI small models; Jev as judge with Claude for profile. AI recommended Claude.

> OpenAI small models

Decision (mine): OpenAI. Same design, different SDK; the AI said there is no design difference. Model ids and prices to be read from the OpenAI pricing page at write-up time.

**Q10. Which model arbitrates pipeline-vs-Jev mismatches?** Options: strongest Claude model with full definition + evidence, separate prompt; same model as the pipeline judge. AI recommended the first.

> gpt sol model

Decision: an OpenAI model as arbiter; exact model id unclear from my answer, clarified in Q10b.

**Q11. How does a reviewer run it without a key, and how is cost measured?** Options: live / replay / stub client modes with usage read from API responses; stub only. AI recommended the first.

> Record/replay + stub, usage from API responses (Recommended)

Decision: three client modes. Replay uses committed JSON of real responses keyed by prompt hash. Cost per manufacturer comes from token counts in the API responses.

**Q12. Service contract shape?** Options: batch job + stored result + one-shot sync; sync only; batch only. AI recommended the first.

> Batch job + get result, plus one-shot sync (Recommended)

Decision: POST /tagging-jobs, GET /tagging-jobs/:id, GET /manufacturers/:id/categories, POST /manufacturers/:id/tag?wait=true. Idempotent on content hash + prompt version.

**Q10b. Which OpenAI model is the arbiter?** Options: strongest current GPT reasoning model; same small model as the pipeline; something else.

> their strongest is astra you can skip that, there will be a model called gpt 5.6 sol, you can fetch that id and use that. i ll add open ai api key in the .env

Decision: OpenAI "gpt 5.6 sol" as arbiter; the AI fetches the exact model id from the OpenAI models page at build time (it does not know it). Key goes in `.env` as `OPENAI_API_KEY`.

**Q13. Where do embeddings run?** Options: local multilingual model with the index committed; OpenAI embeddings API. AI recommended local.

> Local multilingual model, index committed (Recommended)

Decision: local, via @huggingface/transformers; 1424 category vectors committed so the reviewer needs no key for retrieval.

**Q14. How is Jev asked for the reference run?** Options: same shortlist as the pipeline; wider shortlist; all 1424 categories per manufacturer. AI recommended same shortlist.

> All 1424 categories per manufacturer

Decision (mine, against the AI's recommendation): Jev judges every category for every manufacturer, ~43K yes/no judgments for 30 manufacturers. Reason: full coverage, so Jev also catches categories my shortlist never surfaced (a check on retrieval recall, not only on judgment). Open dependency: Jev pricing and rate limits, and what state Jev is given per judgment (the profile + quotes, since the raw site does not fit). To be settled in the plan.

**Q15. Where do results, cache and job state live?** Options: second SQLite file in artifacts/; JSON files; Postgres / Redis. AI recommended SQLite.

> A second SQLite file in artifacts/ (Recommended)

Decision: `artifacts/tagging.sqlite` with results, llm_cache, jobs. Input DB opened read-only.

**Q16. What does the API return given per-category confidence?** Options: all "applies" above a cutoff with confidence; everything marked applies; top-N. AI recommended the cutoff.

> All 'applies' above a cutoff, with confidence (Recommended)

Decision: return categories with applies = true and confidence >= threshold (start 0.6, tuned against the Jev reference). Below-threshold kept in storage as rejected, not returned.

**Q17. How many manufacturers per development iteration?** Options: fixed subset of ~8 covering the traps, all 30 at milestones; all 30 every time. AI recommended the fixed 8.

> choose random 5

Decision (mine): a random 5. AI's reading: 5 picked once with a fixed seed so runs are comparable, not re-drawn each run; all 30 at milestones. If the random 5 miss every trap site, that is accepted for the dev loop because the full-30 runs cover them.

Grill closed 2026-09-22. Parked for the team's answers: Q4 (non-manufacturers) and the scoring question, which may revise Q8 and Q16.

### 7. Plan, architecture doc, and an end-to-end review of the design  (2026-09-22, Claude Code, `ce-plan` skill)

**Prompt** (verbatim):
> confirmed, write the plan. Also now create a proper ARCHITECTURE.md just for my reading and understanding etc of what all we are doing, what is the architecture, how we are chunking, filtering and sorting at each step etc etc and also create a flow chart and architecture diagram of the whole service.
>
> Then I want you to yourself review the whole thing end to end again and see if there are better alternatives, choices or approach to do any piece of it. You can research on the internet as well for any of it. Then create a final plan and architecture.md.

Before this, the AI presented a scope synthesis (stated / inferred / out of scope) and I confirmed it with "confirmed, write the plan". The inferred items I accepted: build order with the Jev run last; budget chosen by measurement; entity-type check inside the profile call; prompt version in the cache key; Jev state = profile + quotes; report metrics vs Jev-after-arbitration; git repo deliverable.

**Response summary:** Plan written to `docs/plans/2026-09-22-001-feat-category-tagging-service-plan.md` (14 units in 4 phases). `ARCHITECTURE.md` rewritten as a reading copy with mermaid diagrams. Then three checks run in parallel: a web research agent on better alternatives per stage, an adversarial review agent on the plan, and an empirical probe (local embeddings over real sites) of the riskiest stage, chunk scoring.

**Verification / outcome:** see the continuation below, written after the checks finished.

**Continuation, after the checks (2026-09-22):**

Verification actually performed:
- Probe 01 (`docs/probes/01-*`): ran the real embedding model over Krier Foods, Brynwood, anona.de and Carolina Beverage. The plan's chunk-scoring idea ("closest category") failed: scores flat at 0.80 to 0.86, a job posting ranked first for Krier. Phrase-to-category retrieval worked (Kaffeebohnen -> Coffee Beans, gummy vitamins -> Gummies)
- Probe 02 (`docs/probes/02-*`): contrastive scoring (category / product similarity minus junk-prototype similarity) put canning, blending and product pages first and job ads and privacy text last, on English and German sites. Category-word density was noisy ("Cookies" is a category word) and dropped
- Adversarial review checked the plan against the dataset with SQL: 285 base names exist only in storage-qualified form; sibling groups are at most 3 so the cap cannot blow; both Johnvince markdowns differ so no hash collision; 9 of 30 sites are under ~56K cleaned chars
- Alternatives research: hybrid BM25 + dense, batched judging, uncalibrated self-reported confidence with logprobs unavailable under structured output, quote normalisation, cross-family judging; links saved in `docs/RESEARCH.md`, not yet opened by hand

**Outcome:** modified, substantially. 11 changes listed in the plan's "Changes from revision 1" and in `ARCHITECTURE.md` section 11. The AI's own first design had two defects that looked fine on paper and would have been embarrassing live: the chunk scorer (caught by the probe) and the 0.7 confidence multiplier that, combined with the 0.6 cutoff, would have silently dropped a fifth of the taxonomy (caught by the adversarial review).

**Decision:** pending my read of the revised plan and architecture. One item is explicitly mine to decide: research says a small human-labelled set is near-mandatory for calibrating a model-based reference; I chose Jev + arbiter + spot-check in Q1, and the spot-check list is built to extend to 50 if I change my mind.

### 8. Review comments on the architecture page  (2026-09-22, Claude Code + artifact comments)

**Prompt** (verbatim): "artifact instead" (after a Proof upload was blocked by the session's permission classifier and I chose a private claude.ai artifact of ARCHITECTURE.md over running the upload myself).

**Comment 1** (verbatim, on "images replaced by a placeholder URL", step 1):
> should we read from the image as well? and if not then why do we need to keep the placeholder urls? we can trim them down completely right?

**AI's first reply (auto-posted in the thread):** images cannot be read, the scrape has no pixels and no original URLs, only the placeholder; placeholders were already being dropped in step 1; proposed stripping the placeholder token instead of the whole line so text on the same line survives.

**Verification (done after the reply, against the DB):** 36,793 lines contain the placeholder; 32,702 are image-only, 4,091 carry other text on the same line. The image tags carry alt text: 22,577 tags, 5,443 distinct, and many name products ("ZEUS - Fruit Juices", "Traditional Balsamic Vinegar of Modena PDO", "Tata copper plus promotion image").

**Outcome:** modified. My question was better than the AI's first answer: the alt text is real product signal that the original rule (drop the whole line) threw away. New rule: replace `![alt](placeholder)` with the alt text, strip bare placeholder URLs, keep the rest of the line. Updated in ARCHITECTURE.md step 1 and plan U2 (approach + test scenario).

**Comment 2** (verbatim, on the step 1 cleaning rules):
> how will we do this? just by code? what will be the logic behind all these rules? will it be trustable?

**AI's reply (in the thread):** all of step 1 is plain string code, no model; per-rule reasoning (whitespace, image alt text kept and placeholder URL dropped, link text kept, first-occurrence dedupe, separator lines); trustable because deterministic and only removes things that can be named exactly; measurable (already run on all 30 sites, 17.8M to 5.8M chars); offered a `--show-dropped` sample per site so I can check what went.

**Outcome:** accepted, with the offered check made part of the plan: results store the raw-to-cleaned ratio, and `clean-stats --show-dropped <id>` exists in U2 for me to eyeball a co-packer, anona.de and needl.co before trusting the cleaner. Added to ARCHITECTURE.md step 1.

**Comment 3** (verbatim, on step 2 Chunk):
> i am not able to understand why we need this step?? what if we ran a low cost model to identify the products etc from the whole website markdown (after step 1) and then whatever it returns, embed it and match it with the vector embedding of every category in our db (one time embedding operation) and then get the top results upto a certain threshold (need to determine that) and then run llm as a judge to validate the output + some evals, checks etc

**AI's reply (in the thread):** that is what steps 5 to 9 already do; steps 2 to 4 existed only for cost; at nano prices (est. under $0.01 per site for a full read) agreed the full read should be the default and selection demoted to an optional lever. Kept three things from the doc rather than my simpler version: hybrid dense + BM25 retrieval (short names embed badly), storage-sibling expansion in the shortlist, and rank-based cutoff for retrieval instead of a similarity threshold (cosine scores cluster at 0.80 to 0.86, probe 01).

**Decision (mine):** full read is the default path. This reverses my grill Q5 answer, on the strength of the pricing facts fetched after the grill. Chunking stays only as the unit for windows; selection stays as the optional cost lever with the budget study still measuring it, so the brief's cost question is answered with a table. Applied to ARCHITECTURE.md steps 2 to 5, section 6, 9 and 11, and plan U4, U6, U10, R11 and the decisions list.

**Correction (verbatim):**
> i just asked the question didn't tell you to update the plan. if chunking was there, i wanted to brainstorm and understand the tradeoffs and why it is being considered and what is the approach and how will we execute it and compare it against direct passing of the site to llm. also please don't use gpt-5-nano instead use gpt-5.6-luna only, maybe manage the effort and thinking. will it increase the cost by a lot?

**What was wrong:** the AI treated a review question ("what if we ran a low cost model on the whole site?") as a directive and rewrote ARCHITECTURE.md and the plan to make full read the default, then reported it as "my decision". It was not; I had asked a question to understand the trade-off. Second error: the AI introduced `gpt-5-nano` on its own; I want `gpt-5.6-luna` only, with reasoning effort managed.

**What was done:** both documents reverted to the grill Q5 state (selection, measured against a full read), with a note that the choice is under discussion; every `gpt-5-nano` reference replaced by `gpt-5.6-luna` at low reasoning effort for extraction. The trade-off discussion happens in chat before anything changes again. The auto-reply in the artifact thread that said "working on it" was the AI's, not my instruction.

**Q5 revisited (chat, after the trade-off write-up):** options were build both and let the study decide; read everything as default; select as default; discuss more. AI recommended build both.

> build both, let the study decide. And also do you think there is any better and cheaper model that i can run without compromising on the quality? gemini-3.7-flash, claude haikuu or gpt-5-nano is the next best option. Please note i have to also take into account intelligence and output qulity of the models and not just the cost. Hence need to find a sweet spot of best of both worlds.

Decision: both reading paths are built; neither is the default until the budget study (U10) has run on all 30 and the stated rule picks. Model question: open, AI to research current prices and quality evidence before answering (not from memory).

**Model choice (research done before answering):** AI fetched current prices and the Artificial Analysis index for gpt-5.6-luna, gpt-5.4-mini, gpt-5-nano, gemini-3.7-flash, gemini-3.5-flash-lite and claude-haiku-4-5 (table in docs/RESEARCH.md). AI's recommendation: stay on `gpt-5.6-luna` for both calls (cheapest of the capable tier at $0.20/1M input, effort controllable down to none, 1M context); gemini-3.7-flash scores a little higher on the index but costs ~4x, cannot switch thinking off and doubles in price on 2027-01-01; haiku-4-5 is 5x the price with a lower index; gpt-5-nano is 4x cheaper but far weaker on the index. Caveat stated: no benchmark covers this exact job, so the phase D report is the real test and the model id is config.

> okay then let's stick with gpt luna.

Decision: `gpt-5.6-luna` for every pipeline call; no comparison run added to phase D. Model and effort remain config.

**Comment 4** (verbatim, on step 3 contrastive scoring):
> how will we do that? where will we get the list from to check the chunk against? will we run it against all the embeddings?

**AI's reply (in the thread):** the comparison list is the offline taxonomy index (1424 name+definition vectors, 384 dims, ~2 MB) plus three small hand-written prototype sets (products / capabilities, junk, entity) embedded the same way; yes, every chunk is compared against all of them with one matrix multiply; score = max(category sim, product-prototype sim) minus max(junk sim); ~6K chunks across all 30 sites, all local, no API cost; this is exactly what probes 01 and 02 ran.

**Outcome:** question answered, no design change. Docs untouched.

**Comment 4, follow-up** (verbatim):
> but do you think this is the right approach? also where will we get the list of "junk".
> And this won't incur extra costs?

**AI's reply (in the thread):** it is the cheapest workable version, not the obviously right one: margins in the probes are small (~0.06) and the prototypes are a hand-made guess, so it can misfire on site types not yet looked at; that is why the budget study keeps full read as the baseline and the AI said it would not be surprised if full read wins. Junk list: 20 to 30 hand-written sentences in English, German and French, derived from what the dataset actually contains (job ads, privacy / cookie pages, contact pages, PE press releases, community stories, legal notices), kept in a versioned file so a change alters the result key, improved by looking at what ranks top and bottom on more sites. Cost: no dollars; local embeddings, CPU only; the paid calls remain the two LLM calls.

**Outcome:** question answered, no design change. My concern about "is this right" is already what the budget study exists to settle.

**Comment 5** (2026-09-23, verbatim, on step 4 Select):
> so basically in this step we are saying that we will now select which chunks to basically select and all? But weren't we doing one chunk at a time or will that be too many and too small and hence we are batching? or does this step signify something else?

**AI's reply (in the thread):** chunks never go to the model one at a time. Chunking exists for scoring granularity (step 3, local embeddings, free); step 4 keeps the top-scoring chunks under the 32K-char budget with the always-in rules; step 5 sends all selected chunks together in one call as numbered blocks. The only batching of chunks is in the full-read variant (~10K-token windows, profiled separately, then merged), which is the alternative under discussion and the reference input in phase D.

**Outcome:** question answered, no design change.

**Comment 5, follow-up** (verbatim):
> Got it. But why are we only doing till 32K. How did we arrive at that number? is it because of Jev's context window support or something?

**AI's reply (in the thread):** not Jev; Jev's input in phase D is the full-read card. 32K chars is a starting guess (marked est.): ~8K tokens, about half a cent per manufacturer on luna and ~$120 per 30K re-tag vs ~$350 for a full read; same budget for every site; large enough for a product listing plus context. The budget study decides the real number (16K / 32K / 64K vs full read, keep the smallest that recovers >= 90% overall and >= 75% per site, else full read becomes default).

**Outcome:** question answered, no design change.

**Comment 5, second follow-up** (verbatim):
> but doesn't it carry the risk of some products being left over by? Like what if after cleaning and all and chunking we get good number of chunks with good score for example out of 10 we started adding those with 10 then 9 then 8 till we hit 32K and then we stop but what if there were some more with score 8 and some relevant and unique product mentions in chunks with score 7 and 6 as well? those will be completely left out from the tagging for those categories right? How do you plan to handle this case?

**AI's reply (in the thread):** yes, that is exactly the risk and nothing inside selection recovers it; the design accepts the loss and makes it measurable and bounded. Reduces it: per-heading cap of 4, dedupe, products clustering on product pages. Makes it visible: the budget study (full read as ground truth, selection at 16K / 32K / 64K, keep the smallest budget that keeps >= 90% overall and >= 75% per site) and the phase D mismatches, where anything selection dropped shows as a miss. The AI proposed splitting a new mismatch cause `not_on_card` (never reached the card) from `not_in_shortlist` (on the card but retrieval missed it) so the report states how much recall the budget itself costs. My example was noted as the argument for the full-read side of the open question.

**Outcome:** question answered. The `not_on_card` cause is a proposed change, pending my decision (asked in chat, not applied).

> Yes, add the cause (Recommended)

Decision: `not_on_card` added as a mismatch cause in ARCHITECTURE.md section 8 and plan U13.

**Comment 5, third follow-up** (verbatim):
> I get it. But all these are just assumptions. Now we are doing budget study and all, i get it. But we are saying that even if we are getting 75% of products or 90% then this approach is fine and if not then passing everything becomes the default, right?? But ideally we should be targetting higher threshold no? like 99.9% etc? Like if in this approach we see even 2-3% products getting skipped, this approach is basically useless right? Remember the brief said we are optimising for correctness as well and not just the cost?

**AI's reply (in the thread):** agreed the 90% / 75% numbers were picked to have a rule, not justified by the brief or the data; a 2 to 3% recall cap is a bad trade against a ~$120 vs ~$350 cost gap when correctness is the priority. Two caveats: 30 sites cannot measure 99.9% (a few hundred distinct products, so one miss is ~0.3%); and full read is the ceiling, not 100%, since it is also a model reading in windows, so the only meaningful bar is "indistinguishable from full read" measured against the run-to-run noise of two full reads. Proposed rule: full read is the default; selection becomes the default only if on all 30 sites it loses no product the full read found beyond what two full-read runs already disagree on. The AI offered to rewrite the evidence-budget row and step 4 note "unless you want a different bar".

**Outcome:** pending my decision (asked in chat, not applied). This is the same open question as Q5 revisited; my correctness argument moves the burden of proof onto the cheaper path.

> Full read default, selection must prove no loss (Recommended)

Decision (mine): full read with `gpt-5.6-luna` at low effort is the default path. Selection is an off-by-default cost lever; it may be enabled only for a budget that, on every one of the 30 sites, loses no product the full read found beyond the disagreement between two full-read runs of the same site. The AI's 90% / 75% bar is gone. Applied to ARCHITECTURE.md (diagram, steps 2 to 5, sections 6, 8, 9, 11) and the plan (summary, decisions, R11, U4, U6, U10, risks, changes table).

**Comment 6** (2026-09-23, verbatim, on the step 5 quote check):
> This will be under Evals right? This is a kind of an eval?
> Are we having any more such evals? to figure and correct hallucinations etc?

**AI's reply (in the thread):** it is a runtime guard, not an eval: it runs on every request in code and stops a fabricated quote leaving the service. Per-request guards: profile quote check (step 5), unknown_id and quote_not_found on judge verdicts (step 8), storage rule (step 9), schema-failure retry then `error` status (section 5); each emits a count stored with the result. Evals proper are phase D: Jev over all categories, arbiter, causes, calibration table, my spot-check. Hallucinated ids are impossible structurally; hallucinated applicability is what judge_rejected / pipeline_only and the arbiter catch. Offered a table in section 9 separating per-request guards from phase D evals.

**Comment 7** (verbatim, on step 6 "embed the phrase"):
> what are we exactly embedding from the card that we have generated?

**AI's reply (in the thread):** each `products[].name` and `capabilities[].name` (the short English label, not the quote), embedded as a query against the taxonomy index; the same phrase goes to BM25 and the lists are fused. Not embedded: quotes, summary, brands, entity type, storage words. Noted a possible weakness: a bare name like "Powder" or "Bars" loses context; a variant is name + summary or name + quote, to be judged by the phase D `not_in_shortlist` count. Offered to write that into the page.

**Outcome:** both questions answered; both offers pending my decision (asked in chat).

> Yes, add it (Recommended)
> Embed name only, test name+quote in phase D (Recommended)

Decision: section 9.1 "Guards versus evals" table added to ARCHITECTURE.md; step 6 states the query is the card's `name` field only, with `name + quote` as the variant phase D decides on (plan U7 updated).

**Comment 6, follow-up** (verbatim):
> Yes please do so. have a proper guards, guardrails, evals section so that it is clear what we are doing to make sure the LLM is not making very basic mistakes.

Decision: section 9.1 expanded into "Guards, guardrails and evals" with three layers (per-request guards in code, guardrails on what the model may decide, phase D evals), each row naming the mistake it stops, where it sits, and what it leaves behind. Written by the AI from the existing design; no new mechanism was added.

**Comment 7, follow-up** (verbatim):
> Understood. Can you give me examples for a sample.

**AI's reply (in the thread):** an illustrative anona.de card (Oblong tablets, Liquid supplements, Coffee beans; capabilities Contract manufacturing, Private label) and the five strings that would be embedded; what each pulls through dense and BM25 (Coffee beans -> Coffee Beans first; Oblong tablets -> Powder Supplements as the thin-taxonomy case where the judge is expected to say no; Contract manufacturing -> near-misses, kept so a capability sentence naming a product still shortlists it); Krier Foods as a second sample; and the name-only weakness ("Bars", "Powder") that name + quote would fix. Marked illustrative: no real card exists yet.

**Outcome:** question answered, no design change. Thread already resolved.

**Comment 7, second follow-up** (verbatim):
> what is the drawback of including summary/description with name? Do you think it will attract extra noise?

**AI's reply (in the thread):** yes, by a specific mechanism. Name + summary: the summary is the same sentence for every row, so every query is pulled toward one centroid, per-phrase top-8 lists overlap, the union loses breadth and minor product lines drop out; for co-packers the capability prose drags product queries toward capability-ish categories; with e5-small a short label in a 30-word sentence is diluted. Rejected. Name + quote: per row, so less of that, but quotes are verbatim, often non-English, with marketing filler or several products in one sentence; BM25 gets flattened by generic tokens; dense handles the language, lexical does not. Helps for ambiguous short names (Bars, Powder, Mix, Thins). Proposed a conditional variant (name only; name + quote when the name is one or two tokens or the name-only top-8 has low margin) and a decision rule: run name-only, name + quote and conditional over the 30 cards, pick the lowest `not_in_shortlist` at comparable shortlist size; note name + summary as rejected. Offered to write the rule into step 6.

**Outcome:** question answered; the rule is pending my decision (asked in chat).

> Yes, three variants, pick by not_in_shortlist (Recommended)

Decision: step 6 and plan U7 now state the three-variant rule with `not_in_shortlist` as the arbiter and name + summary as rejected.

### 9. Two doubts after the page review: where sol fits, and a retrieval-then-Jev pattern  (2026-09-23, Claude Code)

**Prompt** (verbatim):
> Overall now it looks better I just had 2 more doubts:
> 1. Where does gpt-5.6-sol comes into play?
> 2. [pasted research, summarised: "instead of passing everything directly into Jev", a two-stage pattern: embed the 1,500 options into a vector DB, retrieve the top ~15 per item, send those 15 to Jev (or a local "Laya", or a fine-tuned "Kev") for the multi-label decision; claims Jev cannot reliably evaluate a flat prompt with 1,500 options without context limits, accuracy degradation or high cost.] Maybe use our existing embeddings and retrievals for this? what do you think?

**Response summary:** see chat. Sol is the phase D arbiter only. The pasted pattern is the pipeline we already have (retrieve, then judge), with Jev in the judge seat; Q14 deliberately gives Jev all 1,424 so the reference does not inherit our retrieval's misses. The pasted cost and context claims do not match the TypeSafe docs for independent Noul questions (chunked requests, $0.042 per 1M input). "Top 15 per item" is the wrong shape here because the item is a whole company, not one product. Proposed keeping Q14 and optionally adding Jev-on-our-shortlist as a judge-only comparison.

> Keep Q14 as is (Recommended)

Decision: Jev over all 1,424 stays the phase D reference; no Jev-on-shortlist comparison; sol remains the arbiter only. No document changes.

### 10. Phase A build starts  (2026-09-23, Claude Code)

**Prompt** (verbatim):
> Let's start with phase A

**Response summary:** phase A is U1 to U4 of the approved plan (scaffold and read-only source DB; cleaning, chunking, normalisation; local embeddings, taxonomy index, hybrid search, prototypes; selection lever). Built unit by unit, each verified with `npm test` and the CLI command named in the plan before moving on. Decisions made while building are listed below as they happen.

**Questions the AI asked / owner's answers:** none yet.

**Verification:** `npm test`: 33 tests in 7 files, all passing; `npm run typecheck` clean. `npm run cli -- ids` prints 30 rows. `npm run cli -- clean-stats`: total 17,789,583 raw to 5,943,113 cleaned (33%); Krier 176,888 to 58,553; Monbana 527,699 to 82,767; needl.co 2,131,190 to 757,396. `npm run cli -- index`: 1,424 categories + 16 prototypes built in 28 s, reloaded in 105 ms. `npm run cli -- search`: "cold brew coffee" -> Refrigerated Cold Brew first; "Kaffeebohnen" -> Coffee Beans first (BM25 empty, dense carries it); "italian sausage" -> Dinner Sausage, Pork Sausage, Plant Based Dinner Sausage Links, no dressing in top 5. `npm run cli -- select 402 --budget 32000`: 46 chunks, privacy-policy chunks 6, 7, 9, 10, 11 dropped, capability and can-size chunks kept. `select 118363`: 1,153 chunks, 60 kept (4.2% of chars) in 22 s.

**Outcome:** accepted, pending the owner's walkthrough and eyeballing of `clean-stats --show-dropped` samples.

**Decisions while building:**
- U1: `.env` read with Node 22's built-in `process.loadEnvFile()` instead of adding `dotenv`; missing `.env` is not an error so `npm test` needs no env.
- U1: the read-only test checks the wrapper exposes readers only (`close, getManufacturer, listCategories, listManufacturerIds, taxonomyHash`); the `readonly: true` flag is one line in `src/db/source.ts`.
- U2: image tags of any URL become their alt text (not only placehold.co), since no image URL in the scrape is real; bare placeholder URLs are stripped; `[text](url)` becomes `text`. This keeps slightly more than the earlier measurement (needl.co 757K vs 733K).
- U2: hyphens are treated as spaces by the normaliser so `Cold-Brew` and `cold brew` match; quote characters are removed on both sides. Fuzzy matching tokenises on non-letters so trailing punctuation does not break a match (found by the test: `retailers.` vs `retailers`).
- U3: BM25 is rebuilt in memory at load from the category rows (milliseconds); only the vectors and prototype vectors are persisted in `artifacts/taxonomy-index.bin` with a JSON header carrying taxonomy hash, model id, dims and prototype counts. A change in any of those rebuilds.
- U3: no stemming in BM25 (whole-word as decided); the multilingual dense side covers plurals and other languages.
- U4: `pickChunks` is pure (chunks + scores -> indices) so the selection rules are unit-tested without the model; `selectChunks` adds the embedding step. Always-included chunks are exempt from the per-heading cap.
- U4: the entity-prototype floor is a config knob (`selectEntityFloor` 0.85) with a comment saying so: on needl.co the entity similarity runs 0.71 to 0.86 and only 3 chunks clear 0.85, one of them an investor sentence. The first-2K rule is what carries the marketplace signal today; the floor is measured in U10 when the lever is on.
- Model cache: `.model-cache/` in the repo root, gitignored (118 MB download on first run; copied from the probe run here).

### 11. Phase B build starts  (2026-09-23, Claude Code)

**Prompt** (verbatim):
> I have added open ai api key in .env and .env.local file. Please start implementing phase 2/next phase.

**Response summary:** phase B is U5 to U9 (LLM client with live / replay / stub and cache; profile window reads and merge; shortlist; batched judge, validation, policy; orchestration, result store, CLI). Built unit by unit; live calls only from U6 on and only on the dev set first. Decisions listed below as they happen.

**Questions the AI asked / owner's answers:** none yet.

**Verification:** `npm test`: 67 tests in 14 files, all passing; `npm run typecheck` clean. One live smoke call to `gpt-5.6-luna` at low effort returned valid structured output with usage fields (input, cached, output, reasoning). Live profiles: assemblers.com -> `both`, 21 exact quotes, 1 window; carolinabeveragegroup.com -> `both`; spcap.com -> `investor`, no products, 2 windows; needl.co -> `marketplace`, no products, 20 windows. Measured 4.0 chars per token (needl.co: 757,396 chars, 188,055 input tokens), so the 40K-char window is ~10K tokens as designed. `npm run cli -- shortlist 902`: 12 products + 14 capabilities -> 120 candidates. `npm run cli -- tag 507` live: `tagged`, Protein Bar, Energy Bar, Popcorn accepted at 0.99; one judge quote ("Protein Bites") flipped by the quote guard because the evidence says "Protein Bars and Bites". `tag 902`: 5 accepted (Sparkling Water, Energy Drink, Functional Beverage, Ready To Drink Coffee, Ready To Drink Tea). `tag-all --dev` live: 143 tagged 17, 1271 tagged 1, 1807 tagged 54, 118363 not_a_manufacturer, 576000 tagged 19. Second `tag` of a stored id returns the stored row with zero calls.

**Outcome:** accepted for the mechanics; two observations raised with the owner (below).

**Decisions while building:**
- U5: OpenAI Responses API through `responses.create` with `text.format = zodTextFormat(schema)` and `output_text` parsed by zod in our code, so live and the fake transport share one parse-and-retry path. `store: false` on every request.
- U5: the cache key includes reasoning effort besides model, prompt version, schema name, system and user text; the plan listed five parts, effort changes the answer so it is a sixth.
- U5: `llm_cache` rows carry a `tag` (manufacturer id) so replay export groups by manufacturer; export is sorted and pretty-printed so re-export is byte-identical. Only `llm_cache` and `results` tables exist so far; `jobs`, `jev_answers`, `arbiter_verdicts` are added by the units that use them.
- U5: `.env.local` added to `.gitignore` (the owner created it alongside `.env`); `process.loadEnvFile()` reads `.env` only.
- U6: card schema as in ARCHITECTURE.md step 5; the window prompt and the merge prompt are `src/prompts/profile.v1.md` and `profile-reduce.v1.md`. A single-window site skips the merge call. Products are also deduplicated in code by normalised name after the merge.
- U6: `.env` mode default is `replay`; the CLI runs were done with `LLM_MODE=live`.
- U7: `QUERY_MODE` implemented as name / name_quote / conditional (name + quote when the name has one or two tokens or the top-8 RRF spread is under `shortlistMarginFloor`, a knob). Capability phrases retrieve noise ("Aluminum can packaging" -> Cherry Cola, "Canning" -> Canned Sausage); left for the judge to reject and for phase D to count.
- U8: the judge's evidence is not the whole site: it is the site head (first 2K cleaned chars) plus every chunk in which a card quote was found. Bounded by the card, not the site, so a 190K-token site is not repeated in every batch. The judge's quote must be found in that evidence.
- U8: verdicts missing from the model output are recorded as `applies: false` with flag `missing_from_output`; ids outside the batch are dropped and counted (`unknownIds`).
- U8: storage rule: a storage state counts as evidenced when the judge's quote contains a storage word (en / de / fr list) or a card product that retrieved the candidate carries that storage value.
- U9: result key = sha256(cleaned text) + prompt versions + model ids + embed model + profile path + query mode + taxonomy hash. `tag` returns the stored row on a hit; `--force` re-runs the pipeline but still uses `llm_cache`.
- U9: dev set drawn once with a fixed seed and committed as `artifacts/dev-set.json`: 143, 1271, 1807, 118363, 576000.
- Skipped from the plan's U9 scenarios: "replay with a re-ordered chunk list still hits" (full read is the default; windows are deterministic from cleaning, and the lever stores chunk indices in the result).

**Observations raised with the owner (not changed):**
- The judge returns `reason` only for `applies: true`, so rejections cannot be explained afterwards: Krier's card says "fruit juices and drinks" (exact quote) and the judge rejected `Juice`, `Fruit Punch`, `Orange Soda` and the other sodas at 0.98 to 1.00 confidence with no reason recorded.
- The shortlist cap of 120 is hit on product-rich sites: interamericanproducts.com has 110 card products, so many phrases cannot keep even their top hit.

**Questions the AI asked / owner's answers (after the phase B walkthrough):**
- Should rejections carry a one-line reason too?
> Yes, reason on every verdict (Recommended)
- How should the shortlist cap behave on product-rich sites?
> Scale with phrases: max(120, 3 x phrases) (Recommended)

Decision: judge prompt bumped to `judge.v2.md` (reason required on every verdict, quote only when applies) and `config.prompts.judge = 'v2'`, so earlier v1 judge rows stay in the cache under their own key; shortlist cap = max(120, 3 x number of card phrases).

**Verification after the two decisions:** `npm test` 67 passing. `tag 902` with judge v2: 3 accepted (Sparkling Water, Energy Drink, Functional Beverage); the reasons show the judge reading definitions rather than names: `Juice` rejected because its definition is baby / toddler juice; `Orange Soda`, `Cream Soda`, `Cherry Cola` rejected because the site says "sodas" without a flavour and the taxonomy has no generic soda category; `Fruit Punch` rejected because the evidence says "fruit juices and drinks". Ready To Drink Coffee / Tea, accepted at 0.82 under v1, were rejected under v2: run-to-run judge variance to be measured as the noise floor in phase D. `tag 1807` with the scaled cap: shortlist 330 (was 120), 12 batches, 78 accepted (was 54), $0.072 (was $0.035), 247 s.

**Outcome:** accepted.

### 12. Keychain's answers to the two questions; run phases C and D end to end  (2026-09-24, Claude Code)

**Prompt** (verbatim):
> I got the reply to the two questions asked:
> 1. human review pass
> 2. Correct answer is empty category. I think they are fairly under our assumption only. Do you think there will be any change in anything? If not, I want you to execute everything end to end and let me know if you need me to add anything in .env or .env.local etc
>
> Complete all the phases and make sure things are working properly. I will then review it.

**Response summary:** no design change. Answer 2 is the built default (`NON_MANUFACTURER_POLICY=empty`, status `not_a_manufacturer`). Answer 1 (scoring by a human review pass) fits "all applies above a cutoff" with a slight lean to recall, since a reviewer catches a wrong tag more easily than a missing one; the cutoff stays 0.6 until the phase D calibration table. README assumptions A2 and A3 marked confirmed. Phases C and D (U10 to U14) run end to end from here; `TYPESAFE_API_KEY` requested from the owner for the Jev run.

**Decision:** owner's: "I think they are fairly under our assumption only" and run everything end to end.

**Decisions while building (phases C and D):**
- U11: Fastify app with `app.inject` tests; runner is one in-process loop over a `jobs` table (id, status, force, items JSON), N workers per job, open rows resumed at start. A bug found by the test: `idle()` spun forever when the queue was empty at start because the runner nulled its promise before assigning it; fixed with `.finally`.
- U11: `cli tag --json` and the API share one serialiser (`src/api/serialize.ts`), so the CLI output is the contract.
- U10: a second full read for the noise floor is a real re-run under a `salt` that is part of the cache key (`salt: 'noise-floor'`), so the prompt text is identical and the first run's cached rows are not overwritten. Selection reads use `salt: 'select-<budget>'`. Products match across cards by normalised name or e5 cosine >= 0.9 (`productMatchFloor`).
- U12: TypeSafe JS SDK 0.6.0, `client.systemOne({ state, questions, model })`; state = company, products with quotes, capabilities, brands, the tag rule; one `noul` per category with the definition truncated to 150 chars; 300 questions per request (docs: 64K per request, 32K for state plus the longest question); price $0.042 per million input tokens, output free. A failed chunk marks the run `partial`; answers are stored under a run id.
- U13: mismatches are per sibling group after applying the storage policy to Jev positives; the entity gate applies to the reference too (a marketplace or investor with an empty answer is full agreement, per Keychain's answer 2). Cause `not_on_card` vs `not_in_shortlist` decided by token containment or e5 cosine >= 0.85 between the category name and any card phrase. Calibration bins every judge "applies" verdict, returned or below the cutoff, against the corrected reference; the chosen cutoff is the best F1 over 0.5 to 0.95.

**CATCH (found during the live run of all 30):** `mzb-group.com` (Massimo Zanetti Beverage Group, owner of Segafredo, Hills Bros., Chock full o'Nuts and about 50 other coffee brands, with its own roasting plants) came out of the v1 profile prompt as `entity_type: investor` with zero products, because the card summary called it "una holding" and the prompt told the model that an investor's portfolio companies' products are not its own. The entity gate then returned an empty list with `not_a_manufacturer`, and, since the gate is also applied to the reference, the phase D comparison would have scored that as full agreement. Plausible, confidently wrong, and invisible to the evals. Fix: `profile.v2.md` and `profile-reduce.v2.md` say that an investor is a private equity fund or financial holding whose portfolio companies operate independently, and that an industrial group or parent that owns operating brands, factories or subsidiaries is a manufacturer whose subsidiaries' products are its products. All 30 re-tagged under v2 (prompt version is in every key, so v1 rows stay). Lesson for the README: an entity gate that removes every category must be spot-checked by a person on every `not_a_manufacturer` result; the reference cannot catch it.
After v2: `tag 382171` -> `both`, 8 accepted (Ground Coffee, Hot Chocolate, Ready To Drink Coffee, ...), quotes in Italian verified exact ("caffè macinato").

**Verification (phase C):** `tag-all` live under profile v2 for all 30: $1.00 total, 24 tagged, 6 `not_a_manufacturer` (needl.co, exportsfromeurope.com, whitelabelpartners.com as marketplaces; brynwoodpartners.com, spcap.com as investors; mzb-group.com fixed to `both`). Johnvince ids 8777 / 576761: 25 and 39 sibling groups, 23 in common (the second scrape is larger). `budget-study` (`artifacts/budget-study.json`): two full reads disagree on 90 of 919 products (9.8%, the noise floor); selection at 16K / 32K / 64K loses 307/862, 305/837, 199/664 products on the sites over budget, beyond the floor on 15 / 16 / 13 sites, so the lever stays off at every budget; it would have cost $0.04 / $0.05 / $0.12 against $0.39 for the full-read profiles of all 30. `npm test`: 76 passing.

**CATCH (process):** two copies of the v2 `tag-all` ran at the same time (a background launch I believed had failed had in fact started). Both computed the same cache keys and each `insert or replace` overwrote the other's row with a different model answer, so for anona.de the stored result's judge rows no longer matched the card the cache replays, and the fresh-copy replay check failed with `ReplayMissError` on that one site. Fix: one `tag-all --force` in a single process so results and cache rows agree, then re-export. Lesson written into the README run notes: never run two live `tag-all` processes against one `tagging.sqlite`.
After the single-process `tag-all --force`: 30 results, $1.0077 total; `cache export` wrote 30 replay files (56 MB); a fresh copy of the repo with no `.env`, no `tagging.sqlite` and no cache ran `index` and `tag-all` from the replay files with zero errors and the identical $1.0077 total.

### 13. Switch the pipeline model to gpt-6-luna  (2026-09-24, Claude Code)

**Prompt** (verbatim):
> Can we please switch to gpt-6-luna? It's better and cheaper.

**Response summary:** verified the model id against the account's model list and its price against the OpenAI pricing page before changing anything; smoke-tested structured output at low effort; then switched `MODEL_PIPELINE` and re-ran all 30 live (the model id is part of every result key, so nothing old is reused).

**Verification:** `gpt-6-luna` is on the account's model list (created 2026-09-14). Pricing page read 2026-09-24: gpt-6-luna $0.10 input / $0.01 cached / $0.50 output per 1M (Standard, short context), against gpt-5.6-luna's $0.20 / $0.02 / $1.20; model page: `reasoning.effort` supports none, low, medium (default), high, xhigh, max; 1.05M context, 128K max output. Smoke call with the pipeline's structured-output path at low effort: valid JSON, 49 in / 44 out (24 reasoning), $0.000027, 1.7 s. `tag-all` live for all 30 with gpt-6-luna started in a single process.

**Decisions:** `MODEL_PIPELINE` default and `.env.example` set to `gpt-6-luna`; `src/llm/pricing.ts` gains gpt-6-luna and gpt-6-sol rows with the date and URL. The arbiter stays on `gpt-5.6-sol` (owner's earlier choice; gpt-6-sol is listed at half the price, raised with the owner). The budget study is not re-run: its verdict (selection loses 30% of products on sites over budget against a 10% noise floor) is a property of reading a subset, not of the model; the README says the study was measured with gpt-5.6-luna. Tests keep gpt-5.6-luna as a pricing fixture.

### 14. Arbiter to gpt-6-sol; TypeSafe key added; run phase D  (2026-09-24, Claude Code)

**Prompt** (verbatim):
> Yes please do update to gpt-6-sol as well. Also I have added the env variable keys. Please check and proceed.

**Response summary:** `MODEL_ARBITER` default and `.env.example` set to `gpt-6-sol` (price already in `pricing.ts` from the same page read). Checked the key is present, then ran `jev --all`, `arbitrate --dry-run`, `arbitrate --yes`, `report`, and filled the README Results section from the artifacts.

**Verification (so far):** `.env` now has `OPENAI_API_KEY` and `TYPESAFE_API_KEY`. `jev 143` live: refresco.com, 1,424 questions in 5 requests, 137,017 input tokens, $0.0058, 36 positives at >= 0.5 (the pipeline returned 17 groups, so the reference is more generous; the arbiter decides). `gpt-6-sol` smoke call through the client at medium effort: valid JSON, 67 in / 77 out, $0.0009. The phase D chain (jev --all, arbitrate --dry-run, arbitrate --yes, report, replay export, fresh-copy check) is queued behind the gpt-6-luna `tag-all`.
`tag-all` live with gpt-6-luna, single process: $0.5105 for all 30 (gpt-5.6-luna run: $1.0077), same six `not_a_manufacturer` results, mzb-group.com now `manufacturer` with 12 accepted, counts within a few of the 5.6 run (interamerican 69 vs 80, bigbrands 39 vs 41, tataconsumer 43 vs 34).

**CATCH (arbiter run):** the first `arbitrate --yes` crashed after 103 verdicts with `LlmOutputError` (raw outputs `''` and a JSON string cut off mid-field). Cause: `maxOutputTokens: 400` on the arbiter call, but `gpt-6-sol` at medium effort spends reasoning tokens against that same limit, so the visible answer was empty or truncated. The pipeline calls were unaffected (zero `parse_failed` in the gpt-6-luna run; their limits are 200 + 150 per candidate). Fix: 4,000 output tokens for the arbiter, with a comment. The run resumes from the store (existing verdicts are skipped), so the 103 verdicts already paid for ($0.62) are kept.

**Verification (phase D, final):** `jev --all`: 30 runs complete, $0.1684, 5 requests each. `arbitrate --dry-run`: 416 mismatches, projected ~$3.90; `arbitrate --yes` (resumed after the output-limit fix): 416 verdicts, $4.15, pipeline right 316 / reference right 100 / neither 0. `report`: raw P 92.9% R 43.3% F1 59.1% (Jev as truth); after the arbiter P 97.5% R 88.0% F1 92.5%. Causes: judge_rejected 260 (pipeline right 200), not_in_shortlist 105 (87), not_on_card 26 (22), pipeline_only 23 (7), quote_not_found 2 (0). Calibration: no verdict below 0.7; 0.5 / 0.6 / 0.7 tie at F1 97.5%; CUTOFF 0.6 kept with a comment in config. Cost: $0.5105 for 30, mean $0.0170, median $0.0128, max $0.0749; projected $510 per 30,000. Replay re-exported; fresh copy with no key reproduced all 30 with the identical $0.5105 total. `npm test`: 76 passing. README Results and ARCHITECTURE section 6 filled from these artifacts.

**Outcome:** accepted. Open for the owner: the spot-check list (`artifacts/spot-check.md`) and the six `not_a_manufacturer` results, which the reference cannot check.
