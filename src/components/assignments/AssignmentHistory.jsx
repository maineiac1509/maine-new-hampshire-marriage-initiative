import React, { useMemo } from 'react';
import { History, Plus, RefreshCw, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fmtDate } from '@/lib/teamUtils';
import AssignmentSection from './AssignmentSection';

const TYPE_META = {
  Created: { icon: Plus, variant: 'success' },
  Updated: { icon: RefreshCw, variant: 'info' },
  'Status Changed': { icon: ArrowRightCircle, variant: 'warning' },
  Closed: { icon: CheckCircle2, variant: 'neutral' },
};

// Authoritative audit trail for the current Assignment. The leading "Created"
// entry is derived from the assigned date so the timeline always shows the
// assignment's origin. Stored events record the acting user (actor).
export default function AssignmentHistory({ events, assignedDate }) {
  const items = useMemo(() => {
    const stored = (events || []).map((e) => ({
      id: e.id,
      date: e.event_date || e.created_date,
      type: e.event_type,
      summary: e.summary,
      previous: e.previous_value,
      next: e.new_value,
      actor: e.actor,
    }));
    const created = { id: '__created__', date: assignedDate, type: 'Created', summary: 'Assignment created', actor: '' };
    return [created, ...stored].sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
  }, [events, assignedDate]);

  return (
    <AssignmentSection icon={History} title="Assignment History">
      <ol className="space-y-3">
        {items.map((e) => {
          const meta = TYPE_META[e.type] || { icon: History, variant: 'neutral' };
          const Icon = meta.icon;
          return (
            <li key={e.id} className="flex gap-3 rounded-lg border p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant={meta.variant}>{e.type}</StatusBadge>
                  {e.actor && <span className="text-xs text-muted-foreground">by {e.actor}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(e.date, true)}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{e.summary || e.type}</p>
                {(e.previous || e.next) && (
                  <p className="text-xs text-muted-foreground">{e.previous || '—'} → {e.next || '—'}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </AssignmentSection>
  );
}