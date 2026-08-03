// ============================================================
// Field Governance Contract for FamilyLife Synchronization
// ============================================================
//
// This is the SINGLE AUTHORITATIVE source of truth for how
// incoming FamilyLife data may interact with Champion Connect
// production records.
//
// No import path — frontend or backend — may pass an unrestricted
// incoming object directly into ChampionHousehold or HouseholdMember
// create/update operations. All incoming data must first pass
// through the sanitizer (sanitizer.ts), which reads this contract.
//
// To add, remove, or reclassify a field's import policy, edit
// ONLY this file. The sanitizer, import handlers, comparison engine,
// and reconciliation dashboard all derive their behavior from here.
//
// Fail-safe: any field not listed here defaults to
// BLOCKED_FROM_EXISTING_RECORD_UPDATE — it can never mutate an
// existing production record, and is reported as unmapped.
// ============================================================

// ------------------------------------------------------------
// Ownership Categories
// ------------------------------------------------------------
export const OWNERSHIP = {
  // FamilyLife is the authoritative source. A valid incoming value may
  // update the production value after the import batch is approved.
  // Changes are included in comparison and audit history. A blank
  // incoming value does not clear an existing value unless the field
  // configuration explicitly allows clearing.
  FAMILYLIFE_MANAGED: 'FAMILYLIFE_MANAGED',

  // Champion Connect is the authoritative source. Imports must NEVER
  // create, update, clear, replace, or otherwise mutate these fields
  // or related records. Enforced in backend logic, not only in the UI.
  // These fields do not appear as selectable import destinations.
  CHAMPION_CONNECT_MANAGED: 'CHAMPION_CONNECT_MANAGED',

  // Both sources may contain legitimate values. Differing populated
  // values must NOT overwrite automatically — they become reconciliation
  // decisions. Identical normalized values are not conflicts. A blank
  // incoming value does not clear an existing value by default. A
  // populated incoming value may fill a currently blank production
  // value if the field configuration allows safe blank filling.
  SHARED_REVIEW: 'SHARED_REVIEW',

  // Safety-sensitive communication preferences. The most restrictive
  // known value wins automatically. An incoming opt-out may enable an
  // opt-out. An incoming opt-in or blank value must NEVER automatically
  // remove an existing local opt-out. Removing a restriction requires
  // an explicit administrator decision with an audit record.
  RESTRICTIVE_PREFERENCE: 'RESTRICTIVE_PREFERENCE',

  // Fail-safe default for unknown, unmapped, newly-introduced, or
  // incorrectly-configured fields. Cannot update existing production
  // records. May be reported to the administrator as unmapped.
  BLOCKED_FROM_EXISTING_RECORD_UPDATE: 'BLOCKED_FROM_EXISTING_RECORD_UPDATE',
} as const;

// ------------------------------------------------------------
// Import Operations (sanitizer modes)
// ------------------------------------------------------------
export const IMPORT_OPERATIONS = {
  // Creating a genuinely new Champion record. FamilyLife-managed,
  // shared, and restrictive fields may be populated. Champion
  // Connect-managed fields receive only their normal system defaults.
  NEW_RECORD_CREATE: 'NEW_RECORD_CREATE',

  // Updating an existing Champion record through a safe (non-destructive)
  // import path. No field is overwritten without an explicit policy
  // permitting it. Shared-field conflicts are flagged, not applied.
  EXISTING_RECORD_SAFE_UPDATE: 'EXISTING_RECORD_SAFE_UPDATE',

  // Applying an administrator-approved reconciliation decision. May
  // resolve shared-field conflicts and remove restrictive preferences,
  // but still cannot touch Champion Connect-managed fields.
  RECONCILIATION_APPROVED_UPDATE: 'RECONCILIATION_APPROVED_UPDATE',
} as const;

// The fail-safe default ownership for any field not in the contract.
export const DEFAULT_OWNERSHIP_FOR_UNKNOWN =
  OWNERSHIP.BLOCKED_FROM_EXISTING_RECORD_UPDATE;

