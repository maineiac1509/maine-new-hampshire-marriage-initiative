// ============================================================
// Resolution Engine — Pure Logic Layer
// ============================================================
//
// Deterministic, non-AI logic for generating default resolutions,
// validating administrator decisions, and computing batch
// readiness. This module contains NO entity I/O — it operates on
// plain data structures passed in by the backend function.
//
// Architecture:
//   STAGED SOURCE DATA
//   → FIELD COMPARISON (immutable)
//   → ADMINISTRATOR RESOLUTION (this module's logic)
//   → FUTURE APPLY ENGINE
//   → PRODUCTION
//
// The future apply engine reads approved resolution records.
// It must NOT determine conflict outcomes from comparison records.
// ============================================================

import {
  FIELD_GOVERNANCE, OWNERSHIP,
  normalizeForComparison, type FieldPolicy,
} from './governance.ts';
import { normalizeAndValidateField } from './normalizer.ts';
import { RECOMMENDED_ACTION, COMPARISON_RESULT } from './comparator.ts';

// These must match the versions in stagingProcessor.ts.
// If either changes, existing resolutions become stale and the
// readiness check will block the batch from READY_TO_APPLY.
export const CURRENT_GOVERNANCE_VERSION = '2025-01-staging-v1';
export const CURRENT_MAPPING_VERSION = '2025-01-staging-v1';

// ------------------------------------------------------------
// Resolution Types
// ------------------------------------------------------------
export const RESOLUTION_TYPE = {
  KEEP_CURRENT: 'KEEP_CURRENT',
  USE_INCOMING: 'USE_INCOMING',
  USE_CUSTOM_VALUE: 'USE_CUSTOM_VALUE',
  APPLY_SAFE_UPDATE: 'APPLY_SAFE_UPDATE',
  APPLY_BLANK_FILL: 'APPLY_BLANK_FILL',
  APPLY_RESTRICTION: 'APPLY_RESTRICTION',
  CREATE_WITH_INCOMING_VALUE: 'CREATE_WITH_INCOMING_VALUE',
  SKIP_FIELD: 'SKIP_FIELD',
  BLOCK_FIELD: 'BLOCK_FIELD',
} as const;

export const RESOLUTION_STATUS = {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
  INVALIDATED: 'INVALIDATED',
  APPLIED: 'APPLIED',
  FAILED: 'FAILED',
} as const;

export const RESOLUTION_SOURCE = {
  DEFAULT: 'DEFAULT',
  MANUAL: 'MANUAL',
  BULK: 'BULK',
} as const;

// ------------------------------------------------------------
// Allowed resolution types per ownership category
// ------------------------------------------------------------
// EXISTING record comparisons:
const ALLOWED_EXISTING: Record<string, string[]> = {
  FAMILYLIFE_MANAGED: [
    RESOLUTION_TYPE.KEEP_CURRENT, RESOLUTION_TYPE.APPLY_SAFE_UPDATE,
    RESOLUTION_TYPE.USE_CUSTOM_VALUE, RESOLUTION_TYPE.SKIP_FIELD,
    RESOLUTION_TYPE.BLOCK_FIELD,
  ],
  CHAMPION_CONNECT_MANAGED: [
    RESOLUTION_TYPE.BLOCK_FIELD, RESOLUTION_TYPE.SKIP_FIELD,
  ],
  SHARED_REVIEW: [
    RESOLUTION_TYPE.KEEP_CURRENT, RESOLUTION_TYPE.USE_INCOMING,
    RESOLUTION_TYPE.APPLY_BLANK_FILL, RESOLUTION_TYPE.USE_CUSTOM_VALUE,
    RESOLUTION_TYPE.SKIP_FIELD,
  ],
  RESTRICTIVE_PREFERENCE: [
    RESOLUTION_TYPE.APPLY_RESTRICTION, RESOLUTION_TYPE.KEEP_CURRENT,
    RESOLUTION_TYPE.SKIP_FIELD, RESOLUTION_TYPE.BLOCK_FIELD,
    // NOTE: No USE_INCOMING or USE_CUSTOM_VALUE — restrictions can
    // never be removed through the import workflow. The admin must
    // use the normal Champion editing workflow to lift a restriction.
  ],
  BLOCKED_FROM_EXISTING_RECORD_UPDATE: [
    RESOLUTION_TYPE.BLOCK_FIELD, RESOLUTION_TYPE.SKIP_FIELD,
  ],
};

