// Dynamically generates prioritized Action Center items from data already
// loaded on the dashboard. No new storage — purely derived signals.
import {
  UserX, Users, Clock, Archive, FileWarning, UserPlus, UserCheck, Users2,
} from 'lucide-react';
import { buildAssignmentMap } from '@/lib/assignmentUtils';

const DAY = 86400000;

function daysSince(val) {
  if (!val) return null;
  const t = new Date(val.length > 10 ? val : val + 'T00:00:00').getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}

function ms(val) {
  if (!val) return Date.now();
  const t = new Date(val.length > 10 ? val : val + 'T00:00:00').getTime();
  return Number.isNaN(t) ? Date.now() : t;
}

function lastActivityMs(householdId, activitiesByHouse) {
  const acts = activitiesByHouse[householdId] || [];
  let latest = 0;
  acts.forEach((a) => {
    const t = ms(a.activity_date || a.created_date);
    if (t > latest) latest = t;
  });
  return latest;
}

export function buildActionItems({ households, assignments, teams, activities, teamMembers }) {
  const assignmentMap = buildAssignmentMap(assignments);
  const activitiesByHouse = {};
  (activities || []).forEach((a) => {
    (activitiesByHouse[a.household_id] = activitiesByHouse[a.household_id] || []).push(a);
  });
  const activeByTeam = {};
  (assignments || []).forEach((a) => {
    if (a.assignment_status === 'Active' && a.volunteer_team_id) {
      activeByTeam[a.volunteer_team_id] = (activeByTeam[a.volunteer_team_id] || 0) + 1;
    }
  });

  const items = [];
  const now = Date.now();

  const hhName = (h) => h.household_name || `${(h._members?.[0]?.last_name) || 'Champion'} Household`;

  // --- Critical ---
  (households || []).forEach((h) => {
    if (assignmentMap[h.id]?.active) return;
    const age = daysSince(h.created_date);
    if (age !== null && age > 30) {
      items.push({
        id: `crit-unassigned-${h.id}`, priority: 'critical', icon: UserX,
        title: `${hhName(h)} Awaiting Assignment`,
        description: 'This Champion has not been connected with a Volunteer Team for over 30 days.',
        detected: ms(h.created_date),
        actionLabel: 'Assign Champion', href: `/champions/${h.id}`,
      });
    }
  });

  (teams || []).forEach((t) => {
    if (t.active === false && (activeByTeam[t.id] || 0) > 0) {
      items.push({
        id: `crit-inactive-team-${t.id}`, priority: 'critical', icon: Users,
        title: `${t.team_name} is Inactive`,
        description: 'This Volunteer Team is marked inactive but still owns active Champions.',
        detected: ms(t.updated_date) || now,
        actionLabel: 'View Team', href: `/volunteer-teams/${t.id}`,
      });
    }
  });

  (assignments || []).forEach((a) => {
    if (a.assignment_status !== 'Active') return;
    const last = lastActivityMs(a.household_id, activitiesByHouse);
    const since = last ? Math.floor((now - last) / DAY) : daysSince(a.assigned_date);
    if (since !== null && since > 60) {
      items.push({
        id: `crit-stale-${a.id}`, priority: 'critical', icon: Clock,
        title: 'Assignment May Be Overdue',
        description: 'No contact activity has been recorded for this assignment in over 60 days.',
        detected: last || ms(a.assigned_date),
        actionLabel: 'Open Assignment', href: `/assignments/${a.id}`,
      });
    }
  });

  // --- High ---
  (households || []).forEach((h) => {
    if (assignmentMap[h.id]?.active) return;
    const age = daysSince(h.created_date);
    if (age !== null && age <= 30) {
      items.push({
        id: `high-awaiting-${h.id}`, priority: 'high', icon: UserPlus,
        title: `${hhName(h)} Awaiting First Assignment`,
        description: 'A newly created Champion has not yet been connected with a Volunteer Team.',
        detected: ms(h.created_date),
        actionLabel: 'Assign Champion', href: `/champions/${h.id}`,
      });
    }
  });

  (teams || []).forEach((t) => {
    if (t.active === false) return;
    const cap = t.target_capacity || 0;
    const count = activeByTeam[t.id] || 0;
    if (cap > 0 && count >= cap * 0.9) {
      items.push({
        id: `high-capacity-${t.id}`, priority: 'high', icon: Users2,
        title: `${t.team_name} Near Capacity`,
        description: `Current utilization is at ${Math.round((count / cap) * 100)}% of target capacity.`,
        detected: now,
        actionLabel: 'View Team', href: `/volunteer-teams/${t.id}`,
      });
    }
  });

  (assignments || []).forEach((a) => {
    if (a.assignment_status !== 'Active') return;
    const last = lastActivityMs(a.household_id, activitiesByHouse);
    const since = last ? Math.floor((now - last) / DAY) : daysSince(a.assigned_date);
    if (since !== null && since > 30 && since <= 60) {
      items.push({
        id: `high-noactivity-${a.id}`, priority: 'high', icon: Clock,
        title: 'No Recent Activity',
        description: 'This assigned Champion has had no recorded activity in 30+ days.',
        detected: last || ms(a.assigned_date),
        actionLabel: 'Review Champion', href: `/champions/${a.household_id}`,
      });
    }
  });

  // --- Medium ---
  (assignments || []).forEach((a) => {
    if (a.assignment_status !== 'Closed') return;
    const closed = daysSince(a.end_date || a.updated_date);
    if (closed !== null && closed <= 14) {
      items.push({
        id: `med-closed-${a.id}`, priority: 'medium', icon: Archive,
        title: 'Recently Closed Assignment',
        description: 'This assignment was recently closed and is ready for review.',
        detected: ms(a.end_date || a.updated_date),
        actionLabel: 'Open Assignment', href: `/assignments/${a.id}`,
      });
    }
  });

  (households || []).forEach((h) => {
    if (!h.city && !h.state) {
      items.push({
        id: `med-profile-${h.id}`, priority: 'medium', icon: FileWarning,
        title: `${hhName(h)} Profile Incomplete`,
        description: 'This Champion profile is missing location details.',
        detected: ms(h.updated_date) || now,
        actionLabel: 'Complete Profile', href: `/champions/${h.id}`,
      });
    }
  });

  // --- Informational ---
  (households || []).forEach((h) => {
    const age = daysSince(h.created_date);
    if (age !== null && age <= 7) {
      items.push({
        id: `info-newchamp-${h.id}`, priority: 'informational', icon: UserPlus,
        title: 'New Champion Added',
        description: `${hhName(h)} was added this week.`,
        detected: ms(h.created_date),
        actionLabel: 'Review Champion', href: `/champions/${h.id}`,
      });
    }
  });

  (assignments || []).forEach((a) => {
    if (a.assignment_status !== 'Closed') return;
    const closed = daysSince(a.end_date || a.updated_date);
    if (closed === 0) {
      items.push({
        id: `info-closedtoday-${a.id}`, priority: 'informational', icon: UserCheck,
        title: 'Assignment Completed',
        description: 'An assignment was completed today.',
        detected: ms(a.end_date || a.updated_date),
        actionLabel: 'Open Assignment', href: `/assignments/${a.id}`,
      });
    }
  });

  (teamMembers || []).forEach((m) => {
    const age = daysSince(m.created_date);
    if (age !== null && age <= 7) {
      items.push({
        id: `info-volunteer-${m.id}`, priority: 'informational', icon: Users2,
        title: 'New Volunteer Joined',
        description: `${m.display_name || 'A volunteer'} joined a team this week.`,
        detected: ms(m.created_date),
        actionLabel: 'View Teams', href: '/volunteer-teams',
      });
    }
  });

  const ORDER = { critical: 0, high: 1, medium: 2, informational: 3 };
  items.sort((a, b) => {
    if (ORDER[a.priority] !== ORDER[b.priority]) return ORDER[a.priority] - ORDER[b.priority];
    return a.detected - b.detected;
  });
  return items;
}