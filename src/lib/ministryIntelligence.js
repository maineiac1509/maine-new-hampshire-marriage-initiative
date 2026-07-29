// Ministry Intelligence Layer
//
// Pure, deterministic calculations that turn existing stewardship data into
// structured ministry intelligence. This is the single source of truth for the
// Ministry Intelligence Dashboard and the foundation for Epic 7 (Ministry
// Coach) — future AI conversations consume this structured output rather than
// re-deriving metrics.
//
// Principles:
//  - No AI. Every value is computed from real stewardship data.
//  - Every metric carries a drillTarget so the UI can navigate onward.
//  - Reuses existing engines (stewardshipHealth, assignmentUtils, recommendation
//    config) — no duplicated thresholds or business rules.
import { computeStewardshipHealth, lastStewardshipMs, STEWARDSHIP_HEALTH_CONFIG, STEWARDSHIP_HEALTH_LEVELS } from '@/lib/stewardshipHealth';
import { buildAssignmentMap } from '@/lib/assignmentUtils';
import { RECOMMENDATION_CONFIG } from '@/lib/recommendationEngine';

const DAY = 86400000;

// --- date helpers ---
function toMs(val) {
  if (!val) return 0;
  const t = new Date(val.length > 10 ? val : val + 'T00:00:00').getTime();
  return Number.isNaN(t) ? 0 : t;
}
function inRange(ms, start, end) {
  return ms > 0 && ms >= start && ms <= end;
}
function daysBetween(aMs, bMs) {
  if (!aMs || !bMs) return null;
  return Math.max(0, Math.round(Math.abs(bMs - aMs) / DAY));
}

// Health as-of a point in time. Mirrors computeStewardshipHealth but classifies
// relative to an arbitrary timestamp instead of "now" — used for trend deltas.
const HEALTH_RANK = { healthy: 0, 'follow-up': 1, 're-engagement': 2, immediate: 3 };
export function healthAsOf(activities, fallbackDate, asOfMs) {
  const lastMs = lastStewardshipMs(activities, fallbackDate);
  const ref = asOfMs || Date.now();
  const { followUp, reEngagement, immediate } = STEWARDSHIP_HEALTH_CONFIG.thresholds;
  if (!lastMs) return { key: 'immediate', daysSinceActivity: null };
  const daysSince = Math.floor((ref - lastMs) / DAY);
  let key = 'healthy';
  if (daysSince >= immediate) key = 'immediate';
  else if (daysSince >= reEngagement) key = 're-engagement';
  else if (daysSince >= followUp) key = 'follow-up';
  return { key, daysSinceActivity: daysSince < 0 ? 0 : daysSince };
}

function groupBy(arr, key) {
  const m = {};
  (arr || []).forEach((x) => { const k = x[key]; if (k) (m[k] = m[k] || []).push(x); });
  return m;
}

function pctDelta(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function buildRange(preset) {
  const now = Date.now();
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const end = today.getTime();
  let start;
  switch (preset) {
    case '30d': start = end - 30 * DAY; break;
    case '90d': start = end - 90 * DAY; break;
    case 'ytd': start = new Date(new Date().getFullYear(), 0, 1).getTime(); break;
    case 'all': start = 0; break;
    default: start = end - 30 * DAY;
  }
  const span = end - start;
  return { startMs: start, endMs: end, prevStartMs: start - span, prevEndMs: start, spanMs: span };
}

// Monthly buckets for growth trend (last 6 months ending now).
function monthlyTrend(households, assignments) {
  const buckets = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const start = d.getTime();
    buckets.push({
      label,
      newChampions: households.filter((h) => { const t = toMs(h.created_date); return t >= start && t < next; }).length,
      newAssignments: assignments.filter((a) => { const t = toMs(a.assigned_date); return t >= start && t < next; }).length,
    });
  }
  return buckets;
}

