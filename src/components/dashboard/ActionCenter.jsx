import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { buildActionItems } from '@/lib/actionCenter';

const VISIBLE_LIMIT = 10;

const PRIORITY = {
  critical: { bar: 'bg-red-500', tone: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'Critical' },
  high: { bar: 'bg-orange-500', tone: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'High' },
  medium: { bar: 'bg-blue-500', tone: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'Medium' },
  informational: { bar: 'bg-slate-400', tone: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', label: 'Info' },
};
const ORDER = ['critical', 'high', 'medium', 'informational'];

function waitingLabel(ms) {
  if (!ms) return 'Today';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `Waiting ${days} days`;
}

function ActionCard({ item }) {
  const Icon = item.icon;
  const p = PRIORITY[item.priority] || PRIORITY.informational;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.2 }}
      className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${p.bar}`} />
      <div className="flex items-start gap-3 sm:flex-1">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${p.tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.tone}`}>{p.label}</span>
          </div>
          <p className="mt-1 text-base font-semibold text-foreground">{item.title}</p>
          {item.subject && <p className="text-xs font-medium text-muted-foreground">{item.subject}</p>}
          <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">{waitingLabel(item.detected)}</p>
        </div>
      </div>
      <Link
        to={item.href}
        className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:mt-0 sm:w-auto"
      >
        {item.actionLabel}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}

export default function ActionCenter({
  households, assignments, teams, activities, teamMembers,
  title = 'Action Center', subtitle = 'Prioritized ministry opportunities that may need your attention.',
}) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState(null);

  const items = useMemo(
    () => buildActionItems({ households, assignments, teams, activities, teamMembers }),
    [households, assignments, teams, activities, teamMembers]
  );

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, informational: 0 };
    items.forEach((i) => { c[i.priority] = (c[i.priority] || 0) + 1; });
    return c;
  }, [items]);

  const filtered = filter ? items.filter((i) => i.priority === filter) : items;
  const visible = expanded ? filtered : filtered.slice(0, VISIBLE_LIMIT);
  const hasMore = filtered.length > VISIBLE_LIMIT;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Today's Focus */}
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
            description="Your ministry is currently operating without any outstanding action items."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <EmptyState
            icon={CheckCircle2}
            title={`No ${PRIORITY[filter].label} Priority items currently require attention.`}
            description="Try viewing all actions to see other ministry work."
            actionLabel="View All Actions"
            onAction={() => setFilter(null)}
          />
        </div>
      ) : (
        <>
          <motion.div layout className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {visible.map((item) => (
                <ActionCard key={item.entityKey} item={item} />
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
                {expanded ? 'Show Fewer' : `View All Actions (${filtered.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}