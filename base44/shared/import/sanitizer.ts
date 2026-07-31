// ============================================================
// Import Sanitization Layer
// ============================================================
//
// The single gateway through which all incoming FamilyLife data
// must pass before reaching ChampionHousehold or HouseholdMember
// create/update operations.
//
// No import path — frontend or backend — may pass an unrestricted
// incoming object directly into a production create or update.
// Every path must call sanitizeImportRecord() with the appropriate
// IMPORT_OPERATIONS mode.
//
// This module reads the governance contract (governance.ts) and
// enforces field-level policies. Unknown fields are blocked and
// reported. Champion Connect-managed fields are stripped. Shared
// fields with differing values are flagged as conflicts, not applied.
// Restrictive preferences preserve the most restrictive known value.
// ============================================================

import {
  FIELD_GOVERNANCE,
  OWNERSHIP,
  IMPORT_OPERATIONS,
  DEFAULT_OWNERSHIP_FOR_UNKNOWN,
  getFieldPolicy,
  normalizeValue,
  normalizeForComparison,
  type FieldPolicy,
} from './governance';

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export interface SanitizationConflict {
  field: string;
  incoming: unknown;
  existing: unknown;
  reason: string;
}

export interface SanitizationBlocked {
  field: string;
  value: unknown;
  reason: string;
}

export interface SanitizationUnmapped {
  field: string;
  value: unknown;
}

export interface RestrictiveDecision {
  field: string;
  appliedValue: boolean;
  reason: string;
}

export interface SanitizationResult {
  /** Only the fields permitted by the governance contract for this operation. */
  sanitized: Record<string, unknown>;
  /** Shared-review fields where both values are populated but differ — need admin reconciliation. */
  conflicts: SanitizationConflict[];
  /** Fields blocked by governance (CC-managed, not available for operation, etc.). */
  blocked: SanitizationBlocked[];
  /** Unknown fields not in the governance contract — reported, never applied. */
  unmapped: SanitizationUnmapped[];
  /** Restrictive preference decisions that were auto-applied (most-restrictive-wins). */
  restrictiveApplied: RestrictiveDecision[];
  /** Non-fatal warnings. */
  warnings: string[];
}

type EntityName = 'ChampionHousehold' | 'HouseholdMember';
type Operation = typeof IMPORT_OPERATIONS[keyof typeof IMPORT_OPERATIONS];

// ------------------------------------------------------------
// Core sanitization function
// ------------------------------------------------------------

/**
 * Sanitize a single incoming record against the governance contract.
 *
 * @param incoming   - The raw incoming record from FamilyLife.
 * @param operation  - One of NEW_RECORD_CREATE, EXISTING_RECORD_SAFE_UPDATE,
 *                     RECONCILIATION_APPROVED_UPDATE.
 * @param existing   - The current production record (required for
 *                     EXISTING_RECORD_SAFE_UPDATE and RECONCILIATION_APPROVED_UPDATE).
 * @param entity     - 'ChampionHousehold' or 'HouseholdMember'.
 *
 * @returns SanitizationResult with the safe payload + diagnostics.
 */
