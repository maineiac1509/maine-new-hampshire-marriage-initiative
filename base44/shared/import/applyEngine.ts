// ============================================================
// Apply Engine — Pure Logic Layer (Chunked / Resumable)
// ============================================================
//
// Deterministic, transactional-safe logic for executing approved
// FamilyLife import resolutions against production ChampionHousehold
// and HouseholdMember records.
//
// The apply engine processes operations in bounded chunks, with
// each chunk persisted as a checkpoint. This enables safe resume
// after interruption without manual database cleanup.
//
// Phases (processed strictly in order):
//   PREVALIDATED → CREATING_HOUSEHOLDS → CREATING_MEMBERS →
//   UPDATING_HOUSEHOLDS → UPDATING_MEMBERS → APPLYING_RESTRICTIONS →
//   RECORDING_DECISIONS → VERIFYING → FINALIZING → COMPLETED
//
// Architecture:
//   READY_TO_APPLY BATCH
//   → START: preflight, drift check, create operations, set phase
//   → CHUNK: process N PENDING operations for current phase
//   → REPEAT CHUNK until phase has no more PENDING ops
//   → ADVANCE to next phase automatically
//   → VERIFY: post-apply verification
//   → FINALIZE: mark batch APPLIED
// ============================================================

import {
  FIELD_GOVERNANCE, OWNERSHIP, IMPORT_OPERATIONS,
  getFieldPolicy, normalizeForComparison, normalizeValue,
  type FieldPolicy,
} from './governance.ts';
import { sanitizeImportRecord } from './sanitizer.ts';
import {
  RESOLUTION_TYPE, RESOLUTION_STATUS,
  CURRENT_GOVERNANCE_VERSION, CURRENT_MAPPING_VERSION,
  isResolutionTypeAllowed, isRestrictionRemovalAttempt,
} from './resolver.ts';
import { COMPARISON_RESULT } from './comparator.ts';

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

/** Conservative chunk size — each chunk should complete in <10s. */
export const CHUNK_SIZE = 15;

/** Stale-lock threshold — if no checkpoint advancement in this many seconds, allow resume. */
export const STALE_THRESHOLD_SECONDS = 120;

export const DRIFT_STATUS = {
  NO_DRIFT: 'NO_DRIFT',
  NORMALIZATION_ONLY_DRIFT: 'NORMALIZATION_ONLY_DRIFT',
  MATERIAL_DRIFT: 'MATERIAL_DRIFT',
  TARGET_RECORD_MISSING: 'TARGET_RECORD_MISSING',
  TARGET_RELATION_CHANGED: 'TARGET_RELATION_CHANGED',
  PROVENANCE_CHANGED: 'PROVENANCE_CHANGED',
} as const;

export const OPERATION_TYPE = {
  UPDATE_HOUSEHOLD_FIELD: 'UPDATE_HOUSEHOLD_FIELD',
  UPDATE_MEMBER_FIELD: 'UPDATE_MEMBER_FIELD',
  CREATE_HOUSEHOLD: 'CREATE_HOUSEHOLD',
  CREATE_MEMBER: 'CREATE_MEMBER',
  ADD_RESTRICTION: 'ADD_RESTRICTION',
  SKIP_FIELD: 'SKIP_FIELD',
  BLOCK_FIELD: 'BLOCK_FIELD',
  KEEP_CURRENT: 'KEEP_CURRENT',
  SYNC_METADATA_UPDATE: 'SYNC_METADATA_UPDATE',
} as const;

