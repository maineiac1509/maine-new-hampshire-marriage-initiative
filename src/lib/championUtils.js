// Shared helpers for Champion list views (filters, badges, summaries).

// Does this household's Assigned Volunteer match the logged-in user?
// Matches by full name or email (case-insensitive, trimmed), with
// tolerant substring matching since the field is free text.
export function isAssignedTo(household, user) {
  if (!household?.assigned_volunteer || !user) return false;
  const av = household.assigned_volunteer.trim().toLowerCase();
  if (!av) return false;
  const candidates = [user.full_name, user.email].filter(Boolean).map((v) => v.trim().toLowerCase());
  return candidates.some((c) => av === c || av.includes(c) || c.includes(av));
}

// Most recent activity date (yyyy-mm-dd) for a household, or null.
export function lastActivityDate(activities) {
  const acts = activities || [];
  if (!acts.length) return null;
  const sorted = [...acts].sort(
    (a, b) => new Date(b.activity_date || b.created_date) - new Date(a.activity_date || a.created_date)
  );
  return sorted[0]?.activity_date || null;
}

// Derive a single at-a-glance indicator for a household from its activities.
// Priority: overdue follow-up > due today > upcoming > never contacted > recently contacted > none.
export function householdIndicator(activities) {
  const acts = activities || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pending = acts
    .filter((a) => a.follow_up_required && a.follow_up_date)
    .map((a) => new Date(a.follow_up_date + 'T00:00:00'));

  if (pending.length) {
    const earliest = pending.sort((a, b) => a - b)[0];
    const diff = Math.round((earliest - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { key: 'overdue', label: 'Follow-up Overdue', tone: 'bg-red-100 text-red-700' };
    if (diff === 0) return { key: 'due-today', label: 'Follow-up Due Today', tone: 'bg-amber-100 text-amber-700' };
    return { key: 'upcoming', label: 'Upcoming Follow-up', tone: 'bg-violet-100 text-violet-700' };
  }

  if (!acts.length) return { key: 'never', label: 'Never Contacted', tone: 'bg-slate-100 text-slate-500' };

  const last = lastActivityDate(acts);
  if (last) {
    const d = new Date(last + 'T00:00:00');
    const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= 7) return { key: 'recent', label: 'Recently Contacted', tone: 'bg-emerald-100 text-emerald-700' };
  }

  return { key: 'none', label: null, tone: null };
}