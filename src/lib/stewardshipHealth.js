// Stewardship Health Foundation
//
// An operational indicator — not a performance rating. It answers one question:
// "Would additional intentional care likely benefit this Champion relationship?"
//
// Health is derived dynamically from existing stewardship activity. No Champion
// data is duplicated. Thresholds are centralized here so they can be configured
// later without touching consumption surfaces.
//
// Extensibility: computeStewardshipHealth is the single entry point. Future
// signals (event attendance, prayer requests, volunteer feedback, Champion
// milestones, Weekend to Remember participation, relationship trends) can be
// folded into this function without changing any UI that consumes it.

const DAY = 86400000;

export const STEWARDSHIP_HEALTH_CONFIG = {
  // Days of stewardship inactivity before each level applies.
  thresholds: {
    followUp: 30,
    reEngagement: 60,
    immediate: 90,
  },
};

// Four stewardship health levels. Soft, ministry-encouraging colors used
// consistently across the dashboard widget, profile badge, and directory.
// Order: most cared-for first.
export const STEWARDSHIP_HEALTH_LEVELS = [
  { key: 'healthy', label: 'Healthy', tone: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'follow-up', label: 'Follow-up Recommended', tone: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  { key: 're-engagement', label: 'Re-engagement Opportunity', tone: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', dot: 'bg-orange-500' },
  { key: 'immediate', label: 'Immediate Attention', tone: 'bg-red-100 text-red-700', bar: 'bg-red-500', dot: 'bg-red-500' },
];

const LEVEL_MAP = STEWARDSHIP_HEALTH_LEVELS.reduce((m, l) => { m[l.key] = l; return m; }, {});

export function getHealthLevel(key) {
  return LEVEL_MAP[key] || STEWARDSHIP_HEALTH_LEVELS[0];
}

function toMs(val) {
  if (!val) return 0;
  const t = new Date(val.length > 10 ? val : val + 'T00:00:00').getTime();
  return Number.isNaN(t) ? 0 : t;
}

// Latest stewardship activity timestamp. Falls back to a registration / created
// date so a brand-new Champion is not prematurely flagged before first contact.
export function lastStewardshipMs(activities, fallbackDate) {
  let latest = 0;
  (activities || []).forEach((a) => {
    const t = toMs(a.activity_date || a.created_date);
    if (t && t > latest) latest = t;
  });
  if (!latest && fallbackDate) latest = toMs(fallbackDate);
  return latest;
}

// Compute stewardship health for a single Champion.
// Returns { key, level, daysSinceActivity, lastActivityMs }.
export function computeStewardshipHealth({ activities, fallbackDate }) {
  const lastMs = lastStewardshipMs(activities, fallbackDate);
  const { followUp, reEngagement, immediate } = STEWARDSHIP_HEALTH_CONFIG.thresholds;

  if (!lastMs) {
    // No activity and no fallback date — encourage first contact.
    return { key: 'immediate', level: getHealthLevel('immediate'), daysSinceActivity: null, lastActivityMs: 0 };
  }

  const daysSince = Math.floor((Date.now() - lastMs) / DAY);
  let key = 'healthy';
  if (daysSince >= immediate) key = 'immediate';
  else if (daysSince >= reEngagement) key = 're-engagement';
  else if (daysSince >= followUp) key = 'follow-up';

  return { key, level: getHealthLevel(key), daysSinceActivity: daysSince, lastActivityMs: lastMs };
}

// Count Champions per health level. Used by the dashboard Stewardship Health widget.
export function computeHealthDistribution(households, activitiesByHouse) {
  const counts = { healthy: 0, 'follow-up': 0, 're-engagement': 0, immediate: 0 };
  (households || []).forEach((h) => {
    const { key } = computeStewardshipHealth({
      activities: (activitiesByHouse || {})[h.id] || [],
      fallbackDate: h.registration_date || h.created_date,
    });
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}