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
