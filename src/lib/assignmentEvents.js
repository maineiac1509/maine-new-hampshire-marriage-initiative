// Shared helpers for recording Assignment lifecycle events across the
// Assignment audit trail, Champion timeline, and Volunteer Team activity feed.
import { base44 } from '@/api/base44Client';

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function actorName(user) {
  return user?.full_name || user?.email || 'Unknown';
}

// Authoritative per-Assignment audit trail.
export async function recordAssignmentEvent({ assignmentId, type, actor, previousValue, newValue, summary }) {
  try {
    await base44.entities.AssignmentEvent.create({
      assignment_id: assignmentId,
      event_type: type,
      event_date: todayISO(),
      actor: actor || undefined,
      previous_value: previousValue || undefined,
      new_value: newValue || undefined,
      summary: summary || undefined,
    });
  } catch (e) {}
}

// Mirror a stewardship milestone into the Champion's timeline.
export async function recordChampionMilestone({ householdId, type, assignmentId, summary }) {
  try {
    await base44.entities.ChampionTimelineEvent.create({
      household_id: householdId,
      event_type: type,
      event_date: todayISO(),
      summary: summary || undefined,
      source_assignment_id: assignmentId || undefined,
    });
  } catch (e) {}
}

// Mirror an assignment milestone into the Volunteer Team activity feed.
export async function recordTeamMilestone({ teamId, householdId, type, assignmentId, summary }) {
  try {
    await base44.entities.TeamTimelineEvent.create({
      team_id: teamId,
      household_id: householdId || undefined,
      event_type: type,
      event_date: todayISO(),
      summary: summary || undefined,
      source_assignment_id: assignmentId || undefined,
    });
  } catch (e) {}
}