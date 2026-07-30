// ============================================================
// Ambient Intelligence — State Management
// ============================================================
// Centralized per-champion state for the Ambient Intelligence Engine.
// Persists dismissed suggestions, snooze periods, suggestion history,
// and context fingerprints in localStorage.
//
// This is the single orchestration point — all capability decisions
// flow through this state to ensure coordinated, non-repetitive
// ministry guidance. The engine never asks "What AI can I show?"
// It asks "What would be most helpful to this Marriage Champion
// right now?" — and often the answer is nothing.
// ============================================================

const STATE_KEY_PREFIX = 'ambient_state_';
const DAY = 86400000;
const DEFAULT_COOLING_DAYS = 7;
const INFO_COOLING_DAYS = 3;
const DEFAULT_SNOOZE_HOURS = 24;
const MAX_HISTORY = 50;

function getStateKey(householdId) {
  return `${STATE_KEY_PREFIX}${householdId}`;
}

function createDefaultState() {
  return {
    lastEvaluation: null,
    lastFingerprint: null,
    cachedSuggestion: null,
    dismissed: {},
    snoozed: {},
    history: [],
  };
}

export function loadAmbientState(householdId) {
  try {
    const raw = localStorage.getItem(getStateKey(householdId));
    if (!raw) return createDefaultState();
    return { ...createDefaultState(), ...JSON.parse(raw) };
  } catch {
    return createDefaultState();
  }
}

export function saveAmbientState(householdId, state) {
  try {
    localStorage.setItem(getStateKey(householdId), JSON.stringify(state));
  } catch {
    // localStorage unavailable — fail silently.
  }
}

export function dismissSuggestion(state, suggestionId, priority) {
  const coolingDays = priority === 'informational' ? INFO_COOLING_DAYS : DEFAULT_COOLING_DAYS;
  const now = Date.now();
  return {
    ...state,
    dismissed: {
      ...state.dismissed,
      [suggestionId]: { dismissedAt: now, coolingUntil: now + coolingDays * DAY },
    },
    history: [...state.history, { suggestionId, resolvedAt: now, resolution: 'dismissed' }].slice(-MAX_HISTORY),
  };
}

export function snoozeSuggestion(state, suggestionId, hours = DEFAULT_SNOOZE_HOURS) {
  const now = Date.now();
  return {
    ...state,
    snoozed: {
      ...state.snoozed,
      [suggestionId]: { snoozedAt: now, wakeAt: now + hours * 3600000 },
    },
    history: [...state.history, { suggestionId, resolvedAt: now, resolution: 'snoozed' }].slice(-MAX_HISTORY),
  };
}

export function completeSuggestion(state, suggestionId) {
  const now = Date.now();
  const { [suggestionId]: _s, ...remainingSnoozed } = state.snoozed;
  const { [suggestionId]: _d, ...remainingDismissed } = state.dismissed;
  return {
    ...state,
    dismissed: remainingDismissed,
    snoozed: remainingSnoozed,
    cachedSuggestion: null,
    history: [...state.history, { suggestionId, resolvedAt: now, resolution: 'completed' }].slice(-MAX_HISTORY),
  };
}

export function clearSuggestion(state) {
  return { ...state, cachedSuggestion: null };
}

export function isDismissed(state, suggestionId) {
  const entry = state.dismissed[suggestionId];
  if (!entry) return false;
  if (Date.now() >= entry.coolingUntil) {
    // Cooling period expired — remove stale entry.
    const { [suggestionId]: _d, ...rest } = state.dismissed;
    state.dismissed = rest;
    return false;
  }
  return true;
}

export function isSnoozed(state, suggestionId) {
  const entry = state.snoozed[suggestionId];
  if (!entry) return false;
  if (Date.now() >= entry.wakeAt) {
    const { [suggestionId]: _s, ...rest } = state.snoozed;
    state.snoozed = rest;
    return false;
  }
  return true;
}

export function computeAmbientFingerprint(context) {
  const { household, activities, reflections, communicationLogs, assignments } = context;
  const lastActivity = (activities || []).map(a => a.activity_date || a.created_date || '').filter(Boolean).sort().pop() || '';
  const lastReflection = (reflections || []).map(r => r.reflection_date || r.created_date || '').filter(Boolean).sort().pop() || '';
  const lastComm = (communicationLogs || []).map(l => l.date || l.created_date || '').filter(Boolean).sort().pop() || '';
  return [
    household?.relationship_status || '',
    household?.champion_status || '',
    (activities || []).length,
    (reflections || []).length,
    (communicationLogs || []).length,
    (assignments || []).filter(a => a.assignment_status === 'Active').length,
    lastActivity,
    lastReflection,
    lastComm,
  ].join('|');
}

// Aggregate stats for the Administration page — reads all ambient states.
export function getAmbientStateStats() {
  const states = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STATE_KEY_PREFIX)) {
        const householdId = key.slice(STATE_KEY_PREFIX.length);
        states.push({ householdId, ...loadAmbientState(householdId) });
      }
    }
  } catch {
    // localStorage unavailable.
  }
  const activeCount = states.filter(s => s.cachedSuggestion).length;
  const totalEvaluated = states.length;
  const lastEvaluation = states
    .map(s => s.lastEvaluation)
    .filter(Boolean)
    .sort()
    .pop() || null;
  return { activeCount, totalEvaluated, lastEvaluation, states };
}