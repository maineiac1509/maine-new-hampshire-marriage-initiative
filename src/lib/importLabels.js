// Shared label and variant mappings for the FamilyLife import workflow.
// Used by both the batch list page and the batch detail / reconciliation dashboard
// so every status, result, and action badge stays consistent.

// --- Batch status ---
export const BATCH_STATUS_VARIANT = {
  UPLOADED: 'neutral',
  PARSING: 'info',
  STAGED: 'info',
  COMPARING: 'info',
  READY_FOR_REVIEW: 'info',
  READY_TO_APPLY: 'success',
  PROCESSING_FAILED: 'danger',
  DISCARDED: 'neutral',
  APPLIED: 'success',
};

export const BATCH_STATUS_LABEL = {
  UPLOADED: 'Uploaded',
  PARSING: 'Parsing…',
  STAGED: 'Staged',
  COMPARING: 'Comparing…',
  READY_FOR_REVIEW: 'Ready for Review',
  READY_TO_APPLY: 'Ready to Apply',
  PROCESSING_FAILED: 'Failed',
  DISCARDED: 'Discarded',
  APPLIED: 'Applied',
};

// --- Comparison result ---
export const COMPARISON_RESULT_VARIANT = {
  SAME_VALUE: 'neutral',
  BOTH_BLANK: 'neutral',
  INCOMING_VALUE_ONLY: 'info',
  CURRENT_VALUE_ONLY: 'neutral',
  FAMILYLIFE_VALUE_CHANGED: 'info',
  SHARED_VALUE_CONFLICT: 'danger',
  RESTRICTIVE_VALUE_ADDED: 'warning',
  RESTRICTIVE_VALUE_PRESERVED: 'neutral',
  PROTECTED_FIELD_IGNORED: 'neutral',
  UNKNOWN_FIELD_BLOCKED: 'danger',
  INVALID_INCOMING_VALUE: 'danger',
  NORMALIZATION_ONLY_DIFFERENCE: 'neutral',
  CREATE_NEW_RECORD_VALUE: 'success',
};

export const COMPARISON_RESULT_LABEL = {
  SAME_VALUE: 'Same',
  BOTH_BLANK: 'Both Blank',
  INCOMING_VALUE_ONLY: 'New Value',
  CURRENT_VALUE_ONLY: 'Current Only',
  FAMILYLIFE_VALUE_CHANGED: 'FL Changed',
  SHARED_VALUE_CONFLICT: 'Conflict',
  RESTRICTIVE_VALUE_ADDED: 'Restriction Added',
  RESTRICTIVE_VALUE_PRESERVED: 'Restriction Kept',
  PROTECTED_FIELD_IGNORED: 'Protected',
  UNKNOWN_FIELD_BLOCKED: 'Unknown Blocked',
  INVALID_INCOMING_VALUE: 'Invalid',
  NORMALIZATION_ONLY_DIFFERENCE: 'Format Only',
  CREATE_NEW_RECORD_VALUE: 'New Record Value',
};

// --- Recommended action ---
export const RECOMMENDED_ACTION_VARIANT = {
  NO_ACTION: 'neutral',
  SAFE_FILL_BLANK: 'success',
  SAFE_FAMILYLIFE_UPDATE: 'success',
  APPLY_RESTRICTION: 'warning',
  PRESERVE_CURRENT_VALUE: 'neutral',
  REQUIRE_ADMIN_REVIEW: 'danger',
  BLOCK_UPDATE: 'neutral',
  CREATE_NEW_RECORD_VALUE: 'success',
};

export const RECOMMENDED_ACTION_LABEL = {
  NO_ACTION: 'No Action',
  SAFE_FILL_BLANK: 'Fill Blank',
  SAFE_FAMILYLIFE_UPDATE: 'FL Update',
  APPLY_RESTRICTION: 'Apply Restriction',
  PRESERVE_CURRENT_VALUE: 'Preserve Current',
  REQUIRE_ADMIN_REVIEW: 'Admin Review',
  BLOCK_UPDATE: 'Blocked',
  CREATE_NEW_RECORD_VALUE: 'Create Value',
};

// --- Record classification ---
export const RECORD_CLASSIFICATION_VARIANT = {
  NEW_RECORD: 'success',
  MATCHED_NO_CHANGE: 'neutral',
  MATCHED_SAFE_CHANGES: 'info',
  MATCHED_WITH_CONFLICTS: 'danger',
  POSSIBLE_DUPLICATE: 'warning',
  UNMATCHED: 'neutral',
  INVALID: 'danger',
  BLOCKED: 'danger',
};

export const RECORD_CLASSIFICATION_LABEL = {
  NEW_RECORD: 'New Record',
  MATCHED_NO_CHANGE: 'No Change',
  MATCHED_SAFE_CHANGES: 'Safe Changes',
  MATCHED_WITH_CONFLICTS: 'Conflicts',
  POSSIBLE_DUPLICATE: 'Possible Dup',
  UNMATCHED: 'Unmatched',
  INVALID: 'Invalid',
  BLOCKED: 'Blocked',
};

