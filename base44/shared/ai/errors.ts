// ============================================================
// AI Error Handling
// ============================================================
// Standardized error categories for observability and graceful
// failure handling. AI failures must never interrupt Champion Connect.
// ============================================================

export const AI_ERROR_CATEGORIES = {
  TIMEOUT: 'timeout',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  INVALID_RESPONSE: 'invalid_response',
  CONTEXT_TOO_LARGE: 'context_too_large',
  EMPTY_CONTEXT: 'empty_context',
  PARTIAL_CONTEXT: 'partial_context',
  FEATURE_DISABLED: 'feature_disabled',
  PERMISSION_DENIED: 'permission_denied',
  CONFIG_ERROR: 'config_error',
  UNKNOWN: 'unknown',
};

export class AIError extends Error {
  constructor(category, message, options = {}) {
    super(message);
    this.name = 'AIError';
    this.category = category;
    if (options.cause) this.cause = options.cause;
  }
}

// Categorize unknown errors into standard buckets for logging.
export function categorizeError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out')) return AI_ERROR_CATEGORIES.TIMEOUT;
  if (msg.includes('unavailable') || msg.includes('connect') || msg.includes('network') || msg.includes('econnreset')) return AI_ERROR_CATEGORIES.PROVIDER_UNAVAILABLE;
  if (msg.includes('too large') || msg.includes('context size')) return AI_ERROR_CATEGORIES.CONTEXT_TOO_LARGE;
  if (msg.includes('permission') || msg.includes('forbidden') || msg.includes('unauthorized') || msg.includes('403')) return AI_ERROR_CATEGORIES.PERMISSION_DENIED;
  return AI_ERROR_CATEGORIES.UNKNOWN;
}