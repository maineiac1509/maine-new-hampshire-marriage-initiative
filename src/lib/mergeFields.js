// Communication Center — merge field engine.
//
// Built-in fields are resolved from champion/user context in code (unavoidable
// for data-binding). Admin-managed MergeField records extend the *registry*
// shown in the composer/admin UI without code changes; non-builtin fields are
// presented as fill-in placeholders the volunteer completes manually.
// Epic 7 may swap resolveFieldValue for intelligence-driven suggestions.

import { APP_CONFIG } from '@/lib/config';

export const MERGE_REGEX = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export const BUILTIN_MERGE_FIELDS = [
  { key: 'ChampionName', label: "Champion's First Name", builtin: true, example_value: 'Sarah' },
  { key: 'SpouseName', label: "Spouse's First Name", builtin: true, example_value: 'Mike' },
  { key: 'HouseholdName', label: 'Household Name', builtin: true, example_value: 'The Anderson Family' },
  { key: 'VolunteerName', label: 'Volunteer Name (You)', builtin: true, example_value: 'Jen' },
  { key: 'ChurchName', label: 'Church Name', builtin: true, example_value: 'Grace Community Church' },
  { key: 'EventName', label: 'Event Name', builtin: true, example_value: 'Weekend to Remember' },
  { key: 'EventDate', label: 'Event Date', builtin: true, example_value: 'November 7, 2026' },
  { key: 'CurrentDate', label: "Today's Date", builtin: true, example_value: 'July 28, 2026' },
  { key: 'LeaderName', label: 'Leader Name', builtin: true, example_value: 'Pastor Dan' },
  { key: 'CustomField', label: 'Custom Field', builtin: false, example_value: '' },
];

export const COMMUNICATION_TYPES = [
  'Text Message', 'Email', 'Phone Call', 'Coffee Invitation', 'Prayer',
  'Encouragement', 'Event Invitation', 'Event Follow-Up',
  'Volunteer Encouragement', 'Church Communication', 'Other',
];

function formatDate(s) {
  if (!s) return '';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return s;
  }
}

export function findMergeFields(text) {
  if (!text) return [];
  const set = new Set();
  const re = new RegExp(MERGE_REGEX);
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return [...set];
}

// Resolve a single field key against champion/user context.
export function resolveFieldValue(key, { champion, members, user } = {}) {
  const list = members || [];
  const primary = list.find((m) => m.relationship === 'Primary') || list[0];
  const spouse = list.find((m) => m.relationship === 'Spouse');
  switch (key) {
    case 'ChampionName': return primary?.first_name || champion?.household_name || 'Friend';
    case 'SpouseName': return spouse?.first_name || '';
    case 'HouseholdName':
      return champion?.household_name || (primary?.last_name ? `${primary.last_name} Family` : 'your family');
    case 'VolunteerName': return user?.full_name || '';
    case 'ChurchName': return champion?.church_name || 'your church';
    case 'EventName': return APP_CONFIG.event || 'Weekend to Remember';
    case 'EventDate': return formatDate(APP_CONFIG.weekendDate);
    case 'CurrentDate':
      return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    case 'LeaderName': return user?.full_name || '';
    default: return ''; // unresolved / custom field
  }
}

// Replace resolvable merge fields; leave unresolved as {{Key}} placeholders.
export function resolveTemplate(body, ctx) {
  if (!body) return '';
  return body.replace(MERGE_REGEX, (full, key) => {
    const val = resolveFieldValue(key, ctx);
    return val || full;
  });
}

// Split text into parts for highlighted preview rendering.
export function highlightMergeFields(text) {
  if (!text) return [];
  const parts = [];
  let last = 0;
  const re = new RegExp(MERGE_REGEX);
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), isField: false });
    parts.push({ text: m[0], isField: true, key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), isField: false });
  return parts;
}