export const OPERATION_STATUS = {
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export const APPLY_RESULT = {
  APPLIED: 'APPLIED',
  SKIPPED: 'SKIPPED',
  BLOCKED: 'BLOCKED',
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  RESTRICTION_ADDED: 'RESTRICTION_ADDED',
  NO_CHANGE: 'NO_CHANGE',
  FAILED: 'FAILED',
  DRIFT_BLOCKED: 'DRIFT_BLOCKED',
  VERIFIED: 'VERIFIED',
} as const;

export const APPLY_PHASE = {
  PREVALIDATED: 'PREVALIDATED',
  CREATING_HOUSEHOLDS: 'CREATING_HOUSEHOLDS',
  CREATING_MEMBERS: 'CREATING_MEMBERS',
  UPDATING_HOUSEHOLDS: 'UPDATING_HOUSEHOLDS',
  UPDATING_MEMBERS: 'UPDATING_MEMBERS',
  APPLYING_RESTRICTIONS: 'APPLYING_RESTRICTIONS',
  RECORDING_DECISIONS: 'RECORDING_DECISIONS',
  VERIFYING: 'VERIFYING',
  FINALIZING: 'FINALIZING',
  COMPLETED: 'COMPLETED',
} as const;

/** Ordered phases for sequential execution. */
export const PHASE_ORDER = [
  APPLY_PHASE.CREATING_HOUSEHOLDS,
  APPLY_PHASE.CREATING_MEMBERS,
  APPLY_PHASE.UPDATING_HOUSEHOLDS,
  APPLY_PHASE.UPDATING_MEMBERS,
  APPLY_PHASE.APPLYING_RESTRICTIONS,
  APPLY_PHASE.RECORDING_DECISIONS,
  APPLY_PHASE.VERIFYING,
  APPLY_PHASE.FINALIZING,
];

/** Map each phase to the operation types it processes. */
export const PHASE_OPERATION_TYPES: Record<string, string[]> = {
  [APPLY_PHASE.CREATING_HOUSEHOLDS]: [OPERATION_TYPE.CREATE_HOUSEHOLD],
  [APPLY_PHASE.CREATING_MEMBERS]: [OPERATION_TYPE.CREATE_MEMBER],
  [APPLY_PHASE.UPDATING_HOUSEHOLDS]: [OPERATION_TYPE.UPDATE_HOUSEHOLD_FIELD],
  [APPLY_PHASE.UPDATING_MEMBERS]: [OPERATION_TYPE.UPDATE_MEMBER_FIELD],
  [APPLY_PHASE.APPLYING_RESTRICTIONS]: [OPERATION_TYPE.ADD_RESTRICTION],
  [APPLY_PHASE.RECORDING_DECISIONS]: [OPERATION_TYPE.KEEP_CURRENT, OPERATION_TYPE.SKIP_FIELD, OPERATION_TYPE.BLOCK_FIELD],
  [APPLY_PHASE.VERIFYING]: [], // Special handling
  [APPLY_PHASE.FINALIZING]: [], // Special handling
};

// ------------------------------------------------------------
// Preflight Validation (unchanged from original)
// ------------------------------------------------------------

export interface PreflightResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    total_rows: number;
    existing_households_to_update: number;
    existing_members_to_update: number;
    new_households_to_create: number;
    new_members_to_create: number;
    safe_familylife_updates: number;
    shared_use_incoming: number;
    shared_keep_current: number;
    custom_values: number;
    restrictions_added: number;
    skipped_rows: number;
    discarded_rows: number;
    blocked_fields: number;
    unresolved_items: number;
  };
}