// --- Match status ---
export const MATCH_STATUS_VARIANT = {
  EXACT_EXTERNAL_ID: 'success',
  EXACT_EMAIL: 'success',
  EXACT_MEMBER_EMAIL: 'success',
  EXACT_PHONE_AND_NAME: 'success',
  EXACT_ADDRESS: 'success',
  STRONG_COMPOSITE_MATCH: 'info',
  WEAK_POSSIBLE_MATCH: 'warning',
  MULTIPLE_MATCHES: 'warning',
  NO_MATCH: 'neutral',
  INVALID_MATCH_DATA: 'danger',
};

export const MATCH_STATUS_LABEL = {
  EXACT_EXTERNAL_ID: 'External ID',
  EXACT_EMAIL: 'Email',
  EXACT_MEMBER_EMAIL: 'Member Email',
  EXACT_PHONE_AND_NAME: 'Phone + Name',
  EXACT_ADDRESS: 'Address',
  STRONG_COMPOSITE_MATCH: 'Composite',
  WEAK_POSSIBLE_MATCH: 'Weak',
  MULTIPLE_MATCHES: 'Multiple',
  NO_MATCH: 'No Match',
  INVALID_MATCH_DATA: 'Invalid',
};

// --- Issue severity / type ---
export const ISSUE_SEVERITY_VARIANT = {
  INFO: 'neutral',
  WARNING: 'warning',
  ERROR: 'danger',
  BLOCKING: 'danger',
};

export const ISSUE_TYPE_LABEL = {
  UNMAPPED_COLUMN: 'Unmapped Column',
  INVALID_VALUE: 'Invalid Value',
  MISSING_REQUIRED_FIELD: 'Missing Required',
  NORMALIZATION_FAILED: 'Normalization Failed',
  MATCH_AMBIGUOUS: 'Ambiguous Match',
  MATCH_DATA_INVALID: 'Invalid Match Data',
  DUPLICATE_FILE: 'Duplicate File',
  PROCESSING_ERROR: 'Processing Error',
  PROTECTED_FIELD_IGNORED: 'Protected Field',
  UNKNOWN_FIELD_BLOCKED: 'Unknown Field',
  RESTRICTIVE_PRESERVED: 'Restriction Preserved',
  VALIDATION_WARNING: 'Validation Warning',
};

// --- Ownership category ---
export const OWNERSHIP_VARIANT = {
  FAMILYLIFE_MANAGED: 'info',
  CHAMPION_CONNECT_MANAGED: 'success',
  SHARED_REVIEW: 'warning',
  RESTRICTIVE_PREFERENCE: 'danger',
  BLOCKED_FROM_EXISTING_RECORD_UPDATE: 'neutral',
};

export const OWNERSHIP_LABEL = {
  FAMILYLIFE_MANAGED: 'FamilyLife',
  CHAMPION_CONNECT_MANAGED: 'Champion Connect',
  SHARED_REVIEW: 'Shared Review',
  RESTRICTIVE_PREFERENCE: 'Restrictive',
  BLOCKED_FROM_EXISTING_RECORD_UPDATE: 'Blocked',
};

// --- Resolution type ---
export const RESOLUTION_TYPE_LABEL = {
  KEEP_CURRENT: 'Keep Current',
  USE_INCOMING: 'Use Incoming',
  USE_CUSTOM_VALUE: 'Custom Value',
  APPLY_SAFE_UPDATE: 'Apply Update',
  APPLY_BLANK_FILL: 'Fill Blank',
  APPLY_RESTRICTION: 'Apply Restriction',
  CREATE_WITH_INCOMING_VALUE: 'Create with Value',
  SKIP_FIELD: 'Skip Field',
  BLOCK_FIELD: 'Block Field',
};

export const RESOLUTION_TYPE_VARIANT = {
  KEEP_CURRENT: 'neutral',
  USE_INCOMING: 'info',
  USE_CUSTOM_VALUE: 'warning',
  APPLY_SAFE_UPDATE: 'success',
  APPLY_BLANK_FILL: 'success',
  APPLY_RESTRICTION: 'warning',
  CREATE_WITH_INCOMING_VALUE: 'success',
  SKIP_FIELD: 'neutral',
  BLOCK_FIELD: 'neutral',
};

// --- Resolution status ---
export const RESOLUTION_STATUS_LABEL = {
  PENDING: 'Pending',
  RESOLVED: 'Resolved',
  INVALIDATED: 'Invalidated',
  APPLIED: 'Applied',
  FAILED: 'Failed',
};

export const RESOLUTION_STATUS_VARIANT = {
  PENDING: 'neutral',
  RESOLVED: 'success',
  INVALIDATED: 'neutral',
  APPLIED: 'info',
  FAILED: 'danger',
};

