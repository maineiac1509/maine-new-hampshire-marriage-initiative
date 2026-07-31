// ============================================================
// Source Parser: extraction output / pasted text → mapped rows → household groups
// ============================================================
//
// Moves parsing logic out of the frontend dialog into a shared,
// reusable module. Header mapping is derived from the governance
// contract's sourceAliases — no hardcoded header maps.
//
// This module does NOT touch production records. It only transforms
// raw source data into mapped + grouped structures for staging.
// ============================================================

import {
  FIELD_GOVERNANCE,
  type FieldPolicy,
} from './governance.ts';

// ------------------------------------------------------------
// Field sets derived from the governance contract
// ------------------------------------------------------------
const HOUSEHOLD_FIELDS: string[] = Object.keys(FIELD_GOVERNANCE.ChampionHousehold || {});
const MEMBER_FIELDS: string[] = Object.keys(FIELD_GOVERNANCE.HouseholdMember || {});

// Fields a source row may populate (union of household + member, minus
// the system-only CC-managed metadata that no source column maps to).
const ALL_SOURCE_FIELDS = new Set([...HOUSEHOLD_FIELDS, ...MEMBER_FIELDS]);

// Reverse lookup: source header (lowercase) → canonical field name.
// Built once from the governance contract's sourceAliases.
const HEADER_TO_FIELD: Record<string, string> = {};
for (const entityFields of Object.values(FIELD_GOVERNANCE)) {
  for (const policy of Object.values(entityFields)) {
    for (const alias of policy.sourceAliases || []) {
      // First match wins; aliases that map to the same canonical name in
      // both entities (e.g. "email") are intentionally identical.
      if (!HEADER_TO_FIELD[alias]) {
        HEADER_TO_FIELD[alias] = policy.field;
      }
    }
  }
}

// Positional fallback when the source has no recognizable header row.
const POSITIONAL_FALLBACK = [
  'first_name', 'last_name', 'email', 'mobile_phone', 'home_phone',
  'address', 'city', 'state', 'zip_code', 'area',
  'registration_date', 'registration_type', 'group_name',
];

const RELATIONSHIP_BY_INDEX = ['Primary', 'Spouse', 'Member'];

// ------------------------------------------------------------
// JSON schema for the extractor (one row per person).
// Exported so the backend function can pass it to ExtractDataFromUploadedFile.
// ------------------------------------------------------------
export const CHAMPION_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    household_name: { type: 'string' },
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    account_salutation: { type: 'string' },
    email: { type: 'string' },
    mobile_phone: { type: 'string' },
    home_phone: { type: 'string' },
    work_phone: { type: 'string' },
    relationship: { type: 'string' },
    address: { type: 'string' },
    address_line_2: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zip_code: { type: 'string' },
    area: { type: 'string' },
    champion_status: { type: 'string' },
    church_name: { type: 'string' },
    church_city: { type: 'string' },
    church_state: { type: 'string' },
    church_zip_code: { type: 'string' },
    church_priority: { type: 'string' },
    marriage_conference_priority: { type: 'string' },
    do_not_call: { type: 'string' },
    do_not_text: { type: 'string' },
    email_opt_out: { type: 'string' },
    cumulative_registrations: { type: 'string' },
    free_couple_registrations_used: { type: 'string' },
    free_couple_registrations_available: { type: 'string' },
    registrations_toward_next_free_registration: { type: 'string' },
    registrations_needed_for_next_free_registration: { type: 'string' },
    registration_date: { type: 'string' },
    registration_type: { type: 'string' },
    group_name: { type: 'string' },
    familylife_external_id: { type: 'string' },
  },
  required: ['first_name', 'last_name'],
};

export const EXPECTED_COLUMNS = Object.keys(CHAMPION_EXTRACTION_SCHEMA.properties);

// ------------------------------------------------------------
// Header mapping
// ------------------------------------------------------------
export function mapHeader(header: string): string | null {
  const h = (header || '').trim().toLowerCase();
  if (!h) return null;
  return HEADER_TO_FIELD[h] || null;
}

