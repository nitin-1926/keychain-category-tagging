import { z } from 'zod';

// .env is optional: tests and replay runs need no key. Node 22 reads it natively.
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

const Env = z.object({
  OPENAI_API_KEY: z.string().optional(),
  LLM_MODE: z.enum(['live', 'replay']).default('replay'),
  MODEL_PIPELINE: z.string().default('gpt-6-luna'),
  EMBED_MODEL: z.string().default('Xenova/multilingual-e5-small'),
  // The exact upstream commit the committed index was embedded with (its files checked
  // byte-identical to it, AI_LOG entry 19). Unpinned, a re-push of the model repo would silently
  // put new queries in a different vector space from the stored categories. Set to `main` when
  // pointing EMBED_MODEL at another model.
  EMBED_REVISION: z.string().default('761b726dd34fb83930e26aab4e9ac3899aa1fa78'),
  // Calibration (artifacts/calibration.json): no judge verdict below 0.7, so cutoffs 0.5 to 0.7 score identically (F1 86.0%); 0.6 stays.
  CUTOFF: z.coerce.number().min(0).max(1).default(0.6),
  NON_MANUFACTURER_POLICY: z.enum(['empty', 'tag']).default('empty'),
  QUERY_MODE: z.enum(['name', 'name_quote', 'conditional']).default('name'),
  SOURCE_DB: z.string().default('data/category_tagging.sqlite'),
  ARTIFACTS_DIR: z.string().default('artifacts'),
});

// Every setting below except llmConcurrency can change a tagging answer, so all of them are part of
// the result key (pipeline/tag.ts versions()). A new one added here joins the key by default.
export const config = {
  ...Env.parse(process.env),
  // Prompt versions are part of every cache key; the result key also hashes the prompt text.
  prompts: { profile: 'v2', profileReduce: 'v2', judge: 'v2' },
  minCleanedChars: 2_000, // below this the site says too little to tag: `insufficient_content`
  chunkChars: 1_000,
  windowChars: 40_000, // ~10K tokens at 4 chars/token; corrected from measured usage after the first live runs
  llmConcurrency: 4,
  effortProfile: 'low' as const, // extraction: low reasoning (owner: "manage the effort and thinking"). The judge runs at the model default.
  embedDefinitionChars: 1_000, // how much of each definition the dense side embeds; the sweep is in index/taxonomy.ts
  retrievalK: 8,
  shortlistCap: 120,
  // A hard ceiling on the scaled cap max(120, 3 x card phrases): 20 judge batches at most, so no
  // site can pull in the whole taxonomy. The largest shortlist over the 30 is 527, so it never binds.
  shortlistMax: 600,
  shortlistMarginFloor: 0.002, // conditional QUERY_MODE: top-k RRF spread below this = "flat"
  judgeBatchSize: 30,
  judgeHeadChars: 2_000, // the site head the judge always sees, for entity context
  judgeDefinitionChars: 300, // how much of each candidate's definition goes into a judge batch
};
