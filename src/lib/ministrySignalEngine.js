// Ministry Intelligence Engine
//
// The strategic planning layer of Champion Connect. Generates transparent,
// explainable Ministry Signals from existing intelligence — never AI.
//
// Design principles (mirrors the Recommendation Engine):
//  - Signals help leaders understand WHAT is happening and WHY it matters.
//  - Every signal carries explicit evidence: business rules, metrics, recs.
//  - Reuses calculations from ministryIntelligence.js + recommendationEngine —
//    the engine is an orchestration layer, not a recalculation layer.
//  - Signals are permanent historical records: resolved signals are archived;
//    when an issue returns, a brand-new Open signal is created.
//  - Modular: new rules are added to the SIGNAL_RULES registry without touching
//    existing logic. This is the structured knowledge source for Epic 7.
//  - Thresholds are loaded dynamically from MinistryIntelligenceConfig (admin-
//    editable). With no stored config, defaults are used — so existing signal
//    behavior is unchanged until leadership adjusts policy.
import { RECOMMENDATION_CONFIG, todayISO } from '@/lib/recommendationEngine';
import { DEFAULT_CONFIG_VALUES } from '@/lib/intelligenceConfigSchema';

const DAY = 86400000;

// Map a persisted config record (snake_case) to the engine's config object
// (camelCase keys consumed by signal rules). Falls back to defaults for any
// missing field, so a partial or absent config never breaks signal generation.
export function resolveConfig(stored) {
  const d = DEFAULT_CONFIG_VALUES;
  const s = stored || {};
  return {
    capacityRiskTeamCount: s.capacity_risk_team_count ?? d.capacity_risk_team_count,
    assignmentImbalanceRatio: (s.assignment_imbalance_percentage ?? d.assignment_imbalance_percentage) / 100,
    growthRateThreshold: s.champion_growth_threshold ?? d.champion_growth_threshold,
    recommendationBacklogThreshold: s.max_open_recommendations ?? d.max_open_recommendations,
    criticalRecBacklogThreshold: s.max_critical_recommendations ?? d.max_critical_recommendations,
    transferTrendThreshold: s.transfer_trend_threshold ?? d.transfer_trend_threshold,
    unassignedGrowthThreshold: s.max_unassigned_champions ?? d.max_unassigned_champions,
    signalAgingWarningDays: s.signal_aging_warning_days ?? d.signal_aging_warning_days,
    healthDeclineThreshold: s.health_decline_window ?? d.health_decline_window,
    // Fields reserved for future Ministry Signals — stored & ready to consume.
    capacityWarningThreshold: s.capacity_warning_threshold ?? d.capacity_warning_threshold,
    capacityCriticalThreshold: s.capacity_critical_threshold ?? d.capacity_critical_threshold,
    recommendationAgeThreshold: s.recommendation_age_threshold ?? d.recommendation_age_threshold,
    healthImprovementWindow: s.health_improvement_window ?? d.health_improvement_window,
    householdGrowthThreshold: s.household_growth_threshold ?? d.household_growth_threshold,
    signalAgingCriticalDays: s.signal_aging_critical_days ?? d.signal_aging_critical_days,
    minRecommendationCompletionRate: s.min_recommendation_completion_rate ?? d.min_recommendation_completion_rate,
    minHealthImprovementPercentage: s.min_health_improvement_percentage ?? d.min_health_improvement_percentage,
    volunteerCapacityRequirement: s.volunteer_capacity_requirement ?? d.volunteer_capacity_requirement,
  };
}

// Default config (used when no persisted configuration exists). Values match
// the original hard-coded thresholds, so existing signal behavior is preserved.
export const DEFAULT_SIGNAL_CONFIG = resolveConfig(null);
// Backwards-compatible alias.
export const SIGNAL_CONFIG = DEFAULT_SIGNAL_CONFIG;

export const SIGNAL_CATEGORIES = ['Capacity', 'Stewardship', 'Growth', 'Recommendations', 'Momentum', 'Transfers'];
export const SIGNAL_SEVERITIES = ['Information', 'Low', 'Medium', 'High', 'Critical'];
export const SIGNAL_STATUSES = ['Open', 'Acknowledged', 'Resolved'];

