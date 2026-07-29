// Stewardship Recommendation Engine
//
// The ministry intelligence layer of Champion Connect. Proactively surfaces
// ministry opportunities using transparent, explainable business rules — never AI.
//
// Design principles:
//  - Recommendations assist leaders; they never make decisions.
//  - Every recommendation explains exactly which rule generated it.
//  - Derived purely from existing stewardship data (no duplication).
//  - Extensible: new rules are added to the RULES registry without touching
//    existing logic or consumers. This is the foundation for Epic 7 (Ministry
//    Coach AI), which will consume this structured data — not replace it.
import { computeStewardshipHealth, lastStewardshipMs } from '@/lib/stewardshipHealth';
import { buildAssignmentMap } from '@/lib/assignmentUtils';

const DAY = 86400000;

// Centralized, configurable thresholds for recommendation rules.
// Adjust these values to tune the engine — no other code changes required.
export const RECOMMENDATION_CONFIG = {
  capacityThresholdPct: 90,
  transferMonitoringDays: 30,
  endingSoonDays: 14,
};

export const RECOMMENDATION_TYPES = [
  'Follow-up Needed',
  'Immediate Attention',
  'Re-engagement Opportunity',
  'New Champion Awaiting Stewardship',
  'Team Near Capacity',
  'Recently Transferred Champion',
  'Stewardship Ending Soon',
];

export const RECOMMENDATION_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

// --- time helpers ---
function toMs(val) {
  if (!val) return 0;
  const t = new Date(val.length > 10 ? val : val + 'T00:00:00').getTime();
  return Number.isNaN(t) ? 0 : t;
}
function daysSince(val) {
  const t = toMs(val);
  if (!t) return null;
  return Math.floor((Date.now() - t) / DAY);
}
function daysUntil(val) {
  const t = toMs(val);
  if (!t) return null;
  return Math.floor((t - Date.now()) / DAY);
}
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s.length > 10 ? s : s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// Relative date label for timeline display (Today / Yesterday / N days ago).
// Falls back to a formatted date for older items. Returns { label, title }.
export function relativeDate(s) {
  if (!s) return null;
  const t = new Date(s.length > 10 ? s : s + 'T00:00:00').getTime();
  if (Number.isNaN(t)) return null;
  const title = new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const diff = Date.now() - t;
  if (diff < 0) return { label: 'just now', title };
  const days = Math.floor(diff / DAY);
  if (days <= 0) return { label: 'Today', title };
  if (days === 1) return { label: 'Yesterday', title };
  if (days < 30) return { label: `${days} days ago`, title };
  return { label: title, title };
}

// --- collection helpers ---
function groupBy(arr, key) {
  const m = {};
  (arr || []).forEach((x) => { const k = x[key]; if (k) (m[k] = m[k] || []).push(x); });
  return m;
}
function byKey(arr, key) {
  const m = {};
  (arr || []).forEach((x) => { if (x[key] && !m[x[key]]) m[x[key]] = x; });
  return m;
}
function householdName(h) {
  if (!h) return 'Champion';
  if (h.household_name) return h.household_name;
  const ln = (h._members || []).find((m) => m.last_name)?.last_name;
  return ln ? `${ln} Household` : 'Champion';
}

// A derived recommendation (not yet persisted). `why` is an explicit list of
// the rule reasons — never a generic message.
function rec({ identity, type, priority, household_id, volunteer_team_id, assignment_id, assigned_volunteer, why, suggested_action, nav_target }) {
  return {
    identity, type, priority,
    household_id: household_id || undefined,
    volunteer_team_id: volunteer_team_id || undefined,
    assignment_id: assignment_id || undefined,
    assigned_volunteer: assigned_volunteer || undefined,
    why, suggested_action, nav_target,
  };
}