// NEW record comparisons:
const ALLOWED_NEW: Record<string, string[]> = {
  FAMILYLIFE_MANAGED: [
    RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE, RESOLUTION_TYPE.SKIP_FIELD,
  ],
  SHARED_REVIEW: [
    RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE, RESOLUTION_TYPE.SKIP_FIELD,
  ],
  RESTRICTIVE_PREFERENCE: [
    RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE, RESOLUTION_TYPE.SKIP_FIELD,
  ],
  CHAMPION_CONNECT_MANAGED: [
    RESOLUTION_TYPE.BLOCK_FIELD, RESOLUTION_TYPE.SKIP_FIELD,
  ],
  BLOCKED_FROM_EXISTING_RECORD_UPDATE: [
    RESOLUTION_TYPE.BLOCK_FIELD, RESOLUTION_TYPE.SKIP_FIELD,
  ],
};

// ------------------------------------------------------------
// Default resolution inference
// ------------------------------------------------------------
// Maps a comparison's recommended_action to a default resolution
// type. Returns null when the comparison requires manual review
// (no safe default exists).
// ------------------------------------------------------------
export function getDefaultResolutionType(comparison: any): string | null {
  const action = comparison.recommended_action;
  const result = comparison.comparison_result;

  switch (action) {
    case RECOMMENDED_ACTION.NO_ACTION:
      if (result === COMPARISON_RESULT.BOTH_BLANK) return RESOLUTION_TYPE.SKIP_FIELD;
      if (result === COMPARISON_RESULT.CURRENT_VALUE_ONLY) return RESOLUTION_TYPE.SKIP_FIELD;
      return RESOLUTION_TYPE.KEEP_CURRENT;

    case RECOMMENDED_ACTION.SAFE_FAMILYLIFE_UPDATE:
      return RESOLUTION_TYPE.APPLY_SAFE_UPDATE;

    case RECOMMENDED_ACTION.SAFE_FILL_BLANK:
      return RESOLUTION_TYPE.APPLY_BLANK_FILL;

    case RECOMMENDED_ACTION.APPLY_RESTRICTION:
      return RESOLUTION_TYPE.APPLY_RESTRICTION;

    case RECOMMENDED_ACTION.CREATE_NEW_RECORD_VALUE:
      return RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE;

    case RECOMMENDED_ACTION.PRESERVE_CURRENT_VALUE:
      return RESOLUTION_TYPE.KEEP_CURRENT;

    case RECOMMENDED_ACTION.BLOCK_UPDATE:
      return RESOLUTION_TYPE.BLOCK_FIELD;

    case RECOMMENDED_ACTION.REQUIRE_ADMIN_REVIEW:
      return null; // No safe default — requires explicit admin decision

    default:
      return null;
  }
}

// ------------------------------------------------------------
// Allowed type check
// ------------------------------------------------------------
export function isResolutionTypeAllowed(comparison: any, resolutionType: string): boolean {
  const isNew = comparison.comparison_result === COMPARISON_RESULT.CREATE_NEW_RECORD_VALUE;
  const allowed = isNew ? ALLOWED_NEW : ALLOWED_EXISTING;
  const list = allowed[comparison.ownership_category] || [];
  return list.includes(resolutionType);
}

