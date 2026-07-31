// ============================================================
// Comparison Engine
// ============================================================
//
// Produces durable field-level comparison records between staged
// normalized incoming data and matched current production data.
//
// Rules per ownership category:
//   FAMILYLIFE_MANAGED:
//     equal → NO_ACTION
//     incoming blank & can't clear → PRESERVE_CURRENT_VALUE
//     incoming differs & valid → SAFE_FAMILYLIFE_UPDATE (auto-apply)
//     invalid incoming → INVALID_INCOMING_VALUE
//
//   CHAMPION_CONNECT_MANAGED:
//     always PROTECTED_FIELD_IGNORED / BLOCK_UPDATE (never auto-apply)
//
//   SHARED_REVIEW:
//     equal → NO_ACTION
//     both blank → NO_ACTION
//     current blank + incoming populated + allowBlankFill → SAFE_FILL_BLANK (auto-apply)
//     current blank + incoming populated + !allowBlankFill → REQUIRE_ADMIN_REVIEW
//     current populated + incoming blank → PRESERVE_CURRENT_VALUE
//     both populated & differ → SHARED_VALUE_CONFLICT / REQUIRE_ADMIN_REVIEW
//
//   RESTRICTIVE_PREFERENCE:
//     incoming adds restriction → APPLY_RESTRICTION (auto-apply)
//     current restricted + incoming blank/permissive → PRESERVE_CURRENT_VALUE
//     both agree → NO_ACTION
//
//   Unknown / unmapped:
//     UNKNOWN_FIELD_BLOCKED → BLOCK_UPDATE
//
//   New record (no existing match):
//     CREATE_NEW_RECORD_VALUE for fields allowed on create
// ============================================================

import {
  FIELD_GOVERNANCE,
  OWNERSHIP,
  type FieldPolicy,
  normalizeForComparison,
} from './governance.ts';

export const COMPARISON_RESULT = {
  SAME_VALUE: 'SAME_VALUE',
  BOTH_BLANK: 'BOTH_BLANK',
  INCOMING_VALUE_ONLY: 'INCOMING_VALUE_ONLY',
  CURRENT_VALUE_ONLY: 'CURRENT_VALUE_ONLY',
  FAMILYLIFE_VALUE_CHANGED: 'FAMILYLIFE_VALUE_CHANGED',
  SHARED_VALUE_CONFLICT: 'SHARED_VALUE_CONFLICT',
  RESTRICTIVE_VALUE_ADDED: 'RESTRICTIVE_VALUE_ADDED',
  RESTRICTIVE_VALUE_PRESERVED: 'RESTRICTIVE_VALUE_PRESERVED',
  PROTECTED_FIELD_IGNORED: 'PROTECTED_FIELD_IGNORED',
  UNKNOWN_FIELD_BLOCKED: 'UNKNOWN_FIELD_BLOCKED',
  INVALID_INCOMING_VALUE: 'INVALID_INCOMING_VALUE',
  NORMALIZATION_ONLY_DIFFERENCE: 'NORMALIZATION_ONLY_DIFFERENCE',
  CREATE_NEW_RECORD_VALUE: 'CREATE_NEW_RECORD_VALUE',
} as const;

export const RECOMMENDED_ACTION = {
  NO_ACTION: 'NO_ACTION',
  SAFE_FILL_BLANK: 'SAFE_FILL_BLANK',
  SAFE_FAMILYLIFE_UPDATE: 'SAFE_FAMILYLIFE_UPDATE',
  APPLY_RESTRICTION: 'APPLY_RESTRICTION',
  PRESERVE_CURRENT_VALUE: 'PRESERVE_CURRENT_VALUE',
  REQUIRE_ADMIN_REVIEW: 'REQUIRE_ADMIN_REVIEW',
  BLOCK_UPDATE: 'BLOCK_UPDATE',
  CREATE_NEW_RECORD_VALUE: 'CREATE_NEW_RECORD_VALUE',
} as const;

