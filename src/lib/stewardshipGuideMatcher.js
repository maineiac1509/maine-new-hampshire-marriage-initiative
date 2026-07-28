// Stewardship Guide — situation taxonomy + recommendation matcher.
//
// This module is intentionally modular and deterministic (no AI in Epic 6).
// Epic 7 may swap detectChampionSituations / recommendGuidesForChampion for
// intelligence-engine-driven logic without touching the UI layers.

export const CHAMPION_SITUATIONS = [
  { key: 'new_champion', label: 'New Champion' },
  { key: 'inactive', label: 'Inactive / Re-engagement' },
  { key: 'recent_event', label: 'Recently Attended Event' },
  { key: 'volunteer', label: 'Volunteer' },
  { key: 'marriage_concern', label: 'Marriage Concern' },
  { key: 'milestone', label: 'Celebrating a Milestone' },
  { key: 'coffee_meeting', label: 'Coffee Meeting' },
  { key: 'leadership_development', label: 'Leadership Development' },
  { key: 'church_partnership', label: 'Church Partnership' },
  { key: 'prayer', label: 'Prayer & Spiritual Care' },
];

export const GUIDE_CATEGORIES = [
  'First Contact',
  'Re-engagement',
  'Coffee Meeting',
  'Follow-up',
  'Volunteer Encouragement',
  'Prayer & Spiritual Care',
  'Marriage Crisis',
  'Leadership Development',
  'Celebrating Milestones',
  'Church Partnership',
  'General',
];

export function situationLabel(key) {
  return CHAMPION_SITUATIONS.find((s) => s.key === key)?.label || key;
}

// Build a lightweight context object from the champion's activity history.
// Future signals (from the Ministry Intelligence Engine) can extend this.
export function buildChampionContext(champion, activities = []) {
  const ctx = {};
  if (Array.isArray(activities) && activities.length) {
    const dates = activities.map((a) => a.activity_date).filter(Boolean).sort();
    const latest = dates[dates.length - 1];
    if (latest) {
      const days = Math.floor((Date.now() - new Date(latest + 'T00:00:00')) / 86400000);
      ctx.lastActivityDate = latest;
      ctx.daysSinceActivity = days;
      ctx.attendedRecently = days <= 30 && activities.some(
        (a) => a.activity_type === 'In Person' || a.outcome === 'Interested' || a.outcome === 'Serving'
      );
    }
  }
  const notes = (champion?.notes || '').toLowerCase();
  if (notes.includes('marriage') || notes.includes('crisis')) ctx.marriageConcern = true;
  if (notes.includes('milestone') || notes.includes('anniversary')) ctx.milestone = true;
  return ctx;
}

// Deterministic rule registry. Each rule tests a champion (+ context) and returns
// a matched situation + a human-readable reason shown to the leader.
export const SITUATION_RULES = [
  {
    situation: 'new_champion',
    test: (c) => ['New', 'First Contact Needed', 'Assigned'].includes(c?.relationship_status),
    reason: () => 'This Champion is new to the ministry — a first-contact approach may be helpful.',
  },
  {
    situation: 'inactive',
    test: (c) => c?.relationship_status === 'Inactive' || c?.champion_status === 'Inactive',
    reason: () => 'This Champion appears inactive. A gentle re-engagement approach may be timely.',
  },
  {
    situation: 'recent_event',
    test: (_c, ctx) => ctx?.attendedRecently === true,
    reason: () => 'This Champion recently attended an event. A follow-up guide may be timely.',
  },
  {
    situation: 'volunteer',
    test: (c) => c?.champion_status === 'Active' && Boolean(c?.volunteer_team_id || c?.assigned_volunteer),
    reason: () => 'This Champion is serving as a volunteer — encouragement can go a long way.',
  },
  {
    situation: 'marriage_concern',
    test: (_c, ctx) => ctx?.marriageConcern === true,
    reason: () => 'A marriage concern has been noted — a care-focused guide may be appropriate.',
  },
  {
    situation: 'milestone',
    test: (_c, ctx) => ctx?.milestone === true,
    reason: () => 'This Champion may be celebrating a milestone.',
  },
];

export function detectChampionSituations(champion, context = {}) {
  const matched = [];
  for (const rule of SITUATION_RULES) {
    try {
      if (rule.test(champion, context)) {
        matched.push({ situation: rule.situation, reason: rule.reason(champion, context) });
      }
    } catch (e) {
      // skip rule on error — keep recommendations resilient
    }
  }
  return matched;
}

// Match enabled, non-archived guides against a champion's detected situations.
// Returns [{ guide, situations: [keys], reasons: [strings] }] sorted by display_order.
export function recommendGuidesForChampion(champion, guides, context = {}) {
  const matched = detectChampionSituations(champion, context);
  if (!matched.length) return [];

  const reasonBySituation = {};
  matched.forEach((m) => { reasonBySituation[m.situation] = m.reason; });
  const matchedKeys = Object.keys(reasonBySituation);

  return (guides || [])
    .filter(
      (g) =>
        !g.archived &&
        g.enabled !== false &&
        Array.isArray(g.situations) &&
        g.situations.some((s) => matchedKeys.includes(s))
    )
    .map((g) => {
      const applicable = g.situations.filter((s) => matchedKeys.includes(s));
      return { guide: g, situations: applicable, reasons: applicable.map((s) => reasonBySituation[s]) };
    })
    .sort((a, b) => (a.guide.display_order ?? 999) - (b.guide.display_order ?? 999));
}