export function preflightValidate(
  batch: any,
  rows: any[],
  comparisons: any[],
  resolutions: any[],
  issues: any[],
  isResume: boolean = false,
): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // On resume, the batch status is APPLYING and apply_status is PAUSED —
  // this is the expected state, not an error.
  if (!isResume && batch.status !== 'READY_TO_APPLY') {
    errors.push(`Batch status is "${batch.status}", not READY_TO_APPLY.`);
  }
  if (batch.status === 'APPLIED' || batch.apply_status === 'APPLIED') {
    errors.push('Batch has already been applied.');
  }
  if (!isResume && (batch.status === 'APPLYING' || batch.apply_status === 'APPLYING')) {
    errors.push('Batch is currently being applied by another execution.');
  }
  if (batch.governance_version && batch.governance_version !== CURRENT_GOVERNANCE_VERSION) {
    errors.push('Governance version mismatch — batch must be reprocessed under the current contract.');
  }
  if (batch.mapping_version && batch.mapping_version !== CURRENT_MAPPING_VERSION) {
    errors.push('Mapping version mismatch — batch must be reprocessed under the current mapping.');
  }

  const blockingIssues = (issues || []).filter((i) => i.severity === 'BLOCKING');
  if (blockingIssues.length > 0) {
    errors.push(`${blockingIssues.length} blocking issue(s) remain unresolved.`);
  }

  const rowMap = new Map<string, any>();
  for (const r of rows || []) rowMap.set(r.id, r);

  const resolutionByComparisonId = new Map<string, any>();
  for (const r of resolutions || []) {
    if (r.status === RESOLUTION_STATUS.PENDING || r.status === RESOLUTION_STATUS.RESOLVED) {
      resolutionByComparisonId.set(r.field_comparison_id, r);
    }
  }

  let totalRows = rows?.length || 0;
  let existingHouseholdsToUpdate = 0;
  let existingMembersToUpdate = 0;
  let newHouseholdsToCreate = 0;
  let newMembersToCreate = 0;
  let safeFamilylifeUpdates = 0;
  let sharedUseIncoming = 0;
  let sharedKeepCurrent = 0;
  let customValues = 0;
  let restrictionsAdded = 0;
  let skippedRows = 0;
  let discardedRows = 0;
  let blockedFields = 0;
  let unresolvedItems = 0;

  const householdIdsToUpdate = new Set<string>();
  const memberIdsToUpdate = new Set<string>();
  const newHouseholdRowIds = new Set<string>();
  const newMemberRowIds = new Set<string>();

  for (const cmp of comparisons || []) {
    const row = rowMap.get(cmp.import_row_id);

    if (row && ['DISCARDED', 'SKIPPED', 'BLOCKED'].includes(row.row_resolution_status)) {
      if (row.row_resolution_status === 'DISCARDED') discardedRows++;
      else if (row.row_resolution_status === 'SKIPPED') skippedRows++;
      continue;
    }

    if (cmp.recommended_action === 'NO_ACTION' ||
        cmp.recommended_action === 'PRESERVE_CURRENT_VALUE' ||
        cmp.recommended_action === 'BLOCK_UPDATE') {
      continue;
    }

    const resolution = resolutionByComparisonId.get(cmp.id);
    if (!resolution) {
      if (cmp.requires_review) {
        errors.push(`Comparison ${cmp.id} (${cmp.canonical_field_name}) requires review but has no resolution.`);
        unresolvedItems++;
      }
      continue;
    }

    if (cmp.requires_review && resolution.status !== RESOLUTION_STATUS.RESOLVED) {
      errors.push(`Comparison ${cmp.id} (${cmp.canonical_field_name}) conflict is not RESOLVED (status: ${resolution.status}).`);
      unresolvedItems++;
      continue;
    }

    if (!isResolutionTypeAllowed(cmp, resolution.resolution_type)) {
      errors.push(`Resolution type "${resolution.resolution_type}" is not allowed for ${cmp.ownership_category} on ${cmp.canonical_field_name}.`);
      continue;
    }

    if (isRestrictionRemovalAttempt(cmp, resolution.resolution_type)) {
      errors.push(`Resolution for ${cmp.canonical_field_name} would remove a restrictive preference — this is blocked in the import workflow.`);
      continue;
    }

    if (cmp.ownership_category === OWNERSHIP.CHAMPION_CONNECT_MANAGED) {
      if (resolution.resolution_type !== RESOLUTION_TYPE.BLOCK_FIELD &&
          resolution.resolution_type !== RESOLUTION_TYPE.SKIP_FIELD) {
        errors.push(`Champion Connect-managed field ${cmp.canonical_field_name} cannot be written by import.`);
        continue;
      }
    }

    if (cmp.ownership_category === OWNERSHIP.BLOCKED_FROM_EXISTING_RECORD_UPDATE) {
      if (resolution.resolution_type !== RESOLUTION_TYPE.BLOCK_FIELD &&
          resolution.resolution_type !== RESOLUTION_TYPE.SKIP_FIELD) {
        errors.push(`Unknown field ${cmp.canonical_field_name} cannot be written by import.`);
        continue;
      }
    }

    if (resolution.resolution_type === RESOLUTION_TYPE.USE_CUSTOM_VALUE) {
      if (!resolution.resolved_value || resolution.resolved_value.trim() === '') {
        errors.push(`Custom value resolution for ${cmp.canonical_field_name} has an empty resolved value.`);
        continue;
      }
    }

    const isNewRecord = cmp.comparison_result === COMPARISON_RESULT.CREATE_NEW_RECORD_VALUE;
    const isWriteOperation =
      resolution.resolution_type !== RESOLUTION_TYPE.KEEP_CURRENT &&
      resolution.resolution_type !== RESOLUTION_TYPE.SKIP_FIELD &&
      resolution.resolution_type !== RESOLUTION_TYPE.BLOCK_FIELD;

    if (isNewRecord) {
      if (resolution.resolution_type === RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE) {
        if (cmp.entity_type === 'ChampionHousehold') {
          newHouseholdRowIds.add(cmp.import_row_id);
        } else if (cmp.entity_type === 'HouseholdMember') {
          newMemberRowIds.add(cmp.import_row_id);
        }
      }
    } else {
      if (isWriteOperation) {
        if (cmp.entity_type === 'ChampionHousehold' && cmp.entity_id) {
          householdIdsToUpdate.add(cmp.entity_id);
        } else if (cmp.entity_type === 'HouseholdMember' && cmp.entity_id) {
          memberIdsToUpdate.add(cmp.entity_id);
        }
      }
    }

    switch (resolution.resolution_type) {
      case RESOLUTION_TYPE.APPLY_SAFE_UPDATE: safeFamilylifeUpdates++; break;
      case RESOLUTION_TYPE.USE_INCOMING:
        if (cmp.ownership_category === OWNERSHIP.SHARED_REVIEW) sharedUseIncoming++; break;
      case RESOLUTION_TYPE.KEEP_CURRENT:
        if (cmp.ownership_category === OWNERSHIP.SHARED_REVIEW) sharedKeepCurrent++; break;
      case RESOLUTION_TYPE.USE_CUSTOM_VALUE: customValues++; break;
      case RESOLUTION_TYPE.APPLY_RESTRICTION: restrictionsAdded++; break;
      case RESOLUTION_TYPE.SKIP_FIELD: blockedFields++; break;
      case RESOLUTION_TYPE.BLOCK_FIELD: blockedFields++; break;
    }
  }

  existingHouseholdsToUpdate = householdIdsToUpdate.size;
  existingMembersToUpdate = memberIdsToUpdate.size;
  newHouseholdsToCreate = newHouseholdRowIds.size;
  newMembersToCreate = newMemberRowIds.size;

  if (batch.total_rows !== totalRows && batch.total_rows > 0) {
    warnings.push(`Batch total_rows (${batch.total_rows}) does not match loaded rows (${totalRows}).`);
  }

  const ambiguousRows = (rows || []).filter((r) =>
    r.record_classification === 'POSSIBLE_DUPLICATE' &&
    r.row_resolution_status === 'PENDING',
  );
  if (ambiguousRows.length > 0) {
    errors.push(`${ambiguousRows.length} row(s) with ambiguous matches still pending.`);
    unresolvedItems += ambiguousRows.length;
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    counts: {
      total_rows: totalRows,
      existing_households_to_update: existingHouseholdsToUpdate,
      existing_members_to_update: existingMembersToUpdate,
      new_households_to_create: newHouseholdsToCreate,
      new_members_to_create: newMembersToCreate,
      safe_familylife_updates: safeFamilylifeUpdates,
      shared_use_incoming: sharedUseIncoming,
      shared_keep_current: sharedKeepCurrent,
      custom_values: customValues,
      restrictions_added: restrictionsAdded,
      skipped_rows: skippedRows,
      discarded_rows: discardedRows,
      blocked_fields: blockedFields,
      unresolved_items: unresolvedItems,
    },
  };
}

