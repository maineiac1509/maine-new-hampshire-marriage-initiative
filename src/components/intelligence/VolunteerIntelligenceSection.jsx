import React from 'react';
import { Link } from 'react-router-dom';
import { Users2, AlertTriangle, UserX } from 'lucide-react';
import Section from './Section';
import MetricCard from './MetricCard';

function TeamList({ title, teams }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1">
        {teams.map((t) => (
          <Link key={t.teamId} to={t.drillTarget} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50">
            <span className="truncate font-medium">{t.teamName}</span>
            <span className="text-muted-foreground">{t.count} · {t.pct}%</span>
          </Link>
        ))}
        {!teams.length && <p className="text-sm text-muted-foreground">No Relationship Builders found.</p>}
      </div>
    </div>
  );
}

export default function VolunteerIntelligenceSection({ data }) {
  return (
    <Section index={3} title="Volunteer Intelligence" summary={data.summary} icon={Users2}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard title="Avg Champions / Volunteer" value={data.avgPerVolunteer} explanation="Active Champions divided by total team members." drillTarget={data.drillTarget} icon={Users2} />
        <MetricCard title="Relationship Builders Near Capacity" value={data.nearCapacityCount} positiveIsGood={false} explanation="Relationship Builders at or above 90% of target capacity." drillTarget={data.drillTarget} icon={AlertTriangle} />
        <MetricCard title="Unassigned Champions" value={data.unassignedCount} positiveIsGood={false} explanation="Champions with no active MC Relationship Builder." drillTarget="/champions?view=unassigned" icon={UserX} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TeamList title="Most Active Relationship Builders" teams={data.mostActive} />
        <TeamList title="Least Active Relationship Builders" teams={data.leastActive} />
      </div>
    </Section>
  );
}