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
  description: 'FamilyLife Ministry Group export. Extract ALL data rows from the sheet with column headers (typically the sheet named "All MCs" or similar — skip any metadata/title sheets). Each row is one household member.',
  properties: {
    household_name: { type: 'string', description: 'MC Household: Account Name' },
    first_name: { type: 'string', description: 'First Name' },
    last_name: { type: 'string', description: 'Last Name' },
    account_salutation: { type: 'string', description: 'Salutation' },
    email: { type: 'string', description: 'Group Email' },
    mobile_phone: { type: 'string', description: 'Mobile Phone' },
    home_phone: { type: 'string', description: 'MC Household: Phone' },
    work_phone: { type: 'string' },
    relationship: { type: 'string' },
    address: { type: 'string', description: 'Address Line 1' },
    address_line_2: { type: 'string', description: 'Address Line 2' },
    city: { type: 'string', description: 'City' },
    state: { type: 'string', description: 'State' },
    zip_code: { type: 'string', description: 'Zip Code' },
    area: { type: 'string' },
    champion_status: { type: 'string', description: 'Status (Active, Inactive, Prospect, Alumni)' },
    church_name: { type: 'string', description: 'Church Name' },
    church_city: { type: 'string', description: 'Church City' },
    church_state: { type: 'string', description: 'Church State' },
    church_zip_code: { type: 'string', description: 'Church ZIP Code' },
    church_priority: { type: 'string' },
    marriage_conference_priority: { type: 'string' },
    do_not_call: { type: 'string' },
    do_not_text: { type: 'string' },
    email_opt_out: { type: 'string' },
    cumulative_registrations: { type: 'string', description: 'All Regs' },
    free_couple_registrations_used: { type: 'string', description: 'Free Couples Regs Used' },
    free_couple_registrations_available: { type: 'string', description: 'Free Couple Regs Avail' },
    registrations_toward_next_free_registration: { type: 'string', description: 'Redeemed Regs' },
    registrations_needed_for_next_free_registration: { type: 'string', description: 'Couples Needed for next Free Reg' },
    registration_date: { type: 'string' },
    registration_type: { type: 'string' },
    group_name: { type: 'string', description: 'Ministry Group Name' },
    group_start_date: { type: 'string', description: 'Start Date' },
    group_renewal_date: { type: 'string', description: 'End Date' },
    familylife_external_id: { type: 'string' },
  },
  required: ['first_name', 'last_name'],
};

export const EXPECTED_COLUMNS = Object.keys(CHAMPION_EXTRACTION_SCHEMA.properties);

// ------------------------------------------------------------
// Raw extraction schema using actual FamilyLife export column names.
// The AI extraction matches these exact column headers from the
// spreadsheet, then mapRawRows() translates them to canonical field
// names using the governance contract's sourceAliases.
// ------------------------------------------------------------
export const FL_RAW_EXTRACTION_SCHEMA = {
  type: 'object',
  description: 'FamilyLife Ministry Group export. Extract ALL data rows from the sheet with column headers (the sheet named "All MCs" or similar). Skip any metadata/title sheets at the top. Each row is one household member with their registration and household info.',
  properties: {
    'Status': { type: 'string' },
    'Ministry Group Name': { type: 'string' },
    'Start Date': { type: 'string' },
    'End Date': { type: 'string' },
    'MC Coach': { type: 'string' },
    'Church Name': { type: 'string' },
    'Church City': { type: 'string' },
    'Church State': { type: 'string' },
    'MC Household: Account Name': { type: 'string' },
    'Last Name': { type: 'string' },
    'First Name': { type: 'string' },
    'Salutation': { type: 'string' },
    'MC Household: Phone': { type: 'string' },
    'Mobile Phone': { type: 'string' },
    'Group Email': { type: 'string' },
    'Address Line 1': { type: 'string' },
    'City': { type: 'string' },
    'State': { type: 'string' },
    'Zip Code': { type: 'string' },
    'All Regs': { type: 'string' },
    'CY Regs': { type: 'string' },
    'Eligible Regs': { type: 'string' },
    'Free Couple Regs Avail': { type: 'string' },
    'Free Couples Regs Used': { type: 'string' },
    'Redeemed Regs': { type: 'string' },
    'Couples Needed for next Free Reg': { type: 'string' },
  },
  required: ['Last Name', 'First Name'],
};

// ------------------------------------------------------------
// Map raw FL rows (using actual column headers) to canonical field names.
// Returns mapped rows plus any headers that did not map to any field.
// ------------------------------------------------------------
export function mapRawRows(rawRows: Record<string, any>[]): {
  mappedRows: Record<string, any>[];
  unmappedHeaders: string[];
} {
  const mappedRows: Record<string, any>[] = [];
  const unmappedSet = new Set<string>();

  for (const rawRow of rawRows) {
    const mapped: Record<string, any> = {};
    for (const [header, value] of Object.entries(rawRow)) {
      if (value == null || value === '') continue;
      const h = (header || '').trim().toLowerCase();
      if (h === 'salutation') {
        mapped.account_salutation = value;
        continue;
      }
      const canonical = mapHeader(header);
      if (canonical) {
        mapped[canonical] = value;
      } else if (h !== '') {
        unmappedSet.add(header);
      }
    }
    mappedRows.push(mapped);
  }

  return { mappedRows, unmappedHeaders: Array.from(unmappedSet) };
}

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