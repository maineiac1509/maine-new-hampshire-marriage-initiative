import React from 'react';
import { ClipboardList, AlertCircle, ArrowUp, ArrowDown, CheckCircle2, BellOff, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const METRICS = [
  { key: 'open', label: 'Open Recommendations', icon: ClipboardList, tone: 'bg-blue-100 text-blue-700' },
  { key: 'critical', label: 'Critical', icon: AlertCircle, tone: 'bg-red-100 text-red-700' },
  { key: 'high', label: 'High', icon: ArrowUp, tone: 'bg-orange-100 text-orange-700' },
  { key: 'medium', label: 'Medium', icon: ArrowDown, tone: 'bg-amber-100 text-amber-700' },
  { key: 'low', label: 'Low', icon: CheckCircle2, tone: 'bg-slate-100 text-slate-600' },
  { key: 'dismissedToday', label: 'Dismissed Today', icon: BellOff, tone: 'bg-slate-100 text-slate-600' },
  { key: 'completedToday', label: 'Completed Today', icon: CheckCheck, tone: 'bg-emerald-100 text-emerald-700' },
];

// Dashboard widget summarizing the recommendation engine output. Every metric is
// drillable — Open/priority metrics filter the in-page Action Center, while
// Dismissed/Completed Today navigate to the full recommendations history.
export default function RecommendationSummary({ summary = {}, onDrill }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Recommendation Summary</h2>
        <p className="text-sm text-muted-foreground">Transparent, rule-based ministry opportunities.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const handler = onDrill?.[m.key];
          const Tag = handler ? 'button' : 'div';
          return (
            <Tag
              key={m.key}
              type={handler ? 'button' : undefined}
              onClick={handler}
              aria-label={handler ? `Filter by ${m.label}` : undefined}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                handler && 'cursor-pointer hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
              )}
            >
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', m.tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary[m.key] ?? 0}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </Tag>
          );
        })}
      </div>
    </section>
  );
}