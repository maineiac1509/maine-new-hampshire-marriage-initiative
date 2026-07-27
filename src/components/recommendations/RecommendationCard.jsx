import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronDown, Ban, ArrowRight } from 'lucide-react';
import { relativeDate } from '@/lib/recommendationEngine';
import { cn } from '@/lib/utils';

const PRIORITY = {
  Critical: { bar: 'bg-red-500', tone: 'bg-red-100 text-red-700' },
  High: { bar: 'bg-orange-500', tone: 'bg-orange-100 text-orange-700' },
  Medium: { bar: 'bg-amber-500', tone: 'bg-amber-100 text-amber-700' },
  Low: { bar: 'bg-slate-400', tone: 'bg-slate-100 text-slate-600' },
};

function ContextField({ label, value }) {
  if (!value || value === '—') return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium text-foreground">{value}</dd>
    </div>
  );
}

// Explainable, information-dense recommendation card. Priority order:
// Priority → Title → Champion → Context (Team/Volunteer/Activity/Health) →
// Suggested Action → Why → Actions. Memoized for responsive list rendering.
function RecommendationCard({ rec, onSelect, onDismiss }) {
  const [showWhy, setShowWhy] = useState(false);
  const p = PRIORITY[rec.priority] || PRIORITY.Medium;
  const last = relativeDate(rec.lastActivityDate);

  const contextFields = [
    { label: 'Volunteer Team', value: rec.teamName },
    { label: 'Assigned Volunteer', value: rec.assignedVolunteer },
    { label: 'Last Activity', value: last ? last.label : null },
    { label: 'Health', value: rec.healthLabel },
  ].filter((f) => f.value && f.value !== '—');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', p.bar)} />
      <div className="pl-2">
        {/* Priority + meta */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', p.tone)}>{rec.priority}</span>
          <span className="text-xs text-muted-foreground">{rec.daysActive}d active</span>
          {rec.status !== 'Open' && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{rec.status}</span>
          )}
        </div>

        {/* Title — primary focal point */}
        <h3 className="mt-1.5 text-base font-semibold text-foreground">{rec.type}</h3>

        {/* Champion */}
        {rec.championName && rec.championName !== 'Champion' && (
          <p className="mt-0.5 text-sm text-muted-foreground">{rec.championName}</p>
        )}

        {/* Supporting context — only meaningful values */}
        {contextFields.length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {contextFields.map((f) => <ContextField key={f.label} label={f.label} value={f.value} />)}
          </dl>
        )}

        {/* Suggested action — visible but not overpowering */}
        <div className="mt-2 flex items-start gap-1.5 text-sm">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-foreground"><span className="text-muted-foreground">Next: </span>{rec.suggestedAction}</span>
        </div>

        {/* Why — scannable bullets, each on its own line */}
        <button
          type="button"
          onClick={() => setShowWhy((s) => !s)}
          aria-expanded={showWhy}
          aria-label={showWhy ? 'Hide reasons for this recommendation' : 'Show reasons for this recommendation'}
          className="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {showWhy ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Why?
        </button>
        {showWhy && (
          <div className="mt-1.5 rounded-md bg-muted/50 p-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Why this recommendation exists</p>
            <ul className="space-y-1">
              {rec.why.map((w, i) => (
                <li key={i} className="text-xs text-foreground">• {w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {onDismiss && rec.status === 'Open' && (
            <button
              type="button"
              onClick={() => onDismiss(rec.id)}
              aria-label="Dismiss recommendation"
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Ban className="h-3.5 w-3.5" /> Dismiss
            </button>
          )}
          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(rec)}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Details
            </button>
          )}
          <Link
            to={rec.navTarget}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default React.memo(RecommendationCard);