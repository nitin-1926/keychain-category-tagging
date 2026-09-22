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
