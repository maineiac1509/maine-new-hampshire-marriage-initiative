import React, { useMemo } from 'react';
import { Activity as ActivityIcon, GitBranch, UserPlus } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtDate, householdDisplay } from '@/lib/teamUtils';
import TeamSection from './TeamSection';

// Aggregates activity across every Champion assigned to the team:
// logged activities, relationship status changes, and assignments.
// TODO: Support "Champion Reassigned" events once reassignment workflow lands.
export default function TeamActivityFeed({ activities, statusChanges, assignments, champions }) {
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
    (assignments || []).forEach((asg) => {
      evs.push({
        id: `asg-${asg.id}`,
        date: asg.assigned_date,
        type: 'Champion Assigned',
        icon: UserPlus,
        title: champMap[asg.household_id] || 'Champion',
        meta: asg.assignment_method,
        champion: champMap[asg.household_id],
      });
    });
    return evs.sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
  }, [activities, statusChanges, assignments, champMap]);

  return (
    <TeamSection icon={ActivityIcon} title="Team Activity Feed">
      {events.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activity yet" description="Recent ministry activity across this team's Champions will appear here." />
      ) : (
        <ol className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 rounded-lg border p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <e.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant="info">{e.type}</StatusBadge>
                  {e.champion && <span className="truncate text-xs text-muted-foreground">{e.champion}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(e.date, true)}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{e.title}</p>
                {e.meta && <p className="text-xs text-muted-foreground">{e.meta}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </TeamSection>
  );
}