// ------------------------------------------------------------
// Drift Detection
// ------------------------------------------------------------

export function detectDrift(
  policy: FieldPolicy | null,
  currentValue: any,
  snapshotValue: string,
): string {
  if (!policy) return DRIFT_STATUS.NO_DRIFT;

  const curNorm = normalizeForComparison(currentValue, policy);
  const snapNorm = normalizeForComparison(snapshotValue, policy);

  if (curNorm === snapNorm) return DRIFT_STATUS.NO_DRIFT;

  const curRaw = currentValue == null ? '' : String(currentValue).trim();
  const snapRaw = (snapshotValue || '').trim();
  if (curRaw.toLowerCase() === snapRaw.toLowerCase()) {
    return DRIFT_STATUS.NORMALIZATION_ONLY_DRIFT;
  }

  return DRIFT_STATUS.MATERIAL_DRIFT;
}

// ------------------------------------------------------------
// Write Plan Generation (unchanged from original)
// ------------------------------------------------------------

export interface WriteOperation {
  operation_key: string;
  operation_type: string;
  entity_type: 'ChampionHousehold' | 'HouseholdMember';
  entity_id: string;
  temporary_entity_key: string;
  import_row_id: string;
  comparison_id: string;
  resolution_id: string;
  field_name: string;
  resolution_type: string;
  ownership_category: string;
  prior_value: string;
  applied_value: string;
  expected_snapshot: string;
  resolved_value: string;
}

