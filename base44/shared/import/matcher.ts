// ============================================================
// Matching Engine
// ============================================================
//
// Deterministic, explainable matching with a fixed precedence
// order. No AI, no probabilistic language-model matching.
//
// Precedence (strongest → weakest):
//   1. Exact FamilyLife external ID          → EXACT_EXTERNAL_ID
//   2. Exact trusted source household ID     → EXACT_EXTERNAL_ID
//   3. Exact normalized household email       → EXACT_EMAIL
//   4. Exact normalized member email          → EXACT_MEMBER_EMAIL
//   5. Exact normalized phone + name         → EXACT_PHONE_AND_NAME
//   6. Exact normalized address + city       → EXACT_ADDRESS
//   7. First + last name + supporting evidence → STRONG_COMPOSITE_MATCH
//   8. Household name only                    → WEAK_POSSIBLE_MATCH
//      (never an automatic production match)
//
// Safeguards:
//   - A weak match must never become an automatic production match.
//   - Multiple possible matches → MULTIPLE_MATCHES (POSSIBLE_DUPLICATE).
//   - Household name alone never selects an existing household.
//   - First+last name alone is treated cautiously.
//   - Match results explain which criteria were used.
//   - Confidence is deterministic and explainable.
// ============================================================

export const MATCH_STATUS = {
  EXACT_EXTERNAL_ID: 'EXACT_EXTERNAL_ID',
  EXACT_EMAIL: 'EXACT_EMAIL',
  EXACT_MEMBER_EMAIL: 'EXACT_MEMBER_EMAIL',
  EXACT_PHONE_AND_NAME: 'EXACT_PHONE_AND_NAME',
  EXACT_ADDRESS: 'EXACT_ADDRESS',
  STRONG_COMPOSITE_MATCH: 'STRONG_COMPOSITE_MATCH',
  WEAK_POSSIBLE_MATCH: 'WEAK_POSSIBLE_MATCH',
  MULTIPLE_MATCHES: 'MULTIPLE_MATCHES',
  NO_MATCH: 'NO_MATCH',
  INVALID_MATCH_DATA: 'INVALID_MATCH_DATA',
} as const;

export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];

export interface ProductionHousehold {
  id: string;
  household_name?: string;
  email?: string;
  home_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  familylife_external_id?: string;
  members?: ProductionMember[];
}

export interface ProductionMember {
  id: string;
  household_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_phone?: string;
  work_phone?: string;
  relationship?: string;
}

export interface IncomingHousehold {
  household_name?: string;
  email?: string;
  home_phone?: string;
  address?: string;
  city?: string;
  familylife_external_id?: string;
  source_household_identifier?: string;
}

export interface IncomingMember {
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_phone?: string;
  work_phone?: string;
}

export interface HouseholdMatchResult {
  status: MatchStatus;
  matchedHousehold: ProductionHousehold | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  method: string;
  possibleMatches: string[];
}

export interface MemberMatchResult {
  matchedMember: ProductionMember | null;
  method: string;
}

// ------------------------------------------------------------
// Normalization helpers (comparison-only)
// ------------------------------------------------------------
function norm(s: any): string {
  return (s ?? '').toString().trim().toLowerCase();
}
function phoneDigits(s: any): string {
  return (s ?? '').toString().replace(/[^0-9]/g, '');
}
function nameKey(first: any, last: any): string {
  return `${norm(first)}|${norm(last)}`;
}

// ------------------------------------------------------------
// Match indexes (built ONCE from production data)
// ------------------------------------------------------------
export interface MatchIndexes {
  byExternalId: Map<string, ProductionHousehold>;
  byHouseholdEmail: Map<string, ProductionHousehold[]>;
  byMemberEmail: Map<string, Array<{ household: ProductionHousehold; member: ProductionMember }>>;
  byHouseholdPhone: Map<string, ProductionHousehold[]>;
  byMemberPhone: Map<string, Array<{ household: ProductionHousehold; member: ProductionMember }>>;
  byAddressCity: Map<string, ProductionHousehold[]>;
  byMemberName: Map<string, Array<{ household: ProductionHousehold; member: ProductionMember }>>;
  byHouseholdName: Map<string, ProductionHousehold[]>;
  allHouseholds: ProductionHousehold[];
}

