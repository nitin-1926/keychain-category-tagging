import { zodTextFormat } from 'openai/helpers/zod';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { config } from '../config.js';
import type { Store } from '../db/store.js';
import { addUsage, costUsd, Usage, ZERO_USAGE } from './pricing.js';

// The one deliberate seam: every model call in the service goes through complete().
// Called by: pipeline/profile.ts (steps 3 and 5) and pipeline/judge.ts (step 7). Nothing else in
// the pipeline may talk to a model, which is what makes the cache, the cost accounting and the
// no-key replay mode possible at all.
// Calls: the OpenAI Responses API through `Transport`, and db/store.ts for the cache.
//
// Read in this order: requestKey() (what makes two calls the same call), openaiTransport() (the
// only network code), then createClient() -> complete(), which is the decision tree below.
// live   -> llm_cache first, then the transport (OpenAI Responses API)
// replay -> llm_cache only; a miss is a ReplayMissError, never a billed call
// Tests fake a model the way a new provider would plug in: a Transport (test/fake-llm.ts).

type Effort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type LlmRequest<T> = {
  model: string;
  promptVersion: string;
  system: string;
  user: string;
  schemaName: string;
  schema: z.ZodType<T>;
  effort?: Effort;
  maxOutputTokens?: number;
  tag?: string; // manufacturer id, groups cache rows for replay export
  salt?: string; // deliberate re-run of an identical prompt (noise floor); part of the key
};

type LlmResult<T> = { output: T; usage: Usage; costUsd: number; source: 'live' | 'cache' };

// Hears every charge the moment it is made: each billed attempt (both of a call that then fails its
// schema) and the stored cost of a cache hit. pipeline/tag.ts keeps the bill with it, so a run that
// fails halfway is stored with what it actually cost.
type OnSpend = (usage: Usage, costUsd: number) => void;

// What a live call needs from the network; tests pass a fake.
export type Transport = (req: LlmRequest<unknown>, user: string) => Promise<{ text: string; usage: Usage }>;

export class LlmOutputError extends Error {
  // Both raw outputs travel with the error; tag() puts them in the stored row's error field,
  // because a schema failure is only debuggable from what the model actually wrote.
  constructor(message: string, raws: string[]) {
    super(`${message} [${raws.map((r) => JSON.stringify(r.slice(0, 200))).join(' | ')}]`);
  }
}
export class ReplayMissError extends Error {
  constructor(public readonly key: string, req: { model: string; schemaName: string; tag?: string }) {
    super(`replay miss for ${req.schemaName} (${req.model}, tag ${req.tag ?? '-'}) key ${key}`);
  }
}

export function requestKey(req: LlmRequest<unknown>): string {
  return createHash('sha256')
    .update([req.model, req.promptVersion, req.effort ?? '', req.schemaName, req.salt ?? '', req.system, req.user].join('\u0000'))
    .digest('hex');
}

function openaiTransport(apiKey: string): Transport {
  const client = new OpenAI({ apiKey });
  return async (req, user) => {
    const r = await client.responses.create({
      model: req.model,
      instructions: req.system,
      input: user,
      text: { format: zodTextFormat(req.schema as z.ZodType<Record<string, unknown>>, req.schemaName) },
      ...(req.effort ? { reasoning: { effort: req.effort } } : {}),
      ...(req.maxOutputTokens ? { max_output_tokens: req.maxOutputTokens } : {}),
      store: false,
    });
    const u = r.usage;
    return {
      text: r.output_text,
      usage: {
        input: u?.input_tokens ?? 0,
        cached: u?.input_tokens_details?.cached_tokens ?? 0,
        output: u?.output_tokens ?? 0,
        reasoning: u?.output_tokens_details?.reasoning_tokens ?? 0,
      },
    };
  };
}

type ClientOptions = {
  mode: 'live' | 'replay';
  store: Store;
  transport?: Transport; // live only; replay must not be able to reach the network
  log?: (event: string, detail: Record<string, unknown>) => void;
};

export function createClient(opts: ClientOptions) {
  const log = opts.log ?? ((event, detail) => console.error(`[llm] ${event} ${JSON.stringify(detail)}`));

  function parse<T>(req: LlmRequest<T>, text: string): { ok: true; value: T } | { ok: false; error: string } {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: `not JSON: ${(e as Error).message}` };
    }
    const r = req.schema.safeParse(json);
    return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.message };
  }

  // `stale`: the cache holds a row for this key that no longer parses. The fresh answer replaces
  // it; kept, the bad row would be paid for again on every run.
  async function live<T>(req: LlmRequest<T>, key: string, stale: boolean, spend?: OnSpend): Promise<LlmResult<T>> {
    if (!opts.transport) throw new Error('live mode needs a transport (OPENAI_API_KEY missing?)');
    costUsd(req.model, ZERO_USAGE); // a model with no price fails here, before anything is billed
    const raws: string[] = [];
    let usage = ZERO_USAGE;
    let user = req.user;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await opts.transport(req, user);
      spend?.(r.usage, costUsd(req.model, r.usage));
      raws.push(r.text);
      usage = addUsage(usage, r.usage);
      const p = parse(req, r.text);
      if (p.ok) {
        const cost = costUsd(req.model, usage);
        (stale ? opts.store.cache.replace : opts.store.cache.put)({
          key,
          model: req.model,
          prompt_version: req.promptVersion,
          tag: req.tag ?? null,
          request: JSON.stringify({ system: req.system, user: req.user, schemaName: req.schemaName, effort: req.effort ?? null }),
          response: r.text,
          usage: JSON.stringify(usage),
          cost_usd: cost,
        });
        return { output: p.value, usage, costUsd: cost, source: 'live' };
      }
      log('parse_failed', { schemaName: req.schemaName, attempt, error: p.error.slice(0, 300) });
      // One retry with the error appended (plan U5); the cache key stays that of the original request.
      user = `${req.user}\n\nYour previous answer did not match the required schema: ${p.error.slice(0, 1_000)}\nAnswer again with valid JSON only.`;
    }
    throw new LlmOutputError(`${req.schemaName}: output failed schema twice`, raws);
  }

  return {
    async complete<T>(req: LlmRequest<T>, spend?: OnSpend): Promise<LlmResult<T>> {
      const key = requestKey(req);
      const row = opts.store.cache.get(key);
      if (row) {
        const p = parse(req, row.response);
        if (p.ok) {
          // Usage is validated too: a hand-edited replay file must not silently poison the cost table.
          const usage = Usage.parse(JSON.parse(row.usage));
          spend?.(usage, row.cost_usd);
          return { output: p.value, usage, costUsd: row.cost_usd, source: 'cache' };
        }
        log('cache_row_unparseable', { key, error: p.error.slice(0, 200) });
      }
      if (opts.mode === 'replay') throw new ReplayMissError(key, { model: req.model, schemaName: req.schemaName, tag: req.tag });
      return live(req, key, !!row, spend);
    },
  };
}

export type LlmClient = ReturnType<typeof createClient>;

// Wires mode and key from config. Only live mode gets a transport, so no run started in the
// default replay mode can bill the owner, whatever is in .env. Live without a key fails at the
// first call, not at startup.
export function clientFromConfig(store: Store): LlmClient {
  const key = config.OPENAI_API_KEY;
  const mode = config.LLM_MODE;
  return createClient({ mode, store, transport: mode === 'live' && key ? openaiTransport(key) : undefined });
}
