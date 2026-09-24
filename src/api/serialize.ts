// The one public shape of a result, shared by the API and `cli tag --json` (contract in ARCHITECTURE.md section 7).

import type { TagResult } from '../pipeline/tag.js';

export function toApi(r: TagResult) {
  return {
    manufacturer_id: r.manufacturerId,
    status: r.status,
    entity_type: r.entityType,
    categories: r.accepted.map((d) => ({
      id: d.id,
      name: d.name,
      confidence: d.confidence,
      quote: d.quote,
      reason: d.reason,
      quote_match: d.quoteMatch,
      retrieval_score: d.retrievalScore,
      ...(d.storageInferred ? { storage_inferred: true } : {}),
      ...(d.movedFrom ? { moved_from: d.movedFrom } : {}),
    })),
    rejected: r.rejected.map((d) => ({ id: d.id, name: d.name, confidence: d.confidence, reason: d.reason, reject_reason: d.rejectReason })),
    evidence: r.evidence,
    usage: r.usage,
    cost_usd: r.costUsd,
    versions: r.versions,
    duration_ms: r.durationMs,
    cached: r.cached,
    error: r.error,
  };
}

export type ApiResult = ReturnType<typeof toApi>;
