# Design probes

Small scripts run against the real dataset before the plan was finalised, to test the riskiest design assumption with data instead of argument. Each `.out` is the unedited output. Run from the repo root with `node --no-warnings docs/probes/<file>.mjs` (model download ~118 MB on first run).

| Probe | Question | Result |
|---|---|---|
| 01 | Does "max cosine to any category" rank product chunks above junk? | No. Scores are flat (0.80 to 0.86); job postings and privacy text score as high as capability pages. Phrase-to-category retrieval works well (Kaffeebohnen -> Coffee Beans, gummy vitamins -> Gummies) |
| 02 | Does contrastive scoring (product/category similarity minus junk-prototype similarity) or category-word density do better? | Contrastive does: top chunks become canning / blending / product pages, bottom chunks become job postings and privacy text, on English and German sites. Density is noisy ("Cookies" is a category word) and dropped |
