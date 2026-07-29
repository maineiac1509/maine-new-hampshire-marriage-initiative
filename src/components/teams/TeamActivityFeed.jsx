import React, { useState, useEffect, useMemo } from 'react';
import { Activity as ActivityIcon, GitBranch, ClipboardList } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtDate, householdDisplay } from '@/lib/teamUtils';
import TeamSection from './TeamSection';

const MILESTONE_VARIANT = { 'Assignment Created': 'success', 'Assignment Closed': 'neutral' };

// Aggregates the team's ministry activity: logged Champion activities,
// relationship status changes, and assignment milestones mirrored from the
// Assignment workflow.
export default function TeamActivityFeed({ teamId, activities, statusChanges, champions }) {
  const [teamEvents, setTeamEvents] = useState([]);

  useEffect(() => {
    if (!teamId) { setTeamEvents([]); return; }
    base44.entities.TeamTimelineEvent.filter({ team_id: teamId }, '-event_date')
      .then((rows) => setTeamEvents(rows || []))
      .catch(() => setTeamEvents([]));
  }, [teamId]);

  const champMap = useMemo(() => {
    const m = {};
    (champions || []).forEach((c) => { m[c.id] = householdDisplay(c); });
    return m;
  }, [champions]);

  const events = useMemo(() => {
    const evs = [];
    (activities || []).forEach((a) => {
      evs.push({
        id: `act-${a.id}`,
        date: a.activity_date || a.created_date,
        type: 'Activity Logged',
        icon: ActivityIcon,
        title: a.summary || a.activity_type,
        meta: [a.activity_type, a.outcome].filter(Boolean).join(' · '),
        champion: champMap[a.household_id],
      });
    });
    (statusChanges || []).forEach((s) => {
      evs.push({
        id: `sc-${s.id}`,
        date: s.change_date,
        type: 'Relationship Status Changed',
        icon: GitBranch,
        title: `${s.previous_status || '—'} → ${s.new_status}`,
        meta: '',
        champion: champMap[s.household_id],
      });
    });
    (teamEvents || []).forEach((e) => {
      evs.push({
        id: `te-${e.id}`,
        date: e.event_date,
        type: e.event_type,
        icon: ClipboardList,
        title: e.summary || e.event_type,
        meta: '',
        champion: champMap[e.household_id],
      });
    });
    return evs.sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
  }, [activities, statusChanges, teamEvents, champMap]);

  return (
    <TeamSection icon={ActivityIcon} title="Activity Feed">
      {events.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activity yet" description="Recent ministry activity across this Relationship Builder's Champions will appear here." />
      ) : (
        <ol className="space-y-3">
          {events.map((e) => {
            const variant = e.type.startsWith('Assignment') ? (MILESTONE_VARIANT[e.type] || 'neutral') : 'info';
            return (
              <li key={e.id} className="flex gap-3 rounded-lg border p-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <e.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge variant={variant}>{e.type}</StatusBadge>
                    {e.champion && <span className="truncate text-xs text-muted-foreground">{e.champion}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{fmtDate(e.date, true)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">{e.title}</p>
                  {e.meta && <p className="text-xs text-muted-foreground">{e.meta}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </TeamSection>
  );
}