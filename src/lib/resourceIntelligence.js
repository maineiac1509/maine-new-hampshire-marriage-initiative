// ============================================================
// Resource Intelligence — Task, Schema, and Cache Helpers
// ============================================================
// Epic 7.5 — The fourth user-facing Ministry Coach capability.
// Recommends ministry resources at meaningful moments throughout
// the Champion journey — not to increase resource consumption, but
// to place the right encouragement into the right hands at the right time.
//
// All AI interactions flow through the AI Foundation (Epic 7.1):
//   ResourceIntelligenceCard → aiRequest backend function →
//   RIE → Context Builder (ministry context) → Prompt Framework →
//   Orchestrator → Validated Response → Resource Intelligence Card
//
// The available resource library is passed via additionalInstructions
// so the AI can only recommend real resources from the library —
// never invented content.
//
// Silence is the default. The Ministry Coach only surfaces when an
// experienced Marriage Champion would naturally think:
// "I know something that might really help them right now."
// ============================================================

export const RESOURCE_INTELLIGENCE_CAPABILITY = 'resource_intelligence';

// Base task prompt sent to the AI Orchestrator.
export const RESOURCE_INTELLIGENCE_TASK = `You are the Resource Intelligence module of the Ministry Coach for the FamilyLife New England Marriage Champion ministry.

Your role is to determine whether a specific ministry resource would naturally benefit the Champion at this moment in their ministry journey — and if so, recommend it with clear reasoning.

This is not about increasing resource consumption. This is about placing the right encouragement, study, devotional, or FamilyLife resource into the hands of a Marriage Champion when it would naturally benefit the Champion they are serving.

MINISTRY PHILOSOPHY:
An experienced Marriage Champion naturally thinks: "I know something that might really help them right now."
Resource Intelligence should emulate that instinct.
Recommendations should feel thoughtful, timely, and personal — not algorithmic.
Never recommend a resource simply because one exists.

GOVERNING QUESTION:
Would an experienced Marriage Champion naturally recommend a resource in this moment?
If the answer is no, return has_recommendation: false.
The Ministry Coach should never be more eager to speak than a wise ministry leader would be.

USING THE MINISTRY CONTEXT PROVIDED (champion profile, household, relationship intelligence, reflections, communication history, prayer requests, timeline, resource activity, assignments, leadership observations, and ministry health) AND THE AVAILABLE RESOURCES LIST provided in the additional instructions:

1. Analyze the current ministry context for themes and moments:
   - Communication themes (multiple reflections discuss communication)
   - Parenting challenges in recent conversations
   - Recurring prayer requests around spiritual growth
   - Marriage enrichment readiness (relationship is thriving and ready for deeper investment)
   - Leadership development signals (champion consistently demonstrates leadership)
   - Life transitions (new child, career change, retirement, empty nest, caregiving)

2. If a meaningful ministry moment exists, match it to ONE resource from the AVAILABLE RESOURCES LIST.
   - Only recommend resources that appear in the available list.
   - Never invent or fabricate resource titles.
   - Never recommend resources in the EXCLUDED list (already engaged).

3. If no meaningful moment exists, return has_recommendation: false.
   - Do not force a recommendation.
   - Silence is the desired behavior when no resource naturally fits.

OUTPUT:
1. has_recommendation: true if a resource recommendation is appropriate, false otherwise.
2. primary_recommendation: The main resource recommendation.
   - resource_title: Must EXACTLY match a title from the available resources list.
   - resource_category: The category of the matched resource.
   - why_this_resource: A concise explanation (1-3 sentences) of why this resource fits this moment.
   - reasoning_evidence: List of specific context signals that informed this recommendation (2-5 items).
   - estimated_time: The estimated reading or viewing time of the resource.
   - appropriate_for: "Current ministry season" or a more specific description.
3. alternative_recommendation: An optional second resource that complements the primary. Only include if genuinely valuable — never to fill space.
4. resource_sequence: Optional logical progression. Only include if multiple resources fit a clear learning or growth path. Each step has a label ("Start Here", "Next", "Later") and a resource_title from the available list.
5. confidence: "High", "Medium", or "Low" — reflecting the strength of the match.
6. confidence_explanation: Brief explanation of the confidence level.

GUARDRAILS:
- Never recommend a resource that is not in the available resources list.
- Never invent resource titles, descriptions, or content.
- Never recommend resources the champion has already engaged with (excluded list).
- Never force a recommendation when no meaningful context exists.
- Never recommend solely because a resource exists.
- Every recommendation must be grounded in specific context evidence.
- If context is insufficient, return has_recommendation: false.
- If confidence is Low, prefer silence (has_recommendation: false) unless the match is genuinely compelling.
- The goal is not to maximize recommendations. It is to ensure every recommendation feels timely, thoughtful, and rooted in real ministry wisdom.
- The success of Resource Intelligence is measured not by how many resources it recommends, but by how often Marriage Champions think: "That's exactly what I was looking for."`;

