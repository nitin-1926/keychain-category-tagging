# Keychain OS - Manufacturer Category Tagging Service

**Take-Home Assignment · AI Engineer**

| | |
|---|---|
| **AI tools** | Encouraged - use whatever you normally use |
| **Language** | Your choice - pick what you're most comfortable with |
| **Submission** | Git repo (or zip) with a README explaining your decisions |

---

## 1. Background

Keychain builds a data platform for the manufacturing and CPG industry. A central part of the platform is a rich **manufacturer profile** - for every manufacturer we know what they make, what they sell, what ingredients and packaging they use, and which **product categories** they belong to.

There is a fixed **category taxonomy** - a curated list of thousands of product categories (e.g. *Cold Brew Coffee*, *Gluten-Free Snack Bars*, *Corrugated Shipping Boxes*). Each manufacturer must be tagged with the subset of categories that actually applies to them. Today this tagging is one of the most important enrichment steps we run, and it is fully automated.

You are building the **Category Tagging Service** - the component that, given a manufacturer, decides which categories from the taxonomy apply to it.

---

## 2. What You Have to Work With

We provide a **SQLite database** with everything you need. You do **not** need to build any ingestion.

1. **`category`** - the taxonomy of ~2000 product categories. Columns: `id`, `name`, and a short text `definition` of what the category means. (Some definitions may be blank - handle that.)

2. **`manufacturer`** - the manufacturers to tag. Columns: `id`, `name`, `domain`.

3. **`manufacturer_scraped_data`** - the scraped website content per manufacturer. Columns: `id` (manufacturer id), `domain`, `markdown` (raw text, messy and variable in length).

You also need **an LLM** - assume you can call a model from any provider (bring your own key, or stub the call if you prefer).

How you store, index, or represent any of this beyond the given SQLite is your decision. If it helps your approach to precompute or embed something, that's your call to make and justify.

---

## 3. The Core Problem

Given a `manufacturer_id`, return the category ids that apply to that manufacturer.

The taxonomy has thousands of categories. Accuracy and cost are in tension, and the approach is yours to design - we care about the reasoning behind it, not a specific algorithm.

Questions worth answering in your design:

- How do you decide which categories are even worth evaluating for a given manufacturer?
- How does the relevance decision get made, and what does the LLM see (input shape, prompt, output shape)?
- Where does the cost go, and what levers do you have on it? When do you stop?

You'll walk through and defend your approach in the follow-up round.

---

## 4. The Service Contract

Our core platform calls this service with a `manufacturer_id` and needs the resulting categories back. It runs across our full manufacturer base.

Design the API surface, and document the decisions behind it in your README. Where a requirement is ambiguous, state the assumption you made and why.

> **How we'll check it works:** we run your service on the manufacturers in the provided database and compare the categories it returns against categories we already know are correct. Make sure your service can be run against the given data and produce output for a manufacturer end-to-end.

---

## 5. Deliverables

| # | Deliverable | What we are looking for |
|---|---|---|
| 1 | **Working implementation** | Category tagging works end-to-end for a manufacturer in the provided database. Correctness and reasoning over completeness. |
| 2 | **Data model / interfaces** | How you represent categories, manufacturer content, candidates, and results. |
| 3 | **The tagging approach** | Your candidate-narrowing + LLM-decision + cost-control strategy, and why. |
| 4 | **Service contract** | The API design and the reasoning behind its shape. |
| 5 | **README** | Key decisions, trade-offs, and what you'd do with more time. |
| 6 | **AI Usage Log** | See below - required. |

You do not need to build a UI, deployment, auth, or the data ingestion. Focus on the service.

---

## 6. What We Are Evaluating

- **Approach quality** - is the candidate-narrowing + LLM-decision + cost-control strategy sound? Does it handle the "too many categories" problem intelligently?
- **AI judgment** - prompt design, output parsing, handling of hallucination / bad LLM output, deciding when to trust retrieval vs the LLM.
- **Cost reduction** - LLM calls are the expensive part. What levers does the design use to cut spend without losing accuracy, and are those choices reasoned rather than guessed?
- **Contract design** - a service contract that fits how the work actually runs.
- **Correctness** - does it return sensible categories for the provided manufacturers?
- **Engineering judgment** - the README, the trade-offs, what they chose *not* to build.
- **AI fluency** - using AI tools effectively and validating their output, not just prompting for boilerplate.

---

## 7. AI Usage Log - Required

AI is explicitly allowed and encouraged. But using AI is not the same as demonstrating judgment. Alongside your code, include an **AI Usage Log** covering:

1. Every significant prompt you sent to an AI tool - the prompt and a summary of the response.
2. For each AI output you used: what did you verify before accepting it? Did you test it, cross-check it, or modify it? How?
3. Any AI output you rejected or changed significantly - what was wrong and what you did instead.
4. At least one example where you caught the AI producing something that looked plausible but was incorrect or incomplete.

Quality over volume. Five well-described prompts beat twenty one-liners.

---

## 8. Practical Notes

- AI tools are fully allowed and encouraged. We care about your judgment and what you chose to build, not whether you typed every line.
- You do not need to deploy anything. A locally runnable service is fine.
- Data is provided as a SQLite database - no real infrastructure needed. You bring your own LLM key (or stub the call).
- The follow-up session is a live walkthrough of your submission. **We will ask you to extend it in a few ways, so make sure you understand your own code deeply.**