// --- main entry point ---
export function computeMinistryIntelligence({ households = [], assignments = [], teams = [], activities = [], recommendations = [], teamMembers = [], preset = '30d' }) {
  const range = buildRange(preset);
  const { startMs, endMs, prevStartMs, prevEndMs } = range;

  const activitiesByHouse = groupBy(activities, 'household_id');
  const assignmentMap = buildAssignmentMap(assignments);
  const activeAssignments = assignments.filter((a) => a.assignment_status === 'Active');
  const activeByTeam = {};
  activeAssignments.forEach((a) => { if (a.volunteer_team_id) activeByTeam[a.volunteer_team_id] = (activeByTeam[a.volunteer_team_id] || 0) + 1; });
  const membersByTeam = groupBy(teamMembers, 'team_id');
  const activeTeams = teams.filter((t) => t.active !== false);

  // Per-household current + previous health.
  const householdHealth = households.map((h) => {
    const acts = activitiesByHouse[h.id] || [];
    const fb = h.registration_date || h.created_date;
    return {
      h,
      assigned: !!assignmentMap[h.id]?.active,
      current: healthAsOf(acts, fb, endMs),
      previous: healthAsOf(acts, fb, prevEndMs),
    };
  });

  return {
    generatedAt: endMs,
    range,
    health: buildHealth(householdHealth),
    performance: buildPerformance({ assignments, recommendations, activitiesByHouse, range }),
    volunteer: buildVolunteer({ teams: activeTeams, activeByTeam, membersByTeam, households, assignmentMap }),
    growth: buildGrowth({ households, assignments, activitiesByHouse, range }),
    risks: buildRisks({ householdHealth, recommendations, teams: activeTeams, activeByTeam, households, assignmentMap, range }),
    opportunities: buildOpportunities({ householdHealth, recommendations, teams: activeTeams, activeByTeam, range }),
  };
}

// 1. Ministry Health
function buildHealth(householdHealth) {
  const counts = { healthy: 0, 'follow-up': 0, 're-engagement': 0, immediate: 0 };
  const prevCounts = { healthy: 0, 'follow-up': 0, 're-engagement': 0, immediate: 0 };
  householdHealth.forEach((hh) => { counts[hh.current.key]++; prevCounts[hh.previous.key]++; });
  const total = householdHealth.length || 1;
  const distribution = STEWARDSHIP_HEALTH_LEVELS.map((lvl) => ({
    key: lvl.key, label: lvl.label, color: lvl.bar,
    count: counts[lvl.key], prevCount: prevCounts[lvl.key],
    pct: Math.round((counts[lvl.key] / total) * 100),
    delta: counts[lvl.key] - prevCounts[lvl.key],
    drillTarget: `/champions?health=${lvl.key}`,
  }));
  const healthyPct = Math.round(((counts.healthy) / total) * 100);
  const prevHealthyPct = Math.round(((prevCounts.healthy) / total) * 100);
  const atRisk = counts.immediate + counts['re-engagement'];
  const summary = atRisk === 0
    ? `Champion stewardship health is stable — ${healthyPct}% of ${householdHealth.length} Champions are healthy.`
    : `${atRisk} ${atRisk === 1 ? 'Champion needs' : 'Champions need'} renewed stewardship (${counts.immediate} immediate, ${counts['re-engagement']} re-engagement).`;
  return { summary, total: householdHealth.length, distribution, healthyPct, prevHealthyPct };
}

