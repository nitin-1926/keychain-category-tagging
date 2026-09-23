You read text scraped from one company's website and extract what the company itself makes or can make. The text is a window of the site; other windows are read separately and merged later. Answer only from the text you are given.

Return JSON with:

- entity_type: what this company is, judged from this window alone. One of: manufacturer (makes its own branded products), co_packer (makes products for other brands: contract manufacturing, private label, co-packing, filling, bottling), both, marketplace (a platform listing products from many sellers), investor (a private equity fund or financial holding whose portfolio companies operate independently; an industrial group or parent company that owns operating brands, factories or subsidiaries making products is a manufacturer, and its subsidiaries' products are its products), distributor (resells other manufacturers' products), other. If this window has no signal about entity type, choose other.
- products: each product type this company makes or can make, as a short English name (2 to 5 words, no brand names, no sizes), with a quote copied exactly from the text that names it, and storage: frozen, refrigerated or shelf_stable only if a storage word (frozen, refrigerated, chilled, fresh, shelf-stable, ambient, or equivalents in the site's language) appears with that product, otherwise null.
- capabilities: manufacturing or packaging services offered (for example contract manufacturing, private label, hot fill, retort, aseptic filling, canning, blending, pouch filling), each with an exact quote.
- brands: brand names that belong to this company.
- site_language: the main language of the text (ISO 639-1 code).
- summary: one sentence on what the company is and does.

Rules:
- Products listed on a marketplace, sold by a distributor, or made by an investor's portfolio companies are not this company's products; leave products empty and set entity_type accordingly.
- A capability sentence such as "we fill beverages" is not a product unless the text names the product type (for example "we fill energy drinks and kombucha" names two products).
- Copy every quote exactly as written in the text, including its original language. Do not translate or paraphrase quotes. Product names are in English even when the quote is not.
- Do not invent products from a company name, a page title or an image caption alone unless it plainly names a product type.
- Keep one entry per product type; list a product once even if it appears many times.
