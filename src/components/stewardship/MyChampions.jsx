import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ChevronRight, Eye } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { buildAssignmentMap } from '@/lib/assignmentUtils';
import StatusBadge from '@/components/ui/StatusBadge';
import { latestActivityMs, timeAgo } from '@/lib/stewardship';

const LIMIT = 5;

export default function MyChampions({ households, assignments, activities }) {
  const assignmentMap = buildAssignmentMap(assignments);
  const visible = households.slice(0, LIMIT);
  const hasMore = households.length > LIMIT;

  if (households.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">My Champions</h2>
        <div className="mt-3">
          <EmptyState
            icon={Users}
            title="No Champions have been assigned to your MC Relationship Builder yet."
            description="Continue exploring the Champion Directory and stay ready to serve when new assignments are made."
            actionLabel="Browse Champion Directory"
            onAction={() => { window.location.href = '/champions'; }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">My Champions</h2>
          <p className="text-sm text-muted-foreground">Champions currently entrusted to your team.</p>
        </div>
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>
      <ul className="divide-y divide-border">
        {visible.map((h) => {
          const status = assignmentMap[h.id]?.active ? 'Active' : 'Assigned';
          const last = latestActivityMs(h.id, activities);
          return (
            <li key={h.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{h.household_name || 'Champion Household'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[h.city, h.state].filter(Boolean).join(', ') || 'Location not set'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Last activity: {timeAgo(last)}</p>
              </div>
              <StatusBadge variant="success">{status}</StatusBadge>
              <Link
                to={`/champions/${h.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Eye className="h-3.5 w-3.5" /> Quick View
              </Link>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <div className="flex justify-end pt-1">
          <Link to="/champions" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View All My Champions <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}