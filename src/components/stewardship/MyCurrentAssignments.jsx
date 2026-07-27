import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';

const LIMIT = 5;

function fmt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length > 10 ? dateStr : dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyCurrentAssignments({ assignments, households }) {
  const hhName = (id) => {
    const h = households.find((x) => x.id === id);
    return h ? (h.household_name || 'Champion') : 'Champion';
  };
  const visible = assignments.slice(0, LIMIT);
  const hasMore = assignments.length > LIMIT;

  if (assignments.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">My Current Assignments</h2>
        <div className="mt-3">
          <EmptyState
            icon={ClipboardList}
            title="No active assignments"
            description="Your team has no active assignments right now. New assignments will appear here."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">My Current Assignments</h2>
          <p className="text-sm text-muted-foreground">Active assignments your team is stewarding.</p>
        </div>
        <ClipboardList className="h-5 w-5 text-muted-foreground" />
      </div>
      <ul className="divide-y divide-border">
        {visible.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{hhName(a.household_id)}</p>
              <p className="truncate text-xs text-muted-foreground">Assigned {fmt(a.assigned_date) || '—'}</p>
            </div>
            <StatusBadge variant="info">{a.assignment_method || 'Manual'}</StatusBadge>
            <Link
              to={`/assignments/${a.id}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="flex justify-end pt-1">
          <Link to="/assignments" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View All Assignments <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}