export interface WritePlan {
  operations: WriteOperation[];
  householdUpdates: Map<string, Record<string, unknown>>;
  memberUpdates: Map<string, Record<string, unknown>>;
  newHouseholdCreations: Map<string, { row: any; fields: Record<string, unknown>; members: any[] }>;
  newMemberCreations: Map<string, { householdId: string; fields: Record<string, unknown>; row: any }>;
  restrictionUpdates: Map<string, Record<string, unknown>>;
  syncMetadataUpdates: Map<string, Record<string, unknown>>;
  skippedRows: Set<string>;
  blockedFields: number;
  keepCurrentCount: number;
  skipCount: number;
}

export function generateWritePlan(
  batch: any,
  rows: any[],
  comparisons: any[],
  resolutions: any[],
): WritePlan {
  const rowMap = new Map<string, any>();
  for (const r of rows || []) rowMap.set(r.id, r);

  const resolutionByComparisonId = new Map<string, any>();
  for (const r of resolutions || []) {
    if (r.status === RESOLUTION_STATUS.PENDING || r.status === RESOLUTION_STATUS.RESOLVED) {
      resolutionByComparisonId.set(r.field_comparison_id, r);
    }
  }

  const operations: WriteOperation[] = [];
  const householdUpdates = new Map<string, Record<string, unknown>>();
  const memberUpdates = new Map<string, Record<string, unknown>>();
  const newHouseholdCreations = new Map<string, { row: any; fields: Record<string, unknown>; members: any[] }>();
  const newMemberCreations = new Map<string, { householdId: string; fields: Record<string, unknown>; row: any }>();
  const restrictionUpdates = new Map<string, Record<string, unknown>>();
  const syncMetadataUpdates = new Map<string, Record<string, unknown>>();
  const skippedRows = new Set<string>();
  let blockedFields = 0;
  let keepCurrentCount = 0;
  let skipCount = 0;

  for (const cmp of comparisons || []) {
    const row = rowMap.get(cmp.import_row_id);

    if (row && ['DISCARDED', 'SKIPPED', 'BLOCKED'].includes(row.row_resolution_status)) {
      skippedRows.add(row.id);
      continue;
    }

    if (cmp.recommended_action === 'NO_ACTION' ||
        cmp.recommended_action === 'PRESERVE_CURRENT_VALUE' ||
        cmp.recommended_action === 'BLOCK_UPDATE') {
      continue;
    }

    const resolution = resolutionByComparisonId.get(cmp.id);
    if (!resolution) continue;

    const isNewRecord = cmp.comparison_result === COMPARISON_RESULT.CREATE_NEW_RECORD_VALUE;
    const policy = getFieldPolicy(cmp.entity_type, cmp.canonical_field_name);

    const operationKey = buildOperationKey(batch.id, resolution.id, cmp.entity_type, cmp.canonical_field_name, resolution.resolution_type);

    const baseOp: WriteOperation = {
      operation_key: operationKey,
      operation_type: '',
      entity_type: cmp.entity_type,
      entity_id: cmp.entity_id || '',
      temporary_entity_key: '',
      import_row_id: cmp.import_row_id,
      comparison_id: cmp.id,
      resolution_id: resolution.id,
      field_name: cmp.canonical_field_name,
      resolution_type: resolution.resolution_type,
      ownership_category: cmp.ownership_category,
      prior_value: cmp.current_normalized_value || '',
      applied_value: '',
      expected_snapshot: resolution.current_value_snapshot || '',
      resolved_value: resolution.resolved_value || '',
    };

    switch (resolution.resolution_type) {
      case RESOLUTION_TYPE.KEEP_CURRENT: {
        operations.push({ ...baseOp, operation_type: OPERATION_TYPE.KEEP_CURRENT });
        keepCurrentCount++;
        break;
      }
      case RESOLUTION_TYPE.SKIP_FIELD: {
        operations.push({ ...baseOp, operation_type: OPERATION_TYPE.SKIP_FIELD });
        skipCount++;
        break;
      }
      case RESOLUTION_TYPE.BLOCK_FIELD: {
        operations.push({ ...baseOp, operation_type: OPERATION_TYPE.BLOCK_FIELD });
        blockedFields++;
        break;
      }
      case RESOLUTION_TYPE.APPLY_RESTRICTION: {
        if (cmp.entity_id) {
          const restrictionMap = restrictionUpdates.get(cmp.entity_id) || {};
          restrictionMap[cmp.canonical_field_name] = resolution.resolved_value === 'true';
          restrictionUpdates.set(cmp.entity_id, restrictionMap);
          operations.push({ ...baseOp, operation_type: OPERATION_TYPE.ADD_RESTRICTION, applied_value: 'true' });
        }
        break;
      }
      case RESOLUTION_TYPE.APPLY_SAFE_UPDATE:
      case RESOLUTION_TYPE.USE_INCOMING:
      case RESOLUTION_TYPE.USE_CUSTOM_VALUE:
      case RESOLUTION_TYPE.APPLY_BLANK_FILL:
      case RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE: {
        if (isNewRecord) {
          if (cmp.entity_type === 'ChampionHousehold') {
            const creation = newHouseholdCreations.get(cmp.import_row_id) || { row, fields: {}, members: [] };
            if (resolution.resolved_value) {
              creation.fields[cmp.canonical_field_name] = coerceValue(policy, resolution.resolved_value);
            }
            newHouseholdCreations.set(cmp.import_row_id, creation);
            operations.push({ ...baseOp, operation_type: OPERATION_TYPE.CREATE_HOUSEHOLD, temporary_entity_key: cmp.import_row_id, applied_value: resolution.resolved_value });
          } else if (cmp.entity_type === 'HouseholdMember') {
            const creation = newMemberCreations.get(cmp.import_row_id) || { householdId: row?.matched_household_id || '', fields: {}, row };
            if (resolution.resolved_value) {
              creation.fields[cmp.canonical_field_name] = coerceValue(policy, resolution.resolved_value);
            }
            newMemberCreations.set(cmp.import_row_id, creation);
            operations.push({ ...baseOp, operation_type: OPERATION_TYPE.CREATE_MEMBER, temporary_entity_key: cmp.import_row_id, applied_value: resolution.resolved_value });
          }
        } else {
          const updateMap = cmp.entity_type === 'ChampionHousehold' ? householdUpdates : memberUpdates;
          const entityId = cmp.entity_id;
          if (entityId) {
            const updates = updateMap.get(entityId) || {};
            if (resolution.resolved_value !== '') {
              updates[cmp.canonical_field_name] = coerceValue(policy, resolution.resolved_value);
            }
            updateMap.set(entityId, updates);
          }
          operations.push({
            ...baseOp,
            operation_type: cmp.entity_type === 'ChampionHousehold' ? OPERATION_TYPE.UPDATE_HOUSEHOLD_FIELD : OPERATION_TYPE.UPDATE_MEMBER_FIELD,
            applied_value: resolution.resolved_value,
          });
        }
        break;
      }
    }
  }

  return {
    operations,
    householdUpdates,
    memberUpdates,
    newHouseholdCreations,
    newMemberCreations,
    restrictionUpdates,
    syncMetadataUpdates,
    skippedRows,
    blockedFields,
    keepCurrentCount,
    skipCount,
  };
}

