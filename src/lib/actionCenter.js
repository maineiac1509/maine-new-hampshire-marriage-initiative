// Dynamically generates prioritized Action Center items from data already
// loaded on the dashboard. No new storage — purely derived signals.
// Each entity (Champion / Assignment / Team) surfaces only its single
// highest-priority actionable condition.
import {
  UserPlus, Users, Clock, Users2, Archive, FileWarning, UserCheck,
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

const RANK = { critical: 0, high: 1, medium: 2, informational: 3 };

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

  const raw = [];
  const now = Date.now();
  const hhName = (h) => h.household_name || `${(h._members?.[0]?.last_name) || 'Champion'} Household`;

  // --- Critical ---
  (households || []).forEach((h) => {
    if (assignmentMap[h.id]?.active) return;
    const age = daysSince(h.created_date);
    if (age !== null && age > 30) {
      raw.push({
        entityKey: `hh:${h.id}`, priority: 'critical', icon: UserPlus,
        title: 'Awaiting Assignment', subject: hhName(h),
        description: 'This Champion has not been connected with a Volunteer Team for over 30 days.',
        detected: ms(h.created_date),
        actionLabel: 'Assign Champion', href: `/champions/${h.id}`,
      });
    }
  });

  (teams || []).forEach((t) => {
    if (t.active === false && (activeByTeam[t.id] || 0) > 0) {
      raw.push({
        entityKey: `team:${t.id}`, priority: 'critical', icon: Users,
        title: 'Inactive Team Owning Champions', subject: t.team_name,
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
      raw.push({
        entityKey: `asg:${a.id}`, priority: 'critical', icon: Clock,
        title: 'Assignment May Be Overdue', subject: undefined,
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
      raw.push({
        entityKey: `hh:${h.id}`, priority: 'high', icon: UserPlus,
        title: 'Awaiting First Assignment', subject: hhName(h),
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
      raw.push({
        entityKey: `team:${t.id}`, priority: 'high', icon: Users2,
        title: 'Volunteer Team Near Capacity', subject: t.team_name,
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
      raw.push({
        entityKey: `asg:${a.id}`, priority: 'high', icon: Clock,
        title: 'Follow-up Needed', subject: undefined,
        description: 'This assigned Champion has had no recorded activity in 30+ days.',
        detected: last || ms(a.assigned_date),
        actionLabel: 'Review Champion', href: `/champions/${a.household_id}`,
      });
    }
  });

  // --- Medium ---
  (assignments || []).forEach((a) => {
    if (a.assignment_status !== 'Ended') return;
    const ended = daysSince(a.end_date || a.updated_date);
    if (ended !== null && ended <= 14) {
      raw.push({
        entityKey: `asg:${a.id}`, priority: 'medium', icon: Archive,
        title: 'Stewardship Review', subject: undefined,
        description: 'This stewardship assignment was recently ended and is ready for review.',
        detected: ms(a.end_date || a.updated_date),
        actionLabel: 'Open Assignment', href: `/assignments/${a.id}`,
      });
    }
  });

  (households || []).forEach((h) => {
    if (!h.city && !h.state) {
      raw.push({
        entityKey: `hh:${h.id}`, priority: 'medium', icon: FileWarning,
        title: 'Profile Completion', subject: hhName(h),
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
      raw.push({
        entityKey: `hh:${h.id}`, priority: 'informational', icon: UserPlus,
        title: 'New Champion Added', subject: hhName(h),
        description: 'This Champion was added this week.',
        detected: ms(h.created_date),
        actionLabel: 'Review Champion', href: `/champions/${h.id}`,
      });
    }
  });

  (assignments || []).forEach((a) => {
    if (a.assignment_status !== 'Ended') return;
    const ended = daysSince(a.end_date || a.updated_date);
    if (ended === 0) {
      raw.push({
        entityKey: `asg:${a.id}`, priority: 'informational', icon: UserCheck,
        title: 'Stewardship Ended', subject: undefined,
        description: 'Stewardship for this Champion was ended today.',
        detected: ms(a.end_date || a.updated_date),
        actionLabel: 'Open Assignment', href: `/assignments/${a.id}`,
      });
    }
  });

  (teamMembers || []).forEach((m) => {
    const age = daysSince(m.created_date);
    if (age !== null && age <= 7) {
      raw.push({
        entityKey: `tm:${m.id}`, priority: 'informational', icon: Users2,
        title: 'New Volunteer Joined', subject: m.display_name,
        description: 'A volunteer joined a team this week.',
        detected: ms(m.created_date),
        actionLabel: 'View Teams', href: '/volunteer-teams',
      });
    }
  });

  // Deduplicate: keep only the highest-priority item per entity.
  const byEntity = {};
  raw.forEach((item) => {
    const prev = byEntity[item.entityKey];
    if (!prev) { byEntity[item.entityKey] = item; return; }
    if (RANK[item.priority] < RANK[prev.priority]
      || (RANK[item.priority] === RANK[prev.priority] && item.detected < prev.detected)) {
      byEntity[item.entityKey] = item;
    }
  });

  const items = Object.values(byEntity);
  items.sort((a, b) => {
    if (RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority];
    return a.detected - b.detected;
  });
  return items;
}