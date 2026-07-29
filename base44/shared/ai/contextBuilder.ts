// ============================================================
// Context Builder
// ============================================================
// Assembles structured ministry context from all supported entities.
//
// The Context Builder is the ONLY component that retrieves ministry
// data for AI consumption. It respects user permissions by using
// user-scoped SDK calls (RLS-enforced) — any entity the user cannot
// read is automatically excluded.
//
// Missing information is NEVER assumed — absent data is omitted, not
// fabricated. Partial context (some sources failing) is returned with
// warnings rather than failing the entire request.
//
// Supported sources (extensible — add new sources to CONTEXT_SOURCES):
//   champion, household_members, team, timeline, communications,
//   assignments, assignment_history, leadership_actions, signals,
//   reflection_notes, prayer_history, resource_activity, guide_progress,
//   ministry_health
// ============================================================

import { AIError, AI_ERROR_CATEGORIES } from './errors.ts';
import { reduceContext } from './contextReduction.ts';

// Context package version — incremented when the Context Builder schema evolves.
// Enables backward compatibility between Context Builder, Prompt Framework,
// and AI Orchestrator across iterations.
export const CONTEXT_VERSION = '1.0';

// Normalizers strip internal fields and format records for AI consumption.
// They NEVER add data that doesn't exist in the source record.
function normalizeChampion(h) {
  return {
    type: 'champion',
    household_name: h.household_name || null,
    city: h.city || null,
    state: h.state || null,
    area: h.area || null,
    church_name: h.church_name || null,
    church_city: h.church_city || null,
    champion_status: h.champion_status || null,
    relationship_status: h.relationship_status || null,
    registration_date: h.registration_date || null,
    cumulative_registrations: h.cumulative_registrations ?? null,
    do_not_call: h.do_not_call ?? null,
    do_not_text: h.do_not_text ?? null,
    email_opt_out: h.email_opt_out ?? null,
  };
}

function normalizeMember(m) {
  return {
    type: 'household_member',
    first_name: m.first_name || null,
    last_name: m.last_name || null,
    relationship: m.relationship || null,
  };
}

function normalizeTeam(t) {
  return {
    type: 'volunteer_team',
    team_name: t.team_name || t.name || null,
    area: t.area || null,
  };
}

function normalizeActivity(a) {
  return {
    type: 'activity',
    activity_type: a.activity_type || null,
    activity_date: a.activity_date || null,
    outcome: a.outcome || null,
    summary: a.summary || null,
    follow_up_required: a.follow_up_required ?? null,
    follow_up_date: a.follow_up_date || null,
  };
}

function normalizeCommunication(c) {
  return {
    type: 'communication',
    communication_type: c.communication_type || null,
    date: c.date || null,
    subject: c.subject || null,
    outcome: c.outcome || null,
  };
}

function normalizeAssignment(a) {
  return {
    type: 'assignment',
    assignment_status: a.assignment_status || null,
    assigned_date: a.assigned_date || null,
    end_date: a.end_date || null,
    assignment_method: a.assignment_method || null,
    end_reason: a.end_reason || null,
  };
}

function normalizeNote(n) {
  return {
    type: 'note',
    content: n.content || n.notes || null,
    created_date: n.created_date || null,
  };
}