// 2. Stewardship Performance
function buildPerformance({ assignments, recommendations, activitiesByHouse, range }) {
  const { startMs, endMs, prevStartMs, prevEndMs } = range;

  // Average follow-up time = average gap (days) between consecutive activities per Champion.
  function avgCadence(start, end) {
    let sum = 0, n = 0;
    Object.values(activitiesByHouse).forEach((acts) => {
      const ts = acts.map((a) => toMs(a.activity_date || a.created_date)).filter((t) => t && t >= start && t <= end).sort((a, b) => a - b);
      for (let i = 1; i < ts.length; i++) { sum += (ts[i] - ts[i - 1]) / DAY; n++; }
    });
    return n ? Math.round(sum / n) : 0;
  }
  // Average assignment length (days) for assignments ended in window.
  function avgLength(start, end) {
    const lens = assignments
      .filter((a) => a.assignment_status === 'Ended' && inRange(toMs(a.end_date), start, end))
      .map((a) => daysBetween(toMs(a.assigned_date), toMs(a.end_date)))
      .filter((v) => v != null);
    return lens.length ? Math.round(lens.reduce((s, v) => s + v, 0) / lens.length) : 0;
  }
  function newAssignments(start, end) {
    return assignments.filter((a) => inRange(toMs(a.assigned_date), start, end)).length;
  }
  function endedAssignments(start, end) {
    return assignments.filter((a) => inRange(toMs(a.end_date), start, end)).length;
  }
  function transfers(start, end) {
    return assignments.filter((a) => a.reassignment_flag && inRange(toMs(a.end_date || a.updated_date), start, end)).length;
  }
  function resolutionRate(start, end) {
    const inWin = recommendations.filter((r) => inRange(toMs(r.created_date), start, end));
    if (!inWin.length) return 0;
    const completed = inWin.filter((r) => r.status === 'Completed').length;
    return Math.round((completed / inWin.length) * 100);
  }

  const cur = {
    cadence: avgCadence(startMs, endMs),
    length: avgLength(startMs, endMs),
    newAsg: newAssignments(startMs, endMs),
    ended: endedAssignments(startMs, endMs),
    transfers: transfers(startMs, endMs),
    resolution: resolutionRate(startMs, endMs),
  };
  const prev = {
    cadence: avgCadence(prevStartMs, prevEndMs),
    length: avgLength(prevStartMs, prevEndMs),
    newAsg: newAssignments(prevStartMs, prevEndMs),
    ended: endedAssignments(prevStartMs, prevEndMs),
    transfers: transfers(prevStartMs, prevEndMs),
    resolution: resolutionRate(prevStartMs, prevEndMs),
  };

  const metrics = [
    { key: 'cadence', label: 'Average Follow-up Time', value: cur.cadence, unit: 'days', prev: prev.cadence, delta: cur.cadence - prev.cadence, positiveIsGood: false, explanation: 'Average days between consecutive stewardship contacts per Champion.', drillTarget: '/contact-history' },
    { key: 'length', label: 'Average Assignment Length', value: cur.length, unit: 'days', prev: prev.length, delta: cur.length - prev.length, positiveIsGood: true, explanation: 'Average duration of stewardship relationships that ended in this period.', drillTarget: '/assignments?status=Ended' },
    { key: 'newAsg', label: 'New Stewardship Assignments', value: cur.newAsg, unit: '', prev: prev.newAsg, delta: cur.newAsg - prev.newAsg, positiveIsGood: true, explanation: 'MC Relationship Builders newly assigned to Champions in this period.', drillTarget: '/assignments?status=Active' },
    { key: 'ended', label: 'Ended Assignments', value: cur.ended, unit: '', prev: prev.ended, delta: cur.ended - prev.ended, positiveIsGood: false, explanation: 'Stewardship relationships closed in this period.', drillTarget: '/assignments?status=Ended' },
    { key: 'transfers', label: 'Recent Stewardship Transfers', value: cur.transfers, unit: '', prev: prev.transfers, delta: cur.transfers - prev.transfers, positiveIsGood: false, explanation: 'Champions moved between MC Relationship Builders in this period.', drillTarget: '/assignments' },
    { key: 'resolution', label: 'Recommendation Resolution Rate', value: cur.resolution, unit: '%', prev: prev.resolution, delta: cur.resolution - prev.resolution, positiveIsGood: true, explanation: 'Share of recommendations created in this period that are now resolved.', drillTarget: '/recommendations?status=completed' },
  ];
  const summary = cur.newAsg >= cur.ended
    ? `Stewardship is growing — ${cur.newAsg} new assignments vs ${cur.ended} ended this period.`
    : `Stewardship contracted slightly — ${cur.ended} assignments ended vs ${cur.newAsg} new this period.`;
  return { summary, metrics };
}

// 3. Volunteer Intelligence
function buildVolunteer({ teams, activeByTeam, membersByTeam, households, assignmentMap }) {
  const totalCapacity = teams.reduce((s, t) => s + (t.target_capacity || 0), 0);
  const totalAssigned = teams.reduce((s, t) => s + (activeByTeam[t.id] || 0), 0);
  const totalAvailable = Math.max(0, totalCapacity - totalAssigned);
  const totalMembers = teams.reduce((s, t) => s + ((membersByTeam[t.id] || []).length || 1), 0);
  const avgPerVolunteer = totalMembers ? Math.round((totalAssigned / totalMembers) * 10) / 10 : 0;
  const nearCapacity = teams.filter((t) => {
    const cap = t.target_capacity || 0;
    if (cap <= 0) return false;
    return Math.round(((activeByTeam[t.id] || 0) / cap) * 100) >= RECOMMENDATION_CONFIG.capacityThresholdPct;
  });
  const unassignedCount = households.filter((h) => !assignmentMap[h.id]?.active).length;

  const ranked = teams
    .map((t) => ({
      teamId: t.id,       teamName: t.team_name || 'Unnamed Relationship Builder',
      count: activeByTeam[t.id] || 0, capacity: t.target_capacity || 0,
      pct: t.target_capacity ? Math.round(((activeByTeam[t.id] || 0) / t.target_capacity) * 100) : 0,
      drillTarget: `/volunteer-teams/${t.id}`,
    }))
    .sort((a, b) => b.count - a.count);
  const mostActive = ranked.slice(0, 3);
  const leastActive = ranked.slice(-3).reverse();

  const summary = nearCapacity.length
    ? `${nearCapacity.length} ${nearCapacity.length === 1 ? 'Relationship Builder is' : 'Relationship Builders are'} near capacity; ${totalAvailable} Champion slot${totalAvailable === 1 ? '' : 's'} available ministry-wide.`
    : `Volunteer capacity is healthy across all Relationship Builders — ${totalAvailable} slots available ministry-wide.`;
  return { summary, totalCapacity, totalAssigned, totalAvailable, avgPerVolunteer, nearCapacityCount: nearCapacity.length, nearCapacity, unassignedCount, mostActive, leastActive, drillTarget: '/volunteer-teams' };
}