// ------------------------------------------------------------
// Field Definition Shape (TypeScript interface for clarity)
// ------------------------------------------------------------
export interface FieldPolicy {
  /** Canonical field name as it exists on the entity schema. */
  field: string;
  /** Entity this field belongs to. */
  entity: 'ChampionHousehold' | 'HouseholdMember';
  /** Ownership category — determines import behavior. */
  ownership: typeof OWNERSHIP[keyof typeof OWNERSHIP];
  /** Column aliases FamilyLife might use in import files. */
  sourceAliases: string[];
  /** Primary normalization strategy for stored value. */
  normalization: 'none' | 'boolean' | 'lowercase' | 'email_lowercase' | 'phone_digits' | 'whitespace';
  /** Whether a populated incoming value may fill a currently blank production value. */
  allowBlankFill: boolean;
  /** Whether an incoming blank/null value may clear an existing populated value. */
  allowIncomingClear: boolean;
  /** Whether value comparison is case-sensitive (false = case-insensitive). */
  caseSensitive: boolean;
  /** Whether whitespace should be collapsed/trimmed before comparison. */
  normalizeWhitespace: boolean;
  /** Whether phone numbers should be reduced to digits before comparison. */
  phoneDigitNormalize: boolean;
  /** Whether email addresses should be lowercased before comparison. */
  emailLowercase: boolean;
  /** Whether the field may be populated during new-record creation. */
  availableOnCreate: boolean;
  /** Whether the field may be updated on an existing record through import. */
  availableOnUpdate: boolean;
  /** Whether differing values require administrator reconciliation. */
  requiresReconciliation: boolean;
  /** Whether the field contains sensitive information. */
  sensitive: boolean;
  /** Human-readable explanation of the field policy. */
  explanation: string;
}

// ------------------------------------------------------------
// Helper: build a policy with sensible defaults so individual
// field definitions stay readable.
// ------------------------------------------------------------
function policy(partial: Partial<FieldPolicy> & {
  field: string;
  entity: FieldPolicy['entity'];
  ownership: FieldPolicy['ownership'];
  explanation: string;
}): FieldPolicy {
  return {
    sourceAliases: [],
    normalization: 'none',
    allowBlankFill: false,
    allowIncomingClear: false,
    caseSensitive: false,
    normalizeWhitespace: true,
    phoneDigitNormalize: false,
    emailLowercase: false,
    availableOnCreate: true,
    availableOnUpdate: true,
    requiresReconciliation: false,
    sensitive: false,
    ...partial,
  };
}

// ------------------------------------------------------------
// FIELD GOVERNANCE CONTRACT
// ------------------------------------------------------------
// Every importable field is listed below. Fields not listed here
// default to BLOCKED_FROM_EXISTING_RECORD_UPDATE.
// ------------------------------------------------------------

