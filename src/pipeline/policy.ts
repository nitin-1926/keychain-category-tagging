// Step 9 (ARCHITECTURE.md): storage rule, cutoff, entity gate, status. Code only, no model.

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

export type PolicyResult = { status: Status; accepted: Decision[]; rejected: Decision[] };

const STORAGE_PREFIX: Record<Storage, RegExp> = {
  frozen: /^frozen /,
  refrigerated: /^refrigerated /,
  shelf_stable: /^shelf stable /,
};
// Storage words in the site's own language: en, de, fr (the three languages in the dataset).
// "fresh" / "frisch" / "frais" are deliberately absent: they are ordinary marketing copy on a
// food site ("made with fresh coconuts"), not a claim that the product is sold chilled.
const STORAGE_WORDS: Record<Storage, RegExp> = {
  frozen: /\b(frozen|freezer|deep frozen|tiefk[uü]hl\w*|gefroren|surgel[ée]s?|congel[ée]s?)\b/i,
  refrigerated: /\b(refrigerated|chilled|gek[uü]hlt|r[ée]frig[ée]r[ée]s?)\b/i,
  shelf_stable: /\b(shelf[- ]stable|ambient|long[- ]life|haltbar|lagerf[aä]hig|longue conservation)\b/i,
};

export function storageOf(name: string): Storage | null {
  const n = normalize(name);
  for (const s of Object.keys(STORAGE_PREFIX) as Storage[]) if (STORAGE_PREFIX[s].test(n)) return s;
  return null;
}

// Evidence for a storage state: a retrieving card product carries it, or the judge's quote names it.
function storageEvidenced(v: Verdict, state: Storage, card: Card): boolean {
  if (v.quote && STORAGE_WORDS[state].test(v.quote)) return true;
  const phrases = new Set(v.phrases.map(normalize));
  return card.products.some((p) => p.storage === state && phrases.has(normalize(p.name)));
}

export function applyPolicy(verdicts: Verdict[], card: Card, opts: { cutoff: number; nonManufacturerPolicy: 'empty' | 'tag' }): PolicyResult {
  const decisions: Decision[] = verdicts.map((v) => ({ ...v }));

  // Storage rule, per sibling group.
  const groups = new Map<string, Decision[]>();
  for (const d of decisions) groups.set(d.group, [...(groups.get(d.group) ?? []), d]);
  for (const g of groups.values()) {
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
      keep.reason = `${keep.reason ?? ''} [storage not evidenced; only qualified categories exist]`.trim();
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
