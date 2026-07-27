// Derives the logged-in user's stewardship scope from existing data.
// No new storage — volunteers see their Volunteer Team's Champions;
// administrators (no team) steward the whole ministry.
import { buildAssignmentMap } from '@/lib/assignmentUtils';
import { isAdmin } from '@/lib/permissions';

export function computeStewardship({
  user, teamMembers, assignments, households, activities,
  assignmentEvents, teamTimeline, championTimeline,
}) {
  const admin = isAdmin(user);
  const membership = (teamMembers || []).find((m) => m.user_id && user && m.user_id === user.id);
  const myTeamId = membership?.team_id || null;

  const full = {
    admin, myTeamId, myTeam: null,
    myHouseholds: households || [],
    myActiveAssignments: (assignments || []).filter((a) => a.assignment_status === 'Active'),
    myAssignments: assignments || [],
    myActivities: activities || [],
    myTeamMembers: teamMembers || [],
    myAssignmentEvents: assignmentEvents || [],
    myTeamTimeline: teamTimeline || [],
    myChampionTimeline: championTimeline || [],
  };

  if (admin && !myTeamId) return full;
  if (!myTeamId) {
    return {
      admin, myTeamId: null, myTeam: null,
      myHouseholds: [], myActiveAssignments: [], myAssignments: [],
      myActivities: [], myTeamMembers: [], myAssignmentEvents: [],
      myTeamTimeline: [], myChampionTimeline: [],
    };
  }

  const myActiveAssignments = (assignments || []).filter(
    (a) => a.volunteer_team_id === myTeamId && a.assignment_status === 'Active'
  );
  const myAssignments = (assignments || []).filter((a) => a.volunteer_team_id === myTeamId);
  const myHouseholdIds = new Set(myActiveAssignments.map((a) => a.household_id).filter(Boolean));
  const myHouseholds = (households || []).filter((h) => myHouseholdIds.has(h.id));
  const myActivities = (activities || []).filter((a) => myHouseholdIds.has(a.household_id));
  const myTeamMembers = (teamMembers || []).filter((m) => m.team_id === myTeamId);
  const myAssignmentIds = new Set(myAssignments.map((a) => a.id));
  const myAssignmentEvents = (assignmentEvents || []).filter((e) => myAssignmentIds.has(e.assignment_id));
  const myTeamTimeline = (teamTimeline || []).filter((e) => e.team_id === myTeamId);
  const myChampionTimeline = (championTimeline || []).filter((e) => myHouseholdIds.has(e.household_id));

  return {
    admin, myTeamId, myTeam: null,
    myHouseholds, myActiveAssignments, myAssignments, myActivities,
    myTeamMembers, myAssignmentEvents, myTeamTimeline, myChampionTimeline,
  };
}

export function latestActivityMs(householdId, activities) {
  let latest = 0;
  (activities || []).forEach((a) => {
    if (a.household_id !== householdId) return;
    const t = a.activity_date
      ? new Date(a.activity_date.length > 10 ? a.activity_date : a.activity_date + 'T00:00:00').getTime()
      : (a.created_date ? new Date(a.created_date).getTime() : 0);
    if (t > latest) latest = t;
  });
  return latest;
}

export function timeAgo(ms) {
  if (!ms) return 'No activity yet';
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  if (diff < 86400000) return 'today';
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}