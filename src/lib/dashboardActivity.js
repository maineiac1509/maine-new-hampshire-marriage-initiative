// Builds a unified, reverse-chronological ministry activity feed from the
// existing event/timeline entities. No new data is written — this only reads
// what is already being recorded across the app.
import {
  Phone, MessageSquare, Mail, Users, Calendar, HandHelping, FileEdit,
  UserCheck, Archive, UserPlus, ClipboardList, HelpCircle,
} from 'lucide-react';

const ACTIVITY_ICON = {
  'Phone Call': Phone,
  'Voicemail': MessageSquare,
  'Text Message': MessageSquare,
  'Email': Mail,
  'In Person': Users,
  'Meeting': Calendar,
  'Prayer': HandHelping,
  'Administrative Update': FileEdit,
  'Other': HelpCircle,
};

const ASSIGNMENT_EVENT_ICON = {
  Created: UserCheck,
  Updated: FileEdit,
  'Status Changed': ClipboardList,
  Closed: Archive,
};

function timestamp(record, dateField) {
  if (record.created_date) return new Date(record.created_date).getTime();
  if (dateField) {
    const t = new Date(dateField.length > 10 ? dateField : dateField + 'T00:00:00').getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

export function buildActivityFeed({
  activities, assignmentEvents, teamTimeline, championTimeline, teamMembers,
  households, teams, users,
}) {
  const userMap = {};
  (users || []).forEach((u) => { userMap[u.id] = u.full_name || u.email || ''; });
  const find = (list, id) => (list || []).find((x) => x.id === id);
  const householdName = (id) => {
    const h = find(households, id);
    return h ? (h.household_name || 'Champion') : '';
  };
  const teamName = (id) => {
    const t = find(teams, id);
    return t ? t.team_name : '';
  };

  const items = [];

  (activities || []).forEach((a) => {
    items.push({
      id: 'act-' + a.id,
      icon: ACTIVITY_ICON[a.activity_type] || HelpCircle,
      title: a.summary || a.activity_type || 'Contact logged',
      subtitle: householdName(a.household_id) || undefined,
      timestamp: timestamp(a, a.activity_date),
      actor: userMap[a.created_by_id] || '',
      href: a.household_id ? `/champions/${a.household_id}` : undefined,
    });
  });

  (assignmentEvents || []).forEach((e) => {
    items.push({
      id: 'asge-' + e.id,
      icon: ASSIGNMENT_EVENT_ICON[e.event_type] || ClipboardList,
      title: e.summary || `Assignment ${e.event_type?.toLowerCase() || 'updated'}`,
      subtitle: undefined,
      timestamp: timestamp(e, e.event_date),
      actor: e.actor || userMap[e.created_by_id] || '',
      href: e.assignment_id ? `/assignments/${e.assignment_id}` : undefined,
    });
  });

  (championTimeline || []).forEach((e) => {
    items.push({
      id: 'cte-' + e.id,
      icon: e.event_type === 'Assignment Closed' ? Archive : UserCheck,
      title: e.summary || e.event_type || 'Assignment updated',
      subtitle: householdName(e.household_id) || undefined,
      timestamp: timestamp(e, e.event_date),
      actor: userMap[e.created_by_id] || '',
      href: e.household_id ? `/champions/${e.household_id}` : undefined,
    });
  });

  (teamTimeline || []).forEach((e) => {
    items.push({
      id: 'tte-' + e.id,
      icon: e.event_type === 'Assignment Closed' ? Archive : UserCheck,
      title: e.summary || e.event_type || 'Team update',
      subtitle: teamName(e.team_id) || undefined,
      timestamp: timestamp(e, e.event_date),
      actor: userMap[e.created_by_id] || '',
      href: e.team_id ? `/volunteer-teams/${e.team_id}` : undefined,
    });
  });

  (teamMembers || []).forEach((m) => {
    items.push({
      id: 'tm-' + m.id,
      icon: UserPlus,
      title: `Volunteer added${m.display_name ? ': ' + m.display_name : ''}`,
      subtitle: teamName(m.team_id) || undefined,
      timestamp: timestamp(m),
      actor: userMap[m.created_by_id] || '',
      href: m.team_id ? `/volunteer-teams/${m.team_id}` : undefined,
    });
  });

  // New Champions created in the last 30 days (older ones would flood the feed)
  const cutoff = Date.now() - 30 * 86400000;
  (households || []).forEach((h) => {
    const t = timestamp(h, h.registration_date);
    if (t && t >= cutoff) {
      items.push({
        id: 'hh-' + h.id,
        icon: UserPlus,
        title: `New Champion created${h.household_name ? ': ' + h.household_name : ''}`,
        subtitle: undefined,
        timestamp: t,
        actor: userMap[h.created_by_id] || '',
        href: `/champions/${h.id}`,
      });
    }
  });

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items;
}