// Structured output schema enforced by the AI Orchestrator.
export const RESOURCE_INTELLIGENCE_SCHEMA = {
  type: 'object',
  properties: {
    has_recommendation: {
      type: 'boolean',
      description: 'True if a resource recommendation is appropriate, false otherwise.',
    },
    primary_recommendation: {
      type: 'object',
      properties: {
        resource_title: { type: 'string', description: 'Must match a title from the available resources list.' },
        resource_category: { type: 'string' },
        why_this_resource: { type: 'string', description: 'Concise explanation of why this resource fits this moment.' },
        reasoning_evidence: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific context signals that informed this recommendation.',
        },
        estimated_time: { type: 'string' },
        appropriate_for: { type: 'string' },
      },
    },
    alternative_recommendation: {
      type: 'object',
      properties: {
        resource_title: { type: 'string' },
        resource_category: { type: 'string' },
        why_this_resource: { type: 'string' },
        estimated_time: { type: 'string' },
      },
    },
    resource_sequence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          step: { type: 'string', description: 'e.g. "Start Here", "Next", "Later"' },
          resource_title: { type: 'string' },
        },
      },
      description: 'Optional logical progression of resources.',
    },
    confidence: {
      type: 'string',
      enum: ['High', 'Medium', 'Low'],
      description: 'Strength of the match between ministry context and resource.',
    },
    confidence_explanation: { type: 'string' },
  },
  required: ['has_recommendation', 'confidence', 'confidence_explanation'],
};

// ============================================================
// Resource Library Formatting (passed via additionalInstructions)
// ============================================================

export function formatResourceLibrary(resources) {
  if (!resources || resources.length === 0) return '';
  return resources
    .map((r, i) => {
      const time = r.estimated_reading_time || r.estimated_viewing_time || '';
      const topics = (r.topics || []).join(', ');
      const situations = (r.ministry_situations || []).join(', ');
      const desc = (r.description || r.summary || '').substring(0, 150);
      return `${i + 1}. Title: "${r.title}" | Category: ${r.category || 'General'} | Type: ${r.resource_type || ''} | Time: ${time} | Topics: ${topics} | Ministry Situations: ${situations} | Description: ${desc}`;
    })
    .join('\n');
}

export function buildAdditionalInstructions(resources, excludedTitles) {
  const library = formatResourceLibrary(resources);
  const excluded =
    excludedTitles && excludedTitles.length > 0
      ? `\n\nRESOURCES ALREADY ENGAGED (do not recommend these):\n${excludedTitles.map((t) => `- "${t}"`).join('\n')}`
      : '';
  return `AVAILABLE RESOURCES IN THE LIBRARY (only recommend from this list — never invent titles):\n${library}${excluded}`;
}

// ============================================================
// Deterministic Pre-Check — Should we even ask the AI?
// ============================================================
// If the champion has no reflections, no activities, and no
// communications, there is no meaningful ministry context for
// resource recommendation. Stay silent without calling AI.
export function shouldAttemptRecommendation(reflections, activities, communications) {
  const hasReflections = (reflections || []).length > 0;
  const hasActivities = (activities || []).length > 0;
  const hasCommunications = (communications || []).length > 0;
  return hasReflections || hasActivities || hasCommunications;
}

// ============================================================
// Cache Helpers (localStorage)
// ============================================================

const CACHE_KEY_PREFIX = 'resi_cache_';

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
    // localStorage may be unavailable — fail silently.
  }
}

export function computeFingerprint(household, activities, reflections, communications) {
  const lastActivity =
    (activities || []).map((a) => a.activity_date || a.created_date || '').filter(Boolean).sort().pop() || '';
  const lastReflection =
    (reflections || []).map((r) => r.reflection_date || r.created_date || '').filter(Boolean).sort().pop() || '';
  return [
    household?.relationship_status || '',
    household?.champion_status || '',
    (activities || []).length,
    (reflections || []).length,
    (communications || []).length,
    lastActivity,
    lastReflection,
  ].join('|');
}