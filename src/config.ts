import { z } from 'zod';

// .env is optional: tests and replay runs need no key. Node 22 reads it natively.
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

const Env = z.object({
  OPENAI_API_KEY: z.string().optional(),
  LLM_MODE: z.enum(['live', 'replay', 'stub']).default('replay'),
  MODEL_PIPELINE: z.string().default('gpt-6-luna'),
  EMBED_MODEL: z.string().default('Xenova/multilingual-e5-small'),
  // Calibration (artifacts/calibration.json): no judge verdict below 0.7, so cutoffs 0.5 to 0.7 score identically (F1 86.0%); 0.6 stays.
  CUTOFF: z.coerce.number().min(0).max(1).default(0.6),
  NON_MANUFACTURER_POLICY: z.enum(['empty', 'tag']).default('empty'),
  QUERY_MODE: z.enum(['name', 'name_quote', 'conditional']).default('name'),
  SOURCE_DB: z.string().default('data/category_tagging.sqlite'),
  ARTIFACTS_DIR: z.string().default('artifacts'),
});

export const config = {
  ...Env.parse(process.env),
  // Prompt versions are part of every cache key and of every result key.
  prompts: { profile: 'v2', profileReduce: 'v2', judge: 'v2' },
  chunkChars: 1_000,
  windowChars: 40_000, // ~10K tokens at 4 chars/token; corrected from measured usage after the first live runs
  llmConcurrency: 4,
  effortProfile: 'low' as const, // extraction: low reasoning (owner: "manage the effort and thinking"). The judge runs at the model default.
  retrievalK: 8,
  shortlistCap: 120,
  shortlistMarginFloor: 0.002, // conditional QUERY_MODE: top-k RRF spread below this = "flat"
  judgeBatchSize: 30,
  onCardFloor: 0.85, // cause analysis: category name vs card phrase cosine above which the product was "on the card"
};

export type Config = typeof config;
