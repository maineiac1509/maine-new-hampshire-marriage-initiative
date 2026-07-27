import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { buildActionItems } from '@/lib/actionCenter';

const VISIBLE_LIMIT = 10;

const PRIORITY = {
  critical: { bar: 'bg-red-500', tone: 'bg-red-100 text-red-700', label: 'Critical' },
  high: { bar: 'bg-orange-500', tone: 'bg-orange-100 text-orange-700', label: 'High' },
  medium: { bar: 'bg-blue-500', tone: 'bg-blue-100 text-blue-700', label: 'Medium' },
  informational: { bar: 'bg-slate-400', tone: 'bg-slate-100 text-slate-600', label: 'Info' },
};

function detectedLabel(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 0) return 'Today';
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActionCard({ item }) {
  const Icon = item.icon;
  const p = PRIORITY[item.priority] || PRIORITY.informational;
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md sm:flex-row sm:items-center">
      <span className={`absolute inset-y-0 left-0 w-1 ${p.bar}`} />
      <div className="flex items-start gap-3 sm:flex-1">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${p.tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${p.tone}`}>{p.label}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Detected {detectedLabel(item.detected)}</p>
        </div>
      </div>
      <Link
        to={item.href}
        className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:mt-0 sm:w-auto"
      >
        {item.actionLabel}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function ActionCenter({ households, assignments, teams, activities, teamMembers }) {
  const [expanded, setExpanded] = useState(false);
  const items = buildActionItems({ households, assignments, teams, activities, teamMembers });
  const visible = expanded ? items : items.slice(0, VISIBLE_LIMIT);
  const hasMore = items.length > VISIBLE_LIMIT;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Action Center</h2>
        <p className="text-sm text-muted-foreground">Prioritized ministry opportunities that may need your attention.</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <EmptyState
            icon={CheckCircle2}
            title="Everything looks great!"
            description="Your ministry is currently operating without any outstanding action items."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visible.map((item) => (
              <ActionCard key={item.id} item={item} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex items-center gap-1 rounded-lg border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
              >
                {expanded ? 'Show Fewer' : `View All Actions (${items.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}