// ------------------------------------------------------------
// Resolved value computation
// ------------------------------------------------------------
export function getResolvedValue(
  comparison: any,
  resolutionType: string,
  customNormalizedValue?: string,
): string {
  switch (resolutionType) {
    case RESOLUTION_TYPE.KEEP_CURRENT:
      return comparison.current_normalized_value || '';
    case RESOLUTION_TYPE.USE_INCOMING:
    case RESOLUTION_TYPE.APPLY_SAFE_UPDATE:
    case RESOLUTION_TYPE.APPLY_BLANK_FILL:
    case RESOLUTION_TYPE.APPLY_RESTRICTION:
    case RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE:
      return comparison.incoming_normalized_value || '';
    case RESOLUTION_TYPE.USE_CUSTOM_VALUE:
      return customNormalizedValue || '';
    case RESOLUTION_TYPE.SKIP_FIELD:
    case RESOLUTION_TYPE.BLOCK_FIELD:
      return '';
    default:
      return '';
  }
}

// ------------------------------------------------------------
// Custom value validation
// ------------------------------------------------------------
export function validateCustomValue(
  comparison: any,
  rawCustomValue: string,
): { valid: boolean; normalized: string; error?: string } {
  const entity = comparison.entity_type as 'ChampionHousehold' | 'HouseholdMember';
  const field = comparison.canonical_field_name;
  const result = normalizeAndValidateField(entity, field, rawCustomValue);
  if (!result.isValid) {
    return { valid: false, normalized: '', error: result.error || 'Invalid value.' };
  }
  return {
    valid: true,
    normalized: result.normalized != null ? String(result.normalized) : '',
  };
}

// ------------------------------------------------------------
// Restriction removal detection
// ------------------------------------------------------------
// Returns true if the resolution would reduce an existing
// restrictive preference (remove an opt-out). This is blocked
// in the import workflow — the admin must use the Champion
// editing workflow instead.
// ------------------------------------------------------------
export function isRestrictionRemovalAttempt(comparison: any, resolutionType: string): boolean {
  if (comparison.ownership_category !== OWNERSHIP.RESTRICTIVE_PREFERENCE) return false;
  // Current is restricted (true), incoming is permissive/blank
  const curBool = comparison.current_normalized_value === 'true';
  if (!curBool) return false; // No existing restriction to remove
  // Any resolution that doesn't preserve the restriction is a removal attempt
  return resolutionType !== RESOLUTION_TYPE.APPLY_RESTRICTION &&
         resolutionType !== RESOLUTION_TYPE.KEEP_CURRENT &&
         resolutionType !== RESOLUTION_TYPE.BLOCK_FIELD;
}

// ------------------------------------------------------------
// Readiness check
// ------------------------------------------------------------
// Deterministic: the same inputs always produce the same result.
// Does NOT scan production data — operates only on staged data.
// ------------------------------------------------------------
export interface ReadinessResult {
  ready: boolean;
  reason: string;
  status: string; // NOT_READY | READY_TO_APPLY | STALE_GOVERNANCE | STALE_MAPPING
  summary: {
    total_actionable: number;
    auto_resolved: number;
    manually_resolved: number;
    pending_conflicts: number;
    unresolved_matches: number;
    blocking_issues: number;
    proposed_new_records: number;
    discarded_records: number;
    completion_percentage: number;
  };
}