// 4. Ministry Growth
function buildGrowth({ households, assignments, activitiesByHouse, range }) {
  const { startMs, endMs, prevStartMs, prevEndMs } = range;
  const newChampions = households.filter((h) => inRange(toMs(h.created_date), startMs, endMs)).length;
  const newHouseholds = households.filter((h) => inRange(toMs(h.registration_date), startMs, endMs)).length;
  // Recently engaged = first recorded activity falls in window.
  const recentlyEngaged = households.filter((h) => {
    const acts = (activitiesByHouse[h.id] || []).map((a) => toMs(a.activity_date || a.created_date)).filter(Boolean).sort((a, b) => a - b);
    return acts.length && inRange(acts[0], startMs, endMs);
  }).length;
  // Returning = activity in window after a >60-day gap.
  const returning = households.filter((h) => {
    const ts = (activitiesByHouse[h.id] || []).map((a) => toMs(a.activity_date || a.created_date)).filter(Boolean).sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) {
      if (inRange(ts[i], startMs, endMs) && (ts[i] - ts[i - 1]) > 60 * DAY) return true;
    }
    return false;
  }).length;
  const withoutStewardship = households.filter((h) => !(activitiesByHouse[h.id] || []).length).length;

  const prevNewChampions = households.filter((h) => inRange(toMs(h.created_date), prevStartMs, prevEndMs)).length;
  const prevNewHouseholds = households.filter((h) => inRange(toMs(h.registration_date), prevStartMs, prevEndMs)).length;

  const metrics = [
    { key: 'newChampions', label: 'New Champions', value: newChampions, prev: prevNewChampions, delta: newChampions - prevNewChampions, positiveIsGood: true, drillTarget: '/champions' },
    { key: 'newHouseholds', label: 'New Households', value: newHouseholds, prev: prevNewHouseholds, delta: newHouseholds - prevNewHouseholds, positiveIsGood: true, drillTarget: '/champions' },
    { key: 'recentlyEngaged', label: 'Recently Engaged', value: recentlyEngaged, prev: 0, delta: 0, positiveIsGood: true, drillTarget: '/contact-history' },
    { key: 'returning', label: 'Returning Champions', value: returning, prev: 0, delta: 0, positiveIsGood: true, drillTarget: '/contact-history' },
    { key: 'withoutStewardship', label: 'Without Active Stewardship', value: withoutStewardship, prev: 0, delta: 0, positiveIsGood: false, drillTarget: '/champions?view=unassigned' },
  ];
  const trend = monthlyTrend(households, assignments);
  const summary = newChampions > prevNewChampions
    ? `Ministry is growing — ${newChampions} new Champions this period (up from ${prevNewChampions}).`
    : `${newChampions} new Champions joined this period; ${withoutStewardship} still await first stewardship.`;
  return { summary, metrics, trend };
}

