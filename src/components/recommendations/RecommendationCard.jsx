import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronDown, HelpCircle, Ban } from 'lucide-react';

const PRIORITY = {
  Critical: { bar: 'bg-red-500', tone: 'bg-red-100 text-red-700' },
  High: { bar: 'bg-orange-500', tone: 'bg-orange-100 text-orange-700' },
  Medium: { bar: 'bg-amber-500', tone: 'bg-amber-100 text-amber-700' },
  Low: { bar: 'bg-slate-400', tone: 'bg-slate-100 text-slate-600' },
};

// Explainable recommendation card. Always includes a "Why?" section that lists
// exactly which rule generated it — never a generic message.
export default function RecommendationCard({ rec, onSelect, onDismiss }) {
  const [showWhy, setShowWhy] = useState(false);
  const p = PRIORITY[rec.priority] || PRIORITY.Medium;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.2 }}
      className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-start"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${p.bar}`} />
      <div className="flex flex-1 items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${p.tone}`}>
          <HelpCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.tone}`}>{rec.priority}</span>
            <span className="text-xs text-muted-foreground">{rec.daysActive}d active</span>
            {rec.status !== 'Open' && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{rec.status}</span>
            )}
          </div>
          <p className="mt-1 text-base font-semibold text-foreground">{rec.type}</p>
          <p className="text-xs font-medium text-muted-foreground">{rec.championName}{rec.teamName && rec.teamName !== '—' ? ` · ${rec.teamName}` : ''}</p>
          <button
            type="button"
            onClick={() => setShowWhy((s) => !s)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {showWhy ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Why?
          </button>
          {showWhy && (
            <ul className="mt-1 space-y-0.5 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              {rec.why.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
        {onDismiss && rec.status === 'Open' && (
          <button
            type="button"
            onClick={() => onDismiss(rec.id)}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <Ban className="h-3.5 w-3.5" /> Dismiss
          </button>
        )}
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(rec)}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            Details
          </button>
        )}
        <Link
          to={rec.navTarget}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {rec.suggestedAction} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}