export interface FieldComparisonRecord {
  canonical_field_name: string;
  ownership_category: string;
  entity_type: 'ChampionHousehold' | 'HouseholdMember';
  current_raw_value: string;
  incoming_raw_value: string;
  current_normalized_value: string;
  incoming_normalized_value: string;
  comparison_result: string;
  recommended_action: string;
  reasoning: string;
  is_sensitive: boolean;
  requires_review: boolean;
  can_auto_apply: boolean;
}

function toStr(v: any): string {
  if (v == null) return '';
  return typeof v === 'boolean' ? String(v) : String(v);
}

function isBlank(v: any): boolean {
  return v == null || v === '' || (typeof v === 'string' && v.trim() === '');
}

// ------------------------------------------------------------
// Compare a single field for an EXISTING record
// ------------------------------------------------------------
export function compareField(
  policy: FieldPolicy,
  currentValue: any,
  incomingValue: any,
  isValid: boolean,
): FieldComparisonRecord {
  const curNorm = normalizeForComparison(currentValue, policy);
  const incNorm = normalizeForComparison(incomingValue, policy);
  const curBlank = isBlank(currentValue);
  const incBlank = isBlank(incomingValue);

  const base: FieldComparisonRecord = {
    canonical_field_name: policy.field,
    ownership_category: policy.ownership,
    entity_type: policy.entity,
    current_raw_value: toStr(currentValue),
    incoming_raw_value: toStr(incomingValue),
    current_normalized_value: curNorm,
    incoming_normalized_value: incNorm,
    comparison_result: COMPARISON_RESULT.SAME_VALUE,
    recommended_action: RECOMMENDED_ACTION.NO_ACTION,
    reasoning: '',
    is_sensitive: policy.sensitive,
    requires_review: false,
    can_auto_apply: false,
  };

  // --- Invalid incoming value ---
  if (!isValid && !incBlank) {
    base.comparison_result = COMPARISON_RESULT.INVALID_INCOMING_VALUE;
    base.recommended_action = RECOMMENDED_ACTION.PRESERVE_CURRENT_VALUE;
    base.reasoning = `Incoming value failed validation; current value preserved.`;
    return base;
  }

  switch (policy.ownership) {

    case OWNERSHIP.FAMILYLIFE_MANAGED: {
      if (curNorm === incNorm) {
        base.comparison_result = curBlank ? COMPARISON_RESULT.BOTH_BLANK : COMPARISON_RESULT.SAME_VALUE;
        base.recommended_action = RECOMMENDED_ACTION.NO_ACTION;
        base.reasoning = 'FamilyLife-managed values are equal.';
      } else if (incBlank) {
        if (policy.allowIncomingClear) {
          base.comparison_result = COMPARISON_RESULT.CURRENT_VALUE_ONLY;
          base.recommended_action = RECOMMENDED_ACTION.SAFE_FAMILYLIFE_UPDATE;
          base.can_auto_apply = true;
          base.reasoning = 'Incoming is blank and clearing is allowed for this field.';
        } else {
          base.comparison_result = COMPARISON_RESULT.CURRENT_VALUE_ONLY;
          base.recommended_action = RECOMMENDED_ACTION.PRESERVE_CURRENT_VALUE;
          base.reasoning = 'Incoming is blank; clearing not allowed — current value preserved.';
        }
      } else if (curBlank) {
        base.comparison_result = COMPARISON_RESULT.INCOMING_VALUE_ONLY;
        base.recommended_action = RECOMMENDED_ACTION.SAFE_FAMILYLIFE_UPDATE;
        base.can_auto_apply = true;
        base.reasoning = 'FamilyLife-managed field filled from blank by incoming value.';
      } else {
        base.comparison_result = COMPARISON_RESULT.FAMILYLIFE_VALUE_CHANGED;
        base.recommended_action = RECOMMENDED_ACTION.SAFE_FAMILYLIFE_UPDATE;
        base.can_auto_apply = true;
        base.reasoning = 'FamilyLife is authoritative for this field; incoming value may update on apply.';
      }
      return base;
    }

    case OWNERSHIP.CHAMPION_CONNECT_MANAGED: {
      base.comparison_result = COMPARISON_RESULT.PROTECTED_FIELD_IGNORED;
      base.recommended_action = RECOMMENDED_ACTION.BLOCK_UPDATE;
      base.reasoning = 'Champion Connect-managed field — import cannot mutate.';
      return base;
    }

    case OWNERSHIP.SHARED_REVIEW: {
      if (curNorm === incNorm) {
        base.comparison_result = curBlank ? COMPARISON_RESULT.BOTH_BLANK : COMPARISON_RESULT.SAME_VALUE;
        base.recommended_action = RECOMMENDED_ACTION.NO_ACTION;
        base.reasoning = curBlank ? 'Both values blank.' : 'Shared values are equal after normalization.';
      } else if (incBlank) {
        base.comparison_result = COMPARISON_RESULT.CURRENT_VALUE_ONLY;
        base.recommended_action = RECOMMENDED_ACTION.PRESERVE_CURRENT_VALUE;
        base.reasoning = 'Incoming is blank; shared value never cleared automatically.';
      } else if (curBlank) {
        if (policy.allowBlankFill) {
          base.comparison_result = COMPARISON_RESULT.INCOMING_VALUE_ONLY;
          base.recommended_action = RECOMMENDED_ACTION.SAFE_FILL_BLANK;
          base.can_auto_apply = true;
          base.reasoning = 'Shared field filled from blank; blank-fill permitted for this field.';
        } else {
          base.comparison_result = COMPARISON_RESULT.INCOMING_VALUE_ONLY;
          base.recommended_action = RECOMMENDED_ACTION.REQUIRE_ADMIN_REVIEW;
          base.requires_review = true;
          base.reasoning = 'Shared field currently blank; blank-fill not permitted — requires admin review.';
        }
      } else {
        base.comparison_result = COMPARISON_RESULT.SHARED_VALUE_CONFLICT;
        base.recommended_action = RECOMMENDED_ACTION.REQUIRE_ADMIN_REVIEW;
        base.requires_review = true;
        base.reasoning = 'Both sources have a populated value that differs — requires admin reconciliation.';
      }
      return base;
    }

    case OWNERSHIP.RESTRICTIVE_PREFERENCE: {
      const curBool = currentValue === true;
      const incBool = incomingValue === true;
      if (curBool === incBool && !incBlank) {
        base.comparison_result = COMPARISON_RESULT.SAME_VALUE;
        base.recommended_action = RECOMMENDED_ACTION.NO_ACTION;
        base.reasoning = 'Restrictive preference values agree.';
      } else if (incBool && !curBool) {
        base.comparison_result = COMPARISON_RESULT.RESTRICTIVE_VALUE_ADDED;
        base.recommended_action = RECOMMENDED_ACTION.APPLY_RESTRICTION;
        base.can_auto_apply = true;
        base.reasoning = 'Incoming opt-out enables a restriction (most-restrictive-wins).';
      } else if (!incBool && curBool) {
        base.comparison_result = COMPARISON_RESULT.RESTRICTIVE_VALUE_PRESERVED;
        base.recommended_action = RECOMMENDED_ACTION.PRESERVE_CURRENT_VALUE;
        base.reasoning = 'Existing opt-out preserved; incoming opt-in never removes a restriction automatically.';
      } else if (incBlank) {
        base.comparison_result = COMPARISON_RESULT.RESTRICTIVE_VALUE_PRESERVED;
        base.recommended_action = RECOMMENDED_ACTION.PRESERVE_CURRENT_VALUE;
        base.reasoning = 'Incoming is blank; existing preference preserved.';
      } else {
        base.comparison_result = COMPARISON_RESULT.SAME_VALUE;
        base.recommended_action = RECOMMENDED_ACTION.NO_ACTION;
        base.reasoning = 'Restrictive preference values agree.';
      }
      return base;
    }

    case OWNERSHIP.BLOCKED_FROM_EXISTING_RECORD_UPDATE:
    default: {
      base.comparison_result = COMPARISON_RESULT.UNKNOWN_FIELD_BLOCKED;
      base.recommended_action = RECOMMENDED_ACTION.BLOCK_UPDATE;
      base.reasoning = 'Unknown / unmapped field — blocked from existing record update.';
      return base;
    }
  }
}