export function computeReadiness(
  comparisons: any[],
  resolutions: any[],
  rows: any[],
  issues: any[],
  batch: any,
): ReadinessResult {
  const emptySummary = {
    total_actionable: 0, auto_resolved: 0, manually_resolved: 0,
    pending_conflicts: 0, unresolved_matches: 0, blocking_issues: 0,
    proposed_new_records: 0, discarded_records: 0, completion_percentage: 0,
  };

  // 1. Governance / mapping version staleness
  if (batch.governance_version && batch.governance_version !== CURRENT_GOVERNANCE_VERSION) {
    return {
      ready: false,
      reason: 'The governance contract has been updated since this batch was compared. Reprocess the batch to regenerate comparisons under the current contract.',
      status: 'STALE_GOVERNANCE',
      summary: emptySummary,
    };
  }
  if (batch.mapping_version && batch.mapping_version !== CURRENT_MAPPING_VERSION) {
    return {
      ready: false,
      reason: 'The column mapping has been updated since this batch was compared. Reprocess the batch to regenerate comparisons under the current mapping.',
      status: 'STALE_MAPPING',
      summary: emptySummary,
    };
  }

  // 2. Blocking issues
  const blockingIssues = (issues || []).filter((i) => i.severity === 'BLOCKING');
  if (blockingIssues.length > 0) {
    return {
      ready: false,
      reason: `${blockingIssues.length} blocking issue(s) remain unresolved.`,
      status: 'NOT_READY',
      summary: { ...emptySummary, blocking_issues: blockingIssues.length },
    };
  }

  // 3. Build lookup maps
  const rowMap = new Map<string, any>();
  for (const r of rows || []) rowMap.set(r.id, r);

  const resolutionByComparisonId = new Map<string, any>();
  for (const r of resolutions || []) {
    if (r.status === RESOLUTION_STATUS.RESOLVED || r.status === RESOLUTION_STATUS.PENDING) {
      resolutionByComparisonId.set(r.field_comparison_id, r);
    }
  }

  // 4. Check ambiguous match rows
  const ambiguousRows = (rows || []).filter((r) =>
    r.record_classification === 'POSSIBLE_DUPLICATE' &&
    r.row_resolution_status === 'PENDING',
  );
  if (ambiguousRows.length > 0) {
    return {
      ready: false,
      reason: `${ambiguousRows.length} row(s) with ambiguous matches need resolution, skip, or block.`,
      status: 'NOT_READY',
      summary: { ...emptySummary, unresolved_matches: ambiguousRows.length },
    };
  }

  // 5. Check all actionable comparisons have valid resolutions
  let totalActionable = 0;
  let autoResolved = 0;
  let manuallyResolved = 0;
  let pendingConflicts = 0;

  for (const cmp of comparisons || []) {
    const row = rowMap.get(cmp.import_row_id);
    // Skip rows that are discarded/skipped/blocked — their comparisons don't need resolutions
    if (row && ['DISCARDED', 'SKIPPED', 'BLOCKED'].includes(row.row_resolution_status)) {
      continue;
    }

    // Skip non-actionable comparisons — system already determined the outcome.
    // NO_ACTION: values agree or both blank.
    // PRESERVE_CURRENT_VALUE: system keeps current (covers RESTRICTIVE_VALUE_PRESERVED,
    //   shared CURRENT_VALUE_ONLY, and INVALID_INCOMING_VALUE).
    // BLOCK_UPDATE: field is protected or unknown — system blocks the update.
    // None of these require admin input, so they must not count toward
    // totalActionable or block READY_TO_APPLY.
    if (cmp.recommended_action === RECOMMENDED_ACTION.NO_ACTION ||
        cmp.recommended_action === RECOMMENDED_ACTION.PRESERVE_CURRENT_VALUE ||
        cmp.recommended_action === RECOMMENDED_ACTION.BLOCK_UPDATE) {
      continue;
    }

    totalActionable++;
    const resolution = resolutionByComparisonId.get(cmp.id);

    if (!resolution) {
      // No resolution at all — if it requires review, it's a pending conflict;
      // otherwise it's an unresolved default (shouldn't happen after generate_defaults)
      if (cmp.requires_review) {
        pendingConflicts++;
      }
      continue;
    }

    if (cmp.requires_review && resolution.status !== RESOLUTION_STATUS.RESOLVED) {
      // Conflicts must be explicitly RESOLVED, not just PENDING with a default
      pendingConflicts++;
      continue;
    }

    if (resolution.status === RESOLUTION_STATUS.RESOLVED) {
      if (resolution.resolution_source === RESOLUTION_SOURCE.DEFAULT) {
        autoResolved++;
      } else {
        manuallyResolved++; // MANUAL or BULK
      }
    } else {
      // PENDING with a safe default
      autoResolved++;
    }
  }

  if (pendingConflicts > 0) {
    return {
      ready: false,
      reason: `${pendingConflicts} conflict(s) requiring admin review remain unresolved.`,
      status: 'NOT_READY',
      summary: {
        ...emptySummary,
        total_actionable: totalActionable,
        auto_resolved: autoResolved,
        manually_resolved: manuallyResolved,
        pending_conflicts: pendingConflicts,
        completion_percentage: totalActionable > 0
          ? Math.round(((autoResolved + manuallyResolved) / totalActionable) * 100)
          : 0,
      },
    };
  }

  // All checks passed
  const proposedNewRecords = (rows || []).filter(
    (r) => r.record_classification === 'NEW_RECORD' && r.row_resolution_status === 'PENDING',
  ).length;
  const discardedRecords = (rows || []).filter(
    (r) => r.row_resolution_status === 'DISCARDED',
  ).length;

  return {
    ready: true,
    reason: '',
    status: 'READY_TO_APPLY',
    summary: {
      total_actionable: totalActionable,
      auto_resolved: autoResolved,
      manually_resolved: manuallyResolved,
      pending_conflicts: 0,
      unresolved_matches: 0,
      blocking_issues: 0,
      proposed_new_records: proposedNewRecords,
      discarded_records: discardedRecords,
      completion_percentage: totalActionable > 0
        ? Math.round(((autoResolved + manuallyResolved) / totalActionable) * 100)
        : 100,
    },
  };
}