export function sanitizeImportRecord(
  incoming: Record<string, unknown>,
  operation: Operation,
  existing: Record<string, unknown> | null | undefined,
  entity: EntityName = 'ChampionHousehold',
): SanitizationResult {
  const result: SanitizationResult = {
    sanitized: {},
    conflicts: [],
    blocked: [],
    unmapped: [],
    restrictiveApplied: [],
    warnings: [],
  };

  const entityGov = FIELD_GOVERNANCE[entity];
  if (!entityGov) {
    result.warnings.push(`Unknown entity "${entity}" — no governance contract available.`);
    for (const [field, value] of Object.entries(incoming || {})) {
      result.unmapped.push({ field, value });
    }
    return result;
  }

  for (const [field, rawValue] of Object.entries(incoming || {})) {
    const policy = entityGov[field];

    // --- Unknown / unmapped field → fail-safe ---
    if (!policy) {
      result.unmapped.push({ field, value: rawValue });
      continue;
    }

    // --- Not available for this operation ---
    if (operation === IMPORT_OPERATIONS.NEW_RECORD_CREATE && !policy.availableOnCreate) {
      result.blocked.push({ field, value: rawValue, reason: `${policy.ownership} — not available on new-record create` });
      continue;
    }
    if ((operation === IMPORT_OPERATIONS.EXISTING_RECORD_SAFE_UPDATE ||
         operation === IMPORT_OPERATIONS.RECONCILIATION_APPROVED_UPDATE) && !policy.availableOnUpdate) {
      result.blocked.push({ field, value: rawValue, reason: `${policy.ownership} — not available on existing-record update` });
      continue;
    }

    const normalizedIncoming = normalizeValue(rawValue, policy);
    const incomingIsBlank = normalizedIncoming == null || normalizedIncoming === '';
    const existingValue = existing ? existing[field] : undefined;

    // --- Apply ownership policy ---
    switch (policy.ownership) {

      // ==================================================
      // FAMILYLIFE_MANAGED
      // ==================================================
      case OWNERSHIP.FAMILYLIFE_MANAGED: {
        if (operation === IMPORT_OPERATIONS.NEW_RECORD_CREATE) {
          if (!incomingIsBlank) result.sanitized[field] = normalizedIncoming;
        } else if (operation === IMPORT_OPERATIONS.EXISTING_RECORD_SAFE_UPDATE) {
          if (incomingIsBlank) {
            // Blank incoming does not clear unless explicitly configured.
            if (policy.allowIncomingClear) result.sanitized[field] = null;
            // else: skip — preserve existing
          } else {
            // Populated incoming updates existing (still included in comparison/audit).
            result.sanitized[field] = normalizedIncoming;
          }
        } else if (operation === IMPORT_OPERATIONS.RECONCILIATION_APPROVED_UPDATE) {
          if (!incomingIsBlank) result.sanitized[field] = normalizedIncoming;
          else if (policy.allowIncomingClear) result.sanitized[field] = null;
        }
        break;
      }

      // ==================================================
      // SHARED_REVIEW
      // ==================================================
      case OWNERSHIP.SHARED_REVIEW: {
        if (operation === IMPORT_OPERATIONS.NEW_RECORD_CREATE) {
          if (!incomingIsBlank) result.sanitized[field] = normalizedIncoming;
        } else if (operation === IMPORT_OPERATIONS.EXISTING_RECORD_SAFE_UPDATE) {
          if (incomingIsBlank) {
            // Blank incoming never clears by default.
            break;
          }
          const existingIsBlank = existingValue == null || existingValue === '';
          if (existingIsBlank) {
            // Populate a currently blank production value if configured.
            if (policy.allowBlankFill) {
              result.sanitized[field] = normalizedIncoming;
            } else {
              result.conflicts.push({
                field,
                incoming: normalizedIncoming,
                existing: existingValue,
                reason: 'Blank-fill not allowed for this field — requires reconciliation.',
              });
            }
          } else {
            // Both populated — compare normalized forms.
            const cmpIncoming = normalizeForComparison(normalizedIncoming, policy);
            const cmpExisting = normalizeForComparison(existingValue, policy);
            if (cmpIncoming === cmpExisting) {
              // Identical normalized values — not a conflict, no write needed.
            } else {
              // Differing values — flag for reconciliation, do NOT auto-overwrite.
              result.conflicts.push({
                field,
                incoming: normalizedIncoming,
                existing: existingValue,
                reason: 'Differing populated values require administrator reconciliation.',
              });
            }
          }
        } else if (operation === IMPORT_OPERATIONS.RECONCILIATION_APPROVED_UPDATE) {
          // Admin explicitly approved this value — apply it.
          if (!incomingIsBlank) result.sanitized[field] = normalizedIncoming;
          else if (policy.allowIncomingClear) result.sanitized[field] = null;
        }
        break;
      }

      // ==================================================
      // RESTRICTIVE_PREFERENCE
      // ==================================================
      case OWNERSHIP.RESTRICTIVE_PREFERENCE: {
        if (operation === IMPORT_OPERATIONS.NEW_RECORD_CREATE) {
          if (!incomingIsBlank) result.sanitized[field] = normalizedIncoming;
        } else if (operation === IMPORT_OPERATIONS.EXISTING_RECORD_SAFE_UPDATE) {
          // Most restrictive known value wins automatically.
          const existingBool = existingValue === true;
          const incomingBool = normalizedIncoming === true;

          if (incomingIsBlank) {
            // Blank incoming never removes an existing opt-out.
            break;
          }

          const applied = existingBool || incomingBool;

          if (incomingBool && !existingBool) {
            // Incoming opt-out enables an opt-out.
            result.sanitized[field] = true;
            result.restrictiveApplied.push({
              field,
              appliedValue: true,
              reason: 'Incoming opt-out enabled an existing restriction (most-restrictive-wins).',
            });
          } else if (!incomingBool && existingBool) {
            // Incoming opt-in but existing opt-out — keep existing opt-out.
            // Do not write; the existing value is already correct.
          }
          // If both are true or both are false, no change needed.
        } else if (operation === IMPORT_OPERATIONS.RECONCILIATION_APPROVED_UPDATE) {
          // Admin-approved reconciliation may remove a restriction.
          // The audit record is the responsibility of the reconciliation engine;
          // the sanitizer applies the approved value.
          if (!incomingIsBlank) {
            result.sanitized[field] = normalizedIncoming;
            result.restrictiveApplied.push({
              field,
              appliedValue: normalizedIncoming === true,
              reason: 'Administrator-approved reconciliation decision applied.',
            });
          }
        }
        break;
      }

      // ==================================================
      // CHAMPION_CONNECT_MANAGED
      // ==================================================
      case OWNERSHIP.CHAMPION_CONNECT_MANAGED: {
        // Never imported through any FamilyLife path.
        result.blocked.push({
          field,
          value: rawValue,
          reason: 'Champion Connect-managed field — import cannot mutate.',
        });
        break;
      }

      // ==================================================
      // BLOCKED_FROM_EXISTING_RECORD_UPDATE (fail-safe default)
      // ==================================================
      case OWNERSHIP.BLOCKED_FROM_EXISTING_RECORD_UPDATE:
      default: {
        result.blocked.push({
          field,
          value: rawValue,
          reason: 'Blocked from existing record update (fail-safe default for unmapped/unknown fields).',
        });
        break;
      }
    }
  }

  return result;
}

// ------------------------------------------------------------
// Batch helper
// ------------------------------------------------------------

/**
 * Sanitize a batch of incoming records. Each record is sanitized
 * independently against its corresponding existing record (if any).
 */
export function sanitizeImportBatch(
  incomingRecords: Record<string, unknown>[],
  operation: Operation,
  existingRecords: (Record<string, unknown> | null | undefined)[] | null | undefined,
  entity: EntityName = 'ChampionHousehold',
): SanitizationResult[] {
  return (incomingRecords || []).map((incoming, i) => {
    const existing = existingRecords ? existingRecords[i] : undefined;
    return sanitizeImportRecord(incoming, operation, existing, entity);
  });
}

// ------------------------------------------------------------
// Merge helper: combine sanitized payload with record ID
// ------------------------------------------------------------

/**
 * Attach a record ID to a sanitized payload, producing the object
 * ready for a bulkUpdate call. Returns null if the sanitized payload
 * is empty (nothing to update).
 */
export function buildUpdatePayload(
  recordId: string,
  sanitized: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!recordId || Object.keys(sanitized).length === 0) return null;
  return { id: recordId, ...sanitized };
}