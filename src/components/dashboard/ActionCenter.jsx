import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import RecommendationCard from '@/components/recommendations/RecommendationCard';

const VISIBLE_LIMIT = 10;

const PRIORITY = {
  critical: { dot: 'bg-red-500', label: 'Critical', tone: 'bg-red-100 text-red-700' },
  high: { dot: 'bg-orange-500', label: 'High', tone: 'bg-orange-100 text-orange-700' },
  medium: { dot: 'bg-amber-500', label: 'Medium', tone: 'bg-amber-100 text-amber-700' },
  low: { dot: 'bg-slate-400', label: 'Low', tone: 'bg-slate-100 text-slate-600' },
};
const ORDER = ['critical', 'high', 'medium', 'low'];

function priorityKey(p) {
  return (p || '').toLowerCase();
}

// Action Center — now driven entirely by the Stewardship Recommendation Engine.
// Existing UX preserved: priority filter chips, sorting, expand/collapse, empty
// states, and external drill-down (resetSignal / requestedPriority).
export default function ActionCenter({
  recommendations = [],
  onSelect,
  onDismiss,
  title = 'Action Center',
  subtitle = 'Prioritized stewardship opportunities that may need your attention.',
  resetSignal,
  requestedPriority,
}) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState(null);

  // External drill-down from the dashboard summary: clear filters + expand.
  useEffect(() => {
    if (resetSignal) {
      setFilter(null);
      setExpanded(true);
    }
  }, [resetSignal]);

  // External priority drill-down from the Recommendation Summary widget.
  useEffect(() => {
    if (requestedPriority) {
      setFilter(requestedPriority);
      setExpanded(true);
    }
  }, [requestedPriority]);

  const items = recommendations;

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    items.forEach((i) => { const k = priorityKey(i.priority); if (c[k] != null) c[k]++; });
    return c;
  }, [items]);

  const filtered = filter ? items.filter((i) => priorityKey(i.priority) === filter) : items;
  const visible = expanded ? filtered : filtered.slice(0, VISIBLE_LIMIT);
  const hasMore = filtered.length > VISIBLE_LIMIT;

  const filterLabel = filter ? `${PRIORITY[filter].label} Priority` : 'Recommendation';
  const summaryText = hasMore
    ? `Showing ${visible.length} of ${filtered.length} ${filterLabel} Items`
    : `Showing ${filtered.length} ${filterLabel} Items`;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Today's Focus — priority filters */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Today&rsquo;s Focus</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ORDER.map((key) => {
            const p = PRIORITY[key];
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(active ? null : key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
              >
                <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                {p.label}
                <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-primary-foreground/20' : 'bg-muted'}`}>{counts[key]}</span>
              </button>
            );
          })}
        </div>
        {filter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              Showing: {PRIORITY[filter].label} Priority
            </span>
            <button type="button" onClick={() => setFilter(null)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <X className="h-3 w-3" /> Clear Filter
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <EmptyState
            icon={CheckCircle2}
            title="Everything looks great!"
            description="There are no open stewardship recommendations right now."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <EmptyState
            icon={CheckCircle2}
            title={`No ${PRIORITY[filter].label} Priority recommendations right now.`}
            description="Try viewing all recommendations to see other ministry work."
            actionLabel="View All"
            onAction={() => setFilter(null)}
          />
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-muted-foreground">{summaryText}</p>
          <motion.div layout className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {visible.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} onSelect={onSelect} onDismiss={onDismiss} />
              ))}
            </AnimatePresence>
          </motion.div>
          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex items-center gap-1 rounded-lg border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
              >
                {expanded ? 'Show Fewer' : `View All (${filtered.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}