// --- Rule registry ---
// Each rule: { type, priority, evaluate(ctx) -> [derivedRec] }
// ctx = { households, assignments, teams, activities, activitiesByHouse,
//         assignmentMap, householdMap, activeByTeam }
// Add new rules here; existing rules and consumers never need to change.
const RULES = [
  {
    type: 'Follow-up Needed',
    priority: 'Medium',
    evaluate(ctx) {
      return ctx.households.filter((h) => ctx.assignmentMap[h.id]?.active).map((h) => {
        const acts = ctx.activitiesByHouse[h.id] || [];
        const health = computeStewardshipHealth({ activities: acts, fallbackDate: h.registration_date || h.created_date });
        if (health.key !== 'follow-up') return null;
        const a = ctx.assignmentMap[h.id].active;
        return rec({
          identity: `follow-up:${h.id}`, type: this.type, priority: this.priority,
          household_id: h.id, volunteer_team_id: a.volunteer_team_id, assignment_id: a.id,
          assigned_volunteer: a.assigned_by,
          why: [
            'Stewardship Health changed to Follow-up Recommended',
            health.daysSinceActivity != null
              ? `No stewardship activity recorded in the past ${health.daysSinceActivity} days`
              : 'No stewardship activity has been recorded',
            'Champion currently has an active assignment',
          ],
          suggested_action: 'Review Champion and reach out.',
          nav_target: `/champions/${h.id}`,
        });
      }).filter(Boolean);
    },
  },
  {
    type: 'Immediate Attention',
    priority: 'Critical',
    evaluate(ctx) {
      return ctx.households.filter((h) => ctx.assignmentMap[h.id]?.active).map((h) => {
        const acts = ctx.activitiesByHouse[h.id] || [];
        const health = computeStewardshipHealth({ activities: acts, fallbackDate: h.registration_date || h.created_date });
        if (health.key !== 'immediate') return null;
        const a = ctx.assignmentMap[h.id].active;
        return rec({
          identity: `immediate:${h.id}`, type: this.type, priority: this.priority,
          household_id: h.id, volunteer_team_id: a.volunteer_team_id, assignment_id: a.id,
          assigned_volunteer: a.assigned_by,
          why: [
            'Stewardship Health changed to Immediate Attention',
            health.daysSinceActivity != null
              ? `No stewardship activity recorded in the past ${health.daysSinceActivity} days`
              : 'No stewardship activity has been recorded',
            'Champion currently has an active assignment',
          ],
          suggested_action: 'Contact Champion as soon as practical.',
          nav_target: `/champions/${h.id}`,
        });
      }).filter(Boolean);
    },
  },
  {
    type: 'Re-engagement Opportunity',
    priority: 'High',
    evaluate(ctx) {
      return ctx.households.filter((h) => ctx.assignmentMap[h.id]?.active).map((h) => {
        const acts = ctx.activitiesByHouse[h.id] || [];
        const health = computeStewardshipHealth({ activities: acts, fallbackDate: h.registration_date || h.created_date });
        if (health.key !== 're-engagement') return null;
        const a = ctx.assignmentMap[h.id].active;
        return rec({
          identity: `re-engagement:${h.id}`, type: this.type, priority: this.priority,
          household_id: h.id, volunteer_team_id: a.volunteer_team_id, assignment_id: a.id,
          assigned_volunteer: a.assigned_by,
          why: [
            'Stewardship Health changed to Re-engagement Opportunity',
            health.daysSinceActivity != null
              ? `No stewardship activity recorded in the past ${health.daysSinceActivity} days`
              : 'No stewardship activity has been recorded',
            'Champion currently has an active assignment',
          ],
          suggested_action: 'Plan a reconnect conversation.',
          nav_target: `/champions/${h.id}`,
        });
      }).filter(Boolean);
    },
  },
  {
    type: 'New Champion Awaiting Stewardship',
    priority: 'High',
    evaluate(ctx) {
      return ctx.households.filter((h) => !ctx.assignmentMap[h.id]?.active).map((h) => {
        const days = daysSince(h.registration_date || h.created_date);
        return rec({
          identity: `awaiting-stewardship:${h.id}`, type: this.type, priority: this.priority,
          household_id: h.id,
          why: [
            'Champion has no active stewardship assignment',
            days != null ? `Created ${days} days ago` : 'No registration date recorded',
          ],
          suggested_action: 'Assign an MC Relationship Builder.',
          nav_target: `/champions/${h.id}`,
        });
      });
    },
  },
  {
    type: 'Team Near Capacity',
    priority: 'Medium',
    evaluate(ctx) {
      return ctx.teams.filter((t) => t.active !== false).map((t) => {
        const cap = t.target_capacity || 0;
        if (cap <= 0) return null;
        const count = ctx.activeByTeam[t.id] || 0;
        const pct = Math.round((count / cap) * 100);
        if (pct < RECOMMENDATION_CONFIG.capacityThresholdPct) return null;
        return rec({
          identity: `team-capacity:${t.id}`, type: this.type, priority: this.priority,
          volunteer_team_id: t.id,
          why: [
            `MC Relationship Builder reached ${pct}% of target capacity`,
            `Target capacity is ${cap}; currently stewarding ${count} Champions`,
          ],
          suggested_action: 'Review Relationship Builder workload.',
          nav_target: `/volunteer-teams/${t.id}`,
        });
      }).filter(Boolean);
    },
  },
  {
    type: 'Recently Transferred Champion',
    priority: 'Medium',
    evaluate(ctx) {
      return ctx.assignments.filter((a) => a.reassignment_flag).map((a) => {
        const days = daysSince(a.end_date || a.updated_date);
        if (days === null || days > RECOMMENDATION_CONFIG.transferMonitoringDays) return null;
        const h = ctx.householdMap[a.household_id];
        return rec({
          identity: `transferred:${a.household_id}`, type: this.type, priority: this.priority,
          household_id: a.household_id, volunteer_team_id: a.volunteer_team_id, assignment_id: a.id,
          assigned_volunteer: a.assigned_by,
          why: [
            'Stewardship was recently transferred to another MC Relationship Builder',
            `Transfer occurred ${days} day(s) ago`,
          ],
          suggested_action: 'Confirm successful transition.',
          nav_target: `/champions/${a.household_id}`,
        });
      }).filter(Boolean);
    },
  },
  {
    type: 'Stewardship Ending Soon',
    priority: 'Medium',
    evaluate(ctx) {
      return ctx.assignments.filter((a) => a.assignment_status === 'Active' && a.planned_end_date).map((a) => {
        const days = daysUntil(a.planned_end_date);
        if (days === null || days < 0 || days > RECOMMENDATION_CONFIG.endingSoonDays) return null;
        const h = ctx.householdMap[a.household_id];
        return rec({
          identity: `ending-soon:${a.id}`, type: this.type, priority: this.priority,
          household_id: a.household_id, volunteer_team_id: a.volunteer_team_id, assignment_id: a.id,
          assigned_volunteer: a.assigned_by,
          why: [
            `Assignment is scheduled to end on ${fmtDate(a.planned_end_date)}`,
            days === 0 ? 'That is today' : `That is in ${days} day(s)`,
          ],
          suggested_action: 'Prepare reassignment if necessary.',
          nav_target: `/assignments/${a.id}`,
        });
      }).filter(Boolean);
    },
  },
];

