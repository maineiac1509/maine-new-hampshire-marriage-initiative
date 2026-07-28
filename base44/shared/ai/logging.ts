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

// ============================================================
// Cost Estimation (Provider-Agnostic)
// ============================================================
// When the provider does not return token counts, tokens are estimated
// from character count (~4 chars per token). Cost uses conservative
// default rates — future providers can override via config.

const COST_PER_1K_TOKENS = {
  prompt: 0.001,
  completion: 0.002,
};

export function estimateTokensFromChars(charCount) {
  if (!charCount || charCount <= 0) return 0;
  return Math.ceil(charCount / 4);
}

export function estimateCost(promptTokens, completionTokens) {
  const p = promptTokens || 0;
  const c = completionTokens || 0;
  if (p === 0 && c === 0) return 0;
  const cost = (p / 1000) * COST_PER_1K_TOKENS.prompt + (c / 1000) * COST_PER_1K_TOKENS.completion;
  return Math.round(cost * 10000) / 10000;
}

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
        prompt_tokens: entry.promptTokens || null,
        completion_tokens: entry.completionTokens || null,
        estimated_cost: entry.estimatedCost || 0,
        context_size: entry.contextSize || 0,
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