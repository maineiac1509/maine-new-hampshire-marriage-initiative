// Shared helpers for Volunteer Team views.

// Format a date or datetime string into a readable short date.
// Pass isDateTime=true for ISO timestamps (e.g. created_date).
export function fmtDate(s, isDateTime = false) {
  if (!s) return '—';
  const d = new Date(isDateTime ? s : s + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function householdDisplay(h) {
  if (!h) return 'Unnamed Household';
  return h.household_name || 'Unnamed Household';
}