export function buildMatchIndexes(
  households: ProductionHousehold[],
  members: ProductionMember[],
): MatchIndexes {
  const byExternalId = new Map<string, ProductionHousehold>();
  const byHouseholdEmail = new Map<string, ProductionHousehold[]>();
  const byHouseholdPhone = new Map<string, ProductionHousehold[]>();
  const byAddressCity = new Map<string, ProductionHousehold[]>();
  const byHouseholdName = new Map<string, ProductionHousehold[]>();
  const byMemberEmail = new Map<string, Array<{ household: ProductionHousehold; member: ProductionMember }>>();
  const byMemberPhone = new Map<string, Array<{ household: ProductionHousehold; member: ProductionMember }>>();
  const byMemberName = new Map<string, Array<{ household: ProductionHousehold; member: ProductionMember }>>();

  const membersByHouse = new Map<string, ProductionMember[]>();
  for (const m of members) {
    const list = membersByHouse.get(m.household_id) || [];
    list.push(m);
    membersByHouse.set(m.household_id, list);
  }
  for (const h of households) {
    h.members = membersByHouse.get(h.id) || [];
  }

  for (const h of households) {
    if (h.familylife_external_id) {
      byExternalId.set(norm(h.familylife_external_id), h);
    }
    if (h.email) {
      const key = norm(h.email);
      if (!byHouseholdEmail.has(key)) byHouseholdEmail.set(key, []);
      byHouseholdEmail.get(key)!.push(h);
    }
    if (h.home_phone) {
      const key = phoneDigits(h.home_phone);
      if (key.length >= 7 && !byHouseholdPhone.has(key)) byHouseholdPhone.set(key, []);
      if (key.length >= 7) byHouseholdPhone.get(key)!.push(h);
    }
    const addrKey = `${norm(h.address)}|${norm(h.city)}`;
    if (addrKey !== '|') {
      if (!byAddressCity.has(addrKey)) byAddressCity.set(addrKey, []);
      byAddressCity.get(addrKey)!.push(h);
    }
    if (h.household_name) {
      const key = norm(h.household_name);
      if (!byHouseholdName.has(key)) byHouseholdName.set(key, []);
      byHouseholdName.get(key)!.push(h);
    }
    for (const m of h.members) {
      if (m.email) {
        const key = norm(m.email);
        if (!byMemberEmail.has(key)) byMemberEmail.set(key, []);
        byMemberEmail.get(key)!.push({ household: h, member: m });
      }
      for (const phone of [m.mobile_phone, m.work_phone]) {
        if (phone) {
          const key = phoneDigits(phone);
          if (key.length >= 7 && !byMemberPhone.has(key)) byMemberPhone.set(key, []);
          if (key.length >= 7) byMemberPhone.get(key)!.push({ household: h, member: m });
        }
      }
      const nk = nameKey(m.first_name, m.last_name);
      if (nk !== '|') {
        if (!byMemberName.has(nk)) byMemberName.set(nk, []);
        byMemberName.get(nk)!.push({ household: h, member: m });
      }
    }
  }

  return {
    byExternalId, byHouseholdEmail, byMemberEmail,
    byHouseholdPhone, byMemberPhone, byAddressCity,
    byMemberName, byHouseholdName, allHouseholds: households,
  };
}

