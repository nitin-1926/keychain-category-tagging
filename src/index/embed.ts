import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { existsSync } from 'node:fs';
import { config } from '../config.js';

// Local multilingual embeddings: a 118 MB ONNX model in .model-cache/, no API and no cost.
// Called by: index/taxonomy.ts (every category once at build time, every phrase at query time)
// and eval/compare.ts (to ask whether a missed category was on the card at all).
// Callers add the e5 prefixes themselves: 'passage: ' for categories, 'query: ' for card phrases.
env.cacheDir = '.model-cache';
env.allowRemoteModels = process.env.EMBED_OFFLINE !== '1';

export const DIMS = 384;

export function modelCached(): boolean {
  return existsSync(`.model-cache/${config.EMBED_MODEL}/onnx/model_quantized.onnx`);
}

let extractor: Promise<FeatureExtractionPipeline> | undefined;

export async function embed(texts: string[], batch = 32): Promise<Float32Array[]> {
  // A failed load must not be cached: the first embed of a served process happens inside the
  // first request, and a wedged promise would fail every later one.
  extractor ??= pipeline('feature-extraction', config.EMBED_MODEL, { dtype: 'q8' }).catch((e) => {
    extractor = undefined;
    throw e;
  });
  const ex = await extractor;
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += batch) {
    const r = await ex(texts.slice(i, i + batch), { pooling: 'mean', normalize: true });
    const [n, d] = r.dims as [number, number];
    const data = r.data as Float32Array;
    for (let j = 0; j < n; j++) out.push(data.slice(j * d, (j + 1) * d));
  }
  return out;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k]! * b[k]!;
  return s;
}
