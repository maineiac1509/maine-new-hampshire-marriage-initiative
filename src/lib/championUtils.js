// Shared helpers for Champion list views (filters, badges, summaries).

// Does this household's active Assignment belong to the current user's team?
// Requires the active Assignment and the user's team ID (derived from
// TeamMember records) — both from the Assignment entity, not the denormalized
// assigned_volunteer text field on ChampionHousehold.
export function isAssignedTo(household, user, activeAssignment, myTeamId) {
  if (!household || !user || !activeAssignment || !myTeamId) return false;
  return activeAssignment.volunteer_team_id === myTeamId;
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

// Earliest pending follow-up date (yyyy-mm-dd), or null.
export function nextFollowUpDate(activities) {
  const pending = (activities || [])
    .filter((a) => a.follow_up_required && a.follow_up_date)
    .map((a) => a.follow_up_date)
    .sort();
  return pending[0] || null;
}

// Was the household contacted within the last 7 days?
export function isRecentlyContacted(activities) {
  const la = lastActivityDate(activities);
  if (!la) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(la + 'T00:00:00')) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 7;
}

// Four standardized follow-up indicator states:
//   🔴 Overdue · 🟡 Due Today · 🟢 Up To Date · ⚪ No Follow-up Scheduled
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
    if (diff < 0) return { key: 'overdue', label: 'Overdue', tone: 'bg-red-100 text-red-700' };
    if (diff === 0) return { key: 'due-today', label: 'Due Today', tone: 'bg-amber-100 text-amber-700' };
    return { key: 'up-to-date', label: 'Up To Date', tone: 'bg-emerald-100 text-emerald-700' };
  }

  return { key: 'no-follow-up', label: 'No Follow-up Scheduled', tone: 'bg-slate-100 text-slate-500' };
}