// ------------------------------------------------------------
// Household matching
// ------------------------------------------------------------
export function matchHousehold(
  incoming: IncomingHousehold,
  incomingMembers: IncomingMember[],
  indexes: MatchIndexes,
): HouseholdMatchResult {
  // 1. Exact FamilyLife external ID
  if (incoming.familylife_external_id) {
    const h = indexes.byExternalId.get(norm(incoming.familylife_external_id));
    if (h) {
      return {
        status: MATCH_STATUS.EXACT_EXTERNAL_ID, matchedHousehold: h,
        confidence: 'high', method: `Exact FamilyLife external ID "${incoming.familylife_external_id}"`,
        possibleMatches: [h.id],
      };
    }
  }

  // 2. Exact trusted source household identifier
  if (incoming.source_household_identifier) {
    const h = indexes.byExternalId.get(norm(incoming.source_household_identifier));
    if (h) {
      return {
        status: MATCH_STATUS.EXACT_EXTERNAL_ID, matchedHousehold: h,
        confidence: 'high', method: `Exact source household identifier "${incoming.source_household_identifier}"`,
        possibleMatches: [h.id],
      };
    }
  }

  // 3. Exact normalized household email
  if (incoming.email) {
    const key = norm(incoming.email);
    const matches = indexes.byHouseholdEmail.get(key) || [];
    if (matches.length === 1) {
      return {
        status: MATCH_STATUS.EXACT_EMAIL, matchedHousehold: matches[0],
        confidence: 'high', method: `Exact household email "${incoming.email}"`,
        possibleMatches: [matches[0].id],
      };
    }
    if (matches.length > 1) {
      return {
        status: MATCH_STATUS.MULTIPLE_MATCHES, matchedHousehold: null,
        confidence: 'low', method: `${matches.length} households share email "${incoming.email}"`,
        possibleMatches: matches.map((h) => h.id),
      };
    }
  }

  // 4. Exact normalized member email
  const memberEmails = (incomingMembers || []).map((m) => m.email).filter(Boolean);
  for (const email of memberEmails) {
    const key = norm(email);
    const matches = indexes.byMemberEmail.get(key) || [];
    if (matches.length === 1) {
      return {
        status: MATCH_STATUS.EXACT_MEMBER_EMAIL, matchedHousehold: matches[0].household,
        confidence: 'high', method: `Exact member email "${email}"`,
        possibleMatches: [matches[0].household.id],
      };
    }
    if (matches.length > 1) {
      // Multiple households have a member with this email
      const householdIds = Array.from(new Set(matches.map((m) => m.household.id)));
      if (householdIds.length === 1) {
        return {
          status: MATCH_STATUS.EXACT_MEMBER_EMAIL, matchedHousehold: matches[0].household,
          confidence: 'high', method: `Exact member email "${email}"`,
          possibleMatches: householdIds,
        };
      }
      return {
        status: MATCH_STATUS.MULTIPLE_MATCHES, matchedHousehold: null,
        confidence: 'low', method: `${householdIds.length} households have a member with email "${email}"`,
        possibleMatches: householdIds,
      };
    }
  }

  // 5. Exact normalized phone + compatible name
  if (incoming.home_phone) {
    const key = phoneDigits(incoming.home_phone);
    if (key.length >= 7) {
      const matches = indexes.byHouseholdPhone.get(key) || [];
      if (matches.length === 1) {
        return {
          status: MATCH_STATUS.EXACT_PHONE_AND_NAME, matchedHousehold: matches[0],
          confidence: 'medium', method: `Exact home phone with household name evidence`,
          possibleMatches: [matches[0].id],
        };
      }
    }
  }
  for (const m of incomingMembers) {
    for (const phone of [m.mobile_phone, m.work_phone]) {
      if (phone) {
        const key = phoneDigits(phone);
        if (key.length >= 7) {
          const matches = indexes.byMemberPhone.get(key) || [];
          if (matches.length >= 1) {
            const householdIds = Array.from(new Set(matches.map((x) => x.household.id)));
            if (householdIds.length === 1) {
              return {
                status: MATCH_STATUS.EXACT_PHONE_AND_NAME, matchedHousehold: matches[0].household,
                confidence: 'medium', method: `Exact member phone with name evidence`,
                possibleMatches: householdIds,
              };
            }
          }
        }
      }
    }
  }

  // 6. Exact normalized address + city
  const addrKey = `${norm(incoming.address)}|${norm(incoming.city)}`;
  if (addrKey !== '|') {
    const matches = indexes.byAddressCity.get(addrKey) || [];
    if (matches.length === 1) {
      return {
        status: MATCH_STATUS.EXACT_ADDRESS, matchedHousehold: matches[0],
        confidence: 'medium', method: `Exact address + city`,
        possibleMatches: [matches[0].id],
      };
    }
    if (matches.length > 1) {
      return {
        status: MATCH_STATUS.MULTIPLE_MATCHES, matchedHousehold: null,
        confidence: 'low', method: `${matches.length} households share address + city`,
        possibleMatches: matches.map((h) => h.id),
      };
    }
  }

  // 7. First + last name with supporting household evidence
  for (const m of incomingMembers) {
    const nk = nameKey(m.first_name, m.last_name);
    if (nk !== '|') {
      const matches = indexes.byMemberName.get(nk) || [];
      if (matches.length === 1) {
        return {
          status: MATCH_STATUS.STRONG_COMPOSITE_MATCH, matchedHousehold: matches[0].household,
          confidence: 'medium', method: `Member name "${m.first_name} ${m.last_name}" matched within one household`,
          possibleMatches: [matches[0].household.id],
        };
      }
      if (matches.length > 1) {
        const householdIds = Array.from(new Set(matches.map((x) => x.household.id)));
        if (householdIds.length === 1) {
          return {
            status: MATCH_STATUS.STRONG_COMPOSITE_MATCH, matchedHousehold: matches[0].household,
            confidence: 'medium', method: `Member name "${m.first_name} ${m.last_name}" matched within one household`,
            possibleMatches: householdIds,
          };
        }
        // Multiple households have a member with this name — do NOT auto-match
        return {
          status: MATCH_STATUS.MULTIPLE_MATCHES, matchedHousehold: null,
          confidence: 'low', method: `${householdIds.length} households have a member named "${m.first_name} ${m.last_name}"`,
          possibleMatches: householdIds,
        };
      }
    }
  }

  // 8. Household name only — weak candidate, never an automatic match
  if (incoming.household_name) {
    const key = norm(incoming.household_name);
    const matches = indexes.byHouseholdName.get(key) || [];
    if (matches.length >= 1) {
      return {
        status: MATCH_STATUS.WEAK_POSSIBLE_MATCH, matchedHousehold: null,
        confidence: 'low', method: `Household name "${incoming.household_name}" matched ${matches.length} existing household(s) — name-only match requires admin confirmation`,
        possibleMatches: matches.map((h) => h.id),
      };
    }
  }

  return {
    status: MATCH_STATUS.NO_MATCH, matchedHousehold: null,
    confidence: 'none', method: 'No matching criteria matched',
    possibleMatches: [],
  };
}

// ------------------------------------------------------------
// Member matching within a known household
// ------------------------------------------------------------
export function matchMember(
  incoming: IncomingMember,
  houseMembers: ProductionMember[],
): MemberMatchResult {
  const inEmail = norm(incoming.email);
  if (inEmail) {
    const m = houseMembers.find((em) => norm(em.email) === inEmail);
    if (m) return { matchedMember: m, method: `Exact member email` };
  }
  const inKey = nameKey(incoming.first_name, incoming.last_name);
  if (inKey !== '|') {
    const m = houseMembers.find((em) => nameKey(em.first_name, em.last_name) === inKey);
    if (m) return { matchedMember: m, method: `Member first + last name` };
  }
  return { matchedMember: null, method: 'No existing member matched — new member' };
}