// Registry of context sources. Each source is a retriever function:
//   async (base44, { user, householdId }) -> normalized record[]
// Add future sources here — the Context Builder auto-discovers them.
const CONTEXT_SOURCES = {
  champion: async (base44, { householdId }) => {
    if (!householdId) return [];
    const h = await base44.entities.ChampionHousehold.get(householdId);
    return h ? [normalizeChampion(h)] : [];
  },

  household_members: async (base44, { householdId }) => {
    if (!householdId) return [];
    const members = await base44.entities.HouseholdMember.filter({ household_id: householdId });
    return (members || []).map(normalizeMember);
  },

  team: async (base44, { householdId }) => {
    if (!householdId) return [];
    const assignments = await base44.entities.Assignment.filter({
      household_id: householdId,
      assignment_status: 'Active',
    });
    if (!assignments || assignments.length === 0) return [];
    const teamIds = [...new Set(assignments.map((a) => a.volunteer_team_id).filter(Boolean))];
    const teams = [];
    for (const tid of teamIds) {
      const team = await base44.entities.VolunteerTeam.get(tid);
      if (team) teams.push(normalizeTeam(team));
    }
    return teams;
  },

  timeline: async (base44, { householdId }) => {
    if (!householdId) return [];
    const activities = await base44.entities.ChampionActivity.filter(
      { household_id: householdId },
      '-activity_date',
      20
    );
    return (activities || []).map(normalizeActivity);
  },

  communications: async (base44, { householdId }) => {
    if (!householdId) return [];
    const logs = await base44.entities.CommunicationLog.filter(
      { household_id: householdId },
      '-date',
      20
    );
    return (logs || []).map(normalizeCommunication);
  },

  assignments: async (base44, { householdId }) => {
    if (!householdId) return [];
    const assignments = await base44.entities.Assignment.filter(
      { household_id: householdId },
      '-assigned_date'
    );
    return (assignments || []).map(normalizeAssignment);
  },

  assignment_history: async (base44, { householdId }) => {
    if (!householdId) return [];
    const ended = await base44.entities.Assignment.filter(
      { household_id: householdId, assignment_status: 'Ended' },
      '-end_date'
    );
    return (ended || []).map(normalizeAssignment);
  },

  leadership_actions: async (_base44, { householdId }) => {
    // LeadershipActionItems are linked via signals, which are not directly
    // household-scoped. Placeholder for future household-scoped action items.
    if (!householdId) return [];
    return [];
  },

  signals: async (_base44, { householdId }) => {
    // MinistrySignals are not directly household-scoped in the current schema.
    // Future: filter signals by related_champions containing the household ID.
    if (!householdId) return [];
    return [];
  },

  reflection_notes: async (base44, { householdId }) => {
    if (!householdId) return [];
    const notes = await base44.entities.HouseholdNote.filter(
      { household_id: householdId },
      '-created_date',
      10
    );
    return (notes || []).map(normalizeNote);
  },

  reflections: async (base44, { householdId }) => {
    if (!householdId) return [];
    const reflections = await base44.entities.Reflection.filter(
      { household_id: householdId },
      '-reflection_date',
      10
    );
    return (reflections || []).map((r) => ({
      type: 'reflection',
      reflection_date: r.reflection_date || null,
      summary: r.summary || null,
      timeline_entry: r.timeline_entry || null,
      sentiment: r.sentiment || null,
      prayer_requests: (r.prayer_requests || []).map((p) => p.request || p),
      action_items: (r.action_items || []).map((a) => a.item || a),
      relationship_signals: (r.relationship_signals || []).map((s) => s.signal || s),
      leadership_observations: (r.leadership_observations || []).map((o) => o.observation || o),
    }));
  },

  prayer_history: async (base44, { householdId }) => {
    if (!householdId) return [];
    const prayers = await base44.entities.ChampionActivity.filter(
      { household_id: householdId, activity_type: 'Prayer' },
      '-activity_date',
      10
    );
    return (prayers || []).map(normalizeActivity);
  },

  resource_activity: async (_base44, { householdId }) => {
    // ResourceViews are user-scoped, not household-scoped.
    // Future: aggregate resource activity for a champion context.
    if (!householdId) return [];
    return [];
  },

  guide_progress: async (_base44, { householdId }) => {
    // Guide progress tracking is not yet implemented as an entity.
    // Placeholder for future guide engagement tracking.
    if (!householdId) return [];
    return [];
  },

  ministry_health: async (_base44, { householdId }) => {
    // Ministry health is a derived metric, not a stored entity.
    // Future: compute stewardship health from activities and assignments.
    if (!householdId) return [];
    return [];
  },
};

// Builds a structured context package from requested sources.
// Returns: { sources, entities, warnings, entityCount }
export async function buildContext(base44, opts) {
  const { user, householdId, requestedSources, maxContextSize, reductionConfig } = opts;
  const sources = requestedSources && requestedSources.length > 0
    ? requestedSources
    : Object.keys(CONTEXT_SOURCES);

  const entities = [];
  const retrievedSources = [];
  const warnings = [];

  for (const sourceName of sources) {
    const retriever = CONTEXT_SOURCES[sourceName];
    if (!retriever) {
      warnings.push({ source: sourceName, warning: 'Unknown context source — skipped.' });
      continue;
    }
    try {
      const records = await retriever(base44, { user, householdId });
      if (records.length === 0) {
        warnings.push({ source: sourceName, warning: 'No data available for this Champion.' });
      } else {
        entities.push(...records);
        retrievedSources.push(sourceName);
      }
    } catch (error) {
      // Partial context — log warning and continue with remaining sources.
      warnings.push({ source: sourceName, warning: `Retrieval failed: ${error.message}` });
    }
  }

  // Validate non-empty context.
  if (entities.length === 0) {
    throw new AIError(
      AI_ERROR_CATEGORIES.EMPTY_CONTEXT,
      'No ministry context could be assembled. All sources returned empty or failed.'
    );
  }

  // Apply intelligent context reduction if the package exceeds the size limit.
  // Uses a relevance-weighted strategy: priority entities are always retained,
  // recent records are kept, older records are summarized, and only the oldest
  // non-priority items are truncated as a last resort.
  let finalEntities = entities;
  let reductionSummary = null;
  const serializedSize = JSON.stringify(entities).length;
  if (serializedSize > maxContextSize) {
    const reduction = reduceContext(entities, maxContextSize, reductionConfig);
    finalEntities = reduction.entities;
    reductionSummary = reduction.summary;
    if (reduction.reduced) {
      warnings.push({
        source: 'context_builder',
        warning: `Context reduced from ${entities.length} to ${finalEntities.length} entities (strategy: ${reductionSummary.strategy}).`,
      });
    }
  }

  return {
    contextVersion: CONTEXT_VERSION,
    generatedAt: new Date().toISOString(),
    sources: retrievedSources,
    entities: finalEntities,
    warnings,
    entityCount: finalEntities.length,
    originalEntityCount: entities.length,
    reductionSummary,
  };
}

export const AVAILABLE_CONTEXT_SOURCES = Object.keys(CONTEXT_SOURCES);