// --- Resolution source ---
export const RESOLUTION_SOURCE_LABEL = {
  DEFAULT: 'Default',
  MANUAL: 'Manual',
  BULK: 'Bulk',
};

// --- Row resolution status ---
export const ROW_RESOLUTION_STATUS_LABEL = {
  PENDING: 'Pending',
  RESOLVED: 'Resolved',
  DISCARDED: 'Discarded',
  SKIPPED: 'Skipped',
  BLOCKED: 'Blocked',
  MANUALLY_MATCHED: 'Manually Matched',
};

export const ROW_RESOLUTION_STATUS_VARIANT = {
  PENDING: 'neutral',
  RESOLVED: 'success',
  DISCARDED: 'neutral',
  SKIPPED: 'neutral',
  BLOCKED: 'danger',
  MANUALLY_MATCHED: 'info',
};

// --- Readiness status ---
export const READINESS_STATUS_LABEL = {
  NOT_READY: 'Not Ready',
  READY_TO_APPLY: 'Ready to Apply',
  STALE_GOVERNANCE: 'Stale Governance',
  STALE_MAPPING: 'Stale Mapping',
};

export const READINESS_STATUS_VARIANT = {
  NOT_READY: 'warning',
  READY_TO_APPLY: 'success',
  STALE_GOVERNANCE: 'danger',
  STALE_MAPPING: 'danger',
};

// --- Apply status ---
export const APPLY_STATUS_VARIANT = {
  PENDING: 'neutral',
  APPLYING: 'info',
  PAUSED: 'warning',
  APPLIED: 'success',
  FAILED: 'danger',
  PARTIALLY_FAILED: 'warning',
};

export const APPLY_STATUS_LABEL = {
  PENDING: 'Pending',
  APPLYING: 'Applying…',
  PAUSED: 'Paused — Resumable',
  APPLIED: 'Applied',
  FAILED: 'Failed',
  PARTIALLY_FAILED: 'Partially Failed',
};

// --- Apply phase ---
export const APPLY_PHASE_LABEL = {
  PREVALIDATED: 'Pre-Validated',
  CREATING_HOUSEHOLDS: 'Creating Households',
  CREATING_MEMBERS: 'Creating Members',
  UPDATING_HOUSEHOLDS: 'Updating Households',
  UPDATING_MEMBERS: 'Updating Members',
  APPLYING_RESTRICTIONS: 'Applying Restrictions',
  RECORDING_DECISIONS: 'Recording Decisions',
  VERIFYING: 'Verifying',
  FINALIZING: 'Finalizing',
  COMPLETED: 'Completed',
};

// --- Apply operation status ---
export const APPLY_OPERATION_STATUS_VARIANT = {
  PENDING: 'neutral',
  APPLIED: 'info',
  VERIFIED: 'success',
  FAILED: 'danger',
  SKIPPED: 'neutral',
};

export const APPLY_OPERATION_STATUS_LABEL = {
  PENDING: 'Pending',
  APPLIED: 'Applied',
  VERIFIED: 'Verified',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
};

// --- Apply audit result ---
export const APPLY_RESULT_VARIANT = {
  APPLIED: 'success',
  SKIPPED: 'neutral',
  BLOCKED: 'neutral',
  CREATED: 'success',
  UPDATED: 'info',
  RESTRICTION_ADDED: 'warning',
  NO_CHANGE: 'neutral',
  FAILED: 'danger',
  DRIFT_BLOCKED: 'danger',
  VERIFIED: 'success',
};

export const APPLY_RESULT_LABEL = {
  APPLIED: 'Applied',
  SKIPPED: 'Skipped',
  BLOCKED: 'Blocked',
  CREATED: 'Created',
  UPDATED: 'Updated',
  RESTRICTION_ADDED: 'Restriction Added',
  NO_CHANGE: 'No Change',
  FAILED: 'Failed',
  DRIFT_BLOCKED: 'Drift Blocked',
  VERIFIED: 'Verified',
};

// --- Bulk action type ---
export const BULK_ACTION_TYPE_LABEL = {
  ACCEPT_ALL_SAFE_UPDATES: 'Accept all safe FamilyLife updates',
  ACCEPT_ALL_BLANK_FILLS: 'Accept all blank fills',
  ACCEPT_ALL_NEW_RESTRICTIONS: 'Accept all new restrictions',
  KEEP_CURRENT_FOR_SHARED_CONFLICTS: 'Keep current for all shared conflicts',
  USE_INCOMING_FOR_SELECTED_CONFLICTS: 'Use incoming for selected conflicts',
  SKIP_SELECTED_FIELDS: 'Skip selected fields',
  BLOCK_SELECTED_ROWS: 'Block selected rows',
  ACCEPT_ALL_NEW_RECORD_FIELDS: 'Accept all proposed new-record fields',
  DISCARD_SELECTED_NEW_RECORDS: 'Discard selected proposed new records',
};

// Convenience: human-readable field name from snake_case
export function fieldLabel(field) {
  return (field || '').replace(/_/g, ' ');
}