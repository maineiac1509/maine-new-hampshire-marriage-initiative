import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Standard metric card: title, current value, delta vs previous period, short
// explanation, and drill-down navigation. The whole card is a Link when a
// drillTarget is supplied so every metric remains navigable.
export default function MetricCard({ title, value, unit, delta, positiveIsGood, explanation, drillTarget, icon: Icon }) {
  const hasDelta = delta != null && delta !== 0;
  const up = (delta || 0) > 0;
  const good = hasDelta ? (up ? positiveIsGood : !positiveIsGood) : true;
  const TrendIcon = up ? TrendingUp : TrendingDown;
  const cls = 'group block h-full rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40';
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />}{title}
        </span>
        {hasDelta && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold', good ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
            <TrendIcon className="h-3 w-3" />{up ? '+' : ''}{delta}{unit === '%' ? 'pp' : ''}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-foreground">{value ?? '—'}</span>
        {unit && unit !== '%' && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {explanation && <p className="mt-1 text-xs leading-snug text-muted-foreground">{explanation}</p>}
      {drillTarget && (
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Drill in <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </>
  );
  if (!drillTarget) return <div className={cls}>{inner}</div>;
  return <Link to={drillTarget} className={cls}>{inner}</Link>;
}