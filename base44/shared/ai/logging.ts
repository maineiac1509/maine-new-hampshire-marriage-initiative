// ============================================================
// AI Request Logging (Metadata Only)
// ============================================================
// CRITICAL: This module NEVER logs ministry content.
// No prompts, responses, champion names, notes, or any PII are stored.
// Only operational metadata is logged for observability and monitoring.
//
// Logging is best-effort — failures here must never block AI operations.
// ============================================================

import { waitUntil } from 'base44:runtime';

// Logs AI request metadata asynchronously (non-blocking via waitUntil).
// The AI response is returned to the caller immediately; the log write
// completes in the background.
export function logAIRequest(base44, entry) {
  waitUntil((async () => {
    try {
      await base44.asServiceRole.entities.AIRequestLog.create({
        request_id: entry.requestId,
        user_id: entry.userId,
        capability: entry.capability,
        provider: entry.provider,
        model: entry.model,
        duration_ms: entry.durationMs,
        token_usage: entry.tokenUsage || null,
        success: entry.success,
        error_category: entry.errorCategory || null,
        context_entities_count: entry.contextEntitiesCount || 0,
        context_sources: entry.contextSources || [],
        feature_flag_source: entry.featureFlagSource || 'global',
      });
    } catch (_error) {
      // Logging failures are silently swallowed — observability is best-effort
      // and must never interrupt Champion Connect.
    }
  })());
}