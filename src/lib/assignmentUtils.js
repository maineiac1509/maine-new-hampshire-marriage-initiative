// Helpers for deriving per-Champion assignment status from Assignment records.
// A Champion's status is authoritative from the Assignment entity (not the
// denormalized household.volunteer_team_id field).

export function buildAssignmentMap(assignments) {
  const map = {};
  (assignments || []).forEach((a) => {
    const hid = a.household_id;
    if (!hid) return;
    if (!map[hid]) map[hid] = { active: null, ended: null };
    if (a.assignment_status === 'Active' && !map[hid].active) map[hid].active = a;
    else if (a.assignment_status === 'Ended' && !map[hid].ended) map[hid].ended = a;
  });
  return map;
}

// 'assigned'  — has an Active Assignment
// 'ended'     — most recent Assignment is Ended (no active)
// 'unassigned' — no Assignment history (needs a Volunteer Team)
export function assignmentStatusFor(householdId, assignmentMap) {
  const e = assignmentMap[householdId];
  if (e?.active) return 'assigned';
  if (e?.ended) return 'ended';
  return 'unassigned';
}