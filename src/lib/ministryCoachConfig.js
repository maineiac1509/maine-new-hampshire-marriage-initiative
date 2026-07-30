// ============================================================
// Ministry Coach Configuration — Frontend Helpers
// ============================================================
// Centralizes AIConfig entity loading/saving, capability
// definitions, version constants, and model options for the
// Ministry Coach Administration page.
// ============================================================

import { base44 } from '@/api/base44Client';

// Version constants (kept in sync with backend modules).
export const AI_FOUNDATION_VERSION = '1.0';
export const PROMPT_VERSION = '1.0';
export const CONTEXT_VERSION = '1.0';

// Available AI models (from the Base44 InvokeLLM integration).
export const AVAILABLE_MODELS = [
  { value: 'automatic', label: 'Automatic (recommended)' },
  { value: 'gpt_5_mini', label: 'GPT-5 Mini' },
  { value: 'gpt_5_4', label: 'GPT-5.4' },
  { value: 'gpt_5_6_sol', label: 'GPT-5.6 Sol' },
  { value: 'gemini_3_flash', label: 'Gemini 3 Flash' },
  { value: 'gemini_3_1_pro', label: 'Gemini 3.1 Pro' },
  { value: 'claude_sonnet_4_6', label: 'Claude Sonnet 4.6' },
  { value: 'claude_opus_4_6', label: 'Claude Opus 4.6' },
  { value: 'claude_opus_4_7', label: 'Claude Opus 4.7' },
  { value: 'claude_opus_4_8', label: 'Claude Opus 4.8' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
];

// Available providers (only base44 is registered currently).
export const AVAILABLE_PROVIDERS = [
  { value: 'base44', label: 'Base44 (built-in)', description: 'Uses the built-in Base44 LLM integration. No API key required.' },
];

// Ministry Coach capability definitions.
export const MINISTRY_COACH_CAPABILITIES = [
  {
    key: 'relationship_intelligence',
    name: 'Relationship Intelligence',
    description: 'AI-generated insights about ministry relationship health, key themes, and suggested next steps for each Champion.',
  },
  {
    key: 'reflection_intelligence',
    name: 'Reflection Intelligence',
    description: 'Organizes rough meeting notes into structured ministry knowledge — prayer requests, action items, and relationship signals.',
  },
  {
    key: 'communication_coach',
    name: 'Communication Coach',
    description: 'Context-aware communication drafts that surface at meaningful moments. Never sent automatically — the volunteer always reviews and edits.',
  },
  {
    key: 'resource_intelligence',
    name: 'Resource Intelligence',
    description: 'Recommends ministry resources at meaningful moments — placing the right encouragement into the right hands at the right time.',
  },
];

// Default config values (mirrors backend DEFAULT_CONFIG).
export const DEFAULT_AI_CONFIG = {
  ai_enabled: false,
  capabilities: {
    relationship_intelligence: true,
    reflection_intelligence: true,
    communication_coach: true,
    resource_intelligence: true,
  },
  provider: 'base44',
  model: 'automatic',
  endpoint: '',
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
    organizations: {},
    regions: {},
    churches: {},
    users: {},
  },
};

// Loads the AIConfig record (creates with defaults if none exists).
export async function loadAIConfig() {
  try {
    const records = await base44.entities.AIConfig.list();
    let record = (records && records[0]) || null;
    if (!record) {
      record = await base44.entities.AIConfig.create({ ...DEFAULT_AI_CONFIG });
    }
    return {
      id: record.id,
      config: {
        ...DEFAULT_AI_CONFIG,
        ...record,
        capabilities: { ...DEFAULT_AI_CONFIG.capabilities, ...(record.capabilities || {}) },
        context_reduction: { ...DEFAULT_AI_CONFIG.context_reduction, ...(record.context_reduction || {}) },
        feature_flags: { ...DEFAULT_AI_CONFIG.feature_flags, ...(record.feature_flags || {}) },
      },
    };
  } catch (error) {
    return { id: null, config: { ...DEFAULT_AI_CONFIG } };
  }
}

// Saves partial updates to the AIConfig record.
export async function saveAIConfig(id, updates) {
  const me = await base44.auth.me().catch(() => ({}));
  const payload = {
    ...updates,
    updated_by: me?.full_name || me?.email || 'Administrator',
    last_updated: new Date().toISOString().slice(0, 10),
  };
  if (id) {
    await base44.entities.AIConfig.update(id, payload);
    return id;
  }
  const created = await base44.entities.AIConfig.create({ ...DEFAULT_AI_CONFIG, ...payload });
  return created.id;
}

// Checks if a specific capability is enabled.
export function isCapabilityEnabled(config, capabilityKey) {
  if (!config?.ai_enabled) return false;
  const caps = config.capabilities || {};
  return caps[capabilityKey] !== false;
}