// 5. Emerging Risks
function buildRisks({ householdHealth, recommendations, teams, activeByTeam, households, assignmentMap, range }) {
  const now = Date.now();
  const immediateNow = householdHealth.filter((hh) => hh.assigned && hh.current.key === 'immediate').length;
  const immediatePrev = householdHealth.filter((hh) => hh.assigned && hh.previous.key === 'immediate').length;
  const recsOver30 = recommendations.filter((r) => r.status === 'Open' && (now - toMs(r.created_date)) > 30 * DAY).length;
  const aboveCapacity = teams.filter((t) => {
    const cap = t.target_capacity || 0;
    return cap > 0 && (activeByTeam[t.id] || 0) > cap;
  });
  const noRecentActivity = householdHealth.filter((hh) => hh.assigned && (hh.current.key === 'immediate' || hh.current.key === 're-engagement')).length;
  const awaitingAssignment = households.filter((h) => !assignmentMap[h.id]?.active).length;
  const declines = householdHealth.filter((hh) => HEALTH_RANK[hh.current.key] > HEALTH_RANK[hh.previous.key]).length;

  const items = [
    { key: 'immediate', label: 'Immediate Attention Champions', value: immediateNow, sub: `${immediateNow - immediatePrev >= 0 ? '+' : ''}${immediateNow - immediatePrev} vs previous`, severity: 1, explanation: 'Assigned Champions with no stewardship activity in 90+ days.', drillTarget: '/champions?health=immediate' },
    { key: 'recsOver30', label: 'Recommendations Older Than 30 Days', value: recsOver30, severity: 2, explanation: 'Open recommendations that have aged beyond 30 days.', drillTarget: '/recommendations?status=open' },
    { key: 'aboveCapacity', label: 'Relationship Builders Above Capacity', value: aboveCapacity.length, severity: 3, explanation: 'MC Relationship Builders exceeding their target Champion capacity.', drillTarget: '/volunteer-teams' },
    { key: 'noRecent', label: 'Champions Without Recent Activity', value: noRecentActivity, severity: 4, explanation: 'Assigned Champions in follow-up or re-engagement status.', drillTarget: '/champions?health=re-engagement' },
    { key: 'awaiting', label: 'Champions Awaiting Assignment', value: awaitingAssignment, severity: 5, explanation: 'Champions with no active MC Relationship Builder.', drillTarget: '/champions?view=unassigned' },
    { key: 'declines', label: 'Recent Stewardship Health Declines', value: declines, severity: 6, explanation: 'Champions whose health worsened versus the previous period.', drillTarget: '/champions' },
  ].sort((a, b) => a.severity - b.severity);

  const top = items[0];
  const summary = top && top.value > 0
    ? `Top risk: ${top.label.toLowerCase()} (${top.value}). ${declines} Champions declined in health this period.`
    : 'No emerging risks detected — stewardship health is stable across the ministry.';
  return { summary, items };
}

// 6. Ministry Opportunities
function buildOpportunities({ householdHealth, recommendations, teams, activeByTeam, range }) {
  const { startMs, endMs } = range;
  const availableCapacity = teams.reduce((s, t) => Math.max(0, (t.target_capacity || 0) - (activeByTeam[t.id] || 0)) + s, 0);
  const healthyAssigned = householdHealth.filter((hh) => hh.assigned && hh.current.key === 'healthy').length;
  const regionsWithCapacity = teams
    .filter((t) => { const cap = t.target_capacity || 0; return cap > 0 && (activeByTeam[t.id] || 0) / cap < 0.5; })
    .map((t) => ({ teamName: t.team_name, region: t.coverage_regions || t.city || '—', drillTarget: `/volunteer-teams/${t.id}` }))
    .slice(0, 4);
  const improving = householdHealth.filter((hh) => HEALTH_RANK[hh.current.key] < HEALTH_RANK[hh.previous.key]).length;
  const completedRecs = recommendations.filter((r) => r.status === 'Completed' && inRange(toMs(r.completed_date), startMs, endMs)).length;

  const items = [
    { key: 'capacity', label: 'Available Volunteer Capacity', value: availableCapacity, unit: 'slots', explanation: 'Total Champion slots open across all active MC Relationship Builders.', drillTarget: '/volunteer-teams' },
    { key: 'healthy', label: 'Healthy Champions Ready for Deeper Engagement', value: healthyAssigned, unit: '', explanation: 'Assigned Champions with current, consistent stewardship contact.', drillTarget: '/champions?health=healthy' },
    { key: 'regions', label: 'Regions With Capacity', value: regionsWithCapacity.length, unit: '', explanation: 'Relationship Builders below 50% capacity that can take on more Champions.', regions: regionsWithCapacity, drillTarget: '/volunteer-teams' },
    { key: 'improving', label: 'Champions Showing Improving Health', value: improving, unit: '', explanation: 'Champions whose stewardship health improved this period.', drillTarget: '/champions' },
    { key: 'completed', label: 'Recently Completed Recommendations', value: completedRecs, unit: '', explanation: 'Stewardship recommendations resolved in this period.', drillTarget: '/recommendations?status=completed' },
  ];
  const summary = healthyAssigned > 0
    ? `${healthyAssigned} healthy Champions are ready for deeper engagement, with ${availableCapacity} capacity slots available.`
    : 'No Champions are currently in healthy stewardship status — focus on re-engagement first.';
  return { summary, items };
}