export const SEVERITY_RANK = { Information: 0, Low: 1, Medium: 2, High: 3, Critical: 4 };

// --- small helpers reused across rules ---
function metric(metrics, key) {
  return (metrics || []).find((m) => m.key === key) || null;
}
function riskItem(items, key) {
  return (items || []).find((i) => i.key === key) || null;
}
function activeByTeamMap(assignments) {
  const m = {};
  (assignments || []).forEach((a) => {
    if (a.assignment_status === 'Active' && a.volunteer_team_id) {
      m[a.volunteer_team_id] = (m[a.volunteer_team_id] || 0) + 1;
    }
  });
  return m;
}

// A derived signal (not yet persisted). Array fields are JSON-serialized at sync.
function sig({
  identity, signalType, category, severity, title, description,
  whyGenerated, supportingMetrics, supportingRecommendations,
  relatedChampions, relatedTeams, suggestedAction,
}) {
  return {
    identity, signalType, category, severity, title, description,
    whyGenerated: whyGenerated || [],
    supportingMetrics: supportingMetrics || [],
    supportingRecommendations: supportingRecommendations || [],
    relatedChampions: relatedChampions || [],
    relatedTeams: relatedTeams || [],
    suggestedAction,
  };
}

// --- Rule registry ---
// Each rule: { signalType, category, evaluate(ctx) -> [derivedSignal] }
// ctx = { intel, recommendations, teams, assignments, activeByTeam, config }
// Add new rules here; existing rules and consumers never need to change.
const SIGNAL_RULES = [
  {
    signalType: 'Volunteer Capacity Risk',
    category: 'Capacity',
    evaluate({ intel, recommendations, config }) {
      const over = intel.volunteer.nearCapacity || [];
      if (over.length < config.capacityRiskTeamCount) return [];
      const teamIds = over.map((t) => t.teamId);
      const recs = (recommendations || []).filter((r) => r.status === 'Open' && teamIds.includes(r.volunteer_team_id));
      return [sig({
        identity: 'capacity-risk',
        signalType: this.signalType, category: this.category,
        severity: over.length >= 3 ? 'Critical' : 'High',
        title: `${over.length} Volunteer Team${over.length > 1 ? 's' : ''} near or over capacity`,
        description: `${over.length} active teams have reached ${RECOMMENDATION_CONFIG.capacityThresholdPct}% or more of their target Champion capacity, limiting the ministry's ability to absorb new assignments.`,
        whyGenerated: [
          `Rule: ${over.length} team(s) met or exceeded the ${config.capacityRiskTeamCount}-team capacity-risk threshold`,
          `Each listed team is at or above ${RECOMMENDATION_CONFIG.capacityThresholdPct}% of its target capacity`,
          ...over.map((t) => `${t.teamName}: ${t.count}/${t.capacity} Champions (${t.pct}% utilization)`),
          `${recs.length} open recommendation(s) reference these teams`,
        ],
        supportingMetrics: over.map((t) => ({ label: `${t.teamName} utilization`, value: `${t.count}/${t.capacity} (${t.pct}%)` })),
        supportingRecommendations: recs.map((r) => r.id),
        relatedTeams: teamIds,
        suggestedAction: 'Review team distribution; rebalance Champions across teams or recruit additional volunteers.',
      })];
    },
  },
  {
    signalType: 'Assignment Imbalance',
    category: 'Capacity',
    evaluate({ intel, teams, activeByTeam, config }) {
      const active = (teams || []).filter((t) => t.active !== false && t.target_capacity);
      if (active.length < 3) return [];
      const counts = active.map((t) => ({ team: t, count: activeByTeam[t.id] || 0 }));
      const max = counts.reduce((a, b) => (b.count > a.count ? b : a));
      const avg = counts.reduce((s, c) => s + c.count, 0) / counts.length;
      if (max.count < 1 || max.count < avg * (1 + config.assignmentImbalanceRatio)) return [];
      const ranked = [...counts].sort((a, b) => b.count - a.count).slice(0, 5);
      return [sig({
        identity: 'assignment-imbalance',
        signalType: this.signalType, category: this.category,
        severity: 'Medium',
        title: `${max.team.team_name} carries a disproportionate Champion load`,
        description: `${max.team.team_name} is stewarding ${max.count} Champions — significantly more than the ${Math.round(avg)} average across ${active.length} comparable teams — which may strain stewardship quality.`,
        whyGenerated: [
          `Rule: top team load exceeded the average by more than ${Math.round(config.assignmentImbalanceRatio * 100)}%`,
          `${max.team.team_name}: ${max.count} Champions vs ${Math.round(avg)} team average`,
          `Compared across ${active.length} active teams with defined capacity`,
        ],
        supportingMetrics: ranked.map((c) => ({ label: c.team.team_name, value: `${c.count} Champions` })),
        relatedTeams: [max.team.id],
        suggestedAction: 'Evaluate stewardship redistribution across comparable teams.',
      })];
    },
  },
  {
    signalType: 'Growing Ministry Region',
    category: 'Growth',
    evaluate({ intel, config }) {
      const m = metric(intel.growth.metrics, 'newChampions');
      if (!m || m.value < config.growthRateThreshold) return [];
      const present = (intel.growth.metrics || []).filter((x) => x.value > 0);
      return [sig({
        identity: 'growing-region',
        signalType: this.signalType, category: this.category,
        severity: 'Low',
        title: `Ministry growth is accelerating — ${m.value} new Champions this period`,
        description: `${m.value} new Champions joined this period${m.delta > 0 ? ` (up from ${m.prev} in the prior period)` : ''}, indicating sustained ministry growth that may require additional volunteer capacity.`,
        whyGenerated: [
          `Rule: new Champions (${m.value}) met the ${config.growthRateThreshold} growth-rate threshold`,
          m.delta > 0 ? `Growth increased by ${m.delta} versus the prior period` : 'Growth is steady versus the prior period',
        ],
        supportingMetrics: present.map((x) => ({ label: x.label, value: `${x.value}${x.delta != null && x.delta !== 0 ? ` (${x.delta > 0 ? '+' : ''}${x.delta})` : ''}` })),
        suggestedAction: 'Evaluate additional volunteer recruitment to sustain growth.',
      })];
    },
  },
  {
    signalType: 'Declining Stewardship Health',
    category: 'Stewardship',
    evaluate({ intel, config }) {
      const declines = riskItem(intel.risks.items, 'declines')?.value || 0;
      const immediate = riskItem(intel.risks.items, 'immediate');
      const immediateNow = immediate?.value || 0;
      const trendingUp = immediate && typeof immediate.sub === 'string' && !immediate.sub.startsWith('-') && immediateNow > 0;
      if (declines < config.healthDeclineThreshold && !trendingUp) return [];
      return [sig({
        identity: 'declining-health',
        signalType: this.signalType, category: this.category,
        severity: declines >= config.healthDeclineThreshold * 2 ? 'High' : 'Medium',
        title: `Stewardship health is declining — ${declines} Champions worsened this period`,
        description: `${declines} Champions declined in stewardship health${trendingUp ? `, and Immediate Attention cases are trending upward (${immediateNow})` : ''}, suggesting workload or follow-up gaps.`,
        whyGenerated: [
          `Rule: stewardship health declines (${declines}) met or exceeded the ${config.healthDeclineThreshold} threshold`,
          trendingUp ? `Immediate Attention cases trending upward (${immediateNow} currently)` : 'Immediate Attention cases are not currently increasing',
        ],
        supportingMetrics: [
          { label: 'Champions with declining health', value: declines },
          { label: 'Immediate Attention Champions', value: immediateNow },
          { label: 'Healthy Champions', value: `${intel.health.healthyPct}%` },
        ],
        suggestedAction: 'Review stewardship workload and follow-up cadence across affected teams.',
      })];
    },
  },
  {
    signalType: 'Recommendation Backlog',
    category: 'Recommendations',
    evaluate({ recommendations, config }) {
      const open = (recommendations || []).filter((r) => r.status === 'Open');
      const critical = open.filter((r) => r.priority === 'Critical');
      const now = Date.now();
      const ages = open.map((r) => (r.created_date ? Math.floor((now - new Date(r.created_date).getTime()) / DAY) : 0));
      const avgAge = ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 0;
      if (open.length < config.recommendationBacklogThreshold && critical.length < config.criticalRecBacklogThreshold) return [];
      return [sig({
        identity: 'rec-backlog',
        signalType: this.signalType, category: this.category,
        severity: critical.length >= config.criticalRecBacklogThreshold * 2 ? 'High' : 'Medium',
        title: `Recommendation backlog growing — ${open.length} open (${critical.length} critical)`,
        description: `${open.length} open stewardship recommendations with an average age of ${avgAge} days${critical.length ? `, including ${critical.length} critical` : ''}, indicate the Action Center needs leadership attention.`,
        whyGenerated: [
          `Rule: open recommendations (${open.length}) met the ${config.recommendationBacklogThreshold} backlog threshold`,
          critical.length ? `${critical.length} critical recommendation(s) remain open` : 'No critical recommendations are currently open',
          `Average recommendation age is ${avgAge} days`,
        ],
        supportingMetrics: [
          { label: 'Open recommendations', value: open.length },
          { label: 'Critical open', value: critical.length },
          { label: 'Average age', value: `${avgAge} days` },
        ],
        supportingRecommendations: open.slice(0, 25).map((r) => r.id),
        suggestedAction: 'Review Action Center priorities and resolve aged recommendations.',
      })];
    },
  },
  {
    signalType: 'Positive Ministry Momentum',
    category: 'Momentum',
    evaluate({ intel, config }) {
      const resolution = metric(intel.performance.metrics, 'resolution');
      const improvingItem = (intel.opportunities.items || []).find((i) => i.key === 'improving');
      const improvingVal = improvingItem?.value || 0;
      const nearCapacity = intel.volunteer.nearCapacityCount || 0;
      if (!(resolution && resolution.delta > 0) || improvingVal <= 0 || nearCapacity > (config.volunteerCapacityRequirement || 0)) return [];
      return [sig({
        identity: 'positive-momentum',
        signalType: this.signalType, category: this.category,
        severity: 'Information',
        title: 'Ministry momentum is positive across health, completion, and capacity',
        description: `Recommendation completion is improving (${resolution.value}%, up ${resolution.delta}), ${improvingVal} Champions show improving health, and all volunteer teams remain within healthy capacity.`,
        whyGenerated: [
          'Rule: all three momentum conditions met simultaneously',
          `Recommendation resolution rate improved by ${resolution.delta} percentage points`,
          `${improvingVal} Champions improved in stewardship health this period`,
          'No volunteer teams are currently near or over capacity',
        ],
        supportingMetrics: [
          { label: 'Recommendation resolution rate', value: `${resolution.value}% (+${resolution.delta})` },
          { label: 'Champions with improving health', value: improvingVal },
          { label: 'Teams near capacity', value: nearCapacity },
        ],
        suggestedAction: 'Celebrate ministry progress and share what is working with volunteer teams.',
      })];
    },
  },
  {
    signalType: 'Stewardship Transfer Trend',
    category: 'Transfers',
    evaluate({ intel, config }) {
      const transfers = metric(intel.performance.metrics, 'transfers');
      if (!transfers || transfers.value < config.transferTrendThreshold || transfers.delta <= 0) return [];
      return [sig({
        identity: 'transfer-trend',
        signalType: this.signalType, category: this.category,
        severity: 'Low',
        title: `Stewardship transfers trending up — ${transfers.value} this period`,
        description: `${transfers.value} Champions were transferred between teams this period (up from ${transfers.prev}), which may signal workload strain or volunteer retention concerns.`,
        whyGenerated: [
          `Rule: transfers (${transfers.value}) met the ${config.transferTrendThreshold} threshold and increased versus the prior period`,
          `Transfers rose by ${transfers.delta} compared to the previous period`,
        ],
        supportingMetrics: [
          { label: 'Transfers this period', value: transfers.value },
          { label: 'Change vs prior period', value: `+${transfers.delta}` },
        ],
        suggestedAction: 'Review volunteer retention and the reasons behind recent transfers.',
      })];
    },
  },
  {
    signalType: 'Unassigned Champion Growth',
    category: 'Stewardship',
    evaluate({ intel, config }) {
      const unassigned = intel.volunteer.unassignedCount || 0;
      if (unassigned < config.unassignedGrowthThreshold) return [];
      return [sig({
        identity: 'unassigned-growth',
        signalType: this.signalType, category: this.category,
        severity: 'Medium',
        title: `${unassigned} Champions await stewardship assignment`,
        description: `${unassigned} Champions currently have no active Volunteer Team assignment, indicating a stewardship coverage gap that may leave new Champions without care.`,
        whyGenerated: [
          `Rule: unassigned Champions (${unassigned}) met or exceeded the ${config.unassignedGrowthThreshold} threshold`,
          `${intel.volunteer.totalAvailable || 0} capacity slots are available across active teams`,
        ],
        supportingMetrics: [
          { label: 'Unassigned Champions', value: unassigned },
          { label: 'Available capacity', value: `${intel.volunteer.totalAvailable || 0} slots` },
        ],
        suggestedAction: 'Recruit volunteers or rebalance teams to cover unassigned Champions.',
      })];
    },
  },
];

