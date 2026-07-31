// Frontend re-export of the import governance contract and sanitizer.
//
// The authoritative definitions live in base44/shared/import/ so that
// backend functions and frontend code share ONE source of truth.
// This file provides a clean @/lib import path for frontend components.

export {
  OWNERSHIP,
  IMPORT_OPERATIONS,
  DEFAULT_OWNERSHIP_FOR_UNKNOWN,
  FIELD_GOVERNANCE,
  getFieldPolicy,
  getEntityGovernance,
  getFieldsByOwnership,
  resolveSourceAlias,
  normalizeValue,
  normalizeForComparison,
  isRestrictivePreference,
  isChampionConnectManaged,
} from '../../base44/shared/import/governance';

export {
  sanitizeImportRecord,
  sanitizeImportBatch,
  buildUpdatePayload,
} from '../../base44/shared/import/sanitizer';