// Derive all current recommendations from data. Pure function — no persistence.
export function deriveRecommendations({ households, assignments, teams, activities }) {
  const activitiesByHouse = groupBy(activities, 'household_id');
  const assignmentMap = buildAssignmentMap(assignments);
  const householdMap = byKey(households, 'id');
  const activeByTeam = {};
  (assignments || []).forEach((a) => {
    if (a.assignment_status === 'Active' && a.volunteer_team_id) {
      activeByTeam[a.volunteer_team_id] = (activeByTeam[a.volunteer_team_id] || 0) + 1;
    }
  });
  const ctx = {
    households: households || [], assignments: assignments || [], teams: teams || [],
    activities: activities || [], activitiesByHouse, assignmentMap, householdMap, activeByTeam,
  };
  const out = [];
  RULES.forEach((rule) => out.push(...rule.evaluate(ctx)));
  // Deduplicate by identity — one recommendation per condition.
  const byId = {};
  out.forEach((r) => { if (!byId[r.identity]) byId[r.identity] = r; });
  const deduped = Object.values(byId);
  // Attach supporting context for display (only when a Champion exists).
  deduped.forEach((r) => {
    if (!r.household_id) return;
    const h = householdMap[r.household_id];
    const acts = activitiesByHouse[r.household_id] || [];
    const lastMs = lastStewardshipMs(acts, h?.registration_date || h?.created_date);
    r.lastActivityDate = lastMs ? new Date(lastMs).toISOString().slice(0, 10) : null;
    r.healthLabel = computeStewardshipHealth({
      activities: acts,
      fallbackDate: h?.registration_date || h?.created_date,
    }).level.label;
  });
  return deduped;
}

