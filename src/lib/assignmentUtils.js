// Helpers for deriving per-Champion assignment status from Assignment records.
// A Champion's status is authoritative from the Assignment entity (not the
// denormalized household.volunteer_team_id field).

export function buildAssignmentMap(assignments) {
  const map = {};
  (assignments || []).forEach((a) => {
    const hid = a.household_id;
    if (!hid) return;
    if (!map[hid]) map[hid] = { active: null, closed: null, onHold: null };
    if (a.assignment_status === 'Active' && !map[hid].active) map[hid].active = a;
    else if (a.assignment_status === 'Closed' && !map[hid].closed) map[hid].closed = a;
    else if (a.assignment_status === 'On Hold' && !map[hid].onHold) map[hid].onHold = a;
  });
  return map;
}

// 'assigned' — has an Active Assignment
// 'closed'   — most recent Assignment is Closed (no active)
// 'unassigned' — no Assignment history (needs a Volunteer Team)
export function assignmentStatusFor(householdId, assignmentMap) {
  const e = assignmentMap[householdId];
  if (e?.active) return 'assigned';
  if (e?.closed) return 'closed';
  return 'unassigned';
}