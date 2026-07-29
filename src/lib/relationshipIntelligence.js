// ============================================================
// Relationship Intelligence — Task, Schema, and Cache Helpers
// ============================================================
// Configuration for the first user-facing Ministry Coach capability.
// The AI task prompt and structured output schema live here so they
// can evolve without touching the card component.
//
// All AI interactions flow through the AI Foundation (Epic 7.1):
//   Card → aiRequest backend function → RIE → Context Builder →
//   Prompt Framework → Orchestrator → Validated Response Contract
// ============================================================

export const RELATIONSHIP_INTELLIGENCE_CAPABILITY = 'relationship_intelligence';

// Detailed task prompt sent to the AI Orchestrator.
// Emphasizes that this is about the MINISTRY RELATIONSHIP, not marriage health.
export const RELATIONSHIP_INTELLIGENCE_TASK = `Analyze the ministry relationship with this Champion and provide Relationship Intelligence to help the ministry volunteer or leader understand the current state of the relationship.

This is about the HEALTH OF THE MINISTRY RELATIONSHIP — the quality and consistency of engagement between the ministry volunteer and the Champion. It is NEVER about the quality of the Champion's marriage.

Produce the following sections:

1. MINISTRY SNAPSHOT: A concise summary (2–5 sentences) describing the current ministry relationship. Cover overall engagement, the current season of the relationship, recent momentum, and notable ministry patterns. If context is limited, acknowledge that rather than making assumptions.

2. RELATIONSHIP HEALTH: An overall assessment of the ministry relationship. Use exactly one value: "Thriving", "Growing", "Stable", "Needs Attention", or "Limited Context". Include a brief explanation of why this assessment was made. If there is insufficient data to assess, use "Limited Context".

3. KEY INSIGHTS: Several evidence-based observations about the relationship. Each insight must include supporting evidence from the context data. Focus on patterns: communication frequency changes, follow-up consistency, emerging leadership opportunities, prayer activity, resource engagement, or momentum indicators.

4. SUGGESTED NEXT STEPS: Practical, optional ministry suggestions. Each suggestion must include a rationale. Examples: schedule a conversation, celebrate recent progress, introduce a FamilyLife resource, continue the current rhythm, invite into leadership, follow up on a prayer request. These are suggestions only — never directives.

5. SUPPORTING EVIDENCE: Concise, understandable evidence references for the insights and suggestions. Example: "Based on four conversations during the past eight weeks."

6. CONFIDENCE: "High", "Medium", or "Low" — reflecting the completeness of ministry history, richness of context, and amount of recent engagement. This never reflects the Champion's value or ministry success. Include a brief explanation.

GUARDRAILS:
- Never diagnose marriages, predict behavior, or speculate.
- Never create assignments, send communication, or edit ministry records.
- Never fabricate evidence or hide uncertainty.
- If context is insufficient, say so explicitly and set relationship_health to "Limited Context".
- Every insight and suggestion must be grounded in the provided context data.
- Remain humble when information is limited.
- The goal is to assist ministry, never to direct it.`;

// Structured output schema enforced by the AI Orchestrator.
// The Orchestrator validates that all required fields are present.
export const RELATIONSHIP_INTELLIGENCE_SCHEMA = {
  type: 'object',
  properties: {
    ministry_snapshot: {
      type: 'string',
      description: 'Concise summary (2–5 sentences) of the current ministry relationship.',
    },
    relationship_health: {
      type: 'string',
      enum: ['Thriving', 'Growing', 'Stable', 'Needs Attention', 'Limited Context'],
      description: 'Overall assessment of the ministry relationship health.',
    },
    health_explanation: {
      type: 'string',
      description: 'Brief explanation of why this health assessment was made.',
    },
    key_insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          insight: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
      description: 'Evidence-based observations about the relationship.',
    },
    suggested_next_steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          suggestion: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
      description: 'Optional ministry suggestions with rationale.',
    },
    supporting_evidence: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concise evidence references for insights and suggestions.',
    },
    confidence: {
      type: 'string',
      enum: ['High', 'Medium', 'Low'],
      description: 'Confidence level reflecting context completeness.',
    },
    confidence_explanation: {
      type: 'string',
      description: 'Brief explanation of the confidence level.',
    },
    limited_context: {
      type: 'boolean',
      description: 'True when context is insufficient for meaningful analysis.',
    },
  },
  required: [
    'ministry_snapshot',
    'relationship_health',
    'health_explanation',
    'confidence',
    'confidence_explanation',
  ],
};

// ============================================================
// Cache Helpers (localStorage)
// ============================================================
// Caches Relationship Intelligence per Champion so we only call the
// AI when data has changed significantly or the user manually refreshes.
// Never stores ministry content beyond the AI's structured output.

const CACHE_KEY_PREFIX = 'ri_cache_';

function getCacheKey(householdId) {
  return `${CACHE_KEY_PREFIX}${householdId}`;
}

export function getCachedResult(householdId) {
  try {
    const raw = localStorage.getItem(getCacheKey(householdId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.result) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedResult(householdId, result, generatedAt, fingerprint) {
  try {
    localStorage.setItem(
      getCacheKey(householdId),
      JSON.stringify({ result, generatedAt, fingerprint })
    );
  } catch {
    // localStorage may be unavailable (private mode) — fail silently.
  }
}

// Computes a lightweight fingerprint of ministry data to detect
// significant changes that would warrant regenerating intelligence.
// Does not capture every field — only the dimensions that materially
// affect relationship analysis.
export function computeFingerprint(household, activities, assignments) {
  const lastActivity = (activities || [])
    .map((a) => a.activity_date || a.created_date || '')
    .filter(Boolean)
    .sort()
    .pop() || '';
  return [
    household?.relationship_status || '',
    household?.champion_status || '',
    (activities || []).length,
    (assignments || []).length,
    lastActivity,
  ].join('|');
}