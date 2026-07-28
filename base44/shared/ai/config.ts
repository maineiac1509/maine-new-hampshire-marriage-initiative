// ============================================================
// AI Configuration Loader
// ============================================================
// Loads configuration from the persisted AIConfig entity, merging
// with safe defaults. Configuration is centralized here so future
// admin UI can edit values without code changes.
//
// If no config record exists or retrieval fails, safe defaults
// (AI disabled) are returned — never let config break the app.
// ============================================================

export const DEFAULT_CONFIG = {
  ai_enabled: false,
  provider: 'base44',
  model: 'automatic',
  temperature: 0.3,
  max_tokens: 2000,
  timeout_ms: 30000,
  max_retries: 2,
  max_context_size: 50000,
  context_reduction: {
    recency_window_days: 90,
    max_items_per_source: 50,
    summarize_older_records: true,
    hard_truncate_enabled: true,
  },
  feature_flags: {
    global: false,
    organizations: {},
    regions: {},
    churches: {},
    users: {},
  },
};

// Loads config from the AIConfig entity (service role — bypasses RLS).
// Falls back to DEFAULT_CONFIG on any error.
export async function loadConfig(base44) {
  try {
    const records = await base44.asServiceRole.entities.AIConfig.list();
    const stored = records && records[0];
    if (!stored) return { ...DEFAULT_CONFIG };
    return {
      ...DEFAULT_CONFIG,
      ...stored,
      context_reduction: {
        ...DEFAULT_CONFIG.context_reduction,
        ...(stored.context_reduction || {}),
      },
      feature_flags: {
        ...DEFAULT_CONFIG.feature_flags,
        ...(stored.feature_flags || {}),
      },
    };
  } catch (_error) {
    // Config retrieval failure must never break AI operations.
    // Return safe defaults with AI disabled.
    return { ...DEFAULT_CONFIG };
  }
}