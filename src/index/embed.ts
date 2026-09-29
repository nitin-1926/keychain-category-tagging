import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { existsSync } from 'node:fs';
import { config } from '../config.js';

// Local multilingual embeddings: a 118 MB ONNX model in .model-cache/, no API and no cost.
// Called by: index/taxonomy.ts (every category once at build time, every phrase at query time)
// and eval/compare.ts (to ask whether a missed category was on the card at all).
// The model's own conventions live here, so swapping EMBED_MODEL touches this file only: e5 is
// trained with a 'passage: ' prefix on documents and 'query: ' on searches, and the vector size is
// whatever the model returns.
env.cacheDir = '.model-cache';
env.allowRemoteModels = process.env.EMBED_OFFLINE !== '1';

// transformers.js files a pinned revision under its own directory; `main` sits at the model root.
// (It also fetches `main`'s config.json to list files for its progress display; the config,
// tokenizer and weights that compute vectors all load from the pinned revision.)
export function modelCached(): boolean {
  const dir = config.EMBED_REVISION === 'main' ? config.EMBED_MODEL : `${config.EMBED_MODEL}/${config.EMBED_REVISION}`;
  return existsSync(`.model-cache/${dir}/onnx/model_quantized.onnx`);
}

let extractor: Promise<FeatureExtractionPipeline> | undefined;

async function embed(texts: string[]): Promise<Float32Array[]> {
  // A failed load must not be cached: the first embed of a served process happens inside the
  // first request, and a wedged promise would fail every later one.
  extractor ??= pipeline('feature-extraction', config.EMBED_MODEL, { dtype: 'q8', revision: config.EMBED_REVISION }).catch((e) => {
    extractor = undefined;
    throw e;
  });
  const ex = await extractor;
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += 32) {
    const r = await ex(texts.slice(i, i + 32), { pooling: 'mean', normalize: true });
    const [n, d] = r.dims as [number, number];
    const data = r.data as Float32Array;
    for (let j = 0; j < n; j++) out.push(data.slice(j * d, (j + 1) * d));
  }
  return out;
}

export const embedPassages = (texts: string[]) => embed(texts.map((t) => `passage: ${t}`));
export const embedQueries = (texts: string[]) => embed(texts.map((t) => `query: ${t}`));

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k]! * b[k]!;
  return s;
}