// Derive all current Ministry Signals from intelligence + recommendations.
// Pure function — no persistence. Reuses the `intel` object computed by
// computeMinistryIntelligence so no metrics are recalculated. Thresholds come
// from the resolved config (admin-editable), defaulting to safe values.
export function deriveSignals({ intel, recommendations = [], teams = [], assignments = [], config }) {
  if (!intel) return [];
  const cfg = config || DEFAULT_SIGNAL_CONFIG;
  const ctx = { intel, recommendations, teams, assignments, activeByTeam: activeByTeamMap(assignments), config: cfg };
  const out = [];
  SIGNAL_RULES.forEach((rule) => out.push(...rule.evaluate(ctx)));
  const byId = {};
  out.forEach((s) => { if (!byId[s.identity]) byId[s.identity] = s; });
  return Object.values(byId);
}

// Reconcile derived signals with persisted records.
//   - Create new Open records for conditions with no active record.
//   - Auto-resolve active records whose condition no longer exists.
// "Never reuse historical signals": Resolved records are archived; when an
// issue returns, a brand-new Open record is created.
export function syncSignals({ derived, existing }) {
  const derivedMap = {};
  derived.forEach((d) => { derivedMap[d.identity] = d; });
  // At most one active (Open/Acknowledged) record per identity.
  const activeBy = {};
  (existing || []).filter((s) => s.status !== 'Resolved').forEach((s) => {
    if (!activeBy[s.identity]) activeBy[s.identity] = s;
  });

  const toCreate = derived
    .filter((d) => !activeBy[d.identity])
    .map((d) => ({
      identity: d.identity, signal_type: d.signalType, category: d.category,
      severity: d.severity, title: d.title, description: d.description,
      why_generated: d.whyGenerated.join('\n'),
      supporting_metrics: JSON.stringify(d.supportingMetrics),
      supporting_recommendations: JSON.stringify(d.supportingRecommendations),
      related_champions: JSON.stringify(d.relatedChampions),
      related_teams: JSON.stringify(d.relatedTeams),
      suggested_action: d.suggestedAction,
      date_generated: todayISO(),
      status: 'Open',
    }));

  // Any active record whose condition is gone → Resolved (archived), so a
  // future return creates a fresh signal.
  const toResolve = Object.values(activeBy)
    .filter((s) => !derivedMap[s.identity])
    .map((s) => ({ id: s.id, status: 'Resolved', resolved_date: todayISO() }));

  return { toCreate, toResolve };
}

