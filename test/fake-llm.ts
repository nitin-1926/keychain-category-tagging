// The one way tests fake a model: a Transport, the seam a real provider plugs into, so every test
// call goes through the same parse, retry, cache and cost path as a live one. A handler returns the
// model's answer as an object, or as a raw string to simulate output that fails its schema.
import { openStore, type Store } from '../src/db/store.js';
import { createClient, type LlmRequest, type Transport } from '../src/llm/client.js';
import { ZERO_USAGE, type Usage } from '../src/llm/pricing.js';

type Handler = (req: LlmRequest<unknown>, user: string) => unknown;

export function fakeLlm(handlers: Record<string, Handler>, opts: { store?: Store; usage?: Usage } = {}) {
  const store = opts.store ?? openStore(':memory:');
  let calls = 0;
  const transport: Transport = async (req, user) => {
    calls++;
    const fn = handlers[req.schemaName];
    if (!fn) throw new Error(`no fake answer for ${req.schemaName}`);
    const out = fn(req, user);
    return { text: typeof out === 'string' ? out : JSON.stringify(out), usage: opts.usage ?? ZERO_USAGE };
  };
  return { llm: createClient({ mode: 'live', store, transport, log: () => {} }), store, calls: () => calls };
}

// The candidate ids a judge request asks about, read back out of its prompt.
export const candidateIds = (user: string): number[] => (JSON.parse(user.split('CANDIDATES\n')[1]!) as { id: number }[]).map((c) => c.id);
