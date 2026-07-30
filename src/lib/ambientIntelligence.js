// ============================================================
// Ambient Intelligence Engine — Orchestration Layer
// ============================================================
// Coordinates all Ministry Coach capabilities into a single,
// context-aware ministry companion that quietly surfaces meaningful
// assistance throughout Champion Connect.
//
// The engine NEVER generates AI content itself. It orchestrates
// existing capabilities so they appear naturally, consistently, and
// only when they provide meaningful ministry value.
//
// Core Philosophy:
//   "What would be most helpful to this Marriage Champion right now?"
//   Often the answer is: Nothing. Silence remains a feature.
//
// Priority Model: Critical > Important > Helpful > Informational
// Only the highest-priority suggestion surfaces at a time.
// ============================================================

import { detectAllMoments } from './ambientMoments';
import { isDismissed, isSnoozed, computeAmbientFingerprint } from './ambientState';
import { isCapabilityEnabled } from './ministryCoachConfig';

const PRIORITY_WEIGHTS = { critical: 0, important: 1, helpful: 2, informational: 3 };
const DAY = 86400000;

/**
 * Evaluate the full ministry context and determine the single
 * suggestion that should surface — or null for silence.
 *
 * @param {object} params
 * @param {object} params.context - Ministry data (household, activities, reflections, etc.)
 * @param {object} params.state - Ambient state (dismissed, snoozed, history)
 * @param {object} params.config - AIConfig (ai_enabled, capabilities)
 * @returns {object} { suggestion, fingerprint, allCandidates, evaluatedAt }
 */
export function evaluateAmbientContext({ context, state, config }) {
  const fingerprint = computeAmbientFingerprint(context);

  // Performance: reuse cached result if context hasn't changed
  if (fingerprint === state.lastFingerprint && state.cachedSuggestion !== undefined && state.cachedSuggestion !== null) {
    return {
      suggestion: state.cachedSuggestion,
      fingerprint,
      allCandidates: [],
      evaluatedAt: state.lastEvaluation,
      fromCache: true,
    };
  }

  // 1. Detect all moments from deterministic rules
  const allMoments = detectAllMoments(context);

  // 2. Filter by charter compliance (would a champion naturally help?)
  const charterCompliant = allMoments.filter(m => passesCharter(m, context));

  // 3. Filter by capability availability (is the required capability enabled?)
  const capabilityAvailable = charterCompliant.filter(m => {
    if (!config?.ai_enabled) return false;
    return isCapabilityEnabled(config, m.capability);
  });

  // 4. Filter by dismissal/snooze state (ministry rhythm awareness)
  const notDismissedOrSnoozed = capabilityAvailable.filter(m =>
    !isDismissed(state, m.id) && !isSnoozed(state, m.id)
  );

  // 5. Apply cross-capability awareness (avoid repetitive recommendations)
  const crossCapFiltered = notDismissedOrSnoozed.filter(m =>
    passesCrossCapabilityCheck(m, context, state)
  );

  // 6. Sort by priority (Critical first, then secondary weight)
  const sorted = crossCapFiltered.sort((a, b) => {
    const pa = PRIORITY_WEIGHTS[a.priority] ?? 3;
    const pb = PRIORITY_WEIGHTS[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    return (a.secondaryWeight || 0) - (b.secondaryWeight || 0);
  });

  // 7. Return the single highest-priority suggestion — or silence
  const top = sorted[0] || null;

  return {
    suggestion: top,
    fingerprint,
    allCandidates: sorted.map(m => ({ id: m.id, priority: m.priority, title: m.title })),
    evaluatedAt: new Date().toISOString(),
    fromCache: false,
  };
}

// ============================================================
// Charter Enforcement
// ============================================================
// The Ministry Coach Charter's governing question:
// "Would an experienced Marriage Champion naturally offer help
// in this moment?"
//
// These checks ensure the engine never surfaces something
// a wise champion would not naturally think of.
// ============================================================
function passesCharter(moment, context) {
  // Communication suggestions: stay silent if ALL preferences are restricted
  if (moment.capability === 'communication_coach') {
    const h = context.household;
    if (h?.do_not_call && h?.do_not_text && h?.email_opt_out) return false;
  }
  return true;
}

// ============================================================
// Cross-Capability Awareness
// ============================================================
// Capabilities should become aware of one another to prevent
// conflicting or repetitive recommendations.
// ============================================================
function passesCrossCapabilityCheck(moment, context, state) {
  // Resource: don't surface if a resource was shared in the last 7 days
  if (moment.id === 'resource_opportunity') {
    const { resourceViews, resourceFavorites } = context;
    const recent = [...(resourceViews || []), ...(resourceFavorites || [])].some(item => {
      const d = new Date(item.viewed_date || item.created_date);
      return Date.now() - d.getTime() < 7 * DAY;
    });
    if (recent) return false;
  }

  // Communication: delay if a communication was drafted/logged today
  if (moment.capability === 'communication_coach' && moment.id !== 'first_contact') {
    const { communicationLogs, activities } = context;
    const today = new Date().toISOString().slice(0, 10);
    const veryRecent = [...(communicationLogs || []), ...(activities || [])].some(item => {
      const d = (item.date || item.activity_date || '').slice(0, 10);
      return d === today;
    });
    if (veryRecent) return false;
  }

  return true;
}

// ============================================================
// Suggestion Lifecycle Helpers
// ============================================================

// Determine if a suggestion has naturally expired based on context changes
export function hasSuggestionExpired(suggestion, context) {
  if (!suggestion) return true;

  const { activities, communicationLogs, reflections } = context;

  switch (suggestion.id) {
    case 'prayer_followup':
    case 'first_contact':
    case 'relationship_drift':
    case 'communication_followup': {
      // Expire if a communication was logged after the suggestion was surfaced
      const lastComm = [...(activities || []), ...(communicationLogs || [])]
        .map(a => a.activity_date || a.date)
        .filter(Boolean)
        .sort()
        .pop();
      if (!lastComm) return false;
      return new Date(lastComm) > new Date(suggestion.surfacedAt || 0);
    }
    case 'reflection_opportunity': {
      const latestReflection = (reflections || [])
        .map(r => r.reflection_date)
        .filter(Boolean)
        .sort()
        .pop();
      if (!latestReflection) return false;
      return new Date(latestReflection) > new Date(suggestion.surfacedAt || 0);
    }
    case 'celebration_anniversary': {
      // Expires at the end of the anniversary month
      const regDate = context.household?.registration_date;
      if (!regDate) return true;
      const now = new Date();
      const regMonth = new Date(regDate + 'T00:00:00').getMonth();
      return now.getMonth() !== regMonth;
    }
    default:
      return false;
  }
}