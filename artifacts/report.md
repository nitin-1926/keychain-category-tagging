# Eval report

Generated 2026-09-25T19:35:20.712Z. Pipeline: gpt-6-luna, prompts profile v2 / judge v2, query mode name, cutoff 0.6. Reference: artifacts/reference.json (2026-09-24): Jev (jev-latest) over all 1,424 categories per manufacturer with the gpt-6-luna full-read card as state, positives at >= 0.5, collapsed to sibling groups with the storage policy; every disagreement with the pipeline settled by gpt-6-sol (416 verdicts, 2026-09-24); marketplaces and investors have an empty reference by Keychain's answer. Groups are keyed by category base name. Every number comes from rows in artifacts/tagging.sqlite; rerun `npm run cli -- report` to regenerate.

## Accuracy (per sibling group)

| TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---|---|---|
| 307 | 16 | 84 | 95.0% | 78.5% | 86.0% |

| Manufacturer | Status | Returned | Reference | Missed | Wrong | P | R | F1 |
|---|---|---|---|---|---|---|---|---|
| refresco.com | tagged | 15 | 14 | 2 | 3 | 80.0% | 85.7% | 82.8% |
| nellsonllc.com | tagged | 7 | 9 | 2 | 0 | 100.0% | 77.8% | 87.5% |
| carolinabeveragegroup.com | tagged | 3 | 4 | 1 | 0 | 100.0% | 75.0% | 85.7% |
| trufoodmfg.com | tagged | 8 | 9 | 1 | 0 | 100.0% | 88.9% | 94.1% |
| assemblers.com | tagged | 3 | 3 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| portlandbottling.com | tagged | 5 | 6 | 1 | 0 | 100.0% | 83.3% | 90.9% |
| krierfoods.com | tagged | 4 | 5 | 1 | 0 | 100.0% | 80.0% | 88.9% |
| innomarkinc.com | tagged | 6 | 8 | 2 | 0 | 100.0% | 75.0% | 85.7% |
| tailoredbottlingsolutions.com | tagged | 1 | 2 | 1 | 0 | 100.0% | 50.0% | 66.7% |
| thedrinkink.com | tagged | 4 | 6 | 2 | 0 | 100.0% | 66.7% | 80.0% |
| interamericanproducts.com | tagged | 69 | 72 | 11 | 8 | 88.4% | 84.7% | 86.5% |
| bigbrandsllc.com | tagged | 39 | 44 | 7 | 2 | 94.9% | 84.1% | 89.2% |
| usbeveragemanufacturing.com | tagged | 13 | 12 | 0 | 1 | 92.3% | 100.0% | 96.0% |
| johnvince.com | tagged | 27 | 37 | 10 | 0 | 100.0% | 73.0% | 84.4% |
| inw-group.com | tagged | 4 | 9 | 5 | 0 | 100.0% | 44.4% | 61.5% |
| lilyofthedesert.com | tagged | 6 | 9 | 3 | 0 | 100.0% | 66.7% | 80.0% |
| alphaaromatics.com | tagged | 1 | 1 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| tataconsumer.com | tagged | 43 | 56 | 16 | 2 | 95.2% | 71.4% | 81.6% |
| lacharlotte.com | tagged | 6 | 5 | 1 | 0 | 100.0% | 80.0% | 88.9% |
| needl.co | not_a_manufacturer | 0 | 0 | 0 | 0 | - | - | - |
| brynwoodpartners.com | not_a_manufacturer | 0 | 0 | 0 | 0 | - | - | - |
| spcap.com | not_a_manufacturer | 0 | 0 | 0 | 0 | - | - | - |
| anona.de | tagged | 10 | 15 | 5 | 0 | 100.0% | 66.7% | 80.0% |
| mzb-group.com | tagged | 12 | 12 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| monbana.com | tagged | 14 | 20 | 6 | 0 | 100.0% | 70.0% | 82.4% |
| Johnvince.com | tagged | 20 | 26 | 6 | 0 | 100.0% | 76.9% | 87.0% |
| flavorchem.store | tagged | 4 | 4 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| exportsfromeurope.com | not_a_manufacturer | 0 | 0 | 0 | 0 | - | - | - |
| kookainc.com | tagged | 2 | 3 | 1 | 0 | 100.0% | 66.7% | 80.0% |
| whitelabelpartners.com | not_a_manufacturer | 0 | 0 | 0 | 0 | - | - | - |

## Why the misses happen

The 84 missed groups by the stage that lost them (the 16 wrong tags are listed separately below).

| Cause | Groups |
|---|---|
| judge_rejected | 60 |
| not_in_shortlist | 18 |
| not_on_card | 4 |
| quote_not_found | 2 |

Missed groups by manufacturer:

- refresco.com: Flavored Concentrate (judge_rejected); Flavored Hydration Water (judge_rejected)
- nellsonllc.com: Chocolate / Candy Melts (judge_rejected); Energy Bar (judge_rejected)
- carolinabeveragegroup.com: Ready To Drink Tea (judge_rejected)
- trufoodmfg.com: Energy Bar (judge_rejected)
- portlandbottling.com: Sparkling Fruit Juice (judge_rejected)
- krierfoods.com: Functional Beverage (quote_not_found)
- innomarkinc.com: Berries (judge_rejected); Functional Beverage (not_in_shortlist)
- tailoredbottlingsolutions.com: Functional Beverage (judge_rejected)
- thedrinkink.com: Ready To Drink Tea (judge_rejected); Wellness Shot (judge_rejected)
- interamericanproducts.com: American Cheese (judge_rejected); Baking Ingredients (not_in_shortlist); Bread Dough (not_in_shortlist); Bread Roll Dough (not_in_shortlist); Drink Mix (judge_rejected); Fruit Punch (judge_rejected); Ice Cream (not_in_shortlist); Jam (judge_rejected); Seasoning Packet (judge_rejected); Tomato (judge_rejected); Refrigerated Yogurt Drink (not_in_shortlist)
- bigbrandsllc.com: Ready To Drink Coffee (judge_rejected); Drink Mix (judge_rejected); Flavored Beer (judge_rejected); Hydration (judge_rejected); Purified Water (judge_rejected); Ready To Drink Tea (judge_rejected); Wellness Shot (judge_rejected)
- johnvince.com: Almond (not_on_card); Baking Chocolate (judge_rejected); Caramel (judge_rejected); Dried Mango (judge_rejected); Flaxseed (not_in_shortlist); Hard Pretzels (Baked) (judge_rejected); Mango (not_on_card); Pretzel Rods (judge_rejected); Seasoning Mix (not_in_shortlist); Soft Sugar Candy (judge_rejected)
- inw-group.com: Drink Powder (judge_rejected); Energy Bar (judge_rejected); Energy Drink (judge_rejected); Functional Beverage (judge_rejected); Wellness Shot (judge_rejected)
- lilyofthedesert.com: Refrigerated Aloe Vera Juice (judge_rejected); Drink Powder (judge_rejected); Vegetable Oil (judge_rejected)
- tataconsumer.com: Black Pepper (judge_rejected); Cereal With Inclusions (judge_rejected); Cooking Pastes (not_in_shortlist); Curry Sauce (judge_rejected); Curry Seasoning (judge_rejected); Drink Mix (not_in_shortlist); Garbanzo Bean / Chickpea (not_in_shortlist); Garlic Seasoning (not_in_shortlist); Ginger Seasoning (judge_rejected); Jam (not_on_card); Marmalade (not_in_shortlist); Millet (not_on_card); Seasoning Mix (not_in_shortlist); Snack Mix (not_in_shortlist); Ready To Drink Tea (judge_rejected); Trail Mix (judge_rejected)
- lacharlotte.com: Custard (judge_rejected)
- anona.de: Baking (not_in_shortlist); Baking Ingredients (not_in_shortlist); Functional Beverage (judge_rejected); Granola Bars (judge_rejected); Powder Supplements (judge_rejected)
- monbana.com: Biscuits (quote_not_found); Caramel (judge_rejected); Clusters (judge_rejected); Praline (judge_rejected); Soft Sugar Candy (not_in_shortlist); Tea Mix (judge_rejected)
- Johnvince.com: Baking Chips (judge_rejected); Candy Bar (judge_rejected); Classic Pretzel Twist (judge_rejected); Hard Pretzels (Baked) (judge_rejected); Pretzel Rods (judge_rejected); Soft Sugar Candy (judge_rejected)
- kookainc.com: Candy Bar (judge_rejected)

Wrong groups by manufacturer (16 in total):

- refresco.com: Nectar Juice; Purified Water; Vegetable Juice
- interamericanproducts.com: Bakery Cookies; Basmati Rice; Cheese Spread; Coleslaw; Garbanzo Bean / Chickpea; Ice Cream Cone; Pizza Sauce; Sub
- bigbrandsllc.com: Juice Concentrates; Milk
- usbeveragemanufacturing.com: Tequila
- tataconsumer.com: Alkaline Water; Pistachio

## Calibration (judge confidence vs reference, 323 "applies" verdicts)

The judge scores only what it accepted; the cutoff table below is scored against all 391 reference groups, so it is comparable with the accuracy table above.

| Confidence | n | Correct | Share |
|---|---|---|---|
| 0.00 to 0.50 | 0 | 0 | - |
| 0.50 to 0.60 | 0 | 0 | - |
| 0.60 to 0.70 | 0 | 0 | - |
| 0.70 to 0.80 | 2 | 2 | 100.0% |
| 0.80 to 0.90 | 17 | 16 | 94.1% |
| 0.90 to 0.95 | 28 | 23 | 82.1% |
| 0.95 to 1.00 | 276 | 266 | 96.4% |

| Cutoff | Precision | Recall | F1 |
|---|---|---|---|
| 0.5 | 95.0% | 78.5% | 86.0% |
| 0.6 | 95.0% | 78.5% | 86.0% |
| 0.7 | 95.0% | 78.5% | 86.0% |
| 0.8 | 95.0% | 78.0% | 85.7% |
| 0.9 | 95.1% | 73.9% | 83.2% |
| 0.95 | 96.4% | 68.0% | 79.8% |

Best-F1 cutoff: **0.5**. Config CUTOFF = 0.6.

## Cost

| | |
|---|---|
| Manufacturers | 30 |
| Total pipeline cost | $0.5105 |
| Mean / median / max per manufacturer | $0.0170 / $0.0122 / $0.0749 (bigbrandsllc.com) |
| Input tokens (cached share) | 3,234,010 (0.0%) |
| Output tokens | 374,148 |
| Profile / judge share of input | 47.0% / 53.0% |
| Projected for 30,000 manufacturers | $510.4750 (Batch API: $255.2375) |
| One-off cost of building the reference set | $4.3220 |