function parseJSON(val, fallback) {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch (e) { return fallback; }
}

function teamName(teamMap, id) {
  return teamMap[id]?.team_name || 'Unnamed Team';
}

// Build the active display surface: live derived fields + resolved names + aging.
export function buildSignalSurface(existing, derived, teams, households, config) {
  const cfg = config || DEFAULT_SIGNAL_CONFIG;
  const derivedMap = {};
  derived.forEach((d) => { derivedMap[d.identity] = d; });
  const teamMap = {};
  (teams || []).forEach((t) => { teamMap[t.id] = t; });
  const hhMap = {};
  (households || []).forEach((h) => { hhMap[h.id] = h; });
  return (existing || [])
    .filter((s) => s.status !== 'Resolved')
    .map((s) => toSignalSurface(s, derivedMap[s.identity], teamMap, hhMap, cfg))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

function toSignalSurface(s, d, teamMap, hhMap, cfg) {
  const createdMs = s.created_date ? new Date(s.created_date).getTime() : 0;
  const ackMs = s.acknowledged_date ? new Date(s.acknowledged_date).getTime() : 0;
  const resolvedMs = s.resolved_date ? new Date(s.resolved_date).getTime() : 0;
  const relatedTeams = parseJSON(d?.relatedTeams || s.related_teams, []).map((id) => ({ id, name: teamName(teamMap, id) }));
  const relatedChampions = parseJSON(d?.relatedChampions || s.related_champions, []).map((id) => ({
    id, name: hhMap[id]?.household_name || 'Champion',
  }));
  return {
    id: s.id,
    identity: s.identity,
    signalType: d ? d.signalType : s.signal_type,
    category: d ? d.category : s.category,
    severity: d ? d.severity : s.severity,
    title: d ? d.title : s.title,
    description: d ? d.description : s.description,
    whyGenerated: d ? d.whyGenerated : (s.why_generated ? s.why_generated.split('\n').filter(Boolean) : []),
    supportingMetrics: d ? d.supportingMetrics : parseJSON(s.supporting_metrics, []),
    supportingRecommendations: d ? d.supportingRecommendations : parseJSON(s.supporting_recommendations, []),
    relatedTeams,
    relatedChampions,
    suggestedAction: d ? d.suggestedAction : s.suggested_action,
    dateGenerated: s.date_generated || (s.created_date ? s.created_date.slice(0, 10) : null),
    status: s.status,
    acknowledgedDate: s.acknowledged_date || null,
    resolvedDate: s.resolved_date || null,
    resolutionNotes: s.resolution_notes || '',
    daysOpen: createdMs ? Math.max(0, Math.floor((Date.now() - createdMs) / DAY)) : 0,
    daysSinceAcknowledged: ackMs ? Math.max(0, Math.floor((Date.now() - ackMs) / DAY)) : null,
    daysSinceResolved: resolvedMs ? Math.max(0, Math.floor((Date.now() - resolvedMs) / DAY)) : null,
    isAged: s.status === 'Open' && createdMs ? (Date.now() - createdMs) > cfg.signalAgingWarningDays * DAY : false,
  };
}

// Deterministic narrative assembled from active signals + intelligence summaries.
// Never AI — every sentence is drawn from real calculated data.
export function ministryStory(activeSignals, intel) {
  if (!intel) return [];
  const lines = [];
  lines.push(intel.health.summary);
  lines.push(intel.volunteer.summary);
  if (activeSignals.length) {
    activeSignals.slice(0, 3).forEach((s) => {
      const evidence = (s.whyGenerated && s.whyGenerated[0]) ? s.whyGenerated[0].replace(/^Rule:\s*/i, '') : '';
      lines.push(evidence ? `${s.title} — ${evidence}.` : `${s.title}.`);
    });
  } else {
    lines.push('No active Ministry Signals — the ministry is operating within all configured thresholds.');
  }
  lines.push(intel.performance.summary);
  return lines;
}