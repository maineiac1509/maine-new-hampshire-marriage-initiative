import React from 'react';
import { History } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fmtDate } from '@/lib/teamUtils';

const STATUS_VARIANT = { Active: 'success', Ended: 'neutral' };

// Chronological stewardship journey for a Champion — every Assignment ever
// recorded, preserved permanently. Communicates how responsibility has moved
// between Volunteer Teams over time without implying the relationship ended.
export default function StewardshipTimeline({ assignments, teams, healthEvents = [] }) {
  const teamMap = (teams || []).reduce((m, t) => { m[t.id] = t; return m; }, {});
  const ordered = [...(assignments || [])].sort(
    (a, b) => new Date(a.assigned_date || 0) - new Date(b.assigned_date || 0)
  );

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="h-4 w-4" /> Stewardship Timeline
      </div>
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No stewardship history yet. This Champion has not been assigned to an MC Relationship Builder.
        </p>
      ) : (
        <ol className="space-y-3">
          {ordered.map((a) => {
            const team = teamMap[a.volunteer_team_id];
            const status = a.assignment_status || 'Active';
            const isEnded = status === 'Ended';
            return (
              <li key={a.id} className="flex gap-3 rounded-lg border p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <History className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{team?.team_name || 'Unknown Relationship Builder'}</span>
                    <StatusBadge variant={STATUS_VARIANT[status] || 'neutral'}>{isEnded ? 'Ended' : 'Active'}</StatusBadge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fmtDate(a.assigned_date) || '—'} → {isEnded ? (fmtDate(a.end_date) || 'Ended') : 'Present'}
                    </span>
                  </div>
                  {isEnded && (a.end_reason || a.closing_reason) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      End Reason: {a.end_reason || a.closing_reason}
                      {(a.end_reason_notes || a.closing_notes) ? ` — ${a.end_reason_notes || a.closing_notes}` : ''}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {healthEvents.length > 0 && (
        <div className="mt-4 rounded-lg border border-dashed bg-emerald-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stewardship Health Milestones</p>
          <ul className="mt-2 space-y-1">
            {healthEvents.map((e) => (
              <li key={e.id} className="text-sm text-foreground">
                {e.event_date ? fmtDate(e.event_date) : '—'} · {e.summary || 'Health update'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}