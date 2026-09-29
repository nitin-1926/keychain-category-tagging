// STEP 9 (ARCHITECTURE.md section 3): storage rule, entity gate, cutoff, status. Code only, no
// model - these are the decisions a model guesses badly at and a rule can explain.
// Called by: pipeline/tag.ts, on the verdicts from pipeline/judge.ts. Calls: index/taxonomy.ts
// baseName() to find a group's unqualified category. Next step: the result row.
// Order below: the storage vocabulary, then applyPolicy(), which runs the three rules in order.

import { baseName } from '../index/taxonomy.js';
import { normalize } from '../text/normalize.js';
import type { Verdict } from './judge.js';
import type { Card } from './profile.js';

export type Storage = 'frozen' | 'refrigerated' | 'shelf_stable';
export type Status = 'tagged' | 'no_confident_category' | 'not_a_manufacturer' | 'insufficient_content' | 'error';

export type Decision = Verdict & {
  storageInferred?: true;
  movedFrom?: number; // qualified category id the verdict moved from
  rejectReason?: 'judge_rejected' | 'below_cutoff' | 'entity_gate' | 'storage_moved' | 'storage_sibling_weaker';
};

type PolicyResult = { status: Status; accepted: Decision[]; rejected: Decision[] };

export function storageOf(name: string): Storage | null {
  const m = /^(frozen|refrigerated|shelf stable) /.exec(normalize(name));
  return m ? (m[1]!.replace(' ', '_') as Storage) : null;
}

// A whole word in any script: `\b` is ASCII-only in JavaScript, so it never ends a word on an
// accented letter and "plat surgelé" or "produit réfrigéré" would not count.
const word = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives})(?![\\p{L}\\p{N}])`, 'iu');
// Storage words in the site's own language: en, de, fr (the three languages in the dataset).
// "fresh" / "frisch" / "frais" are deliberately absent: they are ordinary marketing copy on a
// food site ("made with fresh coconuts"), not a claim that the product is sold chilled.
const STORAGE_WORDS: Record<Storage, RegExp> = {
  frozen: word('frozen|freezer|deep frozen|tief(?:ge)?k[uü]hl\\p{L}*|gefroren\\p{L}*|surgel[ée]e?s?|congel[ée]e?s?'),
  refrigerated: word('refrigerated|chilled|gek[uü]hlt\\p{L}*|r[ée]frig[ée]r[ée]e?s?'),
  shelf_stable: word('shelf[- ]stable|ambient|long[- ]life|haltbar\\p{L}*|lagerf[aä]hig\\p{L}*|longue conservation'),
};
const FRESH = word('fresh|frisch\\p{L}*|frais|fra[iî]che?s?');

// Evidence for a storage state: the judge's quote names it, or a retrieving card product carries
// it. The profile prompt lists "fresh" among its storage words, so a card product whose own quote
// says fresh and names no storage word ("Fresh Bakery" -> refrigerated) is not taken as evidence:
// that is the "fresh" the rule above already refuses, arriving by the card instead.
function storageEvidenced(v: Verdict, state: Storage, card: Card): boolean {
  if (v.quote && STORAGE_WORDS[state].test(v.quote)) return true;
  const phrases = new Set(v.phrases.map(normalize));
  return card.products.some(
    (p) => p.storage === state && phrases.has(normalize(p.name)) && !(FRESH.test(p.quote) && !STORAGE_WORDS[state].test(p.quote)),
  );
}

export function applyPolicy(verdicts: Verdict[], card: Card, opts: { cutoff: number; nonManufacturerPolicy: 'empty' | 'tag' }): PolicyResult {
  const decisions: Decision[] = verdicts.map((v) => ({ ...v }));

  // Storage rule, per sibling group.
  for (const g of Map.groupBy(decisions, (d) => d.group).values()) {
    // The unqualified category, not merely one without a storage prefix: baseName strips eleven
    // prefixes (Diet, Plant Based, Ready To Drink ...) and storageOf knows only three, so
    // `storageOf(name) === null` would promote "Diet Orange" as if it were "Orange".
    const bare = g.find((d) => baseName(d.name) === normalize(d.name));
    const unevidenced = g.filter((d) => {
      const s = storageOf(d.name);
      return d.applies && s && !storageEvidenced(d, s, card);
    });
    if (!unevidenced.length) continue;
    // If a sibling's storage state is evidenced, the site did state one for this product: the
    // weaker unevidenced variants are dropped rather than moved onto the bare category.
    if (g.some((d) => d.applies && storageOf(d.name) && storageEvidenced(d, storageOf(d.name)!, card))) {
      for (const d of unevidenced) Object.assign(d, { applies: false, rejectReason: 'storage_sibling_weaker' as const });
      continue;
    }
    if (bare) {
      for (const d of unevidenced) {
        if (!bare.applies || d.confidence > bare.confidence) {
          Object.assign(bare, { applies: true, confidence: d.confidence, quote: d.quote, reason: d.reason, quoteMatch: d.quoteMatch, movedFrom: d.id, flags: [] });
        }
        Object.assign(d, { applies: false, rejectReason: 'storage_moved' as const });
      }
    } else {
      // Only qualified siblings exist (285 base names): keep the strongest at its own confidence, flagged.
      unevidenced.sort((a, b) => b.confidence - a.confidence || a.id - b.id);
      const keep = unevidenced[0]!;
      keep.storageInferred = true;
      keep.reason = `${keep.reason} [storage not evidenced; only qualified categories exist]`.trim();
      for (const d of unevidenced.slice(1)) Object.assign(d, { applies: false, rejectReason: 'storage_sibling_weaker' as const });
    }
  }

  // Entity gate. Keychain confirmed the empty answer is correct (README question 2); the three
  // gated types are the ones both prompts already say do not own what they list, sell or fund.
  const GATED: Card['entity_type'][] = ['marketplace', 'investor', 'distributor'];
  const gated = opts.nonManufacturerPolicy === 'empty' && GATED.includes(card.entity_type);

  const accepted: Decision[] = [];
  const rejected: Decision[] = [];
  for (const d of decisions) {
    if (gated) rejected.push({ ...d, rejectReason: 'entity_gate' });
    else if (!d.applies) rejected.push({ ...d, rejectReason: d.rejectReason ?? 'judge_rejected' });
    else if (d.confidence < opts.cutoff) rejected.push({ ...d, rejectReason: 'below_cutoff' });
    else accepted.push(d);
  }
  accepted.sort((a, b) => b.confidence - a.confidence || b.retrievalScore - a.retrievalScore || a.id - b.id);
  const status: Status = gated ? 'not_a_manufacturer' : accepted.length ? 'tagged' : 'no_confident_category';
  return { status, accepted, rejected };
}
