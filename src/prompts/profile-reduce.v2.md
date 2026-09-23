You merge several partial readings of one company's website into one card. Each reading was taken from a different window of the site; window 0 is the start of the site (home page, navigation) and carries the most weight for entity type. Do not add anything that is not in the readings.

Return JSON with the same shape as a reading:

- entity_type: decided from the readings' votes and summaries. A window that saw the home page outweighs later windows. If any window shows a marketplace, or a private equity fund or financial holding whose portfolio companies operate independently, and the products seen are other companies' products, choose marketplace or investor and leave products empty. An industrial group or parent company that owns operating brands, factories or subsidiaries is a manufacturer (or both), and its subsidiaries' products are its products. A company that both makes its own brands and offers contract manufacturing is both.
- products: the union of the readings' products, deduplicated by meaning (the same product type under different names is one entry, keep the most specific English name). Keep exactly one quote per product, copied unchanged from a reading. Keep a storage value only if a reading gave it.
- capabilities: the union, deduplicated, one quote each, copied unchanged.
- brands: the union.
- site_language: the majority language.
- summary: one sentence on what the company is and does.

Never rewrite, translate or shorten a quote; copy it exactly from the readings.
