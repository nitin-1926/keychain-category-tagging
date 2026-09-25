// The one public shape of a result, shared by every route and by `cli tag --json`, so the contract
// cannot drift between them (README "Service contract", ARCHITECTURE.md section 7).
// Called by: api/routes.ts and cli.ts. Calls: nothing - it is a pure rename of TagResult.

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