// ------------------------------------------------------------
// Compare a single field for a NEW record (no existing match)
// ------------------------------------------------------------
export function compareFieldForNewRecord(
  policy: FieldPolicy,
  incomingValue: any,
  isValid: boolean,
): FieldComparisonRecord {
  const incNorm = normalizeForComparison(incomingValue, policy);
  const incBlank = isBlank(incomingValue);

  const base: FieldComparisonRecord = {
    canonical_field_name: policy.field,
    ownership_category: policy.ownership,
    entity_type: policy.entity,
    current_raw_value: '',
    incoming_raw_value: toStr(incomingValue),
    current_normalized_value: '',
    incoming_normalized_value: incNorm,
    comparison_result: COMPARISON_RESULT.CREATE_NEW_RECORD_VALUE,
    recommended_action: RECOMMENDED_ACTION.CREATE_NEW_RECORD_VALUE,
    reasoning: '',
    is_sensitive: policy.sensitive,
    requires_review: false,
    can_auto_apply: false,
  };

  if (!policy.availableOnCreate) {
    base.recommended_action = RECOMMENDED_ACTION.BLOCK_UPDATE;
    base.reasoning = `${policy.ownership} — not available on new-record create.`;
    return base;
  }
  if (incBlank) {
    base.reasoning = 'No incoming value; field left blank on new record.';
    return base;
  }
  if (!isValid) {
    base.comparison_result = COMPARISON_RESULT.INVALID_INCOMING_VALUE;
    base.recommended_action = RECOMMENDED_ACTION.PRESERVE_CURRENT_VALUE;
    base.reasoning = 'Incoming value failed validation; not included on new record.';
    return base;
  }
  base.reasoning = 'Field permitted for new-record creation.';
  return base;
}

// ------------------------------------------------------------
// Compare all fields for a household or member
// ------------------------------------------------------------
export interface ComparisonContext {
  entityType: 'ChampionHousehold' | 'HouseholdMember';
  incoming: Record<string, any>;
  existing: Record<string, any> | null;
  validationErrors: Record<string, boolean>;
}

export function compareAllFields(ctx: ComparisonContext): FieldComparisonRecord[] {
  const entityGov = FIELD_GOVERNANCE[ctx.entityType];
  if (!entityGov) return [];

  const results: FieldComparisonRecord[] = [];
  const incomingKeys = new Set(Object.keys(ctx.incoming || {}));

  for (const policy of Object.values(entityGov)) {
    // Only compare fields that appear in the incoming data OR are CC-managed
    // (to report protected fields present in the source).
    const hasIncoming = incomingKeys.has(policy.field);
    if (!hasIncoming && !policy.sourceAliases?.length) {
      // Skip fields not in incoming and not mappable from any source alias.
      // But still include CC-managed fields that the source tried to provide.
      continue;
    }

    const incomingValue = ctx.incoming?.[policy.field];
    const isValid = !ctx.validationErrors[policy.field];

    if (ctx.existing) {
      const currentValue = ctx.existing[policy.field];
      results.push(compareField(policy, currentValue, incomingValue, isValid));
    } else {
      if (!hasIncoming) continue;
      results.push(compareFieldForNewRecord(policy, incomingValue, isValid));
    }
  }

  return results;
}