// ------------------------------------------------------------
// Bulk action → resolution type mapping
// ------------------------------------------------------------
export function getBulkResolutionType(actionType: string, comparison: any): string | null {
  switch (actionType) {
    case 'ACCEPT_ALL_SAFE_UPDATES':
      if (comparison.recommended_action === RECOMMENDED_ACTION.SAFE_FAMILYLIFE_UPDATE) {
        return RESOLUTION_TYPE.APPLY_SAFE_UPDATE;
      }
      return null;

    case 'ACCEPT_ALL_BLANK_FILLS':
      if (comparison.recommended_action === RECOMMENDED_ACTION.SAFE_FILL_BLANK) {
        return RESOLUTION_TYPE.APPLY_BLANK_FILL;
      }
      return null;

    case 'ACCEPT_ALL_NEW_RESTRICTIONS':
      if (comparison.recommended_action === RECOMMENDED_ACTION.APPLY_RESTRICTION) {
        return RESOLUTION_TYPE.APPLY_RESTRICTION;
      }
      return null;

    case 'KEEP_CURRENT_FOR_SHARED_CONFLICTS':
      if (comparison.comparison_result === COMPARISON_RESULT.SHARED_VALUE_CONFLICT) {
        return RESOLUTION_TYPE.KEEP_CURRENT;
      }
      return null;

    case 'USE_INCOMING_FOR_SELECTED_CONFLICTS':
      if (comparison.comparison_result === COMPARISON_RESULT.SHARED_VALUE_CONFLICT) {
        return RESOLUTION_TYPE.USE_INCOMING;
      }
      return null;

    case 'SKIP_SELECTED_FIELDS':
      return RESOLUTION_TYPE.SKIP_FIELD;

    case 'ACCEPT_ALL_NEW_RECORD_FIELDS':
      if (comparison.comparison_result === COMPARISON_RESULT.CREATE_NEW_RECORD_VALUE &&
          comparison.recommended_action === RECOMMENDED_ACTION.CREATE_NEW_RECORD_VALUE) {
        return RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE;
      }
      return null;

    default:
      return null;
  }
}