// Reconcile derived recommendations with persisted records.
//   - Create new Open records for conditions with no active record.
//   - Complete active records whose condition no longer exists (auto-close).
// "Never reuse old recommendations": Completed/Dismissed records are archived;
// when an issue returns, a brand new Open record is created.
export function syncRecommendations({ derived, existing, scopeHouseholdIds, scopeTeamIds }) {
  const derivedMap = byKey(derived, 'identity');
  const scoped = (existing || []).filter((r) =>
    (r.household_id && scopeHouseholdIds.has(r.household_id)) ||
    (r.volunteer_team_id && scopeTeamIds.has(r.volunteer_team_id))
  );
  // At most one active (Open/Dismissed) record per identity.
  const activeBy = {};
  scoped.filter((r) => r.status !== 'Completed').forEach((r) => {
    if (!activeBy[r.identity]) activeBy[r.identity] = r;
  });

  const toCreate = derived
    .filter((d) => !activeBy[d.identity])
    .map((d) => ({
      identity: d.identity, type: d.type, priority: d.priority,
      household_id: d.household_id, volunteer_team_id: d.volunteer_team_id,
      assignment_id: d.assignment_id, assigned_volunteer: d.assigned_volunteer,
      why: (d.why || []).join('\n'), suggested_action: d.suggested_action, nav_target: d.nav_target,
      status: 'Open',
    }));

  // Any active record whose condition is gone → Completed (archived), so a
  // future return creates a fresh recommendation.
  const toComplete = Object.values(activeBy)
    .filter((r) => !derivedMap[r.identity])
    .map((r) => ({ id: r.id, status: 'Completed', completed_date: todayISO() }));

  return { toCreate, toComplete };
}

// Build the Open display surface: live derived fields + resolved names + days active.
export function buildSurface(recs, derived, households, teams) {
  const derivedMap = byKey(derived, 'identity');
  const householdMap = byKey(households, 'id');
  const teamMap = byKey(teams, 'id');
  return (recs || [])
    .filter((r) => r.status === 'Open' && derivedMap[r.identity])
    .map((r) => toSurfaceItem(r, derivedMap[r.identity], householdMap, teamMap));
}

// Build a surface across ALL statuses (Open/Dismissed/Completed) for history views.
// Open items use live derived fields; Dismissed/Completed use stored fields.
export function buildAllSurface(recs, derived, households, teams) {
  const derivedMap = byKey(derived, 'identity');
  const householdMap = byKey(households, 'id');
  const teamMap = byKey(teams, 'id');
  return (recs || [])
    .map((r) => toSurfaceItem(r, derivedMap[r.identity], householdMap, teamMap))
    .sort((a, b) => (a.status === 'Open' ? -1 : 1) || (b.daysActive - a.daysActive));
}

function toSurfaceItem(r, d, householdMap, teamMap) {
  const h = householdMap[r.household_id];
  const t = teamMap[r.volunteer_team_id];
  const created = r.created_date ? new Date(r.created_date).getTime() : 0;
  const why = d ? d.why : (r.why ? r.why.split('\n').filter(Boolean) : []);
  return {
    id: r.id,
    identity: r.identity,
    type: d ? d.type : r.type,
    priority: d ? d.priority : r.priority,
    household_id: r.household_id,
    volunteer_team_id: r.volunteer_team_id,
    assignment_id: r.assignment_id,
    championName: householdName(h),
    assignedVolunteer: r.assigned_volunteer || '—',
    teamName: t?.team_name || '—',
    why,
    suggestedAction: d ? d.suggested_action : r.suggested_action,
    navTarget: d ? d.nav_target : r.nav_target,
    createdDate: r.created_date,
    daysActive: created ? Math.max(0, Math.floor((Date.now() - created) / DAY)) : 0,
    lastActivityDate: d ? d.lastActivityDate : null,
    healthLabel: d ? d.healthLabel : null,
    confidence: 'Deterministic',
    status: r.status,
  };
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr.length > 10 ? dateStr : dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// Dashboard widget summary from persisted records + Open surface.
export function summaryFrom(recs, surface) {
  const byPri = (p) => surface.filter((s) => s.priority === p).length;
  return {
    open: surface.length,
    critical: byPri('Critical'),
    high: byPri('High'),
    medium: byPri('Medium'),
    low: byPri('Low'),
    dismissedToday: (recs || []).filter((r) => r.status === 'Dismissed' && isToday(r.dismissed_date)).length,
    completedToday: (recs || []).filter((r) => r.status === 'Completed' && isToday(r.completed_date)).length,
  };
}