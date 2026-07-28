// ============================================================
// Intelligent Context Reduction
// ============================================================
// Relevance-weighted strategy for keeping context within model limits
// while preserving the most valuable ministry information.
//
// Strategy (applied only when context exceeds maxContextSize):
//
//   Tier 1 — Always Retained:
//     Champion core record, active assignments, active team,
//     flagged items (follow-up required, do-not-contact),
//     prayer history.
//
//   Tier 2 — Retained if Recent:
//     Activities, communications, and notes within the recency
//     window (default: 90 days).
//
//   Tier 3 — Summarized:
//     Older records are deterministically aggregated into compact
//     historical_summary entries (grouped by type + month).
//     No AI is used for summarization — this is pure data reduction.
//
//   Tier 4 — Hard Truncate:
//     If context still exceeds limits after summarization, the oldest
//     non-priority items are removed until the package fits.
//
// The strategy is fully configurable via AIConfig.context_reduction
// and can evolve without changes to business logic.
// ============================================================

import { AIError, AI_ERROR_CATEGORIES } from './errors.ts';

const DEFAULT_REDUCTION_CONFIG = {
  recency_window_days: 90,
  max_items_per_source: 50,
  summarize_older_records: true,
  hard_truncate_enabled: true,
};

// Tier 1 — entities that are always retained regardless of age.
function isPriorityEntity(entity) {
  if (entity.type === 'champion') return true;
  if (entity.type === 'assignment' && entity.assignment_status === 'Active') return true;
  if (entity.type === 'volunteer_team') return true;
  if (entity.follow_up_required === true) return true;
  if (entity.do_not_call === true || entity.do_not_text === true || entity.email_opt_out === true) return true;
  if (entity.type === 'activity' && entity.activity_type === 'Prayer') return true;
  return false;
}

// Extracts the most relevant date from an entity for recency comparison.
function getEntityDate(entity) {
  const dateField =
    entity.activity_date ||
    entity.date ||
    entity.assigned_date ||
    entity.end_date ||
    entity.created_date;
  if (!dateField) return null;
  const d = new Date(dateField);
  return isNaN(d.getTime()) ? null : d;
}

// Tier 2 — checks if an entity falls within the recency window.
function isRecent(entity, cutoffDate) {
  const date = getEntityDate(entity);
  if (!date) return false;
  return date >= cutoffDate;
}

// Tier 3 — deterministically summarizes older records into compact aggregates.
// Groups by type + month, preserving outcome distribution without storing
// individual records. No AI involved — pure data reduction.
function summarizeOlderRecords(olderEntities) {
  const groups = {};
  for (const entity of olderEntities) {
    const date = getEntityDate(entity);
    const monthKey = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : 'unknown';
    const typeKey = entity.type || 'unknown';
    const groupKey = `${typeKey}:${monthKey}`;
    if (!groups[groupKey]) {
      groups[groupKey] = { type: typeKey, period: monthKey, records: [] };
    }
    groups[groupKey].records.push(entity);
  }

  const summaries = [];
  for (const group of Object.values(groups)) {
    const outcomes = {};
    for (const r of group.records) {
      const label = r.outcome || r.communication_type || r.activity_type;
      if (label) outcomes[label] = (outcomes[label] || 0) + 1;
    }
    summaries.push({
      type: 'historical_summary',
      period: group.period,
      record_type: group.type,
      count: group.records.length,
      outcomes: Object.keys(outcomes).length > 0 ? outcomes : null,
    });
  }
  return summaries;
}

// Tier 4 — removes oldest non-priority entities until the package fits.
function hardTruncate(entities, maxContextSize, protectedEntities) {
  const protectedSet = new Set(protectedEntities);
  const protectedArr = [];
  const sortable = [];
  for (const e of entities) {
    if (protectedSet.has(e)) protectedArr.push(e);
    else sortable.push(e);
  }

  // Sort ascending by date (oldest first) so oldest are removed first.
  sortable.sort((a, b) => {
    const da = getEntityDate(a) || new Date(0);
    const db = getEntityDate(b) || new Date(0);
    return da.getTime() - db.getTime();
  });

  while (sortable.length > 0) {
    const candidate = [...protectedArr, ...sortable];
    if (JSON.stringify(candidate).length <= maxContextSize) break;
    sortable.shift();
  }

  return [...protectedArr, ...sortable];
}

// Main entry point — reduces context if it exceeds the size limit.
// Returns: { entities, reduced, summary }
export function reduceContext(entities, maxContextSize, reductionConfig = {}) {
  const config = { ...DEFAULT_REDUCTION_CONFIG, ...reductionConfig };
  const serialized = JSON.stringify(entities);

  if (serialized.length <= maxContextSize) {
    return { entities, reduced: false, summary: null };
  }

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - config.recency_window_days * 24 * 60 * 60 * 1000);

  // Classify entities into priority tiers.
  const always = [];
  const recent = [];
  const older = [];

  for (const entity of entities) {
    if (isPriorityEntity(entity)) {
      always.push(entity);
    } else if (isRecent(entity, cutoffDate)) {
      recent.push(entity);
    } else {
      older.push(entity);
    }
  }

  let result = [...always, ...recent];
  const reductionSummary = {
    originalEntityCount: entities.length,
    strategy: 'none',
    olderRecordsSummarized: 0,
    olderRecordsTruncated: 0,
  };

  // Tier 3 — summarize older records into compact aggregates.
  if (config.summarize_older_records && older.length > 0) {
    const summaries = summarizeOlderRecords(older);
    result.push(...summaries);
    reductionSummary.olderRecordsSummarized = older.length;
    reductionSummary.strategy = 'summarized';
  } else {
    // Summarization disabled — keep older records for now;
    // hard truncation will remove them if needed.
    result.push(...older);
  }

  // Tier 4 — hard truncate if still over the limit.
  if (JSON.stringify(result).length > maxContextSize && config.hard_truncate_enabled) {
    const beforeCount = result.length;
    result = hardTruncate(result, maxContextSize, always);
    reductionSummary.olderRecordsTruncated = beforeCount - result.length;
    reductionSummary.strategy = config.summarize_older_records
      ? 'summarized_and_truncated'
      : 'truncated';
  }

  reductionSummary.finalEntityCount = result.length;

  // Final safety check — if we still can't fit, fail gracefully.
  const finalSize = JSON.stringify(result).length;
  if (finalSize > maxContextSize) {
    throw new AIError(
      AI_ERROR_CATEGORIES.CONTEXT_TOO_LARGE,
      `Context package exceeds maximum size (${finalSize} > ${maxContextSize} characters) even after reduction.`
    );
  }

  return { entities: result, reduced: true, summary: reductionSummary };
}