/**
 * Build a deterministic creation key for a new-record production entity.
 * Derived from immutable import data: batch ID, import row ID, and entity type.
 * This key is stored on the production record AND on the apply operation,
 * enabling exact recovery after interruption without relying on email matching.
 *
 * Format: create:{batchId}:{importRowId}:{entityType}
 */
export function buildCreationKey(
  batchId: string,
  importRowId: string,
  entityType: string,
): string {
  return `create:${batchId}:${importRowId}:${entityType}`;
}

export function buildOperationKey(
  batchId: string,
  resolutionId: string,
  entityType: string,
  fieldName: string,
  resolutionType: string,
): string {
  return `${batchId}:${resolutionId}:${entityType}:${fieldName}:${resolutionType}`;
}

function coerceValue(policy: FieldPolicy | null, value: string): unknown {
  if (!policy || value === '') return value;
  if (policy.normalization === 'boolean') {
    return value === 'true';
  }
  if (['cumulative_registrations', 'free_couple_registrations_used',
       'free_couple_registrations_available',
       'registrations_toward_next_free_registration',
       'registrations_needed_for_next_free_registration'].includes(policy.field)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

// ------------------------------------------------------------
// Progress Tracking
// ------------------------------------------------------------

export function computeProgress(
  totalOps: number,
  applied: number,
  verified: number,
  failed: number,
  skipped: number,
  chunkIndex: number,
): { total_operations: number; pending: number; applied: number; verified: number; failed: number; skipped: number; percent_complete: number; chunk_index: number; last_checkpoint_at: string } {
  const completed = applied + verified + failed + skipped;
  const pending = totalOps - completed;
  const percent = totalOps > 0 ? Math.round((completed / totalOps) * 100) : 0;
  return {
    total_operations: totalOps,
    pending,
    applied,
    verified,
    failed,
    skipped,
    percent_complete: percent,
    chunk_index: chunkIndex,
    last_checkpoint_at: new Date().toISOString(),
  };
}

/**
 * Determine the next phase after the current one.
 * Returns COMPLETED if this was the last phase.
 */
export function nextPhase(currentPhase: string): string {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return APPLY_PHASE.COMPLETED;
  return PHASE_ORDER[idx + 1];
}

/**
 * Check if a phase has any PENDING operations of its types.
 */
export function phaseHasPendingOps(operations: any[], phase: string): boolean {
  const types = PHASE_OPERATION_TYPES[phase];
  if (!types || types.length === 0) return false;
  return operations.some((op) => types.includes(op.operation_type) && op.status === OPERATION_STATUS.PENDING);
}

/**
 * Check if an apply execution is stale (no checkpoint advancement within threshold).
 */
export function isStale(lastCheckpointAt: string | undefined): boolean {
  if (!lastCheckpointAt) return true;
  const elapsed = (Date.now() - new Date(lastCheckpointAt).getTime()) / 1000;
  return elapsed > STALE_THRESHOLD_SECONDS;
}

// ------------------------------------------------------------
// Sanitization Helper
// ------------------------------------------------------------

export function sanitizeWritePayload(
  payload: Record<string, unknown>,
  operation: string,
  existingRecord: Record<string, unknown> | null,
  entityType: 'ChampionHousehold' | 'HouseholdMember',
): { sanitized: Record<string, unknown>; blocked: string[]; conflicts: any[] } {
  const result = sanitizeImportRecord(payload, operation as any, existingRecord, entityType);
  return {
    sanitized: result.sanitized,
    blocked: result.blocked.map((b) => b.field),
    conflicts: result.conflicts,
  };
}

export function validateSanitization(
  plannedFields: string[],
  sanitized: Record<string, unknown>,
  blocked: string[],
): { valid: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];
  for (const field of plannedFields) {
    if (blocked.includes(field)) {
      discrepancies.push(`Field "${field}" was blocked by the sanitizer but the write plan expected to write it.`);
    } else if (!(field in sanitized)) {
      discrepancies.push(`Field "${field}" was not included in the sanitized payload but the write plan expected to write it.`);
    }
  }
  return { valid: discrepancies.length === 0, discrepancies };
}