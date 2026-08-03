// Classification of field comparisons for the Reconciliation Dashboard.
//
// A comparison is classified into exactly one of four categories:
//
//   needs_review   — requires administrator action (conflicts, ambiguous matches)
//   auto_resolved  — system generated a default resolution that doesn't need admin input
//   hidden         — no action needed (both blank, same value, NO_ACTION)
//   admin_resolved — administrator already made a manual decision
//
// The default dashboard view shows only "needs_review" items, so a typical
// annual import surfaces only true conflicts and ambiguous matches instead
// of thousands of individual field comparisons.

/**
 * Classify a single field comparison into one of the four categories.
 * @param {object} comparison  — FamilyLifeImportFieldComparison record
 * @param {object} resolution  — matching FamilyLifeImportResolution (or null)
 * @returns {'needs_review'|'auto_resolved'|'hidden'|'admin_resolved'}
 */
export function classifyComparison(comparison, resolution) {
  // 1. Already resolved by administrator (MANUAL or BULK + RESOLVED status)
  if (resolution && resolution.status === 'RESOLVED' &&
      (resolution.resolution_source === 'MANUAL' || resolution.resolution_source === 'BULK')) {
    return 'admin_resolved';
  }

  // 2. Requires admin review — conflicts, ambiguous matches, etc.
  //    These have requires_review = true; the default resolution is a
  //    placeholder, NOT an "automatic" one the user intends to hide.
  if (comparison.requires_review) {
    return 'needs_review';
  }

  // 3. Has an automatic (DEFAULT) resolution — system decided what to do.
  //    Includes KEEP_CURRENT, BLOCK_FIELD, SKIP_FIELD, APPLY_SAFE_UPDATE,
  //    APPLY_BLANK_FILL, APPLY_RESTRICTION, CREATE_WITH_INCOMING_VALUE.
  if (resolution && resolution.resolution_source === 'DEFAULT' &&
      resolution.status !== 'INVALIDATED') {
    return 'auto_resolved';
  }

  // 4. No action needed — both blank, same value, NO_ACTION, PRESERVE_CURRENT_VALUE,
  //    or BLOCK_UPDATE. These are all deterministic outcomes where the system
  //    has already decided what to do and no admin input is required.
  //    Covers RESTRICTIVE_VALUE_PRESERVED ("Restriction Kept"), CURRENT_VALUE_ONLY
  //    for shared fields, PROTECTED_FIELD_IGNORED, and UNKNOWN_FIELD_BLOCKED.
  if (comparison.comparison_result === 'BOTH_BLANK' ||
      comparison.comparison_result === 'SAME_VALUE' ||
      comparison.recommended_action === 'NO_ACTION' ||
      comparison.recommended_action === 'PRESERVE_CURRENT_VALUE' ||
      comparison.recommended_action === 'BLOCK_UPDATE') {
    return 'hidden';
  }

  // 5. Can auto-apply but no resolution yet — treat as auto_resolved
  if (comparison.can_auto_apply) {
    return 'auto_resolved';
  }

  // 6. Fallback — anything not covered above needs review
  return 'needs_review';
}

export const COMPARISON_FILTERS = [
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'all', label: 'All Comparisons' },
  { key: 'auto_resolved', label: 'Automatically Resolved' },
  { key: 'hidden', label: 'Hidden' },
];

/**
 * Compute aggregate counts for the summary cards.
 * @returns {{total, auto_resolved, hidden, needs_review, admin_resolved}}
 */
export function computeComparisonSummary(comparisons, resolutions) {
  const resolutionMap = new Map();
  for (const r of resolutions || []) {
    if (r.status === 'PENDING' || r.status === 'RESOLVED') {
      resolutionMap.set(r.field_comparison_id, r);
    }
  }

  const summary = {
    total: comparisons?.length || 0,
    auto_resolved: 0,
    hidden: 0,
    needs_review: 0,
    admin_resolved: 0,
  };

  for (const c of comparisons || []) {
    const cls = classifyComparison(c, resolutionMap.get(c.id));
    summary[cls]++;
  }

  return summary;
}