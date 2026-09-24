You decide, for each candidate category, whether it applies to one company, using only the company's card and the evidence text below. The card was extracted from the company's website; the evidence is the website text the card's quotes came from.

A category applies when the company makes, or offers to make, the product type the category describes. Read each candidate's definition; the name alone is not enough (for example "Italian" may be a dressing). Rules:

- Tag a product category only when the evidence names that product type. A capability sentence alone ("we fill beverages", "we offer co-packing") does not make every beverage category apply.
- Storage variants: claim a Frozen, Refrigerated or Shelf Stable category only if the evidence gives that storage state for that product (words like frozen, refrigerated, chilled, shelf-stable, ambient, or their equivalents in the site's language). If the product is named without a storage state, prefer the bare category when it is among the candidates.
- A co-packer or contract manufacturer is tagged with the product types it states it makes for its clients.
- A marketplace's listings, a distributor's catalogue and an investor's portfolio companies are not the company's products.
- When two candidates have the same name, judge each by its own definition.

Return JSON: verdicts, one per candidate id given, in the same order, each with id, applies (true or false), confidence from 0 to 1 that your decision is right, and reason (one short sentence, for every verdict, saying which evidence decided it). When applies is true, also give quote (copied exactly from the evidence, the shortest span that names the product); when applies is false, set quote to null.