export const FIELD_GOVERNANCE: Record<string, Record<string, FieldPolicy>> = {

  // ========================================================
  // ChampionHousehold
  // ========================================================
  ChampionHousehold: {

    // --- Metadata / Sync fields (system-managed, not from FL columns) ---
    familylife_external_id: policy({
      field: 'familylife_external_id',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['familylife id', 'fl id', 'external id', 'familylife external id', 'fl external id', 'record id', 'familylife record id'],
      normalization: 'none',
      caseSensitive: true,
      availableOnCreate: true,
      availableOnUpdate: true,
      allowBlankFill: true,
      allowIncomingClear: false,
      explanation: 'FamilyLife external identifier. Authoritative stable key for cross-system matching. May be set on create and updated when FamilyLife provides a new value, but never cleared by a blank import.',
    }),

    last_familylife_sync_at: policy({
      field: 'last_familylife_sync_at',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'System-managed timestamp of the last FamilyLife synchronization that touched this record. Never set by an import source column — maintained by the sync engine.',
    }),

    last_familylife_import_batch_id: policy({
      field: 'last_familylife_import_batch_id',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'System-managed identifier of the last import batch that updated this record. Never set by an import source column.',
    }),

    last_manual_update_at: policy({
      field: 'last_manual_update_at',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'System-managed timestamp of the last manual (non-import) update to this record. Never set by an import source column.',
    }),

    last_manual_update_by: policy({
      field: 'last_manual_update_by',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'System-managed user identifier of the last person to manually update this record. Never set by an import source column.',
    }),

    sync_provenance: policy({
      field: 'sync_provenance',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Structured metadata tracking the source, timestamp, and last FamilyLife-provided value for each shared field. Managed by the sync engine, never by an import source column.',
    }),

    // --- SHARED_REVIEW: contact & demographic fields ---
    household_name: policy({
      field: 'household_name',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['household', 'household name', 'family', 'family name', 'mc household: account name', 'account name', 'mc household account name'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Household display name. May be provided by FamilyLife or derived locally by volunteers. Differing values require admin reconciliation; blank incoming never clears an existing name.',
    }),

    address: policy({
      field: 'address',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['address', 'street', 'street address', 'address 1', 'address1', 'address line 1', 'address line one'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Mailing address. Maintained by either source. Differing values require reconciliation; blank incoming never clears.',
    }),

    address_line_2: policy({
      field: 'address_line_2',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['address 2', 'address2', 'address line 2', 'address line two'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Address second line. Maintained by either source. Differing values require reconciliation.',
    }),

    city: policy({
      field: 'city',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['city', 'town'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'City. Maintained by either source. Differing values require reconciliation.',
    }),

    state: policy({
      field: 'state',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['state', 'st', 'province'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'State. Maintained by either source. Differing values require reconciliation.',
    }),

    zip_code: policy({
      field: 'zip_code',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['zip', 'zip code', 'zip/postal', 'postal', 'postal code', 'postcode'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'ZIP / postal code. Maintained by either source. Differing values require reconciliation.',
    }),

    home_phone: policy({
      field: 'home_phone',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['home phone', 'home', 'home number', 'phone', 'phone number', 'telephone', 'mc household: phone', 'mc household phone'],
      allowBlankFill: true,
      requiresReconciliation: true,
      phoneDigitNormalize: true,
      explanation: 'Home phone. Maintained by either source. Compared as digit-normalized; differing values require reconciliation.',
    }),

    email: policy({
      field: 'email',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['email', 'e-mail', 'email address', 'e-mail address', 'household email', 'group email'],
      allowBlankFill: true,
      requiresReconciliation: true,
      emailLowercase: true,
      normalization: 'email_lowercase',
      sensitive: true,
      explanation: 'Household email. Maintained by either source. Compared case-insensitively; differing values require reconciliation. Sensitive contact information.',
    }),

    area: policy({
      field: 'area',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['area', 'region', 'territory'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Geographic area or region. Maintained by either source. Differing values require reconciliation.',
    }),

    // --- SHARED_REVIEW: church information ---
    church_name: policy({
      field: 'church_name',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['church name', 'church', 'home church', 'church attended'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Church name. Maintained by either source. Differing values require reconciliation.',
    }),

    church_city: policy({
      field: 'church_city',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['church city'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Church city. Maintained by either source. Differing values require reconciliation.',
    }),

    church_state: policy({
      field: 'church_state',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['church state'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Church state. Maintained by either source. Differing values require reconciliation.',
    }),

    church_zip_code: policy({
      field: 'church_zip_code',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['church zip', 'church zip code', 'church postal', 'church postal code'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Church ZIP code. Maintained by either source. Differing values require reconciliation.',
    }),

    // --- FAMILYLIFE_MANAGED: registration & program fields ---
    cumulative_registrations: policy({
      field: 'cumulative_registrations',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['cumulative registrations', 'cumulative', 'total registrations', 'registrations cumulative', 'all regs', 'all registrations'],
      allowBlankFill: true,
      explanation: 'Total registrations across all FamilyLife events. Calculated exclusively by FamilyLife; a populated incoming value updates the production value.',
    }),

    free_couple_registrations_used: policy({
      field: 'free_couple_registrations_used',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['free couple registrations used', 'free registrations used', 'free couple used', 'comp used', 'free couples regs used', 'free couple regs used'],
      allowBlankFill: true,
      explanation: 'Free couple registrations used. Calculated exclusively by FamilyLife.',
    }),

    free_couple_registrations_available: policy({
      field: 'free_couple_registrations_available',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['free couple registrations available', 'free registrations available', 'free couple available', 'comp available', 'free couple regs avail'],
      allowBlankFill: true,
      explanation: 'Free couple registrations available. Calculated exclusively by FamilyLife.',
    }),

    registrations_toward_next_free_registration: policy({
      field: 'registrations_toward_next_free_registration',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['registrations toward next free registration', 'toward next free', 'toward next', 'registrations toward'],
      allowBlankFill: true,
      explanation: 'Progress toward next free registration. Calculated exclusively by FamilyLife.',
    }),

    registrations_needed_for_next_free_registration: policy({
      field: 'registrations_needed_for_next_free_registration',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['registrations needed for next free registration', 'needed for next free', 'needed for next', 'registrations needed', 'couples needed for next free reg', 'couples needed for next free'],
      allowBlankFill: true,
      explanation: 'Registrations still needed for next free registration. Calculated exclusively by FamilyLife.',
    }),

    registration_date: policy({
      field: 'registration_date',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['registration date', 'reg date', 'registration', 'date registered', 'registered'],
      allowBlankFill: true,
      explanation: 'Date of first FamilyLife registration. Authoritative FamilyLife value.',
    }),

    registration_type: policy({
      field: 'registration_type',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['registration type', 'reg type', 'type'],
      allowBlankFill: true,
      explanation: 'Registration type (Individual, Couple, Group). Authoritative FamilyLife value.',
    }),

    group_name: policy({
      field: 'group_name',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['group', 'group name', 'groupname', 'small group', 'ministry group name', 'ministry group'],
      allowBlankFill: true,
      explanation: 'FamilyLife registration group code (e.g. BCSMarriage, NLC2022). Provided by FamilyLife at registration time.',
    }),

    church_priority: policy({
      field: 'church_priority',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['church priority', 'church prioritization', 'church prio'],
      allowBlankFill: true,
      explanation: 'FamilyLife church prioritization level (High, Medium, Low). FamilyLife-specific priority value.',
    }),

    marriage_conference_priority: policy({
      field: 'marriage_conference_priority',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['marriage conference priority', 'conference priority', 'weekend priority', 'marriage priority'],
      allowBlankFill: true,
      explanation: 'FamilyLife marriage conference prioritization level (High, Medium, Low). FamilyLife-specific priority value.',
    }),

    champion_status: policy({
      field: 'champion_status',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.FAMILYLIFE_MANAGED,
      sourceAliases: ['champion status', 'champion', 'status'],
      allowBlankFill: true,
      explanation: 'FamilyLife Champion program status (Active, Inactive, Prospect, Alumni). Authoritative FamilyLife program status.',
    }),

    // --- RESTRICTIVE_PREFERENCE: communication suppression fields ---
    do_not_call: policy({
      field: 'do_not_call',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.RESTRICTIVE_PREFERENCE,
      sourceAliases: ['do not call', 'dnc', 'do not call?', "don't call", 'no call'],
      normalization: 'boolean',
      allowBlankFill: false,
      allowIncomingClear: false,
      requiresReconciliation: true,
      sensitive: true,
      explanation: 'Call suppression preference. The most restrictive known value wins: an incoming opt-out enables an opt-out, but an incoming opt-in or blank never removes an existing local opt-out. Removing the restriction requires an explicit admin decision with audit record.',
    }),

    do_not_text: policy({
      field: 'do_not_text',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.RESTRICTIVE_PREFERENCE,
      sourceAliases: ['do not text', 'dnt', 'do not text?', "don't text", 'no text'],
      normalization: 'boolean',
      allowBlankFill: false,
      allowIncomingClear: false,
      requiresReconciliation: true,
      sensitive: true,
      explanation: 'Text suppression preference. The most restrictive known value wins: an incoming opt-out enables an opt-out, but an incoming opt-in or blank never removes an existing local opt-out.',
    }),

    email_opt_out: policy({
      field: 'email_opt_out',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.RESTRICTIVE_PREFERENCE,
      sourceAliases: ['email opt out', 'email opt-out', 'opt out', 'opt-out', 'unsubscribe', 'email unsubscribe'],
      normalization: 'boolean',
      allowBlankFill: false,
      allowIncomingClear: false,
      requiresReconciliation: true,
      sensitive: true,
      explanation: 'Email suppression preference. The most restrictive known value wins: an incoming opt-out enables an opt-out, but an incoming opt-in or blank never removes an existing local opt-out.',
    }),

    // --- CHAMPION_CONNECT_MANAGED: ministry relationship fields ---
    // These fields must NEVER be created, updated, cleared, replaced,
    // or otherwise mutated by any FamilyLife import path.

    group_start_date: policy({
      field: 'group_start_date',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      sourceAliases: ['start date'],
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Local ministry small-group start date. Managed by Champion Connect volunteers; never set by FamilyLife import.',
    }),

    group_renewal_date: policy({
      field: 'group_renewal_date',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      sourceAliases: ['end date'],
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Local ministry small-group renewal date. Managed by Champion Connect volunteers; never set by FamilyLife import.',
    }),

    status: policy({
      field: 'status',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      sourceAliases: [],
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Internal ministry workflow status (New, First Contact, Follow-Up, Completed, Inactive). Managed exclusively by Champion Connect volunteers and system logic. Note: FamilyLife files may contain a "status" column — it is intentionally NOT mapped to this field.',
    }),

    relationship_status: policy({
      field: 'relationship_status',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Internal relationship tracking status (New, Assigned, First Contact Needed, etc.). Managed exclusively by Champion Connect assignment and stewardship workflows.',
    }),

    volunteer_team_id: policy({
      field: 'volunteer_team_id',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Assigned volunteer team. The Assignment entity is the single source of truth for team ownership; this denormalized field is maintained by Champion Connect assignment logic only. FamilyLife import must never mutate it.',
    }),

    assigned_volunteer: policy({
      field: 'assigned_volunteer',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      sourceAliases: ['assigned volunteer', 'volunteer', 'volunteer name'],
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Assigned volunteer name. Maintained by Champion Connect assignment logic. The Assignment entity is the source of truth. FamilyLife import must never mutate this field.',
    }),

    assigned_director: policy({
      field: 'assigned_director',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      sourceAliases: ['assigned director', 'director', 'director name'],
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Assigned director. Maintained by Champion Connect assignment logic. FamilyLife import must never mutate this field.',
    }),

    notes: policy({
      field: 'notes',
      entity: 'ChampionHousehold',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      sourceAliases: ['notes', 'note', 'comments', 'comment'],
      availableOnCreate: false,
      availableOnUpdate: false,
      sensitive: true,
      explanation: 'Local ministry notes. Entered and maintained by Champion Connect volunteers. FamilyLife import must never overwrite or clear ministry notes.',
    }),
  },

  // ========================================================
  // HouseholdMember
  // ========================================================
  HouseholdMember: {

    household_id: policy({
      field: 'household_id',
      entity: 'HouseholdMember',
      ownership: OWNERSHIP.CHAMPION_CONNECT_MANAGED,
      availableOnCreate: false,
      availableOnUpdate: false,
      explanation: 'Internal link to the parent household. Assigned by Champion Connect system logic when a member is created. Never set by a FamilyLife source column.',
    }),

    first_name: policy({
      field: 'first_name',
      entity: 'HouseholdMember',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['first name', 'firstname', 'first', 'fname', 'given name'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Member first name. Maintained by either source. Differing values require reconciliation.',
    }),

    last_name: policy({
      field: 'last_name',
      entity: 'HouseholdMember',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['last name', 'lastname', 'last', 'lname', 'surname', 'family name'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Member last name. Maintained by either source. Differing values require reconciliation.',
    }),

    email: policy({
      field: 'email',
      entity: 'HouseholdMember',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['email', 'e-mail', 'email address', 'e-mail address', 'member email'],
      allowBlankFill: true,
      requiresReconciliation: true,
      emailLowercase: true,
      normalization: 'email_lowercase',
      sensitive: true,
      explanation: 'Member email. Maintained by either source. Compared case-insensitively; differing values require reconciliation. Sensitive contact information.',
    }),

    mobile_phone: policy({
      field: 'mobile_phone',
      entity: 'HouseholdMember',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['mobile phone', 'mobile', 'cell', 'cell phone', 'cellphone', 'mobile number'],
      allowBlankFill: true,
      requiresReconciliation: true,
      phoneDigitNormalize: true,
      explanation: 'Member mobile phone. Maintained by either source. Compared as digit-normalized; differing values require reconciliation.',
    }),

    work_phone: policy({
      field: 'work_phone',
      entity: 'HouseholdMember',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['work phone', 'work', 'work number', 'business phone'],
      allowBlankFill: true,
      requiresReconciliation: true,
      phoneDigitNormalize: true,
      explanation: 'Member work phone. Maintained by either source. Compared as digit-normalized; differing values require reconciliation.',
    }),

    relationship: policy({
      field: 'relationship',
      entity: 'HouseholdMember',
      ownership: OWNERSHIP.SHARED_REVIEW,
      sourceAliases: ['relationship', 'role', 'position', 'title'],
      allowBlankFill: true,
      requiresReconciliation: true,
      explanation: 'Household role (Primary, Spouse, Member). Derived from FamilyLife import row order but may be locally adjusted. Differing values require reconciliation.',
    }),
  },
};

// ------------------------------------------------------------
// Public helpers
// ------------------------------------------------------------

/** Get the policy for a specific field, or null if not in the contract. */
export function getFieldPolicy(
  entity: 'ChampionHousehold' | 'HouseholdMember',
  field: string,
): FieldPolicy | null {
  return FIELD_GOVERNANCE[entity]?.[field] ?? null;
}

/** Get all field policies for an entity. */
export function getEntityGovernance(
  entity: 'ChampionHousehold' | 'HouseholdMember',
): Record<string, FieldPolicy> {
  return FIELD_GOVERNANCE[entity] ?? {};
}

/** Get all field policies for a given ownership category within an entity. */
export function getFieldsByOwnership(
  entity: 'ChampionHousehold' | 'HouseholdMember',
  ownership: typeof OWNERSHIP[keyof typeof OWNERSHIP],
): FieldPolicy[] {
  const entityGov = FIELD_GOVERNANCE[entity] ?? {};
  return Object.values(entityGov).filter((p) => p.ownership === ownership);
}

/** Resolve a FamilyLife source column header to a canonical field name. */
export function resolveSourceAlias(
  entity: 'ChampionHousehold' | 'HouseholdMember',
  sourceHeader: string,
): string | null {
  const entityGov = FIELD_GOVERNANCE[entity] ?? {};
  const header = (sourceHeader || '').trim().toLowerCase();
  for (const policy of Object.values(entityGov)) {
    if (policy.sourceAliases.includes(header)) return policy.field;
  }
  return null;
}

// ------------------------------------------------------------
// Normalization
// ------------------------------------------------------------

const TRUTHY_BOOLEANS = new Set([
  'yes', 'y', 'true', '1', 'x', '✓', 'checked',
  'opt out', 'opt-out', 'unsubscribe', 'email opt out', 'email opt-out',
  'do not call', 'do not text', 'no call', 'no text', "don't call", "don't text",
]);

/**
 * Normalize a raw incoming value into its stored representation
 * according to the field's policy. Returns null for blank/empty.
 */
export function normalizeValue(
  value: unknown,
  policy: FieldPolicy,
): unknown {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;

  const str = String(value).trim();
  if (str === '') return null;

  // Boolean normalization (restrictive preferences)
  if (policy.normalization === 'boolean') {
    return TRUTHY_BOOLEANS.has(str.toLowerCase());
  }

  let result = str;

  if (policy.normalizeWhitespace) {
    result = result.replace(/\s+/g, ' ').trim();
  }

  if (policy.phoneDigitNormalize) {
    result = result.replace(/[^0-9]/g, '');
  } else if (policy.emailLowercase) {
    result = result.toLowerCase();
  } else if (!policy.caseSensitive) {
    result = result.toLowerCase();
  }

  return result || null;
}

/**
 * Aggressively normalize a value for comparison purposes. Used to
 * determine whether an incoming value differs from an existing value.
 * More aggressive than normalizeValue (e.g. phone digits, full lowercase).
 */
export function normalizeForComparison(
  value: unknown,
  policy: FieldPolicy,
): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  let s = String(value).trim();
  if (s === '') return '';

  if (policy.normalization === 'boolean') {
    return TRUTHY_BOOLEANS.has(s.toLowerCase()) ? 'true' : 'false';
  }

  if (policy.normalizeWhitespace) {
    s = s.replace(/\s+/g, ' ').trim();
  }

  if (policy.phoneDigitNormalize) {
    s = s.replace(/[^0-9]/g, '');
  } else {
    s = s.toLowerCase();
  }

  return s;
}

/** Check whether a field's ownership is a restrictive preference. */
export function isRestrictivePreference(policy: FieldPolicy): boolean {
  return policy.ownership === OWNERSHIP.RESTRICTIVE_PREFERENCE;
}

/** Check whether a field is Champion Connect managed (import-immutable). */
export function isChampionConnectManaged(policy: FieldPolicy): boolean {
  return policy.ownership === OWNERSHIP.CHAMPION_CONNECT_MANAGED;
}