// Frontend re-export of the centralized resolution policy.
//
// The authoritative definitions live in base44/shared/import/resolver.ts
// so that backend functions (preflight, apply engine, resolution workflow)
// and frontend code share ONE source of truth.
//
// This file provides a clean @/lib import path for frontend components.

import {
  RESOLUTION_TYPE,
  RESOLUTION_STATUS,
  RESOLUTION_SOURCE,
  isResolutionTypeAllowed,
  getDefaultResolutionType,
  getResolvedValue,
  isRestrictionRemovalAttempt,
  getBulkResolutionType,
  computeReadiness,
} from '../../base44/shared/import/resolver';

export {
  RESOLUTION_TYPE,
  RESOLUTION_STATUS,
  RESOLUTION_SOURCE,
  isResolutionTypeAllowed,
  getDefaultResolutionType,
  getResolvedValue,
  isRestrictionRemovalAttempt,
  getBulkResolutionType,
  computeReadiness,
};

// All possible resolution types, ordered for UI display.
const ALL_RESOLUTION_TYPES = [
  RESOLUTION_TYPE.KEEP_CURRENT,
  RESOLUTION_TYPE.APPLY_SAFE_UPDATE,
  RESOLUTION_TYPE.USE_INCOMING,
  RESOLUTION_TYPE.APPLY_BLANK_FILL,
  RESOLUTION_TYPE.USE_CUSTOM_VALUE,
  RESOLUTION_TYPE.APPLY_RESTRICTION,
  RESOLUTION_TYPE.CREATE_WITH_INCOMING_VALUE,
  RESOLUTION_TYPE.SKIP_FIELD,
  RESOLUTION_TYPE.BLOCK_FIELD,
];

/**
 * Derive the resolution options available for a comparison by calling
 * the same isResolutionTypeAllowed function used by backend validation.
 * This guarantees frontend options and backend enforcement cannot drift.
 */
export function getAvailableResolutionOptions(comparison) {
  return ALL_RESOLUTION_TYPES.filter((type) =>
    isResolutionTypeAllowed(comparison, type),
  );
}