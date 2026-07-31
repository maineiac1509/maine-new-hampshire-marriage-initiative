// ============================================================
// Normalizer & Validator
// ============================================================
//
// Uses the governance contract as the authoritative source for
// normalization behavior. Adds validation for specific field types
// (dates, enums, numbers) and produces structured validation issues.
//
// Normalization rules (from the user's spec):
//   - Trim surrounding whitespace.
//   - Convert empty strings to null for comparison.
//   - Normalize email addresses to lowercase.
//   - Normalize phone numbers to digits for comparison while
//     preserving display values.
//   - Normalize state abbreviations consistently.
//   - Normalize ZIP codes without losing leading zeros.
//   - Normalize boolean and restrictive preference values.
//   - Normalize common spreadsheet date formats.
//   - Do NOT aggressively normalize names, addresses, churches, or
//     household names in ways that could merge distinct records.
// ============================================================

import {
  getFieldPolicy,
  normalizeValue as governanceNormalize,
  type FieldPolicy,
} from './governance.ts';

export interface FieldValidation {
  normalized: any;
  isValid: boolean;
  error?: string;
  warning?: string;
}

// ------------------------------------------------------------
// Enum / type-specific normalizers
// ------------------------------------------------------------
const PRIORITY_VALUES = new Set(['High', 'Medium', 'Low']);
const CHAMPION_STATUS_VALUES = new Set(['Active', 'Inactive', 'Prospect', 'Alumni']);
const REGISTRATION_TYPE_VALUES = new Set(['Individual', 'Couple', 'Group']);

function normalizePriority(v: any): string | null {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (['high', 'h', 'urgent'].includes(s)) return 'High';
  if (['medium', 'med', 'm', 'normal', 'mid'].includes(s)) return 'Medium';
  if (['low', 'l'].includes(s)) return 'Low';
  return null;
}

function normalizeChampionStatus(v: any): string | null {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (['active', 'a', 'current'].includes(s)) return 'Active';
  if (['inactive', 'i', 'former'].includes(s)) return 'Inactive';
  if (['prospect', 'p', 'potential', 'lead'].includes(s)) return 'Prospect';
  if (['alumni', 'alumnus', 'alum', 'past'].includes(s)) return 'Alumni';
  return null;
}

function normalizeRegistrationType(v: any): string | null {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (['individual', 'ind', 'single'].includes(s)) return 'Individual';
  if (['couple', 'c', 'married'].includes(s)) return 'Couple';
  if (['group', 'g', 'team'].includes(s)) return 'Group';
  return null;
}