/** Return all source columns that did not map to any canonical field. */
export function findUnmappedColumns(headers: string[]): string[] {
  return (headers || []).filter((h) => mapHeader(h) === null);
}

// ------------------------------------------------------------
// Normalize extractor output into a flat array of source rows
// ------------------------------------------------------------
export function normalizeExtractOutput(output: any): Record<string, any>[] {
  if (!output) return [];
  if (Array.isArray(output)) return output;
  if (typeof output === 'object') {
    const nested = Object.values(output).find((v) => Array.isArray(v));
    return nested || [output];
  }
  return [];
}

// ------------------------------------------------------------
// Parse tab-separated pasted data (as copied from spreadsheets)
// ------------------------------------------------------------
export function parsePastedData(text: string): Record<string, any>[] {
  const lines = (text || '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const rows = lines.map((l) => l.split('\t'));
  const mappedHeaders = rows[0].map(mapHeader);
  const hasHeaderRow = mappedHeaders.some((h) => h !== null);
  const headers = hasHeaderRow
    ? mappedHeaders
    : rows[0].map((_, idx) => POSITIONAL_FALLBACK[idx] || null);
  const startIdx = hasHeaderRow ? 1 : 0;
  const records: Record<string, any>[] = [];
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    const rec: Record<string, any> = {};
    headers.forEach((field, idx) => {
      if (field && row[idx] != null && row[idx].trim() !== '') {
        rec[field] = row[idx].trim();
      }
    });
    if (rec.first_name || rec.last_name) records.push(rec);
  }
  return records;
}

// ------------------------------------------------------------
// Group flat person-rows into households with their member contacts
// ------------------------------------------------------------
export interface HouseholdGroup {
  household: Record<string, any>;
  members: Record<string, any>[];
  householdGroupKey: string;
}

export interface GroupResult {
  groups: HouseholdGroup[];
  unmappedColumns: string[];
}

function groupKeyForRow(row: Record<string, any>): string {
  const name = (row.household_name || '').trim().toLowerCase();
  const ln = (row.last_name || '').trim().toLowerCase();
  const addr = (row.address || row.city || '').trim().toLowerCase();
  return name || `${ln}|${addr}`;
}

export function groupRowsIntoHouseholds(rows: Record<string, any>[]): GroupResult {
  const groups: HouseholdGroup[] = [];
  const keyMap = new Map<string, HouseholdGroup>();
  const unmappedSet = new Set<string>();

  rows.forEach((row) => {
    // Detect unmapped original keys (shouldn't happen post-mapping, but guard)
    for (const key of Object.keys(row)) {
      if (!ALL_SOURCE_FIELDS.has(key) && key !== 'account_salutation') {
        unmappedSet.add(key);
      }
    }
    const key = groupKeyForRow(row);
    let g = keyMap.get(key);
    if (!g) {
      g = { household: {}, members: [], householdGroupKey: key };
      keyMap.set(key, g);
      groups.push(g);
    }
    // Merge household-level fields (first non-empty value wins).
    HOUSEHOLD_FIELDS.forEach((f) => {
      if (!g.household[f] && row[f] != null && row[f].toString().trim() !== '') {
        g.household[f] = row[f];
      }
    });
    // Build the member record from member-level fields.
    g.members.push({
      first_name: row.account_salutation || row.first_name,
      last_name: row.last_name,
      email: row.email,
      mobile_phone: row.mobile_phone,
      work_phone: row.work_phone,
      relationship: row.relationship,
    });
  });

  // Derive household name + relationships.
  groups.forEach((g) => {
    if (!g.household.household_name) {
      const ln = (g.members.find((m) => m.last_name)?.last_name || '').trim();
      g.household.household_name = ln ? `${ln} Household` : 'Household';
    }
    g.members.forEach((m, i) => {
      if (!m.relationship) m.relationship = RELATIONSHIP_BY_INDEX[i] || 'Member';
    });
  });

  return { groups, unmappedColumns: Array.from(unmappedSet) };
}

export { HOUSEHOLD_FIELDS, MEMBER_FIELDS };