function parseNumber(v: any): number | null {
  const s = (v ?? '').toString().replace(/[^0-9.-]/g, '');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a date value into ISO date format (YYYY-MM-DD).
 * Handles common spreadsheet formats:
 *   - ISO: 2025-01-15
 *   - US: 01/15/2025 or 1/15/25
 *   - Excel serial numbers (days since 1899-12-30)
 *   - Month name formats: Jan 15, 2025 / January 15, 2025
 * Returns null if the value cannot be parsed.
 */
function normalizeDate(v: any): { value: string | null; error?: string } {
  if (v == null) return { value: null };
  if (v instanceof Date && !isNaN(v.getTime())) {
    return { value: v.toISOString().slice(0, 10) };
  }
  const s = String(v).trim();
  if (!s) return { value: null };

  // Excel serial number (days since 1899-12-30)
  if (/^\d{4,6}$/.test(s) && Number(s) > 59) {
    const serial = Number(s);
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + serial * 86400000);
    if (!isNaN(d.getTime())) return { value: d.toISOString().slice(0, 10) };
  }

  // ISO format
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return { value: iso };
    return { value: null, error: `Invalid date "${s}"` };
  }

  // US format MM/DD/YYYY or M/D/YY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = (Number(year) > 50 ? '19' : '20') + year;
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    const d = new Date(`${year}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return { value: `${year}-${mm}-${dd}` };
    return { value: null, error: `Invalid date "${s}"` };
  }

  // Month name format
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    return { value: new Date(parsed).toISOString().slice(0, 10) };
  }

  return { value: null, error: `Unrecognized date format "${s}"` };
}

/**
 * Normalize state to a consistent uppercase 2-letter abbreviation.
 * Does NOT attempt to merge or expand — just trims and uppercases short codes.
 */
function normalizeState(v: any): string | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  // Full state name → abbreviation (common New England + others)
  const STATE_MAP: Record<string, string> = {
    'CONNECTICUT': 'CT', 'MASSACHUSETTS': 'MA', 'MAINE': 'ME',
    'NEW HAMPSHIRE': 'NH', 'RHODE ISLAND': 'RI', 'VERMONT': 'VT',
    'NEW YORK': 'NY', 'CALIFORNIA': 'CA', 'TEXAS': 'TX', 'FLORIDA': 'FL',
    'PENNSYLVANIA': 'PA', 'OHIO': 'OH', 'VIRGINIA': 'VA', 'GEORGIA': 'GA',
    'NORTH CAROLINA': 'NC', 'SOUTH CAROLINA': 'SC', 'WASHINGTON': 'WA',
  };
  return STATE_MAP[upper] || upper.slice(0, 2);
}

/**
 * Normalize ZIP code: trim, preserve leading zeros, keep 5-digit or ZIP+4.
 */
function normalizeZipCode(v: any): string | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  // Extract a 5-digit zip, optionally with +4
  const m = s.match(/(\d{5})(?:[-\s]?(\d{4}))?/);
  if (m) return m[2] ? `${m[1]}-${m[2]}` : m[1];
  return s;
}

// ------------------------------------------------------------
// Per-field normalization with validation
// ------------------------------------------------------------
export function normalizeAndValidateField(
  entity: 'ChampionHousehold' | 'HouseholdMember',
  field: string,
  rawValue: any,
): FieldValidation {
  const policy = getFieldPolicy(entity, field);

  // Unknown field — return as-is (will be blocked downstream)
  if (!policy) {
    return { normalized: rawValue, isValid: true };
  }

  if (rawValue == null || String(rawValue).trim() === '') {
    return { normalized: null, isValid: true };
  }

  // Apply type-specific normalization + validation for FL-managed enum fields
  if (field === 'church_priority' || field === 'marriage_conference_priority') {
    const v = normalizePriority(rawValue);
    if (v) return { normalized: v, isValid: true };
    return { normalized: null, isValid: false, error: `Unrecognized priority value "${rawValue}"` };
  }
  if (field === 'champion_status') {
    const v = normalizeChampionStatus(rawValue);
    if (v) return { normalized: v, isValid: true };
    return { normalized: null, isValid: false, error: `Unrecognized champion status "${rawValue}"` };
  }
  if (field === 'registration_type') {
    const v = normalizeRegistrationType(rawValue);
    if (v) return { normalized: v, isValid: true };
    return { normalized: null, isValid: false, error: `Unrecognized registration type "${rawValue}"` };
  }
  if (['cumulative_registrations', 'free_couple_registrations_used', 'free_couple_registrations_available',
       'registrations_toward_next_free_registration', 'registrations_needed_for_next_free_registration'].includes(field)) {
    const v = parseNumber(rawValue);
    if (v !== null) return { normalized: v, isValid: true };
    return { normalized: null, isValid: false, error: `Invalid number "${rawValue}"` };
  }
  if (field === 'registration_date' || field === 'group_start_date' || field === 'group_renewal_date') {
    const d = normalizeDate(rawValue);
    if (d.value) return { normalized: d.value, isValid: true };
    return { normalized: null, isValid: false, error: d.error || `Invalid date "${rawValue}"` };
  }
  if (field === 'state' || field === 'church_state') {
    return { normalized: normalizeState(rawValue), isValid: true };
  }
  if (field === 'zip_code' || field === 'church_zip_code') {
    return { normalized: normalizeZipCode(rawValue), isValid: true };
  }

  // Default: use governance contract normalization
  const normalized = governanceNormalize(rawValue, policy);
  return { normalized, isValid: true };
}

// ------------------------------------------------------------
// Normalize an entire mapped row for an entity type
// ------------------------------------------------------------
export interface NormalizedRowResult {
  normalized: Record<string, any>;
  errors: Array<{ field: string; message: string; rawValue: any }>;
  warnings: Array<{ field: string; message: string }>;
}

export function normalizeMappedRow(
  mappedRow: Record<string, any>,
  entity: 'ChampionHousehold' | 'HouseholdMember',
): NormalizedRowResult {
  const normalized: Record<string, any> = {};
  const errors: Array<{ field: string; message: string; rawValue: any }> = [];
  const warnings: Array<{ field: string; message: string }> = [];

  for (const [field, rawValue] of Object.entries(mappedRow)) {
    const result = normalizeAndValidateField(entity, field, rawValue);
    if (result.normalized != null) {
      normalized[field] = result.normalized;
    }
    if (!result.isValid && result.error) {
      errors.push({ field, message: result.error, rawValue });
    }
